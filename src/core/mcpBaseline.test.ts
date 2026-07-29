import { describe, expect, it } from 'vitest'
import { buildMcpBaseline } from '../../scripts/mcp-baseline.mjs'

describe('AI Hub MCP developer baseline', () => {
  it('pins Context7 and scopes Filesystem to one workspace', () => {
    const config = buildMcpBaseline({ workspace: process.cwd(), platform: 'linux' })
    expect(config.mcpServers.context7.args).toContain('@upstash/context7-mcp@3.2.5')
    expect(config.mcpServers.filesystem.args).toContain('@modelcontextprotocol/server-filesystem@2026.7.10')
    expect(config.mcpServers.filesystem.args.at(-1)).toBe(process.cwd())
  })

  it('uses the documented Windows npx wrapper', () => {
    const config = buildMcpBaseline({ workspace: process.cwd(), platform: 'win32' })
    expect(config.mcpServers.context7).toMatchObject({ command: 'cmd', args: ['/c', 'npx', '-y', '@upstash/context7-mcp@3.2.5'] })
  })

  it('keeps GitHub opt-in, read-only, lockdown, and free of literal tokens', () => {
    const config = buildMcpBaseline({ workspace: process.cwd(), includeGitHub: true })
    const github = config.mcpServers['github-readonly']
    expect(github.args).toContain('ghcr.io/github/github-mcp-server:0.31.0')
    expect(github.args).toContain('GITHUB_READ_ONLY=1')
    expect(github.args).toContain('GITHUB_LOCKDOWN_MODE=1')
    expect(github.args).toContain('GITHUB_TOOLSETS=context,repos,pull_requests')
    expect(github.env).toBeUndefined()
    expect(JSON.stringify(github)).not.toMatch(/github_pat_|ghp_/)
  })

  it('fails closed for a missing workspace', () => {
    expect(() => buildMcpBaseline({ workspace: '__missing_workspace__' })).toThrow(/not an existing directory/)
  })
})
