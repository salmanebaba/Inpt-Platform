# SmartResto — Project Specification & Codex Implementation Guide

> **Purpose:** Build a demonstrable, secure MVP for a university restaurant prepaid-coupon system. This file is the implementation contract for Codex. Deliver a running project, not just an architecture proposal.
>
> **Language:** Source code, names, and documentation in English. UI copy in French. Currency: MAD. Timezone: Africa/Casablanca.

## 1. Context and vision

Students use an existing physical RFID/NFC-like restaurant card. The card is an identifier: the current balance is held in the restaurant's central database, and each meal is deducted after the student badges at the reader (example meal price: **1.40 MAD**). Today, card recharges require visiting the *régie*, whose opening window is extremely short.

**SmartResto** proposes prepaid vouchers (*coupons*) sold for cash by an approved BDE/buvette agent. The student enters a voucher code in the web app to redeem its value, checks their balance, and views transactions and meal statistics. No card-payment gateway, bank transfer, or third-party payment provider is involved in the MVP.

**Essential separation:** In this MVP, all balances, meal deductions, coupons, and sales are **simulated/demo data** in a dedicated database. They DO NOT update the actual restaurant card or restaurant database. Before live use, the school/restaurant/régie must approve the arrangement, the cash collection and reconciliation process, and an authorized system integration. Never claim that a simulated wallet balance is the real restaurant-card balance.

### Scope of first release

- Student: sign in, view **demo** balance, redeem an activated unused coupon, view recharge/meal history and basic consumption statistics.
- Seller (BDE/buvette): view authorized demo coupon inventory and activate a coupon **only after a simulated cash sale** (record seller, timestamp, optional sale reference). No self-granted arbitrary wallet credits.
- Admin: manage demo coupon batches, generate secure coupons, inspect coupons/sales/redemptions/transactions, and seed sample meals for a demo.
- Local environment: one Docker Compose command to start API, web frontend, PostgreSQL; seeded demo accounts.

### Explicit non-goals

- No real payments, cash collection in the app, payouts, bank integration, payment processing, or CMI.
- No reverse engineering, unauthorized database access, card modification, or direct SQL writing to the school's live database.
- No production integration with badge readers or the actual restaurant system.
- No microservices, Kubernetes, complex ML predictions, mobile-native app, or real hardware tests for MVP.
- No password-reset email, SSO, or student identity verification for MVP; design extensibly for future integration.

## 2. Technology decisions

- **Frontend:** React + Vite + TypeScript, React Router, Tailwind CSS, Axios or fetch, simple responsive components (shadcn/ui optional).
- **Backend:** NestJS + TypeScript, class-validator + class-transformer, Swagger/OpenAPI, JWT authentication, bcrypt or argon2 password hashing, role-based guards.
- **Database:** PostgreSQL + Prisma ORM.
- **Infrastructure:** Docker Compose, `.env.example`, migration and seed scripts.
- **Testing:** Jest + Supertest backend integration/e2e tests, basic frontend tests as practical.
- **Architecture:** Modular monolith. All money values are **integer centimes** (`amountCents`, e.g. 1.40 MAD = 140), never floats. ISO timestamps stored in UTC; displayed in Africa/Casablanca.
- Pick currently compatible stable package versions; lock dependencies. Do not over-engineer.

## 3. System overview

```text
Student Web ─┐
Seller Web  ─┼─ HTTPS/REST ─> NestJS API ─> Prisma ─> PostgreSQL (DEMO)
Admin Web   ─┘                   │
                                ├─ Auth / RBAC
                                ├─ Coupons / Sales
                                ├─ Wallet / Ledger
                                ├─ Meals / Statistics (simulated)
                                └─ RestaurantIntegration port (stub, no real integration)
```

### Future production adapter (design only)

Define an interface `RestaurantIntegrationPort` with methods such as `getRestaurantBalance(studentExternalId)` and `requestRecharge({studentExternalId, amountCents, externalReference})`, but **do not wire it to a real system**. For MVP use `DemoRestaurantAdapter` operating against the local demo wallet. Real integration needs school authorization and a documented API/service; the restaurant system must be treated as authoritative. Prevent double-credit through stable external references and reconciliation. Avoid double-counting the demo wallet as a second source of truth in future production.

## 4. Roles and permissions

| Action | STUDENT | SELLER | ADMIN |
|---|:---:|:---:|:---:|
| View own profile/balance/history/stats | ✓ | own profile only | own profile only |
| Redeem a coupon into own demo wallet | ✓ | — | — |
| View available assigned coupons | — | ✓ | ✓ |
| Activate a sold coupon | — | ✓ (assigned stock only) | ✓ |
| Create coupon batches | — | — | ✓ |
| View all sales/redemptions/ledger for audit | — | own sales only | ✓ |
| Seed/demo-simulate meal debit | — | — | ✓ (demo only) |

Never trust role/user ID from client request payload. Identity must come from the verified JWT. Scope seller inventory and reports by seller when applicable.

## 5. Data model (Prisma)

Implement these models or an equivalent normalized schema. Use UUIDs (or cuid), foreign keys, created/updated timestamps, proper unique indexes, and enum types. Prefer `Decimal` only if justified, otherwise integer cents.

### `User`
- `id`, `email` (unique), `passwordHash`, `fullName`, `studentNumber` (nullable, unique), `role` (`STUDENT | SELLER | ADMIN`), `isActive`, `createdAt`, `updatedAt`.
- One wallet for each student account.

### `Wallet` (demo only)
- `id`, `userId` (unique), `balanceCents` (integer, nonnegative), `updatedAt`.
- Wallet changes must always have an associated immutable ledger entry.

### `CouponBatch`
- `id`, `label`, `amountCents`, `quantity`, `createdById`, `createdAt`.
- Admin creates batch with fixed denomination. Allowed denominations in MVP: `2000`, `5000`, `10000` cents (20/50/100 MAD). Configure as constants.

### `Coupon`
- `id`, `batchId`, `codeHash` (unique), `status` (`CREATED | ACTIVE | REDEEMED | VOID`), `assignedSellerId` (nullable), `activatedById` (nullable), `activatedAt` (nullable), `redeemedById` (nullable), `redeemedAt` (nullable), `createdAt`, `updatedAt`.
- Do **not** store plain-text redeemable codes in the database. Codes are generated with a cryptographically secure RNG, high entropy (at least 128 random bits), human-readable groups, e.g. `RESTO-XXXX-XXXX-XXXX-XXXX-XXXX-XXXX-XXXX-XXXX` if using hex groups; choose an unambiguous alphabet if preferred.
- Hash with `HMAC-SHA256` using a dedicated server-side pepper (`COUPON_HASH_KEY`). Normalize code before hashing; compare via indexed equality; do not log raw coupon codes.
- Coupon codes are displayed **once** to an authorized admin at generation; they can export printable codes at that moment, after which only masked identifiers remain available. For the MVP, allow admin to download a CSV from the one-time creation response. Do not leak codes in GET endpoints.
- A `CREATED` coupon cannot be redeemed; a `VOID`/`REDEEMED` coupon cannot be activated/redeemed.

### `CouponSale`
- `id`, `couponId` (unique), `sellerId`, `saleReference` (optional), `amountCents`, `soldAt`.
- Created at activation, representing **demo simulated cash collection**; do not claim proof of real cash payment.

### `WalletTransaction` (immutable ledger)
- `id`, `walletId`, `type` (`COUPON_RECHARGE | MEAL_DEBIT | ADMIN_ADJUSTMENT`), `amountCents` (signed integer; positive credit, negative debit), `balanceAfterCents`, `couponId` (nullable, unique for recharge), `mealId` (nullable, unique for meal debit), `createdAt`, `metadata` (JSON optional).
- Do not allow edit/delete APIs for ledger records.
- In MVP avoid `ADMIN_ADJUSTMENT` unless audit/approval semantics are explicitly implemented.

### `Meal` (demo data)
- `id`, `userId`, `type` (`BREAKFAST | LUNCH | DINNER`), `priceCents`, `consumedAt`, `createdAt`.
- For demo, use sample meal entries; if meals deduct demo wallets, always write matching `WalletTransaction` atomically and reject insufficient funds. Sample price `140` cents (1.40 MAD) is configurable, not universally fixed.

### Constraints
- Enforce unique coupon hashes, one sale per coupon, one redemption ledger entry per coupon, nonnegative wallet balance.
- Add indexes on transaction `walletId, createdAt` and coupon `status, assignedSellerId`.
- Use `onDelete` choices that preserve financial audit history; prefer deactivate/archive over destructive deletion.

## 6. Core transactional rules (critical)

### Coupon generation
1. Only ADMIN can create batches.
2. Validate positive quantity with safe limit (e.g. 1–100 coupons per request) and permitted denomination.
3. Generate codes using crypto-safe randomness; persist hashes only.
4. Return plain codes **one time** to the admin. In demo, show an explicit warning to print/export them securely.

### Coupon activation / sale
1. Only authorized SELLER of assigned coupon (or ADMIN) can activate.
2. Require `status = CREATED` and non-existing sale.
3. In one DB transaction create `CouponSale` and move `Coupon` to `ACTIVE`; reject duplicate activation.
4. Record who activated it and when. Sale is simulated for MVP.

### Coupon redemption (**most important workflow**)
1. Authenticated STUDENT submits `{ code }`.
2. Normalize and HMAC-hash the code. Never log or return the raw code.
3. Perform all changes in **one database transaction** with safe concurrency behavior (e.g. conditional `updateMany` from `ACTIVE` to `REDEEMED`, check `count === 1`, then increment the wallet, insert unique ledger record). Use PostgreSQL isolation/unique constraints and retry only on known serialization conflicts.
4. Reject `CREATED`, `VOID`, already `REDEEMED`, invalid or nonexistent coupons with safe messages. No balance change on failure.
5. Derive value server-side from batch, never from request.
6. Record `redeemedById`, `redeemedAt`, `WalletTransaction` with unique `couponId`.
7. Return credited amount and current demo balance. Parallel duplicate submissions must credit **exactly once**.
8. Rate-limit redemption and login; do not expose whether a code exists through markedly different error details.

### Simulated meal deduction
1. ADMIN-only demo endpoint for creating a meal on a selected student wallet; this must be clearly labeled simulation.
2. Conditional decrement only if `balanceCents >= priceCents`, create meal and ledger record in same transaction.
3. No negative balances; statistics may be derived from `Meal` table.

## 7. REST API contract

Base prefix: `/api/v1`. Use consistent JSON error structure, validation DTOs, JWT bearer auth, roles guards, pagination on list APIs, and `/api/docs` Swagger.

| Method | Endpoint | Access | Description |
|---|---|---|---|
| `GET` | `/health` | Public | Health status |
| `POST` | `/api/v1/auth/login` | Public | `{email, password}` -> `{accessToken, user}` |
| `GET` | `/api/v1/users/me` | Auth | Own profile |
| `GET` | `/api/v1/wallet/me` | STUDENT | Demo balance; `isDemo: true` |
| `GET` | `/api/v1/wallet/me/transactions?page=1&limit=20` | STUDENT | Paginated own ledger |
| `POST` | `/api/v1/coupons/redeem` | STUDENT | `{code}` -> demo wallet credit |
| `GET` | `/api/v1/meals/me?page=1&limit=20` | STUDENT | Own demo meals |
| `GET` | `/api/v1/meals/me/stats?from=...&to=...` | STUDENT | Counts by type, total spent cents |
| `POST` | `/api/v1/admin/coupon-batches` | ADMIN | `{label, amountCents, quantity, assignedSellerId?}`; one-time code list |
| `GET` | `/api/v1/admin/coupon-batches` | ADMIN | Batch summaries; no plain codes |
| `GET` | `/api/v1/admin/coupons?status=...&page=...` | ADMIN | Masked coupon list/status |
| `POST` | `/api/v1/admin/coupons/:id/void` | ADMIN | Void unredeemed coupon (business rule) |
| `GET` | `/api/v1/admin/sales` | ADMIN | Paginated simulated sale audit |
| `GET` | `/api/v1/seller/coupons?status=...` | SELLER | Assigned coupons, no code disclosure |
| `POST` | `/api/v1/seller/coupons/:id/activate` | SELLER | `{saleReference?}`; demo cash sale |
| `GET` | `/api/v1/seller/sales` | SELLER | Own simulated sale history |
| `POST` | `/api/v1/admin/demo/meals` | ADMIN | `{studentId, type, priceCents?}` simulated debit |

**UX requirement:** Voucher printing/handling workflow must be coherent. Because codes are stored as hashes and not recoverable, `GET /seller/coupons` must not pretend to reveal codes. For MVP, admin downloads/prints a secure CSV of generated codes, distributes cards/slips to seller, and assigns coupon records to that seller. The seller identifies a coupon using a **non-secret printed coupon reference/serial number** (`publicSerial`, unique) to activate it after payment. Add `publicSerial` on `Coupon`, include it in the printed slip and seller inventory, and allow seller activation by coupon `id` or `publicSerial`, never by providing/exposing the redeemable code. No consumer redemption permitted prior to activation.

### Example responses

```json
// GET /api/v1/wallet/me
{
  "isDemo": true,
  "currency": "MAD",
  "balanceCents": 8740,
  "balanceFormatted": "87,40 MAD"
}
```

```json
// POST /api/v1/coupons/redeem
// request: { "code": "RESTO-...." }
{
  "success": true,
  "isDemo": true,
  "creditedCents": 5000,
  "balanceCents": 13740,
  "transactionId": "uuid"
}
```

### Standard error status
- `400` invalid body/format; `401` missing/invalid auth; `403` wrong role or seller ownership; `404` resource not found; `409` invalid state/duplicate coupon; `429` throttled. Preserve safe error messages for codes.

## 8. UI specification (in French)

### Shared
- Responsive desktop/mobile, accessible labels, clear error/success toasts, loading indicators, logout, navigation by role.
- Header/badge visible on all relevant screens: **« Démonstration — aucun solde réel modifié »**.
- Use MAD formatting: e.g. `87,40 DH`, dates formatted in French Casablanca locale.

### Student pages
- `/login`: email + password; sample accounts for development.
- `/dashboard`: welcome, demo balance card, recharge CTA, number of meals this month, total meal spending, recent transactions.
- `/recharge`: input coupon code, confirm, success message with new balance; note code single-use.
- `/transactions`: recharge/meal transaction table with pagination/filters.
- `/meals`: consumption list, breakfast/lunch/dinner breakdown, current-month summary.

### Seller pages
- `/seller`: assigned coupon stock by status, search by serial, activation button with explicit simulated-cash-sale confirmation, own sales log.

### Admin pages
- `/admin`: dashboard showing coupon batch, active/redeemed counts.
- `/admin/coupons`: create batch, choose denomination (20/50/100 DH), quantity, assign seller, immediately export one-time CSV with **publicSerial + secret redeemable code + value**; show masked summaries afterward.
- `/admin/sales`: audit simulated sales.
- `/admin/demo`: pick student and simulate a meal deduction.

## 9. Suggested project layout

```text
smartresto/
├── README.md
├── PROJECT_SPEC.md
├── docker-compose.yml
├── .env.example
├── .gitignore
├── frontend/
│   ├── Dockerfile
│   ├── package.json
│   └── src/
│       ├── app/            # router + auth context
│       ├── components/     # shared UI
│       ├── pages/          # student/seller/admin
│       ├── services/       # typed API client
│       └── types/
└── backend/
    ├── Dockerfile
    ├── package.json
    ├── prisma/
    │   ├── schema.prisma
    │   ├── migrations/
    │   └── seed.ts
    ├── test/
    └── src/
        ├── main.ts
        ├── app.module.ts
        ├── common/         # guards, filters, pagination, decorators
        ├── auth/
        ├── users/
        ├── wallets/
        ├── coupons/
        ├── sales/
        ├── meals/
        └── integrations/   # demo adapter + future port
```

## 10. Docker and local development

- `docker compose up --build` starts `db`, `backend`, and `frontend`, with PostgreSQL healthcheck and appropriate startup dependency.
- Document local URLs, e.g. web `http://localhost:5173`, API `http://localhost:3000`, Swagger `http://localhost:3000/api/docs`.
- Migrations run explicitly or via documented entrypoint, not destructive force-reset at startup.
- `.env.example` includes `DATABASE_URL`, `JWT_SECRET`, `COUPON_HASH_KEY`, `FRONTEND_URL`, `VITE_API_URL` and sensible local port settings. No real secrets committed.
- Seed **demo** accounts for `student@smartresto.local`, `seller@smartresto.local`, `admin@smartresto.local` with clear development-only credentials in README (not reused in production). Give sample meals and transactions consistent with balances and ledger; do not seed real active monetary value beyond demo context.
- README includes setup, demo flow, role permissions, sample calls, test commands, production caveats.

## 11. Security essentials

- Auth: hash passwords, JWT expirations, validation, RBAC and ownership checks. No secrets in logs, client bundles, or repository.
- Generate secure unpredictable coupons, HMAC hashes at rest, one-time printable codes, and rate-limit brute-force attempts.
- Coupon activated only after *recorded* simulated sale, redeemed once, credit atomic with ledger, safe under concurrent requests.
- DB integrity and constraints; money integer cents; avoid direct frontend write paths.
- Validate inputs, pagination limits, CORS allowed origin, no SQL injection, Swagger restricted/disabled in production as needed.
- In real deployment, protect personal data and restrict reporting to legitimate access. Never display other students' identifiable meal history to sellers.
- Ensure `CouponSale` records are simulations and not legal proof of cash receipt. School approval is required before real distribution/financial operation.

## 12. Minimum required tests

Write and run tests covering:

1. Student login succeeds; wrong password fails; RBAC denies student access to seller/admin endpoints.
2. Admin creates batch; raw code returned once; database only stores HMAC; subsequent list returns no secret code.
3. `CREATED` coupon cannot be redeemed; seller activation transitions to `ACTIVE` and logs sale.
4. Redeeming a valid ACTIVE 50 DH coupon increases demo wallet by exactly 5000 cents and creates one ledger entry.
5. Redeeming the same code twice does **not** increase balance twice.
6. Concurrent redemption attempts credit exactly once.
7. Invalid/VOID coupon cannot be redeemed; wallet unchanged.
8. Seller cannot activate coupons assigned to another seller.
9. Simulated 1.40 DH meal decreases wallet by 140 cents, creates matching meal and ledger entry, and updates student statistics.
10. Insufficient demo wallet balance prevents meal debit (no negative balance).

## 13. Acceptance criteria (definition of done)

- [ ] Running app with one documented Docker Compose command.
- [ ] Frontend responsive pages for student, seller and admin.
- [ ] Auth and RBAC implemented and enforced server-side.
- [ ] Admin can create printable single-use coupons; cannot retrieve their secrets later.
- [ ] Seller can activate assigned unsold coupon after simulated cash-sale confirmation.
- [ ] Student can redeem activated coupon, see updated demo balance, and view ledger and meal stats.
- [ ] No double credit on repeated or parallel requests.
- [ ] Meal simulation debits safely and appears in student history.
- [ ] Swagger/OpenAPI API docs work.
- [ ] Backend tests run and pass; provide commands in README.
- [ ] Clear demo banner; no claim of integration with existing restaurant DB.
- [ ] Code organized by modules, linted, with no committed credentials.

## 14. Codex execution instructions

You are the implementation agent. **Build the entire MVP in this repository**, making reasoned technical choices without stopping for low-value confirmations.

1. Inspect the repository. If empty, scaffold the structure above.
2. Create Prisma schema, migrations, seed and backend modules first.
3. Implement API routes with validation, JWT, RBAC, atomic coupon redemption, stable DB constraints and Swagger.
4. Build responsive French UI with protected role-specific routes and real integration to your local backend.
5. Add Dockerfiles and Compose; provide `.env.example` and useful scripts.
6. Write tests for the critical workflows, especially duplicate/concurrent redemption.
7. Run installation, migrations, build, lint/tests and fix any failures. If Docker is unavailable, run everything you can locally and document limitations transparently.
8. Write a detailed `README.md` with getting started, demo login credentials, sample voucher sale/redeem flow, testing, and constraints.
9. End with a concise summary of implemented features, startup commands, test results and any remaining blockers.

**Implementation priorities:** reliable end-to-end coupon creation → activation → redemption → ledger over decorative frontend features. Prefer a complete working thin vertical slice to unfinished extras. Use real database transactions, not in-memory mocks, for the core flows.

**Important business caveat:** The voucher cash-sale model is only a prototype until school/régie authorization, cash accountability, voucher issuance controls, and an official restaurant-system integration are established. Do not connect or modify the existing live restaurant database without explicit authorization and technical specifications.
