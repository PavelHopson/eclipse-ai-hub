# eclipse.automation-audit.v1

## Outcome

Первый безопасный B2B vertical slice превращает интервью с малым бизнесом в проверяемый
read-only audit: intake → process map → proposal → Claim Auditor → human approval → receipt.
Receipt подтверждает только решение по proposal. Он не доказывает экономический результат и
не разрешает OAuth, сообщения, платежи, изменение production или доступ к клиентским данным.

## Contract boundary

- input: company/role/objective, 2–12 process steps, systems, constraints;
- evidence: 1–20 обезличенных записей с уникальными ID;
- SaaS validation: problem, audience, offer, interview count, waitlist count, pilot evidence;
- proposal: outcome, scope, exclusions, one pilot metric;
- claims: 1–12 утверждений, каждое связано с известными evidence IDs или остаётся qualified;
- policy: `readOnly=true`; OAuth, external actions, production changes and payments are false;
- approval: три явных human confirmations;
- receipt: decision, timestamp and statement of the exact non-execution boundary.

AI Hub создаёт и локально утверждает source artifact. При импорте Eclipse Chat обязан повторно
валидировать exact schema, сбросить source approval/receipt и провести независимый tenant-scoped
review. Это защищает от самоутверждения AI или подмены source receipt локальным решением команды.

## SaaS validation evidence ladder

1. `problem` и `audience` — гипотезы, пока нет интервью.
2. `interviews` — количество, не доказательство готовности платить.
3. `waitlist` — сигнал интереса, не выручка и не activation.
4. `pilotEvidence` — граница того, что реально наблюдалось.
5. Paid pilot, retention и measured outcome появятся только как новые evidence types после
   фактического результата; текущий контракт не генерирует их автоматически.

## Security risk register

Шкала: likelihood/impact Low–High; risk — qualitative combination до controls.

| ID | Threat event | Likelihood | Impact | Risk | Implemented treatment | Residual |
|---|---|---:|---:|---:|---|---:|
| R1 | Секрет или пароль попадает в intake/export | Medium | High | High | size limits, control/secret detection, no OAuth fields | Low |
| R2 | Неподтверждённый claim маркируется фактом | High | High | High | exact evidence-ID binding; missing evidence → qualified | Medium |
| R3 | Source artifact сам утверждает действие | Medium | High | High | Chat resets approval/receipt; second human gate | Low |
| R4 | Cross-tenant read/update review | Low | High | High | membership/RBAC plus `{id, serverId}` selectors | Low |
| R5 | Replay/race создаёт два решения | Medium | Medium | Medium | idempotency key, unique constraints, optimistic version | Low |
| R6 | Пользователь воспринимает receipt как выполненную automation | Medium | High | High | explicit non-execution statement in UI/receipt/policy | Medium |
| R7 | Prompt injection из evidence запускает tool | Medium | High | High | deterministic local mapper; no model/tool request | Low |

Maintenance trigger: расширение evidence types, подключение LLM, OAuth, uploads, external
messaging, payment or production access требует новой threat model и отдельного owner approval.
