export type McpServerEntry = {
  command: string
  args: string[]
  env?: Record<string, string>
}

export function buildMcpBaseline(options: {
  workspace: string
  includeGitHub?: boolean
  platform?: NodeJS.Platform
}): { mcpServers: Record<string, McpServerEntry> }

export function runMcpBaseline(args?: string[]): void
