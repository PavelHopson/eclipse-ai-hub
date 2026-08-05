import { createHash } from 'node:crypto';
import { existsSync, lstatSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { validateBuilderFilesArtifact } from './builder-materializer.mjs';

const SCRIPT_DIRECTORY = dirname(fileURLToPath(import.meta.url));
const POLICY_PATH = resolve(SCRIPT_DIRECTORY, '../contracts/builder.dependency-policy.v1.json');
const SNAPSHOT_PATH = resolve(SCRIPT_DIRECTORY, '../contracts/builder.advisory-snapshot.v1.json');
const AUDIT_LOCK_PATH = resolve(SCRIPT_DIRECTORY, '../security/builder-audit/package-lock.json');
const MAX_ARTIFACT_FILE_BYTES = 256 * 1024;
const ALLOWED_IMPORTS = Object.freeze({
  'src/App.tsx': new Set(['react']),
  'src/main.tsx': new Set(['react', 'react-dom/client', './App', './styles.css']),
  'vite.config.ts': new Set(['vite', '@vitejs/plugin-react']),
});
const BLOCKED_CALLS = new Set(['eval', 'fetch', 'require']);
const BLOCKED_CONSTRUCTORS = new Set(['EventSource', 'Function', 'WebSocket', 'Worker', 'XMLHttpRequest']);

function parseJson(text, label) {
  try { return JSON.parse(text); }
  catch { throw new Error(`${label} is not valid JSON`); }
}

function loadTrustedJson(path, label) {
  return parseJson(readFileSync(path, 'utf8'), label);
}

function assertTrustedPolicy(policy) {
  if (policy?.schemaVersion !== 'builder.dependency-policy.v1') throw new Error('Unsupported dependency policy');
  if (policy.renderer !== 'eclipse-react-vite-v1') throw new Error('Dependency policy renderer mismatch');
  if (!Array.isArray(policy.allowedLicenses) || !Array.isArray(policy.dependencies)) throw new Error('Dependency policy is incomplete');
  const identities = new Set();
  for (const component of policy.dependencies) {
    if (!component || typeof component !== 'object') throw new Error('Dependency policy component is invalid');
    const identity = `${component.name}@${component.version}`;
    if (identities.has(identity)) throw new Error(`Duplicate dependency policy component: ${identity}`);
    identities.add(identity);
    if (!policy.allowedLicenses.includes(component.license)) throw new Error(`Disallowed policy license: ${component.license}`);
    if (typeof component.purl !== 'string' || typeof component.evidence !== 'string') throw new Error(`Missing evidence for ${identity}`);
  }
  return policy;
}

function dependencyInventory(manifest) {
  return [
    ...Object.entries(manifest.dependencies).map(([name, version]) => ({ name, version, relationship: 'runtime' })),
    ...Object.entries(manifest.devDependencies).map(([name, version]) => ({ name, version, relationship: 'development' })),
  ].sort((left, right) => left.name.localeCompare(right.name));
}

function inspectTypescript(path, content) {
  const findings = [];
  const kind = path.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
  const source = ts.createSourceFile(path, content, ts.ScriptTarget.ES2022, true, kind);
  for (const diagnostic of source.parseDiagnostics) {
    findings.push({ severity: 'block', code: 'syntax-error', file: path, message: ts.flattenDiagnosticMessageText(diagnostic.messageText, ' ') });
  }

  function visit(node) {
    if (ts.isImportDeclaration(node)) {
      const specifier = ts.isStringLiteral(node.moduleSpecifier) ? node.moduleSpecifier.text : '';
      if (!ALLOWED_IMPORTS[path]?.has(specifier)) {
        findings.push({ severity: 'block', code: 'unexpected-import', file: path, message: `Import is not allowlisted: ${specifier || '<dynamic>'}` });
      }
    }
    if (ts.isCallExpression(node)) {
      if (node.expression.kind === ts.SyntaxKind.ImportKeyword) {
        findings.push({ severity: 'block', code: 'dynamic-import', file: path, message: 'Dynamic import is not allowed in a preview artifact' });
      }
      if (ts.isIdentifier(node.expression) && BLOCKED_CALLS.has(node.expression.text)) {
        findings.push({ severity: 'block', code: 'active-api', file: path, message: `${node.expression.text}() is not allowed in a static preview` });
      }
      if (ts.isPropertyAccessExpression(node.expression) && node.expression.name.text === 'sendBeacon') {
        findings.push({ severity: 'block', code: 'network-api', file: path, message: 'sendBeacon() is not allowed in a static preview' });
      }
    }
    if (ts.isNewExpression(node) && ts.isIdentifier(node.expression) && BLOCKED_CONSTRUCTORS.has(node.expression.text)) {
      findings.push({ severity: 'block', code: 'active-constructor', file: path, message: `new ${node.expression.text}() is not allowed in a static preview` });
    }
    if (ts.isJsxAttribute(node) && node.name.text === 'dangerouslySetInnerHTML') {
      findings.push({ severity: 'block', code: 'unsafe-html', file: path, message: 'dangerouslySetInnerHTML is not allowed' });
    }
    ts.forEachChild(node, visit);
  }
  visit(source);
  return findings;
}

function inspectPassiveFiles(files) {
  const findings = [];
  const html = files.get('index.html');
  const scripts = html.match(/<script\b[\s\S]*?<\/script>/gi) ?? [];
  const expectedScript = '<script type="module" src="/src/main.tsx"></script>';
  if (scripts.length !== 1 || scripts[0].trim() !== expectedScript) {
    findings.push({ severity: 'block', code: 'active-html', file: 'index.html', message: 'HTML must contain only the reviewed local module entrypoint' });
  }
  if (/<(?:iframe|object|embed)\b|\son[a-z]+\s*=/i.test(html)) {
    findings.push({ severity: 'block', code: 'embedded-content', file: 'index.html', message: 'Embedded content and inline event handlers are not allowed' });
  }
  const css = files.get('src/styles.css');
  if (/@import\b|url\s*\(/i.test(css)) {
    findings.push({ severity: 'block', code: 'external-css', file: 'src/styles.css', message: 'CSS imports and URL resources are not allowed' });
  }
  return findings;
}

function parseSnapshotDate(value, label) {
  if (typeof value !== 'string') throw new Error(`Advisory snapshot ${label} is invalid`);
  const parsed = new Date(value);
  if (Number.isNaN(parsed.valueOf()) || parsed.toISOString() !== value) throw new Error(`Advisory snapshot ${label} is invalid`);
  return parsed;
}

function evaluateSnapshot(snapshot, now, auditInputSha256) {
  if (snapshot?.schemaVersion !== 'builder.advisory-snapshot.v1') throw new Error('Unsupported advisory snapshot');
  if (snapshot.status !== 'verified') {
    return {
      status: 'not-verified',
      severity: 'warning',
      message: snapshot.reason || 'No reviewed advisory snapshot is available',
      auditedAt: null,
      expiresAt: null,
      summary: null,
    };
  }
  if (snapshot.source !== 'npm-audit') throw new Error('Unsupported advisory source');
  const auditedAt = parseSnapshotDate(snapshot.auditedAt, 'auditedAt');
  const expiresAt = parseSnapshotDate(snapshot.expiresAt, 'expiresAt');
  if (auditedAt.valueOf() > now.valueOf() || expiresAt.valueOf() <= auditedAt.valueOf()) {
    throw new Error('Advisory snapshot time window is invalid');
  }
  if (!auditInputSha256) {
    return { status: 'missing-lock', severity: 'block', message: 'A verified advisory snapshot requires the reviewed audit lockfile', auditedAt: snapshot.auditedAt, expiresAt: snapshot.expiresAt, summary: snapshot.summary };
  }
  if (!/^[a-f0-9]{64}$/.test(snapshot.auditInputSha256) || snapshot.auditInputSha256 !== auditInputSha256) {
    return { status: 'mismatch', severity: 'block', message: 'Advisory snapshot does not match the reviewed audit lockfile', auditedAt: snapshot.auditedAt, expiresAt: snapshot.expiresAt, summary: snapshot.summary };
  }
  const severityKeys = ['info', 'low', 'moderate', 'high', 'critical'];
  const summaryKeys = Object.keys(snapshot.summary ?? {}).sort();
  if (summaryKeys.join(',') !== [...severityKeys, 'total'].sort().join(',')) throw new Error('Advisory snapshot summary is invalid');
  const severities = severityKeys.map((key) => Number(snapshot.summary[key]));
  const total = Number(snapshot.summary.total);
  if (severities.some((count) => !Number.isInteger(count) || count < 0) || !Number.isInteger(total) || total !== severities.reduce((sum, count) => sum + count, 0)) {
    throw new Error('Advisory snapshot summary is invalid');
  }
  if (total > 0) {
    return { status: 'known-advisories', severity: 'block', message: `${total} known advisories are recorded in the snapshot`, auditedAt: snapshot.auditedAt, expiresAt: snapshot.expiresAt, summary: snapshot.summary };
  }
  const expired = expiresAt.valueOf() <= now.valueOf();
  return {
    status: expired ? 'expired' : 'no-known-advisories-at-snapshot',
    severity: expired ? 'warning' : 'pass',
    message: expired ? 'The advisory snapshot is expired and must be refreshed' : 'The reviewed snapshot recorded no known advisories at audit time',
    auditedAt: snapshot.auditedAt,
    expiresAt: snapshot.expiresAt,
    summary: snapshot.summary,
  };
}

export function verifyBuilderFilesArtifact(artifact, options = {}) {
  validateBuilderFilesArtifact(artifact);
  const now = options.now ?? new Date();
  const policy = assertTrustedPolicy(options.policy ?? loadTrustedJson(POLICY_PATH, 'Dependency policy'));
  const snapshot = options.snapshot ?? loadTrustedJson(SNAPSHOT_PATH, 'Advisory snapshot');
  const auditInput = options.auditInput ?? (existsSync(AUDIT_LOCK_PATH) ? readFileSync(AUDIT_LOCK_PATH, 'utf8') : null);
  const auditInputSha256 = auditInput === null ? null : createHash('sha256').update(auditInput).digest('hex');
  const files = new Map(artifact.files.map((file) => [file.path, file.content]));
  const manifest = parseJson(files.get('package.json'), 'Generated package.json');
  const inventory = dependencyInventory(manifest);
  const policyByName = new Map(policy.dependencies.map((component) => [component.name, component]));
  const dependencyFindings = [];
  const components = inventory.map((dependency) => {
    const approved = policyByName.get(dependency.name);
    if (!approved || approved.version !== dependency.version || approved.relationship !== dependency.relationship) {
      dependencyFindings.push({ severity: 'block', code: 'dependency-policy', file: 'package.json', message: `${dependency.name}@${dependency.version} is not approved` });
    }
    return approved ? { ...approved, direct: true } : { ...dependency, direct: true, license: 'UNKNOWN', purl: null, evidence: null };
  });
  if (components.length !== policy.dependencies.length) {
    dependencyFindings.push({ severity: 'block', code: 'dependency-count', file: 'package.json', message: 'Dependency inventory does not match the reviewed policy' });
  }

  const sourceFindings = [
    ...Object.keys(ALLOWED_IMPORTS).flatMap((path) => inspectTypescript(path, files.get(path))),
    ...inspectPassiveFiles(files),
  ];
  const advisory = evaluateSnapshot(snapshot, now, auditInputSha256);
  const findings = [...dependencyFindings, ...sourceFindings];
  if (advisory.severity === 'block') findings.push({ severity: 'block', code: 'advisory-snapshot', file: 'contracts/builder.advisory-snapshot.v1.json', message: advisory.message });
  if (advisory.severity === 'warning') findings.push({ severity: 'warning', code: 'advisory-snapshot', file: 'contracts/builder.advisory-snapshot.v1.json', message: advisory.message });
  const blocked = findings.some((finding) => finding.severity === 'block');

  return {
    schemaVersion: 'builder.verification.v1',
    artifactId: artifact.id,
    projectId: artifact.projectId,
    verifiedAt: now.toISOString(),
    result: blocked ? 'blocked' : 'review-required',
    recommendation: blocked ? 'do-not-materialize' : 'manual-review-required',
    components,
    advisory,
    findings,
    preview: {
      mode: 'static-parse-only',
      filesInspected: artifact.files.length,
      outputProduced: false,
      dependenciesInstalled: false,
      generatedCodeExecuted: false,
      networkAccess: false,
      deployed: false,
    },
    limitations: [
      'Static parsing does not prove that generated code is safe or correct.',
      'The advisory result is only as current as the committed reviewed snapshot.',
      'Transitive components are not covered until a reviewed audit lock exists; this verifier never installs them.',
    ],
  };
}

function readArtifact(path) {
  const absolute = resolve(path);
  const stat = lstatSync(absolute, { throwIfNoEntry: false });
  if (!stat?.isFile() || stat.isSymbolicLink()) throw new Error('Artifact must be an existing regular file');
  if (stat.size > MAX_ARTIFACT_FILE_BYTES) throw new Error('Artifact JSON exceeds 256 KB');
  return parseJson(readFileSync(absolute, 'utf8'), 'Artifact');
}

function parseArgs(args) {
  if (args.length === 1 && ['--help', '-h'].includes(args[0])) return { help: true, artifact: '' };
  if (args.length !== 2 || args[0] !== '--artifact' || args[1].startsWith('--')) throw new Error('Usage: npm run builder:verify -- --artifact <builder-files.json>');
  return { help: false, artifact: args[1] };
}

export function runBuilderVerifier(args = process.argv.slice(2), stdout = process.stdout) {
  const options = parseArgs(args);
  if (options.help) {
    stdout.write('Validate dependencies, licenses and a dated advisory snapshot; statically parse files without installing or executing generated code.\n');
    return null;
  }
  const report = verifyBuilderFilesArtifact(readArtifact(options.artifact));
  stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  return report;
}

if (resolve(process.argv[1] ?? '') === fileURLToPath(import.meta.url)) {
  try {
    const report = runBuilderVerifier();
    if (report?.result === 'blocked') process.exitCode = 2;
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  }
}
