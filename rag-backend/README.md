# Eclipse AI Hub — LightRAG backend

Python/FastAPI service that wraps [LightRAG](https://github.com/HKUDS/LightRAG)
(graph-based RAG with minimal hallucinations) and exposes it to the
`eclipse-ai-hub` frontend over HTTP.

If this service is not running, the frontend automatically falls back to the
in-browser keyword-based RAG implementation. Starting the backend is purely an
upgrade path — nothing breaks when it is offline.

## Run with Docker Compose (recommended)

```bash
cd E:/projects/eclipse-ai-hub/rag-backend

# One-time: create an .env with your OpenAI key (used by LightRAG for LLM + embeddings)
cat > .env <<'EOF'
OPENAI_API_KEY=sk-...
LIGHTRAG_MODEL=gpt-4o-mini
EOF

docker compose up --build
```

The API is now available at `http://localhost:8801`. Graph data persists in
`./workspace`.

## Run without Docker (local Python)

```bash
cd E:/projects/eclipse-ai-hub/rag-backend
python -m venv .venv
source .venv/bin/activate           # on Windows: .venv\Scripts\activate
pip install -r requirements.txt

export OPENAI_API_KEY=sk-...
export LIGHTRAG_MODEL=gpt-4o-mini

uvicorn main:app --host 0.0.0.0 --port 8801 --reload
```

## API

| Method | Path              | Purpose                                          |
|--------|-------------------|--------------------------------------------------|
| GET    | `/health`         | Liveness + `{status, doc_count, model}`          |
| POST   | `/ingest`         | Add a document to the LightRAG graph             |
| POST   | `/query`          | Ask a question, get answer + citations + chunks  |
| GET    | `/docs`           | List ingested documents                          |
| DELETE | `/docs/{doc_id}`  | Remove a document from the graph and registry   |

### curl examples

```bash
# Health
curl -s http://localhost:8801/health | jq

# Ingest
curl -s -X POST http://localhost:8801/ingest \
  -H 'Content-Type: application/json' \
  -d '{"doc_id":"readme","name":"README.md","content":"LightRAG is a graph-based RAG..."}'

# Query
curl -s -X POST http://localhost:8801/query \
  -H 'Content-Type: application/json' \
  -d '{"question":"What is LightRAG?","mode":"hybrid","top_k":5}'

# List docs
curl -s http://localhost:8801/docs | jq

# Delete
curl -s -X DELETE http://localhost:8801/docs/readme
```

## Frontend integration

The frontend reads the backend URL from `VITE_RAG_BACKEND_URL` (default
`http://localhost:8801`). The `ragService.ts` module tries the backend first,
then falls back to the local in-browser implementation.

```bash
# in eclipse-ai-hub/.env.local
VITE_RAG_BACKEND_URL=http://localhost:8801
```

Check the status badge on the RAG page:

- Green "Backend connected" — queries go through LightRAG graph
- Yellow "Local mode" — backend is unreachable, using in-browser fallback

## Notes

- `workspace/` is git-ignored by default (add `rag-backend/workspace/` to your
  `.gitignore` if not already covered). It contains the LightRAG graph,
  vector index, and the `doc_registry.json` metadata file.
- The backend boots in **degraded mode** if `lightrag-hku` is not importable —
  `/health` will return `status=degraded` and the frontend will keep using the
  fallback. This is intentional: Docker builds may fail in locked-down
  networks, and the server should still respond.
- To use a provider other than OpenAI (e.g. DeepSeek, Ollama), swap the
  `llm_model_func` / `embedding_func` in `main.py::_get_rag` — LightRAG ships
  adapters for all major providers.
