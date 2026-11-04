# СНАЧАЛА ОТКРОЙ ЭТО — передача ChatGPT / Work

**Дата:** 2026-11-04. **Статус:** черновая подготовка, НЕ готово для production.  
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

## Непосредственное следующее действие
**Этап A**: проверить сегодняшние HEAD/CI/файлы, составить карту доступных функций, показать актуальные блокеры; затем приступить к этапу B/C — назначение роли администратора только в TEST Firebase и серверно проверенные Rules с тестами двух аккаунтов. Отдельно подобрать безопасную схему приёма/агрегации ошибок и backend ZIP, совместимую с бюджетом владельца.

## Отчёт по окончании каждого продолжения
- «Сделано»: что, в каком repo/branch и commit.
- «Проверено»: какие реальные CI/браузеры/аккаунты и точные результаты.
- «Не сделано»: блокеры и риски, без заявлений о готовности.
- «Следующий шаг»: первый незакрытый пункт issue #10.
- Обновить журнал передачи в каноническом MASTER ROADMAP и issue #10.
