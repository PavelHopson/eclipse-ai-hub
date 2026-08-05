import assert from 'node:assert/strict';
import {
  existsSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, parse, resolve } from 'node:path';
import { afterEach, describe, it } from 'node:test';
import {
  materializeBuilderFiles,
  planBuilderMaterialization,
  runBuilderMaterializer,
  validateBuilderFilesArtifact,
} from './builder-materializer.mjs';

const roots = [];
afterEach(() => {
  for (const root of roots.splice(0)) {
    const safeRoot = resolve(root);
    assert.ok(safeRoot.startsWith(resolve(tmpdir())), 'cleanup must stay inside the OS temp directory');
    rmSync(safeRoot, { recursive: true, force: true });
  }
});

function temporaryRoot() {
  const root = mkdtempSync(join(tmpdir(), 'eclipse-builder-materializer-'));
  roots.push(root);
  return root;
}

const definitions = [
  ['index.html', 'text/html', '<div id="root"></div>\n'],
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
  ['src/App.tsx', 'text/typescript', 'export default function App(){return <main>Safe</main>}\n'],
  ['src/main.tsx', 'text/typescript', 'import App from "./App"; void App;\n'],
  ['src/styles.css', 'text/css', ':root{color:#111}\n'],
  ['tsconfig.json', 'application/json', '{"compilerOptions":{"strict":true}}\n'],
  ['vite.config.ts', 'text/typescript', 'export default {};\n'],
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
    files: definitions.map(([path, mediaType, content]) => ({
      path,
      mediaType,
      content,
      sizeBytes: Buffer.byteLength(content, 'utf8'),
    })),
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

describe('Builder workspace materializer', () => {
  it('defaults to a dry run and leaves the filesystem unchanged', () => {
    const output = join(temporaryRoot(), 'app');
    const result = materializeBuilderFiles(validArtifact(), output);
    assert.equal(result.status, 'dry-run');
    assert.equal(result.files.length, 8);
    assert.equal(existsSync(output), false);
    assert.deepEqual(result.policy, {
      dependenciesInstalled: false,
      generatedCodeExecuted: false,
      networkAccess: false,
      deployed: false,
    });
  });

  it('writes only the allowlisted files into a new empty directory', () => {
    const output = join(temporaryRoot(), 'app');
    const result = materializeBuilderFiles(validArtifact(), output, { write: true });
    assert.equal(result.status, 'written');
    assert.equal(readFileSync(join(output, 'README.md'), 'utf8'), '# Review me\n');
    assert.equal(readFileSync(join(output, 'src', 'App.tsx'), 'utf8').includes('<main>Safe</main>'), true);
    assert.throws(() => materializeBuilderFiles(validArtifact(), output, { write: true }), /must be empty/);
  });

  it('rejects path substitution, policy escalation and size mismatches before writing', () => {
    const root = temporaryRoot();
    for (const attack of [
      '../escape.txt',
      '..\\escape.txt',
      '/etc/passwd',
      'C:\\Windows\\win.ini',
      '%2e%2e%2fescape.txt',
      '....//escape.txt',
    ]) {
      const badPath = structuredClone(validArtifact());
      badPath.files[0].path = attack;
      assert.throws(() => validateBuilderFilesArtifact(badPath), /Unexpected file/);
    }

    const badPolicy = structuredClone(validArtifact());
    badPolicy.policy.networkAccess = true;
    assert.throws(() => validateBuilderFilesArtifact(badPolicy), /must remain false/);

    const badSize = structuredClone(validArtifact());
    badSize.files[0].sizeBytes += 1;
    assert.throws(() => materializeBuilderFiles(badSize, join(root, 'app'), { write: true }), /Invalid size/);
    assert.equal(existsSync(join(root, 'app')), false);

    const lifecycleScript = structuredClone(validArtifact());
    const packageFile = lifecycleScript.files.find((file) => file.path === 'package.json');
    const manifest = JSON.parse(packageFile.content);
    manifest.scripts.postinstall = 'node unexpected.js';
    packageFile.content = JSON.stringify(manifest);
    packageFile.sizeBytes = Buffer.byteLength(packageFile.content, 'utf8');
    assert.throws(() => validateBuilderFilesArtifact(lifecycleScript), /unsupported or missing fields/);
  });

  it('rejects non-empty destinations and filesystem roots', () => {
    const root = temporaryRoot();
    const output = join(root, 'app');
    mkdirSync(output);
    writeFileSync(join(output, 'keep.txt'), 'user data');
    assert.throws(() => planBuilderMaterialization(validArtifact(), output), /must be empty/);
    assert.throws(() => planBuilderMaterialization(validArtifact(), parse(resolve(output)).root), /root cannot/);
    assert.equal(readFileSync(join(output, 'keep.txt'), 'utf8'), 'user data');
  });

  it('rejects destination paths that traverse a symbolic link', (context) => {
    const root = temporaryRoot();
    const real = join(root, 'real');
    const link = join(root, 'linked');
    mkdirSync(real);
    try { symlinkSync(real, link, process.platform === 'win32' ? 'junction' : 'dir'); }
    catch (error) {
      if (error && ['EPERM', 'EACCES'].includes(error.code)) { context.skip('Symlink creation is not permitted'); return; }
      throw error;
    }
    assert.throws(() => planBuilderMaterialization(validArtifact(), join(link, 'app')), /Symbolic links/);
  });

  it('rolls back only paths created by a failed write', () => {
    const output = join(temporaryRoot(), 'app');
    const artifact = validArtifact();
    const readme = artifact.files.find((file) => file.path === 'README.md');
    const content = readme.content;
    let reads = 0;
    Object.defineProperty(readme, 'content', {
      enumerable: true,
      get() {
        reads += 1;
        if (reads > 3) throw new Error('synthetic write failure');
        return content;
      },
    });

    assert.throws(
      () => materializeBuilderFiles(artifact, output, { write: true }),
      /Materialization failed safely/,
    );
    assert.equal(existsSync(output), false);
  });

  it('CLI performs a dry run unless --write is explicitly present', () => {
    const root = temporaryRoot();
    const artifactPath = join(root, 'builder-files.json');
    const output = join(root, 'app');
    writeFileSync(artifactPath, JSON.stringify(validArtifact()));
    const messages = [];
    const stdout = { write: (message) => { messages.push(message); return true; } };
    const result = runBuilderMaterializer(['--artifact', artifactPath, '--out', output], stdout);
    assert.equal(result.status, 'dry-run');
    assert.equal(existsSync(output), false);
    assert.match(messages.join(''), /No dependencies installed/);
  });
});
