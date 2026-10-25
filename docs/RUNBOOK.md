# ChamaSmart operations runbook

This is the short list of things the person running the service needs to know. Keep it current when behaviour changes.

## Settings the backend needs (Render environment)

| Name | What it is | If missing |
|---|---|---|
| `SPRING_DATASOURCE_URL`, `SPRING_DATASOURCE_USERNAME`, `SPRING_DATASOURCE_PASSWORD` | The database | The service does not start |
| `JWT_SECRET` | Signs sign-in tokens. At least 32 random characters | The service refuses to start in production |
| `DATA_ENCRYPTION_KEY` | Encrypts national ID numbers. Generate with `openssl rand -base64 32` | The service refuses to start in production |
| `APP_CORS_ALLOWED_ORIGINS` | The website addresses allowed to call the API | Browsers are blocked |
| `FIREBASE_*` | Google sign-in and file storage | Google sign-in fails |
| `JWT_ACCESS_MS` (optional) | How long a sign-in lasts before it is quietly renewed. Default 30 minutes | Default |
| `JWT_REFRESH_DAYS` (optional) | How long a device stays signed in without use. Default 30 days | Default |
| `SWAGGER_ENABLED` (optional) | API documentation pages. Leave off in production | Off |

Keep `DATA_ENCRYPTION_KEY` in a password manager as well as in Render. If it is lost, national ID numbers cannot be read again. Do not change it once data exists unless you re-encrypt first.

## The first deploy of this version

1. Set `DATA_ENCRYPTION_KEY` and `JWT_SECRET` in Render before deploying.
2. Deploy. On the first start the service:
   - adopts the existing database into Flyway at version 1 (nothing changes in your tables),
   - adds the new tables and columns (Hibernate update),
   - encrypts existing national IDs once. Before it does, it copies the old values into tables named `s18_backup_*`.
3. Check the log for "Started ChamaSmartApplication" and for the encryption line reporting how many IDs were converted.
4. Open the app, sign in, open a profile with a national ID and confirm it shows.
5. After a week with no problems, drop the `s18_backup_*` tables. They hold the old values.
6. Everyone is signed out once when this version goes live, because sign-in tokens changed. That is expected.

## Backups

The database provider (Neon) keeps point-in-time history. Check in its console how many days are kept for your plan and set it to the maximum you can afford.

In addition, take a copy you control every week:

```
pg_dump --format=custom --no-owner "$DATABASE_URL" > chamasmart-$(date +%F).dump
```

Store it somewhere other than Render and Neon. Once a quarter, restore the latest copy into an empty database and open the app against it. A backup that has never been restored is a guess.

Restore:

```
createdb chamasmart_restore
pg_restore --no-owner --dbname chamasmart_restore chamasmart-YYYY-MM-DD.dump
```

## Changing the database structure

Structure changes are numbered files in `backend/src/main/resources/db/migration` (`V2__short_name.sql`, `V3__...`). Flyway applies them once, in order, when the service starts. Never edit a file that has been applied; add a new one.

Hibernate still adds missing tables and columns on start (`SPRING_JPA_DDL_AUTO=update`). Once you are happy that the live database matches the code, set `SPRING_JPA_DDL_AUTO=validate`. From then on the service refuses to start if the database and the code disagree, which is safer than silently changing the database.

## Audit trail

Every sign-in, account change and money action is recorded with who, what, when and from where. A background job links entries into a chain of hashes every five minutes. A platform administrator can check the chain at `GET /api/v1/audit/integrity`. It reports `intact: true`, or the first entry that no longer matches. If it ever reports a break, stop and investigate before anything else: it means an old entry was changed or removed in the database.

## A device is lost or an account is taken over

The person can use "Sign out on all devices" in their profile. If they cannot sign in, an administrator can raise their sign-in version in the database (`UPDATE users SET token_version = COALESCE(token_version,0)+1 WHERE user_id = ?`) and revoke their refresh tokens (`UPDATE refresh_tokens SET revoked = true WHERE user_id = ?`). Their open sessions stop working within the access-token lifetime (30 minutes at most).

If a refresh token is used twice, the service treats it as stolen and signs that person out everywhere.

## Secrets that must not be in the repository

The repository scanner (gitleaks) runs on every push. Never commit `.env` files, service-account JSON, database passwords or payment keys. If one is committed by mistake, rotate it immediately; removing it from the next commit does not remove it from history.

## Known limits

- Login lockouts and rate limits are kept in memory. They reset when the service restarts and are not shared if you run more than one copy.
- Card and wallet payments are not built and M-Pesa is not in use. The payment workflow (`/chamas/{id}/payments`) exists and works with the manual provider only: the member reports a payment, an official verifies it. M-Pesa and card report themselves as unavailable until they are built and approved.
- Loan cover is run by the chama, not an insurer. A premium (set by officials, 0 to 10 percent) is kept back from each new loan into a reserve that is never lent out. Two officials can pay a deceased or disabled borrower's balance from it, up to what the reserve holds.
- ROSCA late fines: set a late fee and grace days when starting a round. A job at 07:00 Nairobi time fines each member still behind, once per round. Officials can waive any fine. Change the time with `APP_ROSCA_OVERDUE_CRON` (a Spring cron expression).
- Welfare proof files (PDF, JPG, PNG, up to 5 MB, three per claim) are kept in the database, so they grow it. Only the claimant and officials can open them.
- Savings are not frozen while a member has a loan; guarantors' savings are protected by the guarantee rules instead.
- The refresh token is kept in the browser's local storage, protected by the Content Security Policy. Sign-in with Google should be re-checked after any change to the policy in `netlify.toml`.
- GitHub's Dependabot lists open dependency advisories. Triage them monthly: update direct dependencies first, then rebuild and run the tests.
- Docker base images are pinned by tag, not digest.
- Leaving a chama: unpaid fines are taken from the savings first (oldest first, never more than the savings); any fines beyond that stay unpaid. Officials can waive a fine before the exit is paid.
- Losing `DATA_ENCRYPTION_KEY` makes stored national IDs unreadable.

## Email: verification and password reset

Render's free plan blocks outgoing SMTP, so ChamaSmart sends mail through Brevo's HTTPS API.

1. Create a free Brevo account, then Senders and domains, and verify the sender address you will use (a click-through email to that address).
2. Create an API key (SMTP and API, API keys).
3. In Render, set these environment variables:
   - `MAIL_PROVIDER=brevo`
   - `BREVO_API_KEY=<the key>`
   - `MAIL_FROM_EMAIL=<the verified sender address>`
   - `MAIL_FROM_NAME=ChamaSmart` (optional)
   - `APP_FRONTEND_URL=https://chamasmart.netlify.app` (the links in emails start with this)
4. Redeploy. With no provider set (`none`, the default) nothing is sent: the app keeps working, "Forgot password" gives its neutral reply, and "Send confirmation link" says email isn't switched on.

Never use `MAIL_PROVIDER=log` in production: it prints the links, which are secrets, into the logs. It exists for local testing only.

Behaviour: links are single-use and stored only as hashes; reset links last 1 hour, confirmation links 48 hours; at most 3 emails per hour per person and purpose. A password reset signs the person out everywhere. Google-only accounts who ask for a reset are told to use Continue with Google. A treasurer or secretary can only be appointed once their email is confirmed.

## Render free plan (512 MB, shared CPU)

The container is tuned to start inside Render's port-scan window: serial garbage collector, C1-only JIT, smaller thread stacks, 65% of RAM for the heap, and a database pool of 8 (`DB_POOL_SIZE`). The first start after a deploy can still take several minutes on free CPU. If the log ends at "Starting ChamaSmartApplication" and Render reports "no open ports detected", check Events for an out-of-memory kill; if it recurs, the Starter plan is the fix.
