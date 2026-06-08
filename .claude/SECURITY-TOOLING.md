# Security Tooling — eclipse-ai-hub

> Additive-установка из батча eclipse-library 28.05–05.06.2026. Цель — держать
> `.claude/` конфиги (plugins, skills) чистыми от prompt injection / tool poisoning /
> config drift. Всё работает **без API-ключа** в статическом режиме.

## 1. Security Guidance (Anthropic, официальный) — глобально, 1 раз
Pre-tool hook ловит 25 vuln-паттернов прямо при Write/Edit в Claude Code.
```bash
/plugin marketplace add anthropics/claude-code
/plugin install security-guidance@anthropics
# дальше автоматически, команд не нужно
```
Docs: https://code.claude.com/docs/en/security-guidance

## 2. AgentShield — скан `.claude/` (102 правила, без ключа)
Локально:
```powershell
.\scripts\agent-security-scan.ps1            # static
.\scripts\agent-security-scan.ps1 -Opus      # + Opus 4.6 deep-scan (нужен $env:ANTHROPIC_API_KEY)
```
CI: `.github/workflows/agent-security.yml` — авто-скан на PR, меняющих `.claude/**` (report-only, не блокирует).
Репо: https://github.com/affaan-m/agentshield

## 3. SkillSpector (NVIDIA) — gate перед install внешних скиллов
64 паттерна / 16 категорий. Прогонять ЛЮБОЙ community-скилл перед добавлением в `.claude/`.
```powershell
git clone https://github.com/NVIDIA/SkillSpector; cd SkillSpector; make install
skillspector scan <путь-или-git-url> --no-llm   # static, без ключа
```

## Зачем именно здесь
В `.claude/plugins/` лежит `knowledge-work-plugins` (Anthropic) — внешний код, который
Claude Code исполняет как часть Hub-воркфлоу. Эти инструменты — defense-in-depth для
такого внешнего кода. Перед добавлением новых плагинов/скиллов — сначала SkillSpector.
