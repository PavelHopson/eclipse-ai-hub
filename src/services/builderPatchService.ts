import type { BuilderFile } from './builderFileRenderer';
import type { BuilderDelivery } from './builderDeliveryService';

export const BUILDER_PATCH_SCHEMA = 'builder.patch.v1' as const;

export interface BuilderPatchArtifact {
  schemaVersion: typeof BUILDER_PATCH_SCHEMA;
  id: string;
  deliveryId: string;
  projectId: string;
  sourceArtifactId: string;
  checkpointId: string;
  sourceFingerprint: string;
  targetBranch: string;
  generatedAt: string;
  patchFingerprint: string;
  files: Array<{ path: string; sizeBytes: number }>;
  patch: string;
  policy: {
    filesWritten: false;
    githubConnected: false;
    branchVerified: false;
    patchApplied: false;
    humanReviewRequired: true;
  };
}

const SAFE_PATH = /^(?:[A-Za-z0-9_.-]+\/)*[A-Za-z0-9_.-]+$/;
const SAFE_BRANCH = /^(?![./])(?!.*(?:\.\.|\s|[~^:?*\[\\]))[A-Za-z0-9][A-Za-z0-9._/-]{0,119}$/;
const MAX_FILES = 24;
const MAX_FILE_BYTES = 64 * 1024;
const MAX_ARTIFACT_BYTES = 128 * 1024;
const MAX_PATCH_BYTES = 256 * 1024;

function hasUnsafeInvisible(value: string): boolean {
  for (const character of value) {
    const codePoint = character.codePointAt(0) ?? 0;
    if (codePoint === 0 || (codePoint >= 0x202a && codePoint <= 0x202e) || (codePoint >= 0x2066 && codePoint <= 0x2069)) {
      return true;
    }
  }
  return false;
}

function fingerprint(value: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return `fnv1a32:${(hash >>> 0).toString(16).padStart(8, '0')}`;
}

function validateFiles(files: BuilderFile[]): BuilderFile[] {
  if (!files.length || files.length > MAX_FILES) throw new Error('Patch содержит недопустимое число файлов');
  const seen = new Set<string>();
  let totalBytes = 0;
  const validated = files.map((file) => {
    if (!SAFE_PATH.test(file.path) || file.path.includes('..') || seen.has(file.path)) {
      throw new Error(`Небезопасный или повторяющийся путь: ${file.path}`);
    }
    if (hasUnsafeInvisible(file.path) || hasUnsafeInvisible(file.content)) {
      throw new Error(`Файл содержит невидимые управляющие символы: ${file.path}`);
    }
    const normalizedContent = file.content.replace(/\r\n?/g, '\n');
    const sizeBytes = new TextEncoder().encode(normalizedContent).byteLength;
    if (sizeBytes !== file.sizeBytes || sizeBytes <= 0 || sizeBytes > MAX_FILE_BYTES) {
      throw new Error(`Размер файла не совпадает с artifact: ${file.path}`);
    }
    seen.add(file.path);
    totalBytes += sizeBytes;
    return { ...file, content: normalizedContent };
  });
  if (totalBytes > MAX_ARTIFACT_BYTES) throw new Error('Patch превышает лимит artifact 128 КБ');
  return validated.sort((left, right) => left.path.localeCompare(right.path));
}

function addedFileDiff(file: BuilderFile): string {
  const endsWithNewline = file.content.endsWith('\n');
  const lines = file.content.split('\n');
  if (endsWithNewline) lines.pop();
  if (!lines.length) throw new Error(`Пустой файл нельзя экспортировать: ${file.path}`);
  const body = lines.map((line) => `+${line}`).join('\n');
  const newlineMarker = endsWithNewline ? '' : '\n\\ No newline at end of file';
  return [
    `diff --git a/${file.path} b/${file.path}`,
    'new file mode 100644',
    '--- /dev/null',
    `+++ b/${file.path}`,
    `@@ -0,0 +1,${lines.length} @@`,
    `${body}${newlineMarker}`,
  ].join('\n');
}

export function buildBuilderPatch(delivery: BuilderDelivery, now = new Date()): BuilderPatchArtifact {
  if (delivery.schemaVersion !== 'builder.delivery.v1' || delivery.stage !== 'handoff_prepared' || !delivery.handoff) {
    throw new Error('Сначала подготовьте handoff для существующей ветки');
  }
  if (!delivery.checks.every((check) => check.status === 'passed')) {
    throw new Error('Patch доступен только после всех проверок');
  }
  const branch = delivery.handoff.targetBranch;
  if (!SAFE_BRANCH.test(branch) || branch.endsWith('/') || branch.endsWith('.lock')) {
    throw new Error('Целевая ветка содержит недопустимые символы');
  }
  const checkpoint = delivery.checkpoints.find((item) => item.id === delivery.currentCheckpointId);
  if (!checkpoint || checkpoint.artifact.id !== delivery.sourceArtifactId || checkpoint.artifact.projectId !== delivery.projectId) {
    throw new Error('Текущий checkpoint не совпадает с исходным artifact');
  }
  const files = validateFiles(checkpoint.artifact.files);
  const patch = `${files.map(addedFileDiff).join('\n')}\n`;
  if (new TextEncoder().encode(patch).byteLength > MAX_PATCH_BYTES) throw new Error('Patch превышает лимит 256 КБ');
  return {
    schemaVersion: BUILDER_PATCH_SCHEMA,
    id: `${delivery.id}-patch-v1`,
    deliveryId: delivery.id,
    projectId: delivery.projectId,
    sourceArtifactId: delivery.sourceArtifactId,
    checkpointId: checkpoint.id,
    sourceFingerprint: checkpoint.fingerprint,
    targetBranch: branch,
    generatedAt: now.toISOString(),
    patchFingerprint: fingerprint(patch),
    files: files.map(({ path, sizeBytes }) => ({ path, sizeBytes })),
    patch,
    policy: {
      filesWritten: false,
      githubConnected: false,
      branchVerified: false,
      patchApplied: false,
      humanReviewRequired: true,
    },
  };
}

export function markBuilderPatchExported(
  delivery: BuilderDelivery,
  artifact: BuilderPatchArtifact,
  now = new Date(),
): BuilderDelivery {
  if (!delivery.handoff || delivery.stage !== 'handoff_prepared') throw new Error('Handoff больше не готов');
  if (
    artifact.schemaVersion !== BUILDER_PATCH_SCHEMA
    || artifact.deliveryId !== delivery.id
    || artifact.projectId !== delivery.projectId
    || artifact.sourceArtifactId !== delivery.sourceArtifactId
    || artifact.checkpointId !== delivery.currentCheckpointId
    || artifact.targetBranch !== delivery.handoff.targetBranch
    || artifact.patchFingerprint !== fingerprint(artifact.patch)
  ) {
    throw new Error('Patch не соответствует текущему handoff');
  }
  return {
    ...delivery,
    updatedAt: now.toISOString(),
    handoff: {
      ...delivery.handoff,
      patchExported: true,
      patchFingerprint: artifact.patchFingerprint,
      exportedAt: now.toISOString(),
    },
  };
}

export function serializeBuilderPatchArtifact(artifact: BuilderPatchArtifact): string {
  return JSON.stringify(artifact, null, 2);
}
