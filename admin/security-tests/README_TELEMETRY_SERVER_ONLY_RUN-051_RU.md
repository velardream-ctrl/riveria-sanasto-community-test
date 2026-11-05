# RUN-051 / NEW-008 — TEST telemetry_reports: серверное хранение, доступ браузера закрыт

**СТАТУС: ТОЛЬКО КАНДИДАТ ДЛЯ ИЗОЛИРОВАННОГО ЭМУЛЯТОРА. НЕ ПУБЛИКОВАТЬ В FIREBASE.**

## Граница доверия

В Sanastoyhteisö V3 браузерная очередь RUN-049 и server-ingress simulator RUN-050 **не подключены к Firebase**. Доказательства действующего TLS backend, проверки Firebase ID token, IAM, инкрементальной записи, durable ACK, anti-abuse budget, сроков хранения и GDPR notice/consent отсутствуют. Поэтому **не открывать клиентский Firestore create** для диагностических событий — даже "только проверенным" пользователям.

TEST-only кандидат: `admin/security-tests/candidates/FIRESTORE_V3_DEVELOPMENT_NEW008_TELEMETRY_SERVER_ONLY_REVIEW.rules`. Он отличается от исходного NEW-006 кандидата одной явной секцией `match /telemetry_reports/{reportId}` с `allow get, list, create, update, delete: if false`. Все другие правила учебных аккаунтов и `admin_metrics/current` сохраняются побайтно. Это **не** актуальный опубликованный cloud ruleset. Фактическая облачная версия, время публикации и права доступа всё ещё неизвестны (RUN-045 BLOCKED).

**Важно:** Firestore разрешения складываются по логическому ИЛИ среди совпавших `match`. Явный `false` **не отменяет** другой разрешающий `match`; будущий reviewer обязан проверить весь опубликованный ruleset на пересечения wildcard, прежде чем пользоваться результатом. Firestore Admin SDK в доверенном backend с надлежащим IAM **обходит** клиентские Rules, поэтому его безопасность, секреты и минимальные права — отдельное обязательное требование, не доказанное этим кандидатом.

## Проверки

Тесты `admin/security-tests/security.telemetry-server-only.test.cjs` запускаются через локальный Firestore Emulator с проектом `demo-...`, без обращения к Firebase Cloud. Проверяются отказ гостям, ученикам и администраторам в get/list/create/update/delete для сырых событий; сохранение owner-only профилей, неизменяемого sync_v3 события и строго закрытой admin_metrics/current. Кроме того, тест сравнивает candidate с NEW-006 побайтно после удаления единственного разрешённого блока. Никакие реальные диагностические записи и UID в GitHub не используются.

## До реального TEST-пилота

Подтвердить опубликованные TEST Rules read-only; выбрать доверенный server backend на согласованном бесплатном или заранее разрешённом тарифе; серверно верифицировать ID token + App Check где применимо, ограничить IAM, применить строгую RUN-048 схему, quotas/rate limits, срок хранения и механизм очистки; получить правовое основание и пользовательское уведомление; осуществить один тестовый синтетический event с end-to-end и безопасным повтором/ошибкой; проверить независимые агрегаты и реальный сбой сети. Не выдавать локальные Emulator PASS за живую телеметрию.

**Запреты:** production main, LIVE `riveria-sanasto-community-test`, TEST `sanastoyhteiso-v3-development` rules/cloud data, другие ученики, тариф и пользовательский сайт не менять без отдельных разрешений.
