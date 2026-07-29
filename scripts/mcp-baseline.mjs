import { existsSync, statSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const FILESYSTEM_PACKAGE = '@modelcontextprotocol/server-filesystem@2026.7.10'
const CONTEXT7_PACKAGE = '@upstash/context7-mcp@3.2.5'
const GITHUB_IMAGE = 'ghcr.io/github/github-mcp-server:0.31.0'

function npxServer(packageName, args = [], platform = process.platform) {
  return platform === 'win32'
    ? { command: 'cmd', args: ['/c', 'npx', '-y', packageName, ...args] }
    : { command: 'npx', args: ['-y', packageName, ...args] }
}

export function buildMcpBaseline({ workspace, includeGitHub = false, platform = process.platform }) {
  const allowedDirectory = resolve(workspace)
  if (!statSync(allowedDirectory, { throwIfNoEntry: false })?.isDirectory()) {
    throw new Error(`Workspace is not an existing directory: ${allowedDirectory}`)
  }

  const mcpServers = {
    context7: npxServer(CONTEXT7_PACKAGE, [], platform),
    filesystem: npxServer(FILESYSTEM_PACKAGE, [allowedDirectory], platform),
  }

  if (includeGitHub) {
    mcpServers['github-readonly'] = {
      command: 'docker',
      args: [
        'run', '-i', '--rm',
        '-e', 'GITHUB_PERSONAL_ACCESS_TOKEN',
        '-e', 'GITHUB_READ_ONLY=1',
        '-e', 'GITHUB_LOCKDOWN_MODE=1',
        '-e', 'GITHUB_TOOLSETS=context,repos,pull_requests',
        GITHUB_IMAGE,
      ],
    }
  }

  return { mcpServers }
}

function parseArgs(args) {
  return {
    workspace: args.find((value, index) => args[index - 1] === '--workspace') ?? '.',
    includeGitHub: args.includes('--github'),
    dryRun: args.includes('--dry-run'),
    force: args.includes('--force'),
  }
}

export function runMcpBaseline(args = process.argv.slice(2)) {
  const options = parseArgs(args)
  const config = buildMcpBaseline(options)
  const outputPath = resolve('.mcp.local.json')

  if (options.dryRun) {
    process.stdout.write(`${JSON.stringify(config, null, 2)}\n`)
    return
  }
  if (existsSync(outputPath) && !options.force) {
    throw new Error(`${outputPath} already exists. Review it or rerun with --force.`)
  }

  writeFileSync(outputPath, `${JSON.stringify(config, null, 2)}\n`, { encoding: 'utf-8', mode: 0o600 })
  process.stdout.write(`Wrote ${outputPath}. No MCP server was started.\n`)
  process.stdout.write('Review tool descriptions, then explicitly import this file into your MCP client.\n')
}

if (resolve(process.argv[1] ?? '') === fileURLToPath(import.meta.url)) {
  try {
    runMcpBaseline()
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`)
    process.exitCode = 1
  }
}
