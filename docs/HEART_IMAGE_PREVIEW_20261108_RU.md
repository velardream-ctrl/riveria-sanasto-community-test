# HEART IMAGE PREVIEW — 2026-11-08

## НАЧАЛ
- Цель: отдельный публично доступный без авторизации TEST-просмотр карточки `T00574` (sydän / сердце / cor), изображение только после «Показать ответ», модальный просмотр +/−, жестовый zoom на iPhone, полноценные FI/RU пояснения.
- Исходное состояние TEST `main`: `732592895c4e4a07b58fd3de80bbcf1f26aac95f`.
- Подтверждённое production `main` на момент проверки: `554ebfe7cb779ca5cf699d63d8f8ab6ca098904e` (RUN164), RUN165 отдельной веткой. Production не менять.
- Резервная ветка TEST: `backup/pre-heart-image-preview-20261108`.
- Рабочая ветка TEST: `feat/heart-image-preview-20261108`.
- Область: `image-preview/index.html`, `image-preview/check-preview.js`, `.github/workflows/heart-image-preview.yml`, этот журнал.
- Изоляция: тестовая страница не вызывает Firebase/Google Auth/localStorage и не изменяет пользовательские результаты.
- Риск: первоначальный самостоятельный файл изображения Work недоступен; используется публичная диаграмма сердца с атрибуцией, совпадение с исходной картинкой не подтверждено.

## ЗАВЕРШИЛ — тестовый прототип
- Изменения внесены только в отдельный TEST-репозиторий `velardream-ctrl/riveria-sanasto-community-test`.
- Новых слов: **0**. Использован существующий `T00574` / `EXAM05`; текущие словари не менялись.
- Реализовано: открытие ответа → загрузка схемы → Latin/FI/RU; zoom-кнопки +/−/сброс; жесты двумя пальцами и перемещение; открытый просмотр без входа и сохранения данных.
- PR: https://github.com/velardream-ctrl/riveria-sanasto-community-test/pull/5
- Merge commit (TEST): `94c3e4f324683c2f657fdc57e7d971cfe6ef55bf`.
- CI (PR): https://github.com/velardream-ctrl/riveria-sanasto-community-test/actions/runs/42508578079 — SUCCESS.
- CI (TEST main): https://github.com/velardream-ctrl/riveria-sanasto-community-test/actions/runs/42508622022 — SUCCESS.
- Pages build/deploy именно для merge commit: https://github.com/velardream-ctrl/riveria-sanasto-community-test/actions/runs/42508621535 — SUCCESS.
- Прямая TEST-ссылка: https://velardream-ctrl.github.io/riveria-sanasto-community-test/image-preview/
- Точка отката: `backup/pre-heart-image-preview-20261108` (TEST), исходный main SHA выше.
- Не изменены: production-сайт, `data.js`, `riveria-anatomy-exam.js`, `sw.js`, Firebase Rules/Auth, учётные записи и прогресс.

## ОСТАЛОСЬ / РУЧНАЯ ПРОВЕРКА
- Проверить на реальном iPhone: картинка появляется лишь после показа ответа, по нажатию увеличивается, pinch/drag работает, FI/RU остаются видимыми, повторная проверка скрывает ответ.
- Проверить отдельно Safari iOS12 — автоматическая проверка синтаксиса не заменяет испытание браузера.
- Сверить картинку с первоначально присланным пользователем изображением и при необходимости заменить источник **только в TEST**.
- Интеграцию в настоящий учебный модуль готовить отдельным согласованным PR, без переноса в production до разрешения владельца.
