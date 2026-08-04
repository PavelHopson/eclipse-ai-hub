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
