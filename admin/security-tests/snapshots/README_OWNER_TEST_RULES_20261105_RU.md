# Sanastoyhteisö V3 — сохранённые владельцем правила TEST Firebase (05.11.2026)

**READ-ONLY SNAPSHOT / НЕ ПУБЛИКОВАТЬ.** Файл `owner-console-rules-20261105.rules` — фиксированная исходная редакция для повторяемого локального эмуляторного тестирования. Не является автоматически синхронизируемой копией Firebase.

## Происхождение

05.11.2026 владелец прислал в чат полный текст правил и три скриншота из Firebase Console. На скриншотах отображены `Sanastoyhteiso V3 Development`, `(default)` Firestore Database, вкладка `Rules`, выделенный верхний элемент истории `Today · 3:03 AM`; точные Google API release name, UTC time и ruleset ID не получены. Снимки не загружены в публичный GitHub: один показывает внутренний документ пользователя.

Содержимое текста совпадает с ранее подготовленным TEST-кандидатом `admin/security-tests/candidates/FIRESTORE_V3_DEVELOPMENT_FULL_FOR_MANUAL_REVIEW.rules` по структуре и видимым блокам. Для надёжного хранения скопирован именно его полный исходник. **После копирования проверен побайтовый матч двух файлов GitHub**, blob SHA обеих копий: `a903ec37fb2c80e65bac71bd24ca15b11b782bc2` (12919 UTF-8 символов, 284 строки при разделении по LF). Не утверждать, что этот GitHub blob *независимо API-проверен* как опубликованный ресурс: исходное свидетельство — код и экран владельца. Если правила изменятся в Console, этот архив не изменится сам.

## Что означает этот архив для реального учебного запуска

- `collection_set` допускает только каталог `^T[0-9]{5,7}$` и личное `^W_[a-f0-9]{32}$`. Для `M`, `P`, `H` (например, `P00055`) запрос должен быть **DENIED** до обновления published TEST Rules. Подготовленный `NEW006_FINDS_TMPH_REVIEW_ONLY.rules` — отдельный кандидат и **не** часть этого архива.
- `admin_metrics/current`: текст допускает только `get` для email-verified Google-сессии с точным boolean custom claim `admin == true`; `list` и все client writes запрещены. Наличие permission в исходнике не доказывает, что custom claim реально выдан или документ metrics существует.
- `users`, `settings`, `sync_v3` — own UID с verified; события sync_v3 create-only, без update/delete; `sync_demo_v3` тестовые записи могут удаляться только владельцем demo-события; неизвестные коллекции имеют catch-all deny.
- Роли, Firestore, приватные данные и тариф **не изменялись** при сохранении snapshot.

## Как проверять далее без Firebase Console

`admin/security-tests/security.user-supplied.test.cjs` загружает **этот архив**, а не потенциально изменённый файл из Firebase Console, и сравнивает его побайтово с подготовленным исходником для обнаружения расхождений. Существующие synthetic emulator-тесты проверяют personal/account isolation, admin permit/deny, My Finds `T` allow и `M/P/H` deny. Запускать через **GitHub Actions** `TEST admin isolated Firestore rules contract`, изолированный `demo-` проект; не устанавливать ничего на старый Mac/iPhone владельца.

Если нужно протестировать исправление `NEW-006`, использовать отдельный candidate TEST emulation. **Не редактировать** этот snapshot задним числом и не делать его `firebase.json` publish target. Новая версия из Console должна получить новый файл с новой датой и новым owner evidence.

**Не путать две вещи:** архив позволяет многократно моделировать нынешние присланные правила без сайта; но лишь заново прочитанный actual release из Firebase сможет подтвердить, что в облаке не изменилось ничего с момента присылки.
