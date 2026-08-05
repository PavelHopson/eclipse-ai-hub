import type { BuilderProject } from './builderWorkflowService';

export interface BuilderFile {
  path: string;
  mediaType: 'application/json' | 'text/html' | 'text/markdown' | 'text/css' | 'text/typescript';
  content: string;
  sizeBytes: number;
}

export interface BuilderFilesArtifact {
  schemaVersion: 'builder.files.v1';
  id: string;
  projectId: string;
  sourceUpdatedAt: string;
  generatedAt: string;
  renderer: 'eclipse-react-vite-v1';
  reviewStatus: 'unreviewed';
  files: BuilderFile[];
  policy: {
    filesWritten: false;
    dependenciesInstalled: false;
    generatedCodeExecuted: false;
    networkAccess: false;
    githubConnected: false;
    deployed: false;
  };
}

const MAX_ARTIFACT_BYTES = 128 * 1024;
const MAX_FILE_BYTES = 64 * 1024;
const SAFE_PATH = /^(?:[A-Za-z0-9_.-]+\/)*[A-Za-z0-9_.-]+$/;

function jsonLiteral(value: unknown): string {
  return JSON.stringify(value)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}

function markdownText(value: string): string {
  return value
    .replace(/[<>]/g, '')
    .replace(/([\\`*_{}\[\]()#+.!|-])/g, '\\$1')
    .trim();
}

function appSource(project: BuilderProject): string {
  const product = {
    name: project.input.name,
    audience: project.input.audience,
    problem: project.input.problem,
    action: project.input.primaryAction,
    requirements: project.input.requirements,
    template: project.input.template,
    proofPoints: project.preview.proofPoints,
  };

  return `import React from 'react';

const product = ${jsonLiteral(product)} as const;

export default function App() {
  return (
    <div className={\`app-shell app-shell--\${product.template}\`}>
      <header className="app-header">
        <span className="brand-mark" aria-hidden="true" />
        <strong>{product.name}</strong>
      </header>
      <main>
        <section className="hero" aria-labelledby="product-title">
          <p className="eyebrow">Для кого: {product.audience}</p>
          <h1 id="product-title">{product.name}</h1>
          <p className="supporting-text">{product.problem}</p>
          <button type="button" className="primary-action">{product.action}</button>
        </section>
        <section className="proof-grid" aria-label="Ключевые свойства">
          {product.proofPoints.map((point) => <article key={point}>{point}</article>)}
        </section>
        {product.requirements.length > 0 && (
          <section className="requirements" aria-labelledby="requirements-title">
            <h2 id="requirements-title">Обязательные требования</h2>
            <ul>{product.requirements.map((item) => <li key={item}>{item}</li>)}</ul>
          </section>
        )}
      </main>
    </div>
  );
}
`;
}

function stylesSource(): string {
  return `:root {
  font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  color: #101828;
  background: #f6f8fb;
  font-synthesis: none;
}

* { box-sizing: border-box; }
body { margin: 0; min-width: 320px; min-height: 100vh; }
button, input, textarea, select { font: inherit; }
button:focus-visible, a:focus-visible { outline: 3px solid #9dc4ff; outline-offset: 3px; }

.app-shell { min-height: 100vh; }
.app-header { height: 64px; display: flex; align-items: center; gap: 12px; padding: 0 24px; border-bottom: 1px solid #dfe5ee; background: #fff; }
.brand-mark { width: 12px; height: 12px; border-radius: 50%; background: #2563eb; box-shadow: 0 0 0 5px #dbeafe; }
main { width: min(1120px, calc(100% - 32px)); margin: 0 auto; padding: 72px 0; }
.hero { max-width: 760px; }
.eyebrow { margin: 0 0 12px; color: #1d4ed8; font-size: 12px; font-weight: 700; letter-spacing: .12em; text-transform: uppercase; }
h1 { margin: 0; font-size: clamp(36px, 7vw, 72px); line-height: 1.05; letter-spacing: -.04em; }
.supporting-text { max-width: 680px; margin: 24px 0 0; color: #475467; font-size: 18px; line-height: 1.65; }
.primary-action { min-height: 48px; margin-top: 32px; padding: 0 20px; border: 0; border-radius: 10px; background: #2563eb; color: #fff; font-weight: 700; cursor: pointer; }
.primary-action:hover { background: #1d4ed8; }
.proof-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin-top: 64px; }
.proof-grid article, .requirements { padding: 24px; border: 1px solid #dfe5ee; border-radius: 14px; background: #fff; }
.requirements { margin-top: 24px; }
.requirements h2 { margin-top: 0; font-size: 20px; }
.requirements li { margin: 10px 0; color: #475467; }

@media (max-width: 720px) {
  .app-header { padding: 0 16px; }
  main { padding: 44px 0; }
  .proof-grid { grid-template-columns: 1fr; margin-top: 44px; }
  .supporting-text { font-size: 16px; }
}

@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { scroll-behavior: auto !important; transition: none !important; animation: none !important; }
}
`;
}

function readmeSource(project: BuilderProject): string {
  const requirements = project.input.requirements.length
    ? project.input.requirements.map((item) => `- ${markdownText(item)}`).join('\n')
    : '- Требования не добавлены';
  return `# ${markdownText(project.input.name)}

Reviewable React/Vite scaffold generated from an approved Eclipse AI Builder plan.

## Product brief

- Audience: ${markdownText(project.input.audience)}
- Primary action: ${markdownText(project.input.primaryAction)}
- Template: ${project.input.template}

## Requirements

${requirements}

## Safety boundary

Eclipse AI Builder did not write these files, install dependencies, run code, connect GitHub or
deploy this application. Review every file and dependency in an isolated workspace before use.
The source project remains the authority for product requirements and approval.
`;
}

function makeFile(path: string, mediaType: BuilderFile['mediaType'], content: string): BuilderFile {
  if (!SAFE_PATH.test(path) || path.includes('..')) throw new Error(`Небезопасный путь файла: ${path}`);
  const sizeBytes = new TextEncoder().encode(content).byteLength;
  if (sizeBytes > MAX_FILE_BYTES) throw new Error(`File exceeds 64 KB: ${path}`);
  return { path, mediaType, content, sizeBytes };
}

export function renderBuilderFiles(project: BuilderProject, now = new Date()): BuilderFilesArtifact {
  if (project.status !== 'approved' || !project.approval) {
    throw new Error('Сначала утвердите план приложения');
  }

  const files: BuilderFile[] = [
    makeFile('index.html', 'text/html', '<!doctype html>\n<html lang="ru">\n<head>\n  <meta charset="UTF-8" />\n  <meta name="viewport" content="width=device-width, initial-scale=1.0" />\n  <title>Generated Eclipse app</title>\n</head>\n<body>\n  <div id="root"></div>\n  <script type="module" src="/src/main.tsx"></script>\n</body>\n</html>\n'),
    makeFile('package.json', 'application/json', JSON.stringify({
      name: `eclipse-${project.input.template}-app`, private: true, version: '0.1.0', type: 'module',
      scripts: { dev: 'vite', typecheck: 'tsc --noEmit', build: 'tsc --noEmit && vite build' },
      dependencies: { react: '19.2.4', 'react-dom': '19.2.4' },
      devDependencies: { '@types/react': '19.2.14', '@types/react-dom': '19.2.3', '@vitejs/plugin-react': '5.2.0', typescript: '5.8.3', vite: '6.4.2' },
    }, null, 2) + '\n'),
    makeFile('README.md', 'text/markdown', readmeSource(project)),
    makeFile('src/App.tsx', 'text/typescript', appSource(project)),
    makeFile('src/main.tsx', 'text/typescript', "import React from 'react';\nimport { createRoot } from 'react-dom/client';\nimport App from './App';\nimport './styles.css';\n\ncreateRoot(document.getElementById('root')!).render(<React.StrictMode><App /></React.StrictMode>);\n"),
    makeFile('src/styles.css', 'text/css', stylesSource()),
    makeFile('tsconfig.json', 'application/json', JSON.stringify({
      compilerOptions: { target: 'ES2020', useDefineForClassFields: true, lib: ['ES2020', 'DOM', 'DOM.Iterable'], module: 'ESNext', skipLibCheck: true, moduleResolution: 'bundler', isolatedModules: true, noEmit: true, jsx: 'react-jsx', strict: true },
      include: ['src'],
    }, null, 2) + '\n'),
    makeFile('vite.config.ts', 'text/typescript', "import { defineConfig } from 'vite';\nimport react from '@vitejs/plugin-react';\n\nexport default defineConfig({ plugins: [react()] });\n"),
  ].sort((left, right) => left.path.localeCompare(right.path));

  const totalBytes = files.reduce((sum, file) => sum + file.sizeBytes, 0);
  if (totalBytes > MAX_ARTIFACT_BYTES) throw new Error('Набор файлов превышает безопасный лимит 128 КБ');

  return {
    schemaVersion: 'builder.files.v1',
    id: `${project.id}-files-v1`,
    projectId: project.id,
    sourceUpdatedAt: project.updatedAt,
    generatedAt: now.toISOString(),
    renderer: 'eclipse-react-vite-v1',
    reviewStatus: 'unreviewed',
    files,
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

export function serializeBuilderFiles(artifact: BuilderFilesArtifact): string {
  return JSON.stringify(artifact, null, 2);
}
