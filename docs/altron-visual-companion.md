# Альтрон Валькирия: clean-room visual companion

Визуальный слой создан внутри Eclipse и не использует код, CSS, модели, видео, голос, изображения или branding Bella. Bella остаётся только продуктовым референсом идеи цифрового компаньона.

## State contract

- `idle`: система ждёт следующую команду;
- `listening`: голосовой слой отдельно подтвердил активный микрофон;
- `thinking`: запрос отправлен, ответ ещё не поступает;
- `speaking`: текст ответа поступает в чат;
- `error`: provider вернул ошибку.

Renderer получает только state, provider label, model label и пользовательские настройки видимости. Он не получает transcript, message history, microphone stream, files, tools, API keys или memory.

## Motion and accessibility

Состояния меняют только opacity и transform изображения. Автоматическая реакция ограничена двумя циклами и полностью отключается при `prefers-reduced-motion: reduce`. Образ можно свернуть, развернуть и скрыть с клавиатуры. Скрытая версия сохраняет доступную кнопку возврата.

Wan2.2 Animate может позже стать отдельным disabled-by-default offline provider для коротких first-party motion clips. Он не входит в runtime интерфейса и не получает доступ к голосовой сессии.