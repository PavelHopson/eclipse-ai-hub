<div align="center">

# Eclipse AI Hub

### Локальная AI-платформа — 6 инструментов, один интерфейс

**Чат, Арена сравнения, RAG, Code Review, Копирайтер, Сканер безопасности.**<br/>
**Работает с Ollama (локально) и облачными провайдерами.**

[![Демо](https://img.shields.io/badge/ОТКРЫТЬ_ДЕМО-6366f1?style=for-the-badge&logo=cloudflarepages&logoColor=white)](https://eclipse-ai-hub.pages.dev)
[![React](https://img.shields.io/badge/React_19-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://typescriptlang.org)
[![Ollama](https://img.shields.io/badge/Ollama-000000?style=for-the-badge&logo=ollama&logoColor=white)](https://ollama.com)
[![MIT](https://img.shields.io/badge/License-MIT-green?style=for-the-badge)](LICENSE)

</div>

---

## Что это?

Eclipse AI Hub — единая платформа для работы с AI-моделями. 6 специализированных инструментов в одном интерфейсе. Подключите свою модель (локальную через Ollama или облачную) — и все инструменты используют её.

**Ключевая идея:** пользователь подключает СВОЮ модель один раз в настройках — и все 6 модулей работают через неё.

---

## 6 модулей

| Модуль | Что делает |
|--------|------------|
| **💬 Чат** | Диалог с AI. История сохраняется. Стриминг ответов. Markdown + code highlight |
| **⚔️ Арена** | Один промпт → 2-4 модели отвечают параллельно. Сравнение скорости и качества |
| **📄 RAG** | Загрузите PDF/TXT → задавайте вопросы по содержимому. Локальная обработка |
| **🔍 Code Review** | Вставьте код → AI находит баги, уязвимости, антипаттерны, предлагает улучшения |
| **✍️ Копирайтер** | Генерация текстов: посты, рекламу, статьи, описания. 6 шаблонов, 4 тона |
| **🛡️ Сканер безопасности** | Анализ кода на уязвимости: SQL injection, XSS, CSRF. Severity-уровни |

## Product radar

Источник: [Eclipse Library · July 2026 project integration](https://library.eclipse-forge.ru/#guide/july-2026-project-integration).

| Reference | Как использовать |
|-----------|------------------|
| **Claude Science beta** | Reference для Research/RAG workspace: scientific sources, notebooks, charts, reviewer, full trace of code/environment/conversation |
| **PPT Master** | Потенциальный модуль "Document → Deck": документ, отчёт или исследование превращается в редактируемую PPTX-презентацию |
| **Colibri** | R&D для локальных runtime: provider readiness, RAM/disk doctor, latency tier, safe next action. Не runtime-зависимость и не обещание fast 744B inference. Детали: [docs/local-model-runtime-rd.md](docs/local-model-runtime-rd.md) |

## Поддерживаемые AI-провайдеры

| Провайдер | Модели | Нужен ключ? | Локальный? |
|-----------|--------|:-----------:|:----------:|
| **Ollama** | Huihui-Qwen 3.5 (без цензуры), Llama 3.1, Mistral, DeepSeek Coder | Нет | Да |
| **Google Gemini** | 2.5 Flash, 2.5 Pro, 2.0 Flash | Да | Нет |
| **OpenAI** | GPT-4o, GPT-4o-mini, o3-mini | Да | Нет |
| **Anthropic** | Claude Sonnet 4.6, Claude Haiku 4.5 | Да | Нет |
| **OpenRouter** | Любая модель через единый API | Да | Нет |

### Provider readiness backlog

Direct Kimi K3 remains a benchmark candidate, not a production provider. The network-free manifest and the gated synthetic suites for AI Hub, Sentinel, and OMC are documented in [docs/kimi-k3-benchmark.md](docs/kimi-k3-benchmark.md). TokenRouter is not used by this harness.

Следующий уровень настроек — не просто выбрать провайдера, а понять, **готов ли он к работе**.
Для этого в backlog добавлен Colibri-inspired подход:

- проверка endpoint / model path
- оценка RAM, disk и latency tier
- понятное состояние `ready / slow / unsafe / missing`
- одна очевидная next action для пользователя

> **Рекомендация:** Установите Ollama + Huihui-Qwen для работы без ограничений, без интернета, бесплатно.

## Быстрый старт

### Server-side gateway для Eclipse Chat

Контракт [`ai.v1`](contracts/ai.v1.openapi.yaml) и runtime находятся в [`gateway/`](gateway/README.md).
Gateway хранит upstream credentials только на сервере, разрешает ограниченный список моделей и подключается к Eclipse Chat как opt-in canary. Текущий browser BYOK-режим остаётся отдельным и не используется для межсервисной авторизации.

### MCP для разработки Hub

MCP не запускается внутри browser-приложения и API keys не попадают в frontend bundle. Вместо этого
можно сгенерировать отдельный локальный конфиг для своего coding-agent:

```bash
# Сначала посмотреть результат без записи файла
npm run mcp:baseline -- --workspace . --dry-run

# Создать ignored-файл .mcp.local.json: Context7 + доступ Filesystem только к этому репозиторию
npm run mcp:baseline -- --workspace .

# GitHub подключается только явно; нужен Docker и fine-grained read-only token в environment
npm run mcp:baseline -- --workspace . --github
```

Генератор закрепляет версии packages, не перезаписывает существующий конфиг без `--force` и ничего
не запускает автоматически. Перед импортом `.mcp.local.json` проверьте tool descriptions; запросы
Context7 не должны содержать private code, credentials или пользовательские данные.

```bash
# Клонировать
git clone https://github.com/PavelHopson/eclipse-ai-hub.git
cd eclipse-ai-hub

# Установить
npm install

# Запустить
npm run dev
```

### Подключение Ollama (для локальной работы)

```bash
# Установить Ollama
# https://ollama.com/download

# Скачать модель без цензуры
ollama run huihui-ai/Huihui-Qwen3.5-35B-A3B-abliterated

# Открыть Eclipse AI Hub → Настройки → Ollama
```

## Технологии

```
Фронтенд        React 19 + TypeScript + Vite 6
Стилизация       TailwindCSS 3
AI               Ollama / Gemini / OpenAI / Claude / OpenRouter
RAG              Клиентский чанкинг + keyword relevance
Деплой           Cloudflare Pages
```

## Структура

```
src/
  App.tsx                    # Роутер + боковая панель
  types.ts                   # Типы + реестр провайдеров
  components/
    Sidebar.tsx              # Навигация (6 модулей + настройки)
    MessageBubble.tsx         # Сообщение в чате (markdown, code)
    ProviderBadge.tsx         # Бейдж провайдера
  pages/
    Chat.tsx                 # 💬 AI-чат со стримингом
    Arena.tsx                # ⚔️ Арена сравнения моделей
    RAG.tsx                  # 📄 Чат с документами
    CodeReview.tsx           # 🔍 Ревью кода
    Copywriter.tsx           # ✍️ Генератор текстов
    SecurityScan.tsx         # 🛡️ Сканер уязвимостей
    Settings.tsx             # ⚙️ Настройки AI-провайдера
  services/
    aiService.ts             # Универсальный AI-сервис (5 провайдеров)
    ragService.ts            # Парсинг документов + чанкинг
    historyService.ts        # Сохранение истории чата
```

## Лицензия

[MIT](LICENSE)

---

<div align="center">
<sub>Сделано в Eclipse Forge</sub>
</div>
