# СНАЧАЛА ОТКРОЙ ЭТО — передача ChatGPT / Work

**КРИТИЧЕСКИЙ ОБЯЗАТЕЛЬНЫЙ ЖУРНАЛ:** [открыть START/END журнал](https://github.com/sanastoyhteiso/sanastoyhteiso.github.io/blob/release/v3-safe-integration-20261104/docs/WORK_ACTIVITY_LOG_2026-11-04_RU.md). Перед каждым действием сначала сохранить запись `НАЧАЛ / RUN-ID` в GitHub, сразу после — `ЗАВЕРШИЛ` (или BLOCKED/FAILED/WAITING_OWNER) с ссылкой на результат. Если `НАЧАЛ` не закрыт — считать действие не подтверждённым, проверить фактическое состояние перед повтором. Не ограничиваться итоговым отчётом, фиксировать последовательность операций по одной. Параллельные Work в одной ветке не запускать без координации.

**Дата:** 2026-11-04. **Статус:** черновая подготовка, НЕ готово для production.  
**Паспорт происхождения/архитектуры/точек восстановления:** https://github.com/sanastoyhteiso/sanastoyhteiso.github.io/blob/release/v3-safe-integration-20261104/docs/PROJECT_HISTORY_ARCHITECTURE_2026-11-04_RU.md — открыть прежде, чем искать старые чаты или менять хранилище.
**Состояние этапа A:** ЧАСТИЧНО, инвентаризированы GitHub и метаданные оригинальных Google Drive таблиц; восстановление частных данных и живое тестирование ещё не проверены.
**Канонический план и этапы A–K:** https://github.com/sanastoyhteiso/sanastoyhteiso.github.io/blob/release/v3-safe-integration-20261104/docs/MASTER_ROADMAP_V3_ADMIN_RELEASE_2026-11-04_RU.md  
**Живая доска задач с галочками:** https://github.com/sanastoyhteiso/sanastoyhteiso.github.io/issues/10  
**Текущий этот PR:** https://github.com/velardream-ctrl/riveria-sanasto-community-test/pull/3  
**Будущий релизный PR:** https://github.com/sanastoyhteiso/sanastoyhteiso.github.io/pull/9

## Что от тебя требуется
1. Прочитать мастер-документ полностью; **не повторять уже выполненные действия** и не начинать новый репозиторий.
2. Сверить текущий GitHub HEAD, PR и GitHub Actions, а не доверять старым SHA/сообщениям. Отметить актуальное состояние по этапу A в issue #10.
3. Продолжить по порядку A → B → C → D → E → F → G → H → I → J → K, фиксируя каждое изменение и проверки (commit SHA, workflow run URL, тестовая среда, оставшийся блокер).
4. Не объявлять готовыми отключённые функции. В текущем черновом `/v3-unified-preview/admin/` есть каркас отдельного кабинета, **но нет** серверной роли владельца, настоящего приёма ошибок/агрегатов и работающего ZIP-upload backend.
5. По критическому запросу владельца **раздел «Данные» обычного ученика не должен показывать админскую диагностику**, и сообщения Firebase/V3/разработки не должны появляться на учебных страницах. Админ — отдельный `/admin/`.
6. Настоящий сайт `https://sanastoyhteiso.github.io/` **не менять**, пока этапы A–I и release-gates не закрыты с проверками, и владелец явно не дал GO.

## Точные ресурсы
- LIVE repo: `sanastoyhteiso/sanastoyhteiso.github.io`, `main` = `d29813cf409af9dc60804105ca3141f98ec12fcd` на дату подготовки; ветка отката `backup/production-before-v3-20261104`.
- LIVE Firebase: `riveria-sanasto-community-test`, с существующими пользователями/UID.
- TEST repo: `velardream-ctrl/riveria-sanasto-community-test`, URL `https://velardream-ctrl.github.io/riveria-sanasto-community-test/v3-unified-preview/`.
- TEST Firebase: `sanastoyhteiso-v3-development`. Нельзя просто переключить `config.js` на LIVE.
- `admin/ADMIN_RELEASE_DESIGN_2026-11-04_RU.md`: технический контракт диагностики/ZIP.
- `admin/rs-release-manifest.js` и `admin/tests/release-manifest.test.cjs`: строгая предварительная проверка ZIP manifest (не публикует сайт).
- `v3-unified-preview/admin/index.html` + `admin-page.js`: изолированный read-only admin UI, проверяющий серверную Firebase роль; данные пока не подключены.
- `v3-unified-preview/admin-entry.js` + изменения `index.html`/`app.js`: скрытая для учеников админ-ссылка, старый admin-виджет убран из «Данные» (только в этом **не слитом** PR).
- Предыдущая история offline sync: https://github.com/sanastoyhteiso/sanastoyhteiso.github.io/pull/8.

## Необходимые защитные условия
- Firebase Spark и GitHub Pages — статический хост. Без отдельного доверенного backend нельзя безопасно принять ZIP и записать сайт в GitHub. Не размещать PAT/service account/admin key в браузере, репозитории или чате.
- Администратор получает роль через Firebase Admin SDK на доверенном сервере; Firestore Rules реально проверяют `admin=true`.
- Клиент сообщает лишь минимальные технические **коды** и браузер/версию, не raw errors/stack, email, личные учебные слова и данные пациентов. GDPR, TTL, rate-limit, проверяемая серверная сводка.
- Статус «ОК» только при свежем heartbeat/проверках и работающей телеметрии, иначе «Нет данных».
- iPad mini 3 / Safari iOS 12.5.x — обязательный регрессионный тест.
- Не слепо сливать PR #8/#9 и не уничтожать Firebase события/UID/Drive/IndexedDB. Согласие владельца забыть собственную статистику не относится к чужим данным.

## Новое обязательное правило владельца — запись после каждой задачи

**Любой новый ChatGPT/Work должен фиксировать результаты не только в конце этапа, но после КАЖДОЙ отдельной выполненной или частично выполненной задачи.** Это условие сохраняется при всех будущих сменах чатов.

1. Перед началом прочитать [Issue #10](https://github.com/sanastoyhteiso/sanastoyhteiso.github.io/issues/10) и два раздела мастер-документа: **«Журнал выполнения задач»** и **«Реестр новых задач»**.
2. После каждого рабочего шага создать датированную запись `TASK-YYYYMMDD-NNN` в master roadmap: что сделано; что проверено; SHA/PR/CI; статус `ГОТОВО/ЧАСТИЧНО/ЗАБЛОКИРОВАНО`; что осталось; ближайшее следующее действие.
3. Все обнаруженные дополнительные задачи и ошибки заводить с ID `NEW-NNN` в реестр и фиксировать в GitHub Issue #10. При большой самостоятельной проблеме открывать связанный Issue; добавлять взаимные ссылки. Ничего не оставлять только в истории чата.
4. Промежуточный результат не равен законченному этапу A–K: соответствующую галочку отмечать лишь после полного выполнения критериев с доказательствами.
5. После каждой сессии дописать короткую передачу: текущая ветка/commit/CI, что сделано, что осталось, с чего начать следующему исполнителю.
6. Записи — **append-only** (не стирать историю). Если GitHub недоступен, честно зафиксировать это в ответе и дать готовый текст для переноса.

**Первоисточник и шаблон**: https://github.com/sanastoyhteiso/sanastoyhteiso.github.io/blob/release/v3-safe-integration-20261104/docs/MASTER_ROADMAP_V3_ADMIN_RELEASE_2026-11-04_RU.md

## Непосредственное следующее действие
**Этап A**: проверить сегодняшние HEAD/CI/файлы, составить карту доступных функций, показать актуальные блокеры; затем приступить к этапу B/C — назначение роли администратора только в TEST Firebase и серверно проверенные Rules с тестами двух аккаунтов. Отдельно подобрать безопасную схему приёма/агрегации ошибок и backend ZIP, совместимую с бюджетом владельца.

## Отчёт по окончании каждого продолжения
- «Сделано»: что, в каком repo/branch и commit.
- «Проверено»: какие реальные CI/браузеры/аккаунты и точные результаты.
- «Не сделано»: блокеры и риски, без заявлений о готовности.
- «Следующий шаг»: первый незакрытый пункт issue #10.
- Обновить журнал передачи в каноническом MASTER ROADMAP и issue #10.

## Обязательный восстановительный резерв — NEW-001 (подтверждено 04.11.2026)

**Архитектурное решение владельца найдено в staging 3 ноября:** основная база — Firestore, независимый датированный **закрытый Google Sheets/Drive backup** как защита на бесплатном Firebase Spark. Это НЕ ежедневная ручная Google-табличная синхронизация.

- `staging/rs-backup-plan.js` умеет собрать `scores/words/favorites/settings` snapshot и проверить обратное преобразование, но возвращает `PREPARED_NOT_UPLOADED` и **не вызывает Google Sheets API**.
- Закрытые Google Sheets уже существуют (исторические копии), но автоматический процесс резервирования Firestore и проверенное восстановление новых V3 данных ещё не реализованы.
- Новая сквозная задача `NEW-001` добавлена в [Issue #10](https://github.com/sanastoyhteiso/sanastoyhteiso.github.io/issues/10) и [мастер-план](https://github.com/sanastoyhteiso/sanastoyhteiso.github.io/blob/release/v3-safe-integration-20261104/docs/MASTER_ROADMAP_V3_ADMIN_RELEASE_2026-11-04_RU.md), [первоисточники в паспорте §6A](https://github.com/sanastoyhteiso/sanastoyhteiso.github.io/blob/release/v3-safe-integration-20261104/docs/PROJECT_HISTORY_ARCHITECTURE_2026-11-04_RU.md).
- До GO реализовать проверяемый независимый периодический backup → versioned copies → hashes/сверка → тестовое восстановление без перезаписи prod → статус последнего проверенного snapshot в admin. Никакие секреты и личные данные не класть в публичный GitHub.



## CHECKPOINT 04.11.2026 — NEW-002 сохранён, CI действительно зелёный

- Исторический RUN-008 остаётся `RECOVERED_NOT_PUSHED` (это **не** успешный commit предыдущего Work). Повторная реализация выполнена под RUN-011/012.
- TEST PR #3: [fix/code commit 91fa4f7](https://github.com/velardream-ctrl/riveria-sanasto-community-test/commit/91fa4f79ff2b8564c1a3671153e55ab0057e346d), `admin/tests/admin-access.test.cjs` (29 Node mock tests), [CI workflow commit 5f4ae30](https://github.com/velardream-ctrl/riveria-sanasto-community-test/commit/5f4ae30af80736f582c7c6eb01b4c731a609ea63).
- [GitHub Actions #41915536733](https://github.com/velardream-ctrl/riveria-sanasto-community-test/actions/runs/41915536733): `success`, нативные Node tests **29/29 PASS**, syntax checks и release manifest PASS.
- [Полный технический audit](./ADMIN_TECHNICAL_AUDIT_2026-11-04_RU.md) сохраняет ограничения и следующий шаг. Реальный admin claim, Firestore Rules, серверные данные, браузеры/iOS12 — **не проверены**. Stage B/C/E не закрывать, production и Firebase не менять, merge без GO запрещён.


## CHECKPOINT 04.11.2026 — RUN-013/014: emulator 15/15 PASS (НЕ live Firebase)

- TEST [security contract commit 6a3599e](https://github.com/velardream-ctrl/riveria-sanasto-community-test/commit/6a3599e1ba9d92e899ec039666c09cf38d58110d), [исправление зависимостей 3d15e33](https://github.com/velardream-ctrl/riveria-sanasto-community-test/commit/3d15e3321914ae2f0cc403502c70ff656c463656).
- [Actions 41918317702](https://github.com/velardream-ctrl/riveria-sanasto-community-test/actions/runs/41918317702): **real local Firestore emulator 15/15 PASS, 0 FAIL**; [TEST client CI 41918317604](https://github.com/velardream-ctrl/riveria-sanasto-community-test/actions/runs/41918317604) SUCCESS.
- `admin/security-tests/firestore.contract.rules` — **только изолированный deny-all TEST fixture, НЕ deployed rules и НЕ файл для замены правил**. Полное облачное TEST ruleset и server-issued custom claim по-прежнему не прочитаны/не подтверждены. Нужна сверка правил со всем student access до additive обновления.
- [Аудит с планом дальнейшего действия](./ADMIN_TECHNICAL_AUDIT_2026-11-04_RU.md); сверить GitHub PR #3 HEAD/CI, внести новый RUN START. До GO никаких изменений реальной Firebase и production.


## CHECKPOINT 04.11.2026 — NEW-003 на полном историческом ruleset: 46/46 PASS, НЕ deployed

- Источник mismatch: исторические правила V3 [PR #8 commit 828d702](https://github.com/sanastoyhteiso/sanastoyhteiso.github.io/commit/828d702430037aeca271786bbcf067e202f10c0c) содержат `site_admin`; текущая TEST админка PR #3 читает `admin_metrics/current`. NEW-003 зарегистрирован в мастер-плане и Issue #10.
- [Snapshot и integration tests 2e9a5ac](https://github.com/velardream-ctrl/riveria-sanasto-community-test/commit/2e9a5accde7334cef2f95feb41e66511e346ac68), [строгая Google-only роль для emulator fd6d94d](https://github.com/velardream-ctrl/riveria-sanasto-community-test/commit/fd6d94d0da7bda24ec4dc3359f346d27a790d1ad): [Actions #41920093362](https://github.com/velardream-ctrl/riveria-sanasto-community-test/actions/runs/41920093362) **46/46 PASS**. Первый CI 42/43 FAIL сохранён в журнале, не скрывается.
- `admin/security-tests/fixtures/*.rules` и `firestore.contract.rules` — **NOT DEPLOYABLE!** Историческая/тестовая копия, не current cloud rules. Настоящие deployed TEST Rules и реальный admin claim не подтверждены; никаких cloud операций.
- [Полный аудит](./ADMIN_TECHNICAL_AUDIT_2026-11-04_RU.md) содержит ограничения. Следующий чат: начать с journal START, read-only сверить актуальный deployed TEST ruleset, затем full emulator tests по его snapshot; не merge, не production, не затрагивать другой Firebase проект.


## CHECKPOINT 05.11.2026 — RUN-018, owner-supplied TEST rules, 85/85 PASS

- Владелец прислал текст TEST Firestore Rules `sanastoyhteiso-v3-development`, в котором `collection_set` и `sync_demo_v3` присутствуют, а `admin_metrics/current` отсутствует. Соответствующий historical файл [PR #8](https://github.com/sanastoyhteiso/sanastoyhteiso.github.io/blob/828d702430037aeca271786bbcf067e202f10c0c/staging/backend/firestore.v3-development-with-finds.rules), blob `86ba7d0b`; облачная revision/time UNKNOWN.
- [TEST commit f8a60b6](https://github.com/velardream-ctrl/riveria-sanasto-community-test/commit/f8a60b65fd3e0940052c5df3a40d039d72d06623): separate baseline + additive offline fixtures, 39 новых security cases; [Actions #41944285697](https://github.com/velardream-ctrl/riveria-sanasto-community-test/actions/runs/41944285697) **85/85 PASS, 0 FAIL** real local Emulator; [client regression #41944285662](https://github.com/velardream-ctrl/riveria-sanasto-community-test/actions/runs/41944285662) SUCCESS.
- [Технический аудит](./ADMIN_TECHNICAL_AUDIT_2026-11-04_RU.md). **Fixtures нельзя deploy.** Никаких Firebase cloud writes, real claim, теста двух аккаунтов или production. Новый admin_metrics ещё не работает в реальном проекте; нет серверной сводки/настоящего admin claim.
- Следующий чат: сверить HEAD и CI, START новый RUN, запрашивать только metadata публикации и owner-approved отдельный plan на additive TEST rules (с backup и rollback). Не выдавать 85 эмуляторных PASS за live permit/deny. PR #3 Draft/open.


## HANDOFF 05.11.2026 — RUN-018: полный TEST Rules готов владельцу

- [Полный готовый код для копирования](./security-tests/candidates/FIRESTORE_V3_DEVELOPMENT_FULL_FOR_MANUAL_REVIEW.rules) — **только** `sanastoyhteiso-v3-development`. TEST code commit [bb3b39d](https://github.com/velardream-ctrl/riveria-sanasto-community-test/commit/bb3b39dea3cfc5cf5a8c0eca1ad95510ad9f98b3); [Actions 41944955117](https://github.com/velardream-ctrl/riveria-sanasto-community-test/actions/runs/41944955117) **86/86 PASS**, [client CI](https://github.com/velardream-ctrl/riveria-sanasto-community-test/actions/runs/41944954897) SUCCESS. Чистый add-only diff зафиксирован проверкой целостности.
- User попросил полный файл для **личного** Publish/replace. В этом чате Firebase cloud не менялась и никакой Auth custom admin claim не выдавался. Правило добавляет только permission read `admin_metrics/current`, не даёт роль и не создаёт агрегат; backend/role/2 real account tests остаются OPEN. Не применять в `riveria-sanasto-community-test` или production. Перед ручным Publish проверить original/version, сохранить backup, убедиться в Google провайдере.
- Следующий RUN: только после новой подтверждённой версии TEST Rules в Console и отдельного согласования можно проверить реальный request.auth.admin и отсутствие data leakage, затем backend aggregated metrics. Не объявлять admin готовым без проверок.
