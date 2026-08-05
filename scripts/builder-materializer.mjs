import {
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmdirSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { dirname, isAbsolute, join, parse, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const MAX_ARTIFACT_FILE_BYTES = 256 * 1024;
const MAX_ARTIFACT_CONTENT_BYTES = 128 * 1024;
const MAX_FILE_BYTES = 64 * 1024;
const SAFE_ID = /^[A-Za-z0-9_-]{1,112}$/;
const ALLOWED_FILES = Object.freeze([
  ['index.html', 'text/html'],
  ['package.json', 'application/json'],
  ['README.md', 'text/markdown'],
  ['src/App.tsx', 'text/typescript'],
  ['src/main.tsx', 'text/typescript'],
  ['src/styles.css', 'text/css'],
  ['tsconfig.json', 'application/json'],
  ['vite.config.ts', 'text/typescript'],
]);
const ROOT_KEYS = ['files', 'generatedAt', 'id', 'policy', 'projectId', 'renderer', 'reviewStatus', 'schemaVersion', 'sourceUpdatedAt'];
const FILE_KEYS = ['content', 'mediaType', 'path', 'sizeBytes'];
const POLICY_KEYS = ['dependenciesInstalled', 'deployed', 'filesWritten', 'generatedCodeExecuted', 'githubConnected', 'networkAccess'];
const PACKAGE_KEYS = ['dependencies', 'devDependencies', 'name', 'private', 'scripts', 'type', 'version'];
const EXPECTED_PACKAGE = Object.freeze({
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
});

function assertObject(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${label} must be an object`);
}

function assertExactKeys(value, expected, label) {
  assertObject(value, label);
  const actual = Object.keys(value).sort();
  const required = [...expected].sort();
  if (actual.length !== required.length || actual.some((key, index) => key !== required[index])) {
    throw new Error(`${label} has unsupported or missing fields`);
  }
}

function assertIsoDate(value, label) {
  if (typeof value !== 'string') throw new Error(`${label} must be an ISO date`);
  const parsed = new Date(value);
  if (Number.isNaN(parsed.valueOf()) || parsed.toISOString() !== value) throw new Error(`${label} must be an ISO date`);
}

function assertExactMap(value, expected, label) {
  assertExactKeys(value, Object.keys(expected), label);
  for (const [key, expectedValue] of Object.entries(expected)) {
    if (value[key] !== expectedValue) throw new Error(`${label}.${key} is not allowed`);
  }
}

function validatePackageManifest(content) {
  let manifest;
  try { manifest = JSON.parse(content); }
  catch { throw new Error('Generated package.json is not valid JSON'); }
  assertExactKeys(manifest, PACKAGE_KEYS, 'package.json');
  if (!/^eclipse-(landing|dashboard|catalog)-app$/.test(manifest.name)) throw new Error('Generated package name is not allowed');
  if (manifest.private !== EXPECTED_PACKAGE.private || manifest.version !== EXPECTED_PACKAGE.version || manifest.type !== EXPECTED_PACKAGE.type) {
    throw new Error('Generated package metadata is not allowed');
  }
  assertExactMap(manifest.scripts, EXPECTED_PACKAGE.scripts, 'package.json scripts');
  assertExactMap(manifest.dependencies, EXPECTED_PACKAGE.dependencies, 'package.json dependencies');
  assertExactMap(manifest.devDependencies, EXPECTED_PACKAGE.devDependencies, 'package.json devDependencies');
}

export function validateBuilderFilesArtifact(value) {
  assertExactKeys(value, ROOT_KEYS, 'artifact');
  if (value.schemaVersion !== 'builder.files.v1') throw new Error('Unsupported Builder files schema');
  if (!SAFE_ID.test(value.id) || value.id.length > 112) throw new Error('Invalid artifact id');
  if (!SAFE_ID.test(value.projectId) || value.projectId.length > 96) throw new Error('Invalid project id');
  assertIsoDate(value.sourceUpdatedAt, 'sourceUpdatedAt');
  assertIsoDate(value.generatedAt, 'generatedAt');
  if (value.renderer !== 'eclipse-react-vite-v1') throw new Error('Unsupported Builder renderer');
  if (value.reviewStatus !== 'unreviewed') throw new Error('Materializer accepts only unreviewed artifacts');

  assertExactKeys(value.policy, POLICY_KEYS, 'policy');
  for (const key of POLICY_KEYS) {
    if (value.policy[key] !== false) throw new Error(`Policy ${key} must remain false`);
  }

  if (!Array.isArray(value.files) || value.files.length !== ALLOWED_FILES.length) {
    throw new Error(`Artifact must contain exactly ${ALLOWED_FILES.length} files`);
  }

  let totalBytes = 0;
  value.files.forEach((file, index) => {
    assertExactKeys(file, FILE_KEYS, `files[${index}]`);
    const [expectedPath, expectedMediaType] = ALLOWED_FILES[index];
    if (file.path !== expectedPath || file.mediaType !== expectedMediaType) {
      throw new Error(`Unexpected file at position ${index}: ${String(file.path)}`);
    }
    if (typeof file.content !== 'string' || file.content.length > MAX_FILE_BYTES) {
      throw new Error(`Invalid content for ${expectedPath}`);
    }
    const measuredBytes = Buffer.byteLength(file.content, 'utf8');
    if (!Number.isInteger(file.sizeBytes) || file.sizeBytes !== measuredBytes || measuredBytes > MAX_FILE_BYTES) {
      throw new Error(`Invalid size for ${expectedPath}`);
    }
    if (expectedPath === 'package.json') validatePackageManifest(file.content);
    totalBytes += measuredBytes;
  });
  if (totalBytes > MAX_ARTIFACT_CONTENT_BYTES) throw new Error('Artifact content exceeds 128 KB');

  return value;
}

function assertNoSymlinkComponents(targetPath) {
  const absolute = resolve(targetPath);
  const root = parse(absolute).root;
  const segments = relative(root, absolute).split(sep).filter(Boolean);
  let cursor = root;
  for (const segment of segments) {
    cursor = join(cursor, segment);
    if (!existsSync(cursor)) break;
    const stat = lstatSync(cursor);
    if (stat.isSymbolicLink()) throw new Error(`Symbolic links are not allowed: ${JSON.stringify(cursor)}`);
  }
}

function inspectDestination(outputDirectory) {
  if (typeof outputDirectory !== 'string' || outputDirectory.trim() === '') throw new Error('Output directory is required');
  const destination = resolve(outputDirectory);
  if (destination === parse(destination).root) throw new Error('Filesystem root cannot be used as output');
  assertNoSymlinkComponents(destination);

  if (existsSync(destination)) {
    const stat = lstatSync(destination);
    if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error('Output must be a real directory');
    if (readdirSync(destination).length > 0) throw new Error('Output directory must be empty');
    return { destination, existed: true };
  }

  const parent = dirname(destination);
  assertNoSymlinkComponents(parent);
  const parentStat = lstatSync(parent, { throwIfNoEntry: false });
  if (!parentStat?.isDirectory() || parentStat.isSymbolicLink()) {
    throw new Error('Output parent must be an existing real directory');
  }
  return { destination, existed: false };
}

export function planBuilderMaterialization(artifact, outputDirectory) {
  validateBuilderFilesArtifact(artifact);
  const destinationState = inspectDestination(outputDirectory);
  const files = artifact.files.map((file) => {
    const targetPath = resolve(destinationState.destination, file.path);
    const inside = relative(destinationState.destination, targetPath);
    if (inside.startsWith('..') || isAbsolute(inside)) throw new Error(`Path escapes output: ${file.path}`);
    return { path: file.path, targetPath, sizeBytes: file.sizeBytes };
  });
  return {
    status: 'dry-run',
    projectId: artifact.projectId,
    destination: destinationState.destination,
    destinationExists: destinationState.existed,
    files,
    totalBytes: files.reduce((sum, file) => sum + file.sizeBytes, 0),
    policy: { dependenciesInstalled: false, generatedCodeExecuted: false, networkAccess: false, deployed: false },
  };
}

function rollback(createdFiles, createdDirectories) {
  for (const path of [...createdFiles].reverse()) {
    try { unlinkSync(path); } catch { /* Never remove anything that was not created by this run. */ }
  }
  for (const path of [...createdDirectories].reverse()) {
    try { rmdirSync(path); } catch { /* Leave non-empty or externally changed directories untouched. */ }
  }
}

export function materializeBuilderFiles(artifact, outputDirectory, { write = false } = {}) {
  const plan = planBuilderMaterialization(artifact, outputDirectory);
  if (!write) return plan;

  const createdFiles = [];
  const createdDirectories = [];
  try {
    if (!plan.destinationExists) {
      mkdirSync(plan.destination, { recursive: false, mode: 0o700 });
      createdDirectories.push(plan.destination);
    }

    const directories = [...new Set(plan.files.map((file) => dirname(file.targetPath)))]
      .filter((path) => path !== plan.destination)
      .sort((left, right) => left.length - right.length);
    for (const directory of directories) {
      if (existsSync(directory)) throw new Error(`Generated directory already exists: ${JSON.stringify(directory)}`);
      mkdirSync(directory, { recursive: false, mode: 0o700 });
      createdDirectories.push(directory);
    }

    for (const directory of [plan.destination, ...directories]) {
      assertNoSymlinkComponents(directory);
      const stat = lstatSync(directory);
      if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error('Generated path is no longer a real directory');
    }
    for (const [index, file] of plan.files.entries()) {
      writeFileSync(file.targetPath, artifact.files[index].content, { encoding: 'utf8', flag: 'wx', mode: 0o600 });
      createdFiles.push(file.targetPath);
    }
    return { ...plan, status: 'written' };
  } catch (error) {
    rollback(createdFiles, createdDirectories);
    throw new Error(`Materialization failed safely: ${error instanceof Error ? error.message : String(error)}`);
  }
}

function readArtifact(path) {
  const absolute = resolve(path);
  const stat = lstatSync(absolute, { throwIfNoEntry: false });
  if (!stat?.isFile() || stat.isSymbolicLink()) throw new Error('Artifact must be an existing regular file');
  if (stat.size > MAX_ARTIFACT_FILE_BYTES) throw new Error('Artifact JSON exceeds 256 KB');
  let value;
  try { value = JSON.parse(readFileSync(absolute, 'utf8')); }
  catch { throw new Error('Artifact is not valid JSON'); }
  return validateBuilderFilesArtifact(value);
}

function parseArgs(args) {
  const options = { artifact: '', output: '', write: false, help: false };
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === '--write') { options.write = true; continue; }
    if (arg === '--help' || arg === '-h') { options.help = true; continue; }
    if (arg === '--artifact' || arg === '--out') {
      const value = args[index + 1];
      if (!value || value.startsWith('--')) throw new Error(`${arg} requires a value`);
      const key = arg === '--artifact' ? 'artifact' : 'output';
      if (options[key]) throw new Error(`${arg} can be provided only once`);
      options[key] = value;
      index += 1;
      continue;
    }
    throw new Error(`Unknown argument: ${arg}`);
  }
  if (!options.help && (!options.artifact || !options.output)) throw new Error('--artifact and --out are required');
  return options;
}

const HELP = `Eclipse AI Builder workspace materializer

Usage:
  npm run builder:materialize -- --artifact <builder-files.json> --out <empty-directory>
  npm run builder:materialize -- --artifact <builder-files.json> --out <empty-directory> --write

The first command is a dry run. --write creates only the eight reviewed files.
It never installs dependencies, executes code, accesses the network, connects GitHub or deploys.
`;

export function runBuilderMaterializer(args = process.argv.slice(2), stdout = process.stdout) {
  const options = parseArgs(args);
  if (options.help) { stdout.write(HELP); return null; }
  const artifact = readArtifact(options.artifact);
  const result = materializeBuilderFiles(artifact, options.output, { write: options.write });
  stdout.write(`${result.status === 'written' ? 'Wrote' : 'Dry run:'} ${result.files.length} files, ${result.totalBytes} bytes -> ${JSON.stringify(result.destination)}\n`);
  stdout.write('No dependencies installed, generated code executed, network accessed or deployment started.\n');
  return result;
}

if (resolve(process.argv[1] ?? '') === fileURLToPath(import.meta.url)) {
  try { runBuilderMaterializer(); }
  catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  }
}
