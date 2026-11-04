# Изолированный контракт Firestore Security Rules — только для TEST

**Автор проекта: Илья Дмитриев.** Предназначение: проверить модель отдельного административного документа `admin_metrics/current` в `demo-`-проекте, без доступа к сети Firebase cloud.

**Внимание: эти правила — НЕ текущие облачные Firestore Security Rules. НИКОГДА не выполнять firebase deploy для этой папки.** Файл целиком запрещает доступ ко всем остальным коллекциям; его публикация вместо существующих правил уничтожила бы доступ учебного приложения к собственным данным. Дальнейшая интеграция — только в виде тщательно проверенных *добавлений* к реальным правилам тестового проекта и после независимой полной сверки.

В `firebase.json` только изолированный эмулятор Firestore на 127.0.0.1:8089, проект `demo-sanastoyhteiso-admin-rules`. Нет токенов, live projectId, service account, подключения production, Cloud Functions, платных API или записи данных учеников.

Запуск в GitHub Actions: [workflow](../../.github/workflows/admin-rules-emulator.yml) (Node 22 / Java 21). Локально из этой папки:

```sh
npm install --no-audit --no-fund
npm run test:emulator
```

Тесты проверяют get только точного пути с `admin === true`, `email_verified === true`, не анонимным provider, deny остальным, list/create/update/delete и посторонним коллекциям. Этот набор **не подтверждает реальный серверный доступ и не проверяет существующие правила для личного прогресса**. Для реальной приёмки нужны актуальные deployed Rules из Firebase Console/CLI, проверка additive интеграции, server-issued claim, и прямые запросы двух тестовых аккаунтов.

**Не закрывать Stage C или E по зелёному эмулятору этого fixture.**
