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


## CHECKPOINT RUN-013/014 — изолированный Firebase Rules emulator, 04.11.2026

- Read-only аудит Git tree PR #3 (исходный HEAD 49971ca) не выявил `firestore.rules`, `firebase.json` или CI Rules emulator. Облачный deployed ruleset и наличие server-issued admin claim по-прежнему **не проверены**.
- [Commit 6a3599e](https://github.com/velardream-ctrl/riveria-sanasto-community-test/commit/6a3599e1ba9d92e899ec039666c09cf38d58110d): создан самостоятельный `admin/security-tests/` с `firestore.contract.rules`, 15 тестами и отдельным GitHub Actions. **Этот deny-all fixture нельзя публиковать как действующие правила учебного приложения.**
- Первый CI [#41918184887](https://github.com/velardream-ctrl/riveria-sanasto-community-test/actions/runs/41918184887) FAILED из-за npm peer dependency ERESOLVE до запуска тестов; [commit 3d15e33](https://github.com/velardream-ctrl/riveria-sanasto-community-test/commit/3d15e3321914ae2f0cc403502c70ff656c463656) исправил SDK на Firebase 13 без отключения проверок.
- [GitHub Actions #41918317702](https://github.com/velardream-ctrl/riveria-sanasto-community-test/actions/runs/41918317702): SUCCESS, настоящий **локальный** Firestore emulator, Node tests 15/15 PASS, 0 FAIL. На точном HEAD 3d15e33 оба workflow также PASS на PR и push.
- Проверено: `get admin_metrics/current` разрешён mock verified non-anonymous admin claim строго boolean; запрет студенту, анонимному пользователю, unverified и любому без роли; list/любые client writes/другие документы отвергаются. Эти mock claims **не означают реальной роли** в TEST Firebase.
- Stage C/H/E остаётся **ЧАСТИЧНО / BLOCKED на реальных проверках**; никакие Firestore cloud Rules не менялись. Исторические утверждения выше о «нет emulator CI» относились к состоянию до RUN-014 и теперь уточнены.

### Следующая обязательная проверка перед cloud-изменениями

1. Read-only экспортировать из Firebase Console **полный актуальный ruleset** именно `sanastoyhteiso-v3-development`, с датой и номером версии. Из GitHub его восстановить невозможно; не заменять contract fixture. Не публиковать в репозитории токены, ключи service account и личные данные.
2. Сравнить с разрешениями существующих `users`, `sync_v3` и других учебных коллекций, которые нельзя случайно заблокировать. Подготовить *аддитивную*, минимальную `match /admin_metrics/{metricId}` проверку на `admin == true`; проанализировать перекрывающиеся `match` и общие allow-правила (в Firestore правила объединяются логическим OR).
3. Провести emulator-regression **на полном будущнем ruleset**, а не только автономном `admin/security-tests/firestore.contract.rules`: deny/allow для admin_metrics плюс совместимость учебных UID. Нужны исходные правила; пока этого теста **нет**.
4. Для реальной приёмки использовать две отдельные тестовые учётные записи; выдача claim только через доверенный Firebase Admin SDK, отдельное согласованное действие владельца. Не принимать скриншот/клиентское скрытие как гарантию прав.
5. Любые изменения реальных TEST Rules/Auth делать только после сверки, бэкапа ruleset и явного согласования; production/тарифы/данные/merge никогда не затрагивать на этом шаге.

**Без реального ruleset и подтверждения тестового владельца Stage C не закрывать; следующий RUN может безопасно продолжить статические/browser проверки на TEST ветке.**


## RUN-015/016 — NEW-003, полный исторический V3 Rules regression (04.11.2026)

**Отдельно найдено:** PR #3 admin-page.js читает `admin_metrics/current`, а полный исторический подготовительный ruleset из [PR #8 commit 828d702](https://github.com/sanastoyhteiso/sanastoyhteiso.github.io/blob/828d702430037aeca271786bbcf067e202f10c0c/staging/backend/firestore.v3-development.rules) содержит `site_admin/{docId}`, но **не содержит** `admin_metrics/{metricId}`. Это высокоприоритетный **NEW-003, HISTORICAL_CONTRACT_MISMATCH**. Текущая deployed версия правил `sanastoyhteiso-v3-development` и фактическая выдача admin claim **не установлены**. Правила другого проекта `riveria-sanasto-community-test` нельзя переносить сюда.

- [TEST интеграционный snapshot commit 2e9a5ac](https://github.com/velardream-ctrl/riveria-sanasto-community-test/commit/2e9a5accde7334cef2f95feb41e66511e346ac68): полная историческая копия правил с additive match **только** `admin_metrics/current`, плюс integration regression на student `users/settings/sync_v3/libraries_v3`. Копия правила **не предназначена для деплоя**.
- [Первый CI #41919685700](https://github.com/velardream-ctrl/riveria-sanasto-community-test/actions/runs/41919685700): **FAILED, 42 PASS / 43 всего**. При отсутствии явно указанного provider Firebase emulator выдаёт `custom`, а условие `!= anonymous` было слишком широким.
- [TEST исправление fd6d94d](https://github.com/velardream-ctrl/riveria-sanasto-community-test/commit/fd6d94d0da7bda24ec4dc3359f346d27a790d1ad): для текущего Google-only admin pilot применён строгий `sign_in_provider == 'google.com'`; другие типы входа отвергаются. Учёт изменений встроен в обе изолированные модели правил и отрицательные tests.
- [GitHub Actions #41920093362](https://github.com/velardream-ctrl/riveria-sanasto-community-test/actions/runs/41920093362): настоящий локальный Firebase Firestore Emulator, **46/46 PASS, 0 FAIL**, exit 0. Это 17 standalone contract tests и 29 integrated tests по историческим student paths/новому admin path. GitHub read-back подтвердил test files в HEAD fd6d94d, PR #3 draft/open, merge=false.
- **Важные границы:** не было чтения published TEST Rules из Firebase, не была выдана серверная роль, не делались прямые запросы двух настоящих аккаунтов, не менялись облачные Rules или Firestore, не тестировались реальные 2 устройства/Safari iOS12. Результаты эмулятора **не закрывают** Stage C/E/H и не дают разрешения на production.
- Следующее безопасное действие: read-only экспортировать **полный текущий deployed TEST ruleset** из `sanastoyhteiso-v3-development` с backup и версией, сравнить с зафиксированным историческим файлом, спроектировать и проверить additive match на реальной полной конфигурации (с правилами студентов), только затем отдельный owner-approved тест server claim в изолированном TEST. **Никогда не публиковать `admin/security-tests/fixtures/*.rules` непосредственно в Firebase.**


## RUN-20261105-018 — владелец предоставил полный TEST Rules текст; emulator 85/85 PASS

- Владелец скопировал в чат полный текст правил для `sanastoyhteiso-v3-development` (05.11.2026). По содержимому это расширенная редакция, соответствующая историческому [`staging/backend/firestore.v3-development-with-finds.rules`](https://github.com/sanastoyhteiso/sanastoyhteiso.github.io/blob/828d702430037aeca271786bbcf067e202f10c0c/staging/backend/firestore.v3-development-with-finds.rules) (blob `86ba7d0b4e4720762babdcd1d6580f644319e08a`): присутствуют `collection_set` для `sync_v3`, `sync_demo_v3`, `site_admin`, все базовые учебные пути и catch-all deny. Подтверждение пришло из присланного владельцем текста, **не независимый Firebase Rules API экспорт**.
- В присланной конфигурации **нет** `match /admin_metrics/{metricId}`: админ-панель PR #3 запрашивает `admin_metrics/current`; этот путь отклоняется исходными правилами даже при реальном admin claim (NEW-003).
- [TEST commit f8a60b6](https://github.com/velardream-ctrl/riveria-sanasto-community-test/commit/f8a60b65fd3e0940052c5df3a40d039d72d06623) сохранил 2 независимых **непубликуемых** fixtures: исходная редакция и копия с добавленным только `admin_metrics/current`. Existing student ACL сохранены без переписывания. Новый файл `admin/security-tests/security.user-supplied.test.cjs` проверяет отказ исходного admin пути, permit/deny добавленного, права `users/settings/sync_v3`, `collection_set`, `sync_demo_v3` (limit/list/create/delete), `libraries_v3`, подписки, отсутствие browser writes.
- [GitHub Actions #41944285697](https://github.com/velardream-ctrl/riveria-sanasto-community-test/actions/runs/41944285697) SUCCESS, native Firebase Firestore Emulator **85/85 PASS, 0 FAIL**, demo-project only; [client/admin regression](https://github.com/velardream-ctrl/riveria-sanasto-community-test/actions/runs/41944285662) SUCCESS на том же HEAD.
- Ограничения остаются: опубликованная версия/release ID и timestamp текущего Firestore Rules **не предоставлены**; независимый API-аудит cloud не проведён, реальный server-issued custom claim не выдан/не проверен, прямые проверки двух реальных аккаунтов и существование backend-managed `admin_metrics/current` не подтверждены. Этапы C/E/H остаются PARTIAL/BLOCKED для реального подключения. `rules_version = '2'` — синтаксис, не номер cloud публикации.
- Допускается только **последующее отдельно согласованное** добавление одного проверенного match после получения backup rules/версии; в этой работе ни Rules, ни Auth/Firestore/данные/тарифы Firebase **НЕ менялись**, production не тронут, PR не merge.
- Дальше: спросить у владельца дату/ID публикации, если доступны в Firebase Rules history; рассмотреть безопасный способ выдать серверный custom admin claim и создавать ограниченный агрегат без использования ключей в клиенте. До нового GO не deploy. Подробности: [README RUN-018](./security-tests/README_USER_SUPPLIED_20261105_RU.md).
