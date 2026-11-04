# NEW-003 — полный исторический TEST V3 ruleset + admin_metrics

**Только офлайн-эмулятор. Не публиковать эти правила в Firebase.**

Источник: [PR #8, commit 828d702430037aeca271786bbcf067e202f10c0c](https://github.com/sanastoyhteiso/sanastoyhteiso.github.io/blob/828d702430037aeca271786bbcf067e202f10c0c/staging/backend/firestore.v3-development.rules), blob SHA `8f5da135e34de7e03437b85ce54e1e1aac1d7563`. Снимок подготовительного `sanastoyhteiso-v3-development` ruleset, **не подтверждённая deployed версия**. Не брать из другого проекта `riveria-sanasto-community-test`.

Единственное аддитивное изменение к этому историческому снимку перед catchall deny:

```firestore
match /admin_metrics/{metricId} {
  allow get: if metricId == 'current' && isAdmin() &&
    request.auth.token.firebase.sign_in_provider != 'anonymous';
  allow list, create, update, delete: if false;
}
```

Существующие `site_admin`, `users`, `settings`, `sync_v3`, `libraries_v3` не редактировались. CI запускает дополнительно `security.integrated.test.cjs` на таком полном **историческом** ruleset, чтобы убедиться, что добавление не нарушает ключевые учебные возможности. Это не доказательство полной совместимости со всеми версиями сайта, действующим облачным набором или серверной выдачей роли.

Для реальной интеграции необходимо read-only получить текущие `sanastoyhteiso-v3-development` deployed Rules, подтвердить сохранение всех путей, дополнить нужный реальный файл и прогнать emulator на полном актуальном наборе. Только после отдельного согласования допустимы cloud-изменения. Не запускать `firebase deploy` из данной папки.
