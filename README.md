# SmartResto

A complete local university restaurant voucher **demonstration** built from [SMARTRESTO_PROJECT_SPEC.md](SMARTRESTO_PROJECT_SPEC.md). React/Vite/TypeScript + Tailwind, NestJS, Prisma and PostgreSQL form a modular monolith. UI copy is French, currency is MAD, amounts are integer centimes, and dates display in Africa/Casablanca.

**No real restaurant-card balance is read or changed.** All wallets, cash sales, vouchers and meals are simulated. There is no payment gateway, badge-reader connection or school database integration.

## Start with Docker

Install Docker Engine/Desktop with Compose, then run from this directory:

```bash
docker compose up --build
```

The database becomes healthy, versioned migrations run, the idempotent demo seed runs, and the frontend starts. The first build needs internet access to download images and npm dependencies. Ports are bound to localhost only.

| Service                     | Address                             |
| --------------------------- | ----------------------------------- |
| Web application             | http://localhost:5173               |
| REST API                    | http://localhost:3000/api/v1        |
| Swagger UI                  | http://localhost:3000/api/docs      |
| OpenAPI JSON                | http://localhost:3000/api/docs-json |
| Health / database readiness | http://localhost:3000/health        |
| Development PostgreSQL      | localhost:5432                      |

Compose works without creating `.env`: independently generated random JWT and coupon HMAC keys are retained in the `demo_secrets` volume. If you supply these variables in an ignored `.env`, they take precedence. Keep the coupon key paired with the database; changing it makes previously printed, unused codes unusable. Do not remove the secrets volume while retaining the database.

```bash
docker compose stop       # stop, retaining demo data and keys
docker compose up -d     # resume
docker compose logs -f backend
```

The published PostgreSQL username is `smartresto`, password `smartresto-demo-only`, database `smartresto`. These are intentionally public, development-only credentials for this isolated prototype. They must never be used for a real system. Startup never resets existing data.

## Demo accounts

All three accounts use the development-only password **`DemoResto2026!`**. The login screen can fill each account for convenience. Tokens live only in browser memory; refreshing the page requires signing in again. Signing out clears the token.

| Role    | Email                    | Access                                                                                                  |
| ------- | ------------------------ | ------------------------------------------------------------------------------------------------------- |
| Student | student@smartresto.local | Own demo balance, recharge, ledger, meals and monthly statistics                                        |
| Seller  | seller@smartresto.local  | Own assigned coupon stock, activation and simulated sale history                                        |
| Admin   | admin@smartresto.local   | Batches, coupon issuance/activation/voiding, users for selection, all sales and ledger, meal simulation |

The student starts with **87.40 MAD**: one simulated 100 MAD recharge and nine 1.40 MAD meals, all with matching immutable ledger entries. The seed is idempotent and preserves subsequent changes. No redeemable seed code is published; issue a new batch to test a recharge.

## Walk through the full demo

1. Sign in as **admin**, open **Gestion des coupons**, choose 20/50/100 DH, quantity 1–100, and assign the lot to **Buvette du campus**. Generate the coupons.
2. Immediately download the one-time CSV. It contains `publicSerial`, `secretCode`, `amountCents`, `currency` and a demonstration marker. Verify it before hiding the codes. Print each public serial with its matching secret code and face value, and hand the slips to the assigned demo seller. Keep the CSV secure. Codes cannot be recovered after leaving the page.
3. Sign out and sign in as **seller**. Find the printed **public serial** in stock, select **Activer**, check the explicit simulated-cash confirmation, and record the sale. The seller never needs the secret code. Each coupon can be sold only once.
4. Sign in as **student**, open **Recharger mon solde**, and enter the secret code. A 50 DH coupon credits exactly 5,000 centimes. A second attempt fails without changing the balance. Coupons cannot be used before activation.
5. Check **Mes transactions** and **Mes repas**. As admin, select the student under **Simuler un repas** and simulate a 140-centime debit. The wallet, ledger, meal history and monthly statistics update together.
6. As admin, inspect **Ventes & registre**. A recorded sale is a simulation, **not evidence of an actual cash receipt**.

Unused, unsold (`CREATED`) coupons may be voided. Sold (`ACTIVE`) and redeemed coupons cannot be voided in this MVP, preserving sale reconciliation. Coupons created without a seller assignment remain administrator stock and can be activated by an admin. There is no arbitrary-credit endpoint or ledger editing API.

## Develop without application containers

Use Node.js 22.12 or newer on the 22.x LTS line (or a compatible newer LTS) and npm. Versions are locked in `package-lock.json`.

```bash
npm ci
npm run setup
docker compose up -d db
npm run db:migrate
npm run db:seed
npm run dev:api
```

In another terminal:

```bash
npm run dev:web
```

`npm run setup` creates an ignored `.env` with independent random secrets and never overwrites an existing file. `.env.example` documents all configuration. `MEAL_PRICE_CENTS` controls the default simulated meal price. Frontend API configuration is a Vite build-time value: rebuild the frontend after changing `VITE_API_URL`. `FRONTEND_URL` must match the browser origin allowed by API CORS.

For a local production build:

```bash
npm run build
npm run start -w backend
npm run preview -w frontend -- --port 5173
```

## Validation

With `.env` prepared and the local PostgreSQL service running:

```bash
npm run build
npm run lint
npm test
```

The backend Jest/Supertest suite exercises real Nest HTTP routes and real PostgreSQL transactions. The test runner creates and migrates the separate `smartresto_test` database, then resets **only that dedicated test database**. It refuses database names not ending in `_test`. The development database role needs `CREATEDB` permission, as the Compose role has. For a restricted database server, pre-create the test database and grant its migration/fixture permissions first. Set `TEST_DATABASE_URL` to use another dedicated `*_test` database on the same PostgreSQL server. Do not point tests at real data.

Coverage includes correct/wrong login, missing auth and RBAC, one-time coupon issuance and HMAC-only persistence, required activation/sale confirmation, exact recharge, repeat and cross-student redemption, six simultaneous redemptions, invalid/voided codes, seller ownership and report scoping, meal accounting and statistics, insufficient funds, strict DTO/pagination validation, database audit immutability, wallet/ledger consistency, and the actual login rate limit. Frontend tests validate MAD formatting, Casablanca time and printable CSV contents.

With the application running, optional browser tests exercise the complete admin → seller → student → meal workflow and a 390px mobile layout:

```bash
npm exec -- playwright install chromium
npm run test:browser
```

Browser tests create a clearly named demo coupon and a simulated meal in the running demo database. They must target only this demonstration. They also save local desktop/mobile screenshots under ignored `.local/screenshots/`. Set `WEB_URL` if the web URL differs. `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` can select an existing compatible Chromium binary.

Dependency audit: compatible patched overrides are used for Multer, Prisma's configuration merge utility and Swagger's YAML parser. The remaining seven low-severity npm audit findings are in Jest's development-only `deepmerge` dependency chain; the available automated downgrade is incompatible with this test stack. No untrusted configuration is passed into that parser. Review the audit again before production work.

## Architecture and integrity

```text
frontend/src/
  app/          Authentication context and protected role routes
  components/   Shared layout, accessible dialogs, tables and resource states
  pages/        French student, seller and admin screens
  services/     Typed REST client, money/date formatting and one-time CSV
backend/src/
  auth/         bcrypt password checks, expiring JWT, database-backed access guard
  users/        Own profile and restricted admin selectors
  wallets/      Own balance and paginated immutable transaction history
  coupons/      Cryptographic codes, HMAC, issuance, activation, redemption, voiding
  meals/        Conditional debits and consumption statistics
  sales/        Scoped simulated sale audit and admin ledger
  common/       Database transactions, validation, errors and pagination
  integrations/ Demo-only restaurant boundary for future authorized integration
backend/prisma/ Schema, versioned SQL migrations and idempotent seed
```

- Codes have 128 random bits from `crypto.randomBytes`, printed in grouped hex. Normalization tolerates case, hyphens and whitespace. Only HMAC-SHA256 digests with a dedicated pepper are persisted; GET endpoints expose neither secrets nor hashes. Creation responses use `Cache-Control: no-store`.
- All credits, sales and debits use serializable database transactions. Only known Prisma `P2034` serialization/deadlock conflicts are retried, up to four attempts. Conditional coupon transitions and unique sale/redemption indexes guarantee one-time issuance use. Conditional meal debits prevent overdrafts.
- SQL checks enforce nonnegative balances and valid monetary sources. Deferred database triggers require wallet balances to equal the sum of ledger entries at commit. Database triggers reject ledger and sale updates/deletes. Foreign keys restrict deletions that would destroy audit history.
- JWTs expire after one hour and have fixed issuer, audience and algorithm. The server reloads the user and current role on every authenticated request; client-supplied identity and roles are rejected. Passwords use bcrypt with cost 12. Login and redemption have per-IP rate limits; inventory and reporting are scoped by the verified identity.
- Strict request DTOs reject unexpected fields, fractional money, invalid denominations and oversized lists. Errors share a consistent envelope and never include internal database details or coupon bodies. Invalid, unactivated, voided and already used codes share one redemption error.
- `DemoRestaurantAdapter` reads local demo balances and reconciles an **existing** coupon recharge using its stable coupon ID. It intentionally creates no second credit. It is not connected to any real restaurant system.

## API examples

See Swagger for the full request schemas. Tokens and one-time codes below are placeholders, not real credentials.

```bash
curl http://localhost:3000/health

curl -X POST http://localhost:3000/api/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"student@smartresto.local","password":"DemoResto2026!"}'

curl http://localhost:3000/api/v1/wallet/me \
  -H 'Authorization: Bearer YOUR_STUDENT_TOKEN'

curl -X POST http://localhost:3000/api/v1/coupons/redeem \
  -H 'Authorization: Bearer YOUR_STUDENT_TOKEN' \
  -H 'Content-Type: application/json' \
  -d '{"code":"YOUR_ONE_TIME_SECRET_CODE"}'

curl -X POST http://localhost:3000/api/v1/seller/coupons/PUBLIC_SERIAL/activate \
  -H 'Authorization: Bearer YOUR_SELLER_TOKEN' \
  -H 'Content-Type: application/json' \
  -d '{"simulatedCashConfirmed":true,"saleReference":"DEMO-001"}'
```

List endpoints return `{items,total,page,limit,pages,isDemo}`. The maximum page size is 100. Admin and seller coupon search accepts `search` (public serial substring) and `status`. Student transactions accept `type`. Meal statistics default to the current Casablanca month and accept ISO `from`/`to` bounds. Activation and admin void routes accept a coupon UUID or public serial. Admin-only helper endpoints are `/admin/users`, `/admin/summary`, `/admin/transactions` and `/admin/coupons/:reference/activate`; sellers also have `/seller/summary`.

## Production boundary

This is a **local demonstration**, not a production financial service. The school/restaurant/régie must approve the arrangement, cash accountability, voucher issuance and reconciliation, and a documented integration before any real distribution or balance change. The actual restaurant system must remain authoritative. No live integration is included or implied.

Production would require independently managed credentials and database roles (separate migration and application privileges), TLS, backups, restricted administration, personal-data retention/access rules, stronger distributed throttling if scaled, monitoring without secret bodies, and an audited integration/reconciliation design. Disable demo accounts and seeding. `NODE_ENV=production` disables Swagger and refuses demo seeding; provision migrations and real users separately. The Compose file intentionally runs in development mode and uses public demo database credentials.
