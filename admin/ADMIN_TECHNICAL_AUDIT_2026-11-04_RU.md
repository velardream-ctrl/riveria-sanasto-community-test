# TEST admin — техническая проверка NEW-002, 04.11.2026

**Автор проекта:** Илья Дмитриев. **Статус:** клиентский fail-closed патч сохранён и покрыт изолированными тестами, **не готовая административная панель**.

## Ссылки на источники проверки

- [TEST PR #3](https://github.com/velardream-ctrl/riveria-sanasto-community-test/pull/3): draft/open; **не объединять**.
- [Проверенный код + 29 тестов](https://github.com/velardream-ctrl/riveria-sanasto-community-test/commit/91fa4f79ff2b8564c1a3671153e55ab0057e346d).
- [CI workflow](https://github.com/velardream-ctrl/riveria-sanasto-community-test/commit/5f4ae30af80736f582c7c6eb01b4c731a609ea63).
- [GitHub Actions #41915536733](https://github.com/velardream-ctrl/riveria-sanasto-community-test/actions/runs/41915536733): success, Native Node 20, **29 tests / 29 pass / 0 fail**, JS syntax checks PASS, release manifest tests PASS.
- [Главный журнал START/END](https://github.com/sanastoyhteiso/sanastoyhteiso.github.io/blob/release/v3-safe-integration-20261104/docs/WORK_ACTIVITY_LOG_2026-11-04_RU.md), RUN-008 (RECOVERED_NOT_PUSHED), RUN-011/012.
- [Issue #10](https://github.com/sanastoyhteiso/sanastoyhteiso.github.io/issues/10).

## Происхождение / осторожность

Предыдущий ChatGPT Work закончил локальную проверку 58/58, но не загрузил файлы, оборвался на RUN-008. Проверка сохранённых исходников показала отсутствие исправлений и тестов на HEAD 7b4f851. Исторический RUN-008 имеет статус **RECOVERED_NOT_PUSHED, НЕ DONE**. Новый код не выдаётся за тот же несохранённый набор. Пересоздан отдельный регрессионный набор **29** тестов.

## Изменённые файлы и конкретные механизмы

- `v3-unified-preview/admin/admin-page.js`: перед каждым изменением ID token, пользователя или статуса права скрываются; удаляются старые DOM и агрегаты, сбрасываются флаги. Сессионный счётчик и идентичность объекта пользователя отсекают опоздавшие claim и Firestore success/error. Чтение только `admin_metrics/current`, `{source:'server'}`; синхронные отказы не приводят к ложному OK.
- `v3-unified-preview/admin-entry.js`: ссылка по умолчанию скрыта; `onIdTokenChanged` слушает изменение токена и отзывает ссылку сразу; устаревшие ответы не показывают её после смены пользователя.
- Оба JS-потока принимают только `result.claims.admin === true`, `emailVerified === true` и `isAnonymous !== true`. При первом событии пользователя вызывается `getIdTokenResult(true)`, при дальнейших событиях того же объекта — `false`, чтобы не запускать бесконечную цепочку принудительного refresh.
- Сверяются проект, `authDomain`, `apiKey` у активного Firebase default app с `RS_FIREBASE_CONFIG` тестового проекта; несовпадение закрывает доступ.
- `v3-unified-preview/index.html`, `admin/index.html`, `sw.js`: одинаковая версия скриптов `admin-auth-2`, cache bump `20261104-v6`.
- `admin/tests/admin-access.test.cjs`: 29 Node VM регрессионных сценариев на контролируемых Auth/Firestore/DOM заглушках: verified/anonymous/ordinary, strict claim, несовпадающий app, обновление токена, смена пользователя, deferred promise, stale read, exception, отсутствие writes, версии скриптов.
- `.github/workflows/admin-regression.yml`: GitHub Actions только с read-only contents permissions; Node 20, синтаксис, mock regression и существующие manifest tests. В workflow **нет секретов, deploy, Firebase writes, оплаты или изменений данных**.

## Воспроизводимая проверка

```sh
node --check v3-unified-preview/admin/admin-page.js
node --check v3-unified-preview/admin-entry.js
node --check v3-unified-preview/sw.js
node --check admin/tests/admin-access.test.cjs
node --test admin/tests/admin-access.test.cjs
node admin/tests/release-manifest.test.cjs
```

GitHub Actions на commit 5f4ae30: все указанные шаги PASS. GitHub API подтвердил сохранённую тестовую ветку и наличие файла тестов после push. Только наличие зелёного CI по mock не подтверждает ни реальную серверную защиту, ни правильность Firebase правил.

## Что остаётся, статус release gates

1. **C / SECURITY BLOCKER:** отдельно выдать тестовому владельцу серверный custom admin claim, выполнить явный deny обычному/анонимному пользователю и permit только админу в настоящих Security Rules/эмуляторе. Подтвердить защиту прямого запроса к `admin_metrics/current`; скрытие ссылки — не security boundary. До этого **никакого GO**.
2. **E / RUNTIME:** проверить настоящий вход в тестовый проект, токены, Firestore 403/permission-denied, потерю сети, смену аккаунта, tab refresh, мобильные Safari/iOS12; проверить исходный URL/test site после загрузки Pages.
3. **D / MONITORING:** серверные агрегаты и отказоустойчивость телеметрии пока не подключены; «Нет данных» не равно «Ошибок нет».
4. **H / CI:** правила Firestore emulator, браузеры и реальный двухпользовательский сценарий отсутствуют в CI. Добавить отдельные tests без секретов.
5. **I/J:** production main/Firebase не менять; до явного GO владельца и всех gates A–I никакого merge или релиза. Задачи NEW-001 (backup+restore) и полноценный безопасный ZIP релиз также открыты.

## Следующему чату

1. Прочитать главный START/END журнал и Issue #10, сверить текущий HEAD PR #3 (ожидается тестовая ветка после этого отчёта) и последний CI.
2. Перед действиями создать свой `RUN-YYYYMMDD-NNN / НАЧАЛ` в GitHub.
3. Продолжить **C: проверка Security Rules / custom admin claim** в изолированном тестовом проекте и только с безопасным разрешением владельца для фактической выдачи роли/правок облака. Начать с read-only аудита тестовых Rules и модели доступа, затем отдельный план эмулятора/тестов.
4. После каждого шага `ЗАВЕРШИЛ` либо `BLOCKED`, обновить TASK/Issue; не ставить DONE на stage C/E по одному JS smoke.
