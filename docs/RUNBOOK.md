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

## Database migrations (Flyway)

- `V0__schema.sql` is the complete schema for a brand-new database. Databases that already hold data were adopted at `V1` and skip it (the `*:ignored` pattern in `application.yml` allows this).
- `V1__baseline.sql` must never change; its checksum is recorded in every existing database.
- Every schema change from now on is a new numbered file (`V3__...`). CI builds an empty database from the files and starts the app with schema validation, so a change that does not match the entity classes fails the build.

## Two-factor sign-in

- People turn it on in Profile, using any authenticator app. They get ten single-use recovery codes, shown once.
- `MFA_ENFORCE_OFFICIALS=true` makes officials (chairperson, treasurer, secretary) turn it on before they can act as an official. Leave it `false` until officials have enrolled, then switch it on.
- A lost phone with no recovery codes needs an admin reset: delete the person's rows from `user_mfa` and `mfa_recovery_codes` after verifying who they are by another route.

## Payments (environment variables)

- `PAYSTACK_ENABLED=true` and `PAYSTACK_SECRET_KEY` switch on card and M-Pesa checkout. Point Paystack's webhook at `/api/v1/payments/paystack/webhook`.
- `MPESA_C2B_SECRET` is the secret segment in the paybill URLs. Register with Daraja:
  `https://<host>/api/v1/payments/mpesa/c2b/<secret>/validation` and `.../confirmation`.
- `MPESA_POOLED_SHORTCODE` is only for the shared-paybill model, which stays off until counsel approves it.
- A chama collecting on its own paybill needs `chama_account_codes.shortcode` set to that paybill; payments to any other shortcode are held, not credited.
- Plan prices live in `subscription_plans`; change one with a single UPDATE. The daily sweep (`app.subscriptions.sweep-cron`) moves unpaid plans to PAST_DUE and then SUSPENDED after 7 days.
- Held payments (unmatched, wrong amount or currency, wrong paybill) are shown to each chama's officials; money no chama could claim is at `GET /admin/payments/held`.

## Admin console and public listing

- Make an operator: register, turn on two-factor sign-in, then `UPDATE users SET role = 'ADMIN' WHERE email = '<lower-case email>';` and sign in again. `APP_ADMIN_REQUIRE_MFA=false` disables the two-factor requirement (tests only).
- Public listing needs an APPROVED review (`chama_verifications`), valid for one year, and no open enforcement case of level 2 or higher. Existing PUBLIC chamas are hidden until approved.
- The three agreements (`agreement_versions`) load as DRAFT. Publishing requires a reviewing lawyer's name; nothing can be accepted before that.
- Settings: `app.payouts.new-listing-days` (30), `new-listing-hold-hours` (72), `new-listing-daily-cap` (100000), `app.enforcement.response-days` (7).
- `agreement_acceptances` and `admin_actions` are append-only (database triggers).

## Staff roles and the activity log

- Roles: SUPER_ADMIN, VERIFICATION_REVIEWER, LEGAL, ACCOUNTING (built in), plus custom roles made of permissions. STAFF_MANAGE and SETTINGS_MANAGE belong to SUPER_ADMIN only.
- The first user promoted with `UPDATE users SET role = 'ADMIN'` becomes SUPER_ADMIN automatically; after that all staff are added from Admin console > Staff. Staff cannot be active members of any chama.
- Suspending or removing a person ends their access at once (the guard checks every request) and invalidates their tokens.
- Two-person rule (Staff tab): off by default; can only be switched on with at least two approvers and two people who can confirm level 3/4 notices.
- `admin_actions` is a hash chain (seq, prev_hash, row_hash). Writes happen in the same transaction as the action; refusals and reads of personal data are logged too. `GET /admin/audit/verify` recomputes it; a nightly job does the same (`app.audit.verify-cron`) and writes the result. Never disable the immutability triggers except in tests.

## Document storage (identity and registration papers)

Officials upload five kinds of paper for a listing application: registration certificate, constitution, officials' resolution, paybill proof, and a national ID for each of the chairperson, treasurer and secretary. An application cannot be sent until all are present.

- **Encryption.** Files are stored in `document_blobs` as AES-256-GCM ciphertext. Set `DOCUMENT_ENCRYPTION_KEY` to 32 random bytes, base64 encoded (`openssl rand -base64 32`). Keep it in the host's secret store, separate from database backups. If it is not set a key is derived from the data key; if neither exists uploads are refused. **Losing the key makes every stored file unreadable.** Rotating it needs a re-encryption job (not built yet).
- **Limits.** PDF, JPEG or PNG only, checked by file content, not name. 5 MB each. 30 active documents per chama. 20 uploads per user per day. A new upload of the same kind replaces the old one, which stays on record as superseded.
- **Who can open.** Officials can upload and see what was uploaded, never download. Staff with `DOCUMENT_VIEW` (verification reviewer, legal, super admin) can open. Every opening is written to the activity log (`DOCUMENT_OPENED`) in the same transaction as the read; a refused attempt is logged as denied. Accounting cannot open files.
- **Legal hold.** Staff with `LEGAL_HOLD` (legal, super admin) can hold one document or all of a chama's. A level 3 or 4 notice taking effect holds every document automatically. A held file cannot be erased, by the app or directly in the database.
- **Erasure.** Super admin only, with a written reason. Blocked while held and until `retention_until` (default 7 years from upload, `DOCUMENT_RETENTION_YEARS`). **The 7 years is a placeholder: confirm the period with the advocate and the Data Protection Act position before launch.** Erasing removes the encrypted bytes; the metadata row stays for good.
- **Not built.** Virus scanning of uploads; key rotation.

## Finance desk

The Finance tab of the admin console is for the accountant (role `ACCOUNTING`: view and propose) and the super admin (approve).

- **Unclaimed payments.** Paybill money that no chama could claim. The accountant proposes either giving it to a named member of a chama (with a reason) or returning it to the sender. The super admin approves; for a give, the contribution is credited at that moment. A return is approved, then sent from the M-Pesa portal, then its reference is recorded to close it.
- **Refunds.** Proposed against an invoice, capped at what was paid across all requests. Approved by the super admin, sent from the Paystack dashboard, then the reference is recorded. ChamaSmart never sends money by itself.
- **Approval rule.** Only `FINANCE_APPROVE` (super admin) can decide. With the two-person rule on, you cannot decide a request you proposed. Finished requests cannot be edited or deleted, even in the database.
- **Invoices and VAT.** An invoice is issued when a verified plan payment arrives; invoices cannot be changed. **No VAT is charged until `BILLING_VAT_REGISTERED=true`.** Set that, and confirm the rate (`BILLING_VAT_RATE`, 0.16) and whether plan prices include VAT (`BILLING_VAT_INCLUSIVE`, true), with your accountant before the first filing. The VAT file lists invoices, then refunds as credit notes, then totals for the period.
- **Every step** (propose, approve, reject, send, export) is on the activity log.

## Legal desk

The Legal tab (role `LEGAL`; super admin also) holds the register of court orders and official requests. The case file opens from the Cases tab.

- **Case file.** One page per enforcement case: the notice and the chama's reply, the officials, agreements accepted (with the exact-text fingerprint, time and address), attached evidence, notes, linked orders, and the activity log for that chama. Notes and evidence links cannot be edited or removed. Attaching a document as evidence places it on legal hold.
- **Register of orders and requests.** Court orders, preservation orders, disclosure, police and regulator requests, with a response date. Overdue ones are flagged and sorted first. A preservation order holds every stored document of that chama at once. What an order says cannot be changed after registering; progress is recorded as dated status entries (received, under review, complied with, contested, closed).
- **Referral pack.** A ZIP built on demand: summary, officials, agreements accepted, case notes, the chama's activity log with its hashes, contributions totals, payouts, payment events, and the document list. It can include the stored documents; each one opened is logged as a document opening. `00_MANIFEST.txt` carries the SHA-256 of every file and whether the activity log chain verified at that moment. **Before any pack is built the recipient and the legal basis (at least 20 characters, for example the order number) are recorded** in a permanent disclosure list.
- **Not built.** Redacting third-party members from a pack; ask counsel whether member-level contribution data should be included for each request type. Appeals handling beyond the admin.

## Hardening: startup check, plan suspension, log fingerprints

- **Startup check.** `APP_ENV=production` makes the app refuse to start when a safe setting is missing: JWT secret under 32 characters, no data or document encryption key, localhost in `CORS_ORIGIN`, admin two-factor off, no real mail provider, `SPRING_JPA_DDL_AUTO` not `validate`, and (when `MPESA_ENV=production`) any missing Daraja key, secret, passkey or the sandbox shortcode. With any other `APP_ENV` the same list is printed as a warning at startup. **Fill every variable first, check the warning list in the Render log is empty, then set `APP_ENV=production`.**
- **Daraja defaults removed.** No consumer key, secret or passkey is built into the code any more. Without `MPESA_CONSUMER_SECRET` the app uses the mocked STK push outside production and refuses in production. **If the old sandbox consumer key was ever a real Daraja app of yours, rotate it in the Daraja portal: it was in earlier commits.**
- **Plan suspension.** A chama whose plan is suspended (after the 7-day grace) cannot create new payout requests or approve new members. Contributions, repayments, approvals already given, and every record continue to work. Paying the plan lifts it at once.
- **Log fingerprints.** On the 1st of each month at 03:00 the app records the activity log's last entry number and hash and emails them to every active super admin; you can also record one from the Activity log tab. **Keep those emails in a folder.** "Check the log has not been altered" now compares the log with every saved fingerprint, and a nightly job raises an alert if one stops matching, so rewriting history is caught even by someone with full database access. Needs a working `MAIL_PROVIDER`.

## Starting again from empty

Use this to wipe every user and all data and begin again (for example before real chamas join). It cannot be undone, so it is a manual step and never runs by itself.

1. Take a backup first (Render: the database's Backups page, or `pg_dump`).
2. Stop sign-ins from continuing: change `JWT_SECRET` on the backend to a new random value. This is required. A new person who gets user number 1 would otherwise be accepted on an old session token for user number 1.
3. Run the reset against the database, passing its name so the script can check you are in the right place. `SELECT current_database();` shows the name.
   `psql "<external connection string>" -v confirm_db=<database name> -f scripts/reset-database.sql`
   The script refuses to run, and stops with an error, if the name does not match.
4. Restart the backend. It rebuilds every table, the three plans, the roles and their permissions on its own.
5. Register your own account on the site, confirm the email, then promote it: `UPDATE users SET role = 'ADMIN' WHERE email = '<your email>';`
6. Sign in again and open the admin console. The first administrator becomes super admin automatically (recorded as `SUPER_ADMIN_BOOTSTRAPPED`). Turn on two-factor sign-in when asked: the console stays closed without it while `ADMIN_REQUIRE_MFA` is on.
7. Add your accounting, legal and reviewer staff from the Staff tab. They register normally first.

What goes with the wipe: the activity log and the monthly fingerprints, so fingerprint emails sent before the wipe will not match the new log. Keep them as the record of the old system. Uploaded documents are stored in the database, so they are gone too. Nothing is kept outside the database, so there is nothing else to clean.
