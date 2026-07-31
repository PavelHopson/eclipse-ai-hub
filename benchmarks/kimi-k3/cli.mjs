#!/usr/bin/env node
import { pathToFileURL } from 'node:url';
import { buildBenchmarkPlan, listSuites, runBenchmark } from './runner.mjs';

function usage() {
  return [
    'Direct Kimi K3 benchmark for Eclipse Forge',
    '',
    'Dry run (default, no network):',
    '  npm run benchmark:kimi-k3 -- --suite all',
    '',
    'Approved live run:',
    '  KIMI_BENCHMARK_ALLOW_NETWORK=1 KIMI_API_KEY=... npm run benchmark:kimi-k3 -- --suite ai-hub --execute',
    '',
    `Suites: ${listSuites().join(', ')}, all`,
    'Options:',
    '  --suite <name>       Select a workload suite',
    '  --reasoning <level>  low, high, or max (default: low)',
    '  --execute            Allow a live request after the environment gate',
    '  --help               Show this help',
  ].join('\n');
}

export function parseArgs(argv) {
  const options = { suiteName: 'all', reasoningEffort: 'low', execute: false, help: false };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--execute') {
      options.execute = true;
    } else if (arg === '--help' || arg === '-h') {
      options.help = true;
    } else if (arg === '--suite') {
      options.suiteName = argv[index + 1] || '';
      index += 1;
    } else if (arg === '--reasoning') {
      options.reasoningEffort = argv[index + 1] || '';
      index += 1;
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  buildBenchmarkPlan(options.suiteName);
  return options;
}

async function main() {
  try {
    const options = parseArgs(process.argv.slice(2));
    if (options.help) {
      console.log(usage());
      return;
    }
    const report = await runBenchmark(options);
    console.log(JSON.stringify(report, null, 2));
    if (report.status === 'failed') process.exitCode = 1;
  } catch (error) {
    console.error(error instanceof Error ? error.message : 'Benchmark failed.');
    process.exitCode = 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
