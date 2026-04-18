"""
Eclipse AI Hub — LightRAG backend
Graph-based RAG with minimal hallucinations via LightRAG library.

Run:
  pip install -r requirements.txt
  uvicorn main:app --host 0.0.0.0 --port 8801 --reload
"""
from __future__ import annotations

import asyncio
import json
import logging
import os
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

# LightRAG is optional — if not installed, the backend still boots in
# "degraded" mode and returns clear errors on ingest/query so the frontend
# fallback kicks in.
try:
    from lightrag import LightRAG, QueryParam  # type: ignore
    from lightrag.llm.openai import gpt_4o_mini_complete, openai_embed  # type: ignore

    LIGHTRAG_AVAILABLE = True
except Exception:  # pragma: no cover — ImportError or runtime init errors
    LIGHTRAG_AVAILABLE = False
    LightRAG = None  # type: ignore
    QueryParam = None  # type: ignore

logging.basicConfig(
    level=os.getenv("LOG_LEVEL", "INFO"),
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("eclipse-rag")

WORKSPACE = Path(os.getenv("LIGHTRAG_WORKSPACE", "./workspace")).resolve()
WORKSPACE.mkdir(parents=True, exist_ok=True)

DOC_REGISTRY = WORKSPACE / "doc_registry.json"
MODEL_NAME = os.getenv("LIGHTRAG_MODEL", "gpt-4o-mini")

# In-memory lock so concurrent /ingest calls do not corrupt the graph.
_graph_lock = asyncio.Lock()
_rag_instance: Optional["LightRAG"] = None


def _load_registry() -> Dict[str, Dict[str, Any]]:
    if not DOC_REGISTRY.exists():
        return {}
    try:
        return json.loads(DOC_REGISTRY.read_text(encoding="utf-8"))
    except Exception as exc:
        logger.warning("Failed to read doc registry: %s", exc)
        return {}


def _save_registry(registry: Dict[str, Dict[str, Any]]) -> None:
    DOC_REGISTRY.write_text(json.dumps(registry, ensure_ascii=False, indent=2), encoding="utf-8")


async def _get_rag() -> "LightRAG":
    global _rag_instance
    if not LIGHTRAG_AVAILABLE:
        raise HTTPException(
            status_code=503,
            detail="LightRAG library is not installed on the backend. "
                   "Install `lightrag-hku` or run the frontend fallback.",
        )
    if _rag_instance is None:
        logger.info("Initializing LightRAG in %s with model=%s", WORKSPACE, MODEL_NAME)
        _rag_instance = LightRAG(
            working_dir=str(WORKSPACE),
            llm_model_func=gpt_4o_mini_complete,
            embedding_func=openai_embed,
        )
        # Newer LightRAG versions expose async initializers.
        if hasattr(_rag_instance, "initialize_storages"):
            await _rag_instance.initialize_storages()
    return _rag_instance


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Eclipse RAG backend starting (LightRAG=%s)", LIGHTRAG_AVAILABLE)
    try:
        if LIGHTRAG_AVAILABLE and os.getenv("OPENAI_API_KEY"):
            await _get_rag()
    except Exception as exc:  # pragma: no cover — surface init issues on /health
        logger.error("LightRAG init deferred: %s", exc)
    yield
    logger.info("Eclipse RAG backend stopping")


app = FastAPI(title="Eclipse AI Hub — LightRAG", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=os.getenv("CORS_ORIGINS", "*").split(","),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class IngestRequest(BaseModel):
    doc_id: str = Field(..., min_length=1, description="Stable document identifier")
    content: str = Field(..., min_length=1, description="Raw document text")
    name: Optional[str] = Field(default=None, description="Human-readable file name")


class IngestResponse(BaseModel):
    ok: bool
    doc_id: str
    chars: int
    ingested_at: str


class QueryRequest(BaseModel):
    question: str = Field(..., min_length=1)
    mode: str = Field(default="hybrid", description="naive | local | global | hybrid | mix")
    top_k: int = Field(default=5, ge=1, le=50)


class Citation(BaseModel):
    doc_id: str
    snippet: str


class QueryResponse(BaseModel):
    answer: str
    citations: List[Citation] = []
    chunks: List[str] = []
    mode: str
    model: str


class DocInfo(BaseModel):
    doc_id: str
    name: Optional[str]
    chars: int
    ingested_at: str


@app.get("/health")
async def health() -> Dict[str, Any]:
    registry = _load_registry()
    return {
        "status": "ok" if LIGHTRAG_AVAILABLE else "degraded",
        "lightrag_available": LIGHTRAG_AVAILABLE,
        "doc_count": len(registry),
        "model": MODEL_NAME,
        "workspace": str(WORKSPACE),
    }


@app.post("/ingest", response_model=IngestResponse)
async def ingest(req: IngestRequest) -> IngestResponse:
    rag = await _get_rag()
    async with _graph_lock:
        try:
            # LightRAG exposes `ainsert` (async). Older versions also have `insert`.
            if hasattr(rag, "ainsert"):
                await rag.ainsert(req.content, ids=[req.doc_id])
            else:
                rag.insert(req.content, ids=[req.doc_id])  # type: ignore[attr-defined]
        except TypeError:
            # Fallback for LightRAG builds that do not accept `ids=`.
            if hasattr(rag, "ainsert"):
                await rag.ainsert(req.content)
            else:
                rag.insert(req.content)  # type: ignore[attr-defined]
        except Exception as exc:
            logger.exception("Ingest failed for doc_id=%s", req.doc_id)
            raise HTTPException(status_code=500, detail=f"Ingest failed: {exc}") from exc

        registry = _load_registry()
        registry[req.doc_id] = {
            "doc_id": req.doc_id,
            "name": req.name,
            "chars": len(req.content),
            "ingested_at": datetime.now(timezone.utc).isoformat(),
        }
        _save_registry(registry)

    return IngestResponse(
        ok=True,
        doc_id=req.doc_id,
        chars=len(req.content),
        ingested_at=registry[req.doc_id]["ingested_at"],
    )


@app.post("/query", response_model=QueryResponse)
async def query(req: QueryRequest) -> QueryResponse:
    rag = await _get_rag()
    param = QueryParam(mode=req.mode, top_k=req.top_k) if QueryParam else None
    try:
        if hasattr(rag, "aquery"):
            result = await rag.aquery(req.question, param=param)
        else:
            result = rag.query(req.question, param=param)  # type: ignore[attr-defined]
    except Exception as exc:
        logger.exception("Query failed")
        raise HTTPException(status_code=500, detail=f"Query failed: {exc}") from exc

    # Normalize LightRAG output: sometimes it's a plain string, sometimes a dict.
    if isinstance(result, dict):
        answer = str(result.get("response") or result.get("answer") or "")
        raw_chunks = result.get("chunks") or result.get("context") or []
        chunks = [c if isinstance(c, str) else json.dumps(c, ensure_ascii=False) for c in raw_chunks][: req.top_k]
    else:
        answer = str(result)
        chunks = []

    citations = [Citation(doc_id="graph", snippet=c[:500]) for c in chunks]

    return QueryResponse(answer=answer, citations=citations, chunks=chunks, mode=req.mode, model=MODEL_NAME)


@app.get("/docs", response_model=List[DocInfo])
async def list_docs() -> List[DocInfo]:
    registry = _load_registry()
    return [DocInfo(**info) for info in registry.values()]


@app.delete("/docs/{doc_id}")
async def delete_doc(doc_id: str) -> Dict[str, Any]:
    registry = _load_registry()
    if doc_id not in registry:
        raise HTTPException(status_code=404, detail=f"doc_id={doc_id} not found")

    if LIGHTRAG_AVAILABLE:
        rag = await _get_rag()
        try:
            if hasattr(rag, "adelete_by_doc_id"):
                await rag.adelete_by_doc_id(doc_id)
            elif hasattr(rag, "delete_by_doc_id"):
                rag.delete_by_doc_id(doc_id)  # type: ignore[attr-defined]
        except Exception as exc:  # pragma: no cover — registry is source of truth
            logger.warning("LightRAG delete failed for %s: %s", doc_id, exc)

    del registry[doc_id]
    _save_registry(registry)
    return {"ok": True, "doc_id": doc_id}
