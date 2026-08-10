# Eclipse Growth OS — первый owned vertical slice

## Решение

Eclipse Forge не покупает Teamly и не подключает его к рабочим данным. Полезные продуктовые
паттерны — изолированная рабочая область, роли, observable run и approval gate — реализуются
самостоятельно в Eclipse AI Hub и Eclipse Chat.

Первый slice превращает один подтверждённый релиз в versioned контент-артефакт:

```text
Finding -> Research -> Strategy -> Draft -> Claim audit -> Final -> Human approval
```

Это не автономная SMM-команда. Пользователь запускает каждый шаг отдельно и видит результат
до следующего запроса.

## Владение

- **Eclipse AI Hub** исполняет пять ограниченных AI-ролей.
- **Eclipse Chat** станет control plane: Growth Command Room, участники, review и история.
- **Eclipse Library** остаётся источником evidence, license status и редакторского доверия.
- **Sentinel** позже получает только read-only наблюдение за ссылками, позициями и аномалиями.
- **Eclipse Media / Shotforge / HyperFrames** подключаются только после утверждения текста.

## Контракт `growth.run.v1`

Экспорт не содержит API key, cookies или service credentials. Он включает:

- идентификатор, даты и статус run;
- название релиза, аудиторию, канал, официальные HTTPS-ссылки и evidence notes;
- provider/model без credential;
- до пяти последовательных артефактов;
- явную policy: `externalActions=false`, `publishAllowed=false`, `toolsAllowed=false`;
- отдельное подтверждение человека перед статусом `approved`.

Стоимость помечается как `provider-dependent`: текущий browser BYOK runtime не возвращает
унифицированную фактическую стоимость. Интерфейс честно показывает максимум пять запросов.

## Security boundary

- Источники и результаты предыдущих ролей всегда считаются недоверенными данными.
- Prompt injection внутри источника не меняет system policy.
- Роли не получают browser, MCP, GitHub, публикацию, рекламу, рассылку или платежи.
- Ссылки не открываются и не загружаются автоматически; принимаются только HTTPS URL без credentials.
- Uncensored/abliterated модели заблокированы для этого workflow.
- Один клик создаёт не больше одного AI-запроса; следующий шаг не стартует автоматически.
- AI не может присвоить собственному результату статус `approved`.
- Вывод показывается как plain text, поэтому HTML из модели не исполняется.
- Каждая роль возвращает отдельный server-owned JSON schema внутри `content`; prose,
  Markdown, лишние поля, чужая role schema и незавершённые результаты отклоняются.
- `verified` research facts и claims обязаны ссылаться только на HTTPS URL из входного
  allowlist. Planned offer/CTA не считаются независимым evidence результата.
- Strategy и final proposition обязаны явно оставаться test/experiment/hypothesis до
  появления отдельно проверенного outcome evidence.
- Invalid model output возвращает sanitized `invalid_upstream_response` и не становится
  артефактом следующего шага.

## Typed role outputs

| Step | Schema | Required completion |
| --- | --- | --- |
| Researcher | `growth.research.v1`; `growth.research.v2` with Evidence Cards | v2 verified facts copy one reviewed card ID and claim exactly |
| Strategist | `growth.strategy.v1` | one audience, problem hypothesis, proposition, offer, CTA and KPI |
| Writer | `growth.draft.v1` | title, body, evidence boundary and one CTA |
| Claim Auditor | `growth.claims.v1`; `growth.claims.v2` with Evidence Cards | v2 verified/planned claims bind to the matching card state |
| Editor | `growth.final.v1` | compact positioning artifact and `finalComplete: true` |

The public endpoint still returns `growth.execute.result.v1`; its `content` field is a
canonical JSON string for the current step. This avoids a breaking envelope migration
while making every handoff machine-validatable.

Every prior artifact is validated again when the next step starts. A pre-migration
unfinished run with prose-only artifacts fails closed and must be restarted. Historical
completed `growth.run.v1` exports remain immutable evidence and are not migrated in place.

`evidenceCards` is optional for envelope compatibility. Each card has a unique ID, exact
claim, state (`verified`, `hypothesis`, `planned`, `unknown` or `rejected`), source URL or
`null`, and an evidence boundary. Verified cards require an HTTPS URL already present in
`sourceUrls`. When cards exist, claim-to-source binding uses the card ID; an allowlisted
URL by itself is no longer sufficient to mark a generated claim verified.

## UX states

- empty: форма релиза и очевидный безопасный пример;
- validation error: конкретная ошибка до AI-запроса;
- running: одна активная роль и объяснение границы;
- provider error: текущий шаг можно повторить без потери предыдущих;
- ready for approval: обязательный human confirmation;
- success: approved artifact и versioned JSON export;
- disabled: отсутствующий API key или небезопасная модель блокируют запуск.

## Реализованный control plane: Eclipse Chat

1. Growth Command Room создаёт и хранит `growth.run.v1` server-side с member authorization и optimistic versioning.
2. Каждый клик вызывает только следующий `POST /v1/growth/execute`; произвольный chat endpoint этому client недоступен.
3. Отдельная identity `eclipse-chat-growth` получает только scope `growth:execute` и собственный минутный budget.
4. Chat применяет timeout, cancel, idempotency key и дневной per-user budget; попытка списывается до внешнего вызова.
5. Gateway сохраняет только aggregate telemetry без prompt content и identifiers.
6. Публикация остаётся отдельным будущим workflow с новым permission и ручным diff approval.

Ручной JSON import сохранён как переносимый fallback. Production OAuth-коннекторы,
автопубликация, outreach, Ads API, платежи и mutation tools остаются запрещены.
