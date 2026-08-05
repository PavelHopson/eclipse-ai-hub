import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import { verifyBuilderFilesArtifact } from './builder-verifier.mjs';

const DIRECTORY = dirname(fileURLToPath(import.meta.url));
const auditInput = readFileSync(resolve(DIRECTORY, '../security/builder-audit/package.json'), 'utf8');
const auditInputSha256 = createHash('sha256').update(auditInput).digest('hex');

const definitions = [
  ['index.html', 'text/html', '<!doctype html>\n<html lang="ru"><body><div id="root"></div><script type="module" src="/src/main.tsx"></script></body></html>\n'],
  ['package.json', 'application/json', `${JSON.stringify({
    name: 'eclipse-dashboard-app',
    private: true,
    version: '0.1.0',
    type: 'module',
    scripts: { dev: 'vite', typecheck: 'tsc --noEmit', build: 'tsc --noEmit && vite build' },
    dependencies: { react: '19.2.4', 'react-dom': '19.2.4' },
    devDependencies: {
      '@types/react': '19.2.14',
      '@types/react-dom': '19.2.3',
      '@vitejs/plugin-react': '5.2.0',
      typescript: '5.8.3',
      vite: '6.4.2',
    },
  })}\n`],
  ['README.md', 'text/markdown', '# Review me\n'],
  ['src/App.tsx', 'text/typescript', "import React from 'react';\nexport default function App(){return <main>Safe</main>}\n"],
  ['src/main.tsx', 'text/typescript', "import React from 'react';\nimport { createRoot } from 'react-dom/client';\nimport App from './App';\nimport './styles.css';\ncreateRoot(document.getElementById('root')).render(<React.StrictMode><App /></React.StrictMode>);\n"],
  ['src/styles.css', 'text/css', ':root{color:#111}\n'],
  ['tsconfig.json', 'application/json', '{"compilerOptions":{"strict":true}}\n'],
  ['vite.config.ts', 'text/typescript', "import { defineConfig } from 'vite';\nimport react from '@vitejs/plugin-react';\nexport default defineConfig({plugins:[react()]});\n"],
];

function validArtifact() {
  return {
    schemaVersion: 'builder.files.v1',
    id: 'builder-test-files-v1',
    projectId: 'builder-test',
    sourceUpdatedAt: '2026-08-05T10:00:00.000Z',
    generatedAt: '2026-08-05T10:05:00.000Z',
    renderer: 'eclipse-react-vite-v1',
    reviewStatus: 'unreviewed',
    files: definitions.map(([path, mediaType, content]) => ({ path, mediaType, content, sizeBytes: Buffer.byteLength(content, 'utf8') })),
    policy: {
      filesWritten: false,
      dependenciesInstalled: false,
      generatedCodeExecuted: false,
      networkAccess: false,
      githubConnected: false,
      deployed: false,
    },
  };
}

function updateFile(artifact, path, content) {
  const file = artifact.files.find((candidate) => candidate.path === path);
  file.content = content;
  file.sizeBytes = Buffer.byteLength(content, 'utf8');
}

function verifiedSnapshot(overrides = {}) {
  return {
    schemaVersion: 'builder.advisory-snapshot.v1',
    status: 'verified',
    source: 'npm-audit',
    auditedAt: '2026-08-05T10:00:00.000Z',
    expiresAt: '2026-08-12T10:00:00.000Z',
    auditInputSha256,
    summary: { info: 0, low: 0, moderate: 0, high: 0, critical: 0, total: 0 },
    ...overrides,
  };
}

describe('Builder offline verifier', () => {
  it('inventories exact direct dependencies and performs a static-only preview', () => {
    const report = verifyBuilderFilesArtifact(validArtifact(), {
      now: new Date('2026-08-06T10:00:00.000Z'),
      snapshot: verifiedSnapshot(),
      auditInput,
    });
    assert.equal(report.result, 'review-required');
    assert.equal(report.components.length, 7);
    assert.equal(report.components.every((component) => component.direct && component.license !== 'UNKNOWN'), true);
    assert.equal(report.advisory.status, 'no-known-advisories-at-snapshot');
    assert.deepEqual(report.preview, {
      mode: 'static-parse-only',
      filesInspected: 8,
      outputProduced: false,
      dependenciesInstalled: false,
      generatedCodeExecuted: false,
      networkAccess: false,
      deployed: false,
    });
  });

  it('reports unavailable and expired advisory evidence as warnings', () => {
    const unavailable = verifyBuilderFilesArtifact(validArtifact(), { now: new Date('2026-08-06T10:00:00.000Z') });
    assert.equal(unavailable.result, 'review-required');
    assert.equal(unavailable.advisory.status, 'not-verified');
    assert.equal(unavailable.findings.some((finding) => finding.severity === 'warning'), true);

    const expired = verifyBuilderFilesArtifact(validArtifact(), {
      now: new Date('2026-08-13T10:00:00.000Z'),
      snapshot: verifiedSnapshot(),
      auditInput,
    });
    assert.equal(expired.advisory.status, 'expired');
    assert.equal(expired.result, 'review-required');
  });

  it('blocks network APIs, dynamic execution and non-allowlisted imports', () => {
    const artifact = validArtifact();
    updateFile(artifact, 'src/App.tsx', "import React from 'react';\nimport secret from 'unexpected';\nfetch('/collect');\nnew WebSocket('wss://example.test');\nexport default function App(){return <main dangerouslySetInnerHTML={{__html:secret}}/>}\n");
    const report = verifyBuilderFilesArtifact(artifact, { snapshot: verifiedSnapshot(), auditInput });
    assert.equal(report.result, 'blocked');
    assert.deepEqual(
      new Set(report.findings.filter((finding) => finding.severity === 'block').map((finding) => finding.code)),
      new Set(['unexpected-import', 'active-api', 'active-constructor', 'unsafe-html']),
    );
  });

  it('blocks active HTML, external CSS and syntax errors without executing them', () => {
    const artifact = validArtifact();
    updateFile(artifact, 'index.html', '<body onload="steal()"><iframe src="https://example.test"></iframe><script>alert(1)</script></body>');
    updateFile(artifact, 'src/styles.css', '@import "https://example.test/style.css";\n.hero{background:url(https://example.test/a.png)}');
    updateFile(artifact, 'src/App.tsx', "import React from 'react';\nexport default function App( {\n");
    const report = verifyBuilderFilesArtifact(artifact, { snapshot: verifiedSnapshot(), auditInput });
    assert.equal(report.result, 'blocked');
    const codes = new Set(report.findings.map((finding) => finding.code));
    assert.equal(codes.has('active-html'), true);
    assert.equal(codes.has('embedded-content'), true);
    assert.equal(codes.has('external-css'), true);
    assert.equal(codes.has('syntax-error'), true);
  });

  it('blocks a verified snapshot when the reviewed lockfile is missing', () => {
    const report = verifyBuilderFilesArtifact(validArtifact(), { snapshot: verifiedSnapshot(), auditInput: null });
    assert.equal(report.result, 'blocked');
    assert.equal(report.advisory.status, 'missing-lock');
  });

  it('rejects malformed advisory dates and inconsistent severity totals', () => {
    assert.throws(
      () => verifyBuilderFilesArtifact(validArtifact(), {
        snapshot: verifiedSnapshot({ expiresAt: 'not-a-date' }),
        auditInput,
      }),
      /expiresAt is invalid/,
    );
    assert.throws(
      () => verifyBuilderFilesArtifact(validArtifact(), {
        snapshot: verifiedSnapshot({ summary: { info: 0, low: 0, moderate: 1, high: 0, critical: 0, total: 0 } }),
        auditInput,
      }),
      /summary is invalid/,
    );
  });

  it('blocks a snapshot that belongs to another audit input or records advisories', () => {
    const mismatch = verifyBuilderFilesArtifact(validArtifact(), {
      snapshot: verifiedSnapshot({ auditInputSha256: '0'.repeat(64) }),
      auditInput,
    });
    assert.equal(mismatch.result, 'blocked');
    assert.equal(mismatch.advisory.status, 'mismatch');

    const vulnerable = verifyBuilderFilesArtifact(validArtifact(), {
      snapshot: verifiedSnapshot({ summary: { info: 0, low: 0, moderate: 1, high: 0, critical: 0, total: 1 } }),
      auditInput,
    });
    assert.equal(vulnerable.result, 'blocked');
    assert.equal(vulnerable.advisory.status, 'known-advisories');
  });
});
