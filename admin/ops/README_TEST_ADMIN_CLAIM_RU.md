# RUN-020: one-time owner-operated TEST Firebase admin claim

**Project:** `sanastoyhteiso-v3-development` only. The user has personally confirmed their own Google-authenticated user exists under Firebase Authentication → Users. No one has assigned a role yet.

**Why:** Firestore Rules added in RUN-018 permit `get admin_metrics/current` only for `email_verified == true`, **boolean** `admin == true` and Google `sign_in_provider`. The Google sign-in record **does not grant** the custom `admin` claim automatically. Google Cloud IAM Project Owner and Firebase Authentication `admin` are different mechanisms.

The standalone [`assign-test-admin.cjs`](./assign-test-admin.cjs) script **never auto-runs in CI**. Without arguments it only reads the locally entered TEST UID and checks eligibility (`--dry-run`). It enforces one exact TEST project, requires a verified, enabled Google-linked account, refuses mismatches, and does not write Firestore or Rules. An intentional `--apply` prompts a second check for the exact account email and the phrase `GRANT TEST ADMIN`; it saves an 0600 local backup of old custom claims before assigning `admin: true`, preserving every unrelated existing claim, then verifies the result.

**No secrets in GitHub or ChatGPT:** UID and email are entered by the owner **locally** into their private shell only. Never paste password, service-account JSON/private key, access/ID token, UID, full email or local claims backup into a public repository or ChatGPT chat. Repo contains source code only.

## Google Cloud Shell (browser-based)
1. Open <https://console.cloud.google.com/?project=sanastoyhteiso-v3-development> under the account allowed to administer that project. Open Cloud Shell in its toolbar. This is **not** the ChatGPT Work browser and does not require software on an old Mac or iPhone.
2. Confirm exactly the intended TEST project: `gcloud config get-value project`. If different, stop; set manually with `gcloud config set project sanastoyhteiso-v3-development`, then recheck.
3. In a fresh private Cloud Shell work directory, install the official Firebase Admin SDK: `mkdir -p ~/sanastoyhteiso-admin-once && cd ~/sanastoyhteiso-admin-once && npm init -y && npm install firebase-admin`. Do NOT generate or download a service-account private key for this workflow.
4. Download the source script to this private directory (check it matches the [GitHub source](./assign-test-admin.cjs)) from the corresponding TEST branch's raw GitHub URL. Commands:
   `curl -fLsS https://raw.githubusercontent.com/velardream-ctrl/riveria-sanasto-community-test/feat/admin-control-center-package-spec-20261104/admin/ops/assign-test-admin.cjs -o assign-test-admin.cjs`
5. Run `node assign-test-admin.cjs --dry-run`. Copy **only your own UID** from Firebase TEST Authentication → Users into the **Cloud Shell terminal**, not ChatGPT. Confirm the email displayed in the terminal corresponds to your own TEST account; if any permission/authentication error occurs, STOP. Cloud Shell ADC identity/IAM authorization can vary, and Firebase Authentication might reject some gcloud end-user credentials; never work around this by pasting keys into the browser, public GitHub or this chat.
6. Only after successful read-only precheck, consciously run `node assign-test-admin.cjs --apply` and provide the exact email and confirmation locally; this changes **one** user's TEST custom claim. Preserve local backup file (0600), never send it to GitHub or a chat. Cloud Shell account must have `firebaseauth.users.get` and `firebaseauth.users.update` permissions or equivalent.
7. Sign out and back in on TEST site to refresh ID token. This **does not** publish PR #3 admin UI or generate `admin_metrics/current`; test site currently lacks admin page on default `main`. Further UI/metrics work needs separate TEST release review.

**Rollback:** local backup records previous `customClaims` but does not automatically restore them. If later rollback is needed, use the Admin SDK under privileged supervision to restore the saved map, preserving any legitimately updated roles since the backup. Never blindly overwrite claims that may have changed after the initial operation.

Official: https://firebase.google.com/docs/auth/admin/custom-claims and https://firebase.google.com/docs/admin/setup.

**RUN-020 limits:** no cloud changes from ChatGPT, no automation, no private data upload, no Firebase Functions/billing, no production access, no PR merge.
