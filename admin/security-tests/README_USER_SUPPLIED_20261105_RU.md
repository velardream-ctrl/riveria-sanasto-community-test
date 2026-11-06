# RUN-018 / NEW-003: правила, скопированные владельцем из TEST Firebase Console

**Автор проекта: Илья Дмитриев.**

Дата сообщения: 2026-11-05 (Europe/Helsinki). Владелец предоставил полный текст Firestore Security Rules для заявленного проекта `sanastoyhteiso-v3-development` (в чате). Это **сообщённая владельцем копия**, не независимый API-экспорт Firebase. Версия публикации, дата и resource name **пока не подтверждены**.

Содержимое сопоставлено с историческим файлом [PR #8 `staging/backend/firestore.v3-development-with-finds.rules`](https://github.com/sanastoyhteiso/sanastoyhteiso.github.io/blob/828d702430037aeca271786bbcf067e202f10c0c/staging/backend/firestore.v3-development-with-finds.rules), blob SHA `86ba7d0b4e4720762babdcd1d6580f644319e08a`. По разделам и содержимому совпадают: `collection_set`, `sync_demo_v3`, owner-only `users/settings/sync_v3`, `libraries_v3`, `library_subscriptions_v3`, `site_admin` и catch-all deny. Нельзя утверждать побайтовое равенство с опубликованным ресурсом без независимого API-экспорта.

Два отдельных файла в `fixtures/`:
- `firestore.user-supplied-20261105.baseline.rules`: воспроизведение совпадающей исторической редакции правил, **без** `admin_metrics`; предсказуемо отвергает даже admin get для нового пути.
- `firestore.user-supplied-20261105-plus-admin-metrics.rules`: та же редакция с добавлением только отдельного `match /admin_metrics/{metricId}` и двумя комментариями-препятствиями для прямого deploy. Существующие пути **сохраняются без изменений**. Новая роль: `get` только `current`, verified strict boolean admin + Google provider; browser list/write deny.

**НЕ ПУБЛИКОВАТЬ НИ ОДИН ФАЙЛ В FIREBASE.** Эмулятор запускается под `demo-` проектами в localhost через CI без секретов и подключения к настоящей базе. `firebase.json` не указывает на эти fixtures для deploy. Использовать только для проверки модели на синтетических данных.

Тесты `security.user-supplied.test.cjs` дополнительно проверяют регрессию для `collection_set`, ограниченные `sync_demo_v3` list/create/delete, персональные документы, subscriptions, library visibility и admin deny/permit. Не означают реальную выдачу server custom claim или работу cloud Firebase.

До публикации: получить independent current `Rules` revision/timestamp; проверить Auth provider владельца и актуальную конфигурацию; при необходимости подготовить отдельно минимальное и обратимое изменение с review/backup и явным разрешением. Не трогать `riveria-sanasto-community-test`, пользователей, production, тарифы.
