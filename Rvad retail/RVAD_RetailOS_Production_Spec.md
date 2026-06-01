# RVAD RetailOS — Production Implementation Specification

> **Purpose:** This document is the complete technical brief for an AI agent or development team to convert the existing Google AI Studio prototype into a production-grade retail operating system. The UI/UX and business logic are already defined in the prototype — do not redesign them. The goal is to replace mock/in-memory state with real persistence, real auth, and a production-ready backend.

---

## 1. Project Overview

**Product:** RVAD RetailOS — a full-stack retail management system for small/medium stores in CIS markets (KGS/RUB currency).

**Tech stack (keep as-is):**
- Frontend: React 19 + TypeScript + Tailwind CSS v4 + Vite
- Backend: Node.js + Express + TypeScript (`server.ts`)
- AI: Gemini API (`gemini-2.5-flash` model — update from `gemini-3.5-flash` in prototype)
- Telegram bots: two separate bots (internal staff + client-facing)
- Barcode scanning: `html5-qrcode`

**Modules in the system:**
| Tab ID | Module | Description |
|---|---|---|
| `pos` | POS (Point of Sale) | Cashier interface, cart, payments |
| `inventory` | Inventory | Products, stock, receiving goods |
| `debt` | Debt Tracker | Customer debts + payments |
| `crm` | CRM | Customers & suppliers |
| `analytics` | Analytics | Sales & financial reports |
| `employees` | Employees | Staff, roles, documents, PIN auth |
| `expenses` | Expenses | Business expense tracking |
| `deadstock` | Dead Stock | Slow-moving inventory alerts |
| `b3s` | Shift Audit | Shift summary & audit dashboard |
| `sync` | Sync Manager | Offline queue management |
| `admin` | Admin Panel | Settings, Telegram config |
| `architecture` | Architecture Hub | System info / AI forecast |

---

## 2. What Is Already Done (Do Not Touch)

- All React UI components: `POS.tsx`, `Inventory.tsx`, `CRM.tsx`, `Analytics.tsx`, `DebtTracker.tsx`, `Employees.tsx`, `ExpensesManagement.tsx`, `SyncManager.tsx`, `AdminPanel.tsx`, `BarcodeScanner.tsx`, `ArchitectureHub.tsx`, `ShiftAuditDashboard.tsx`, `DeadStock.tsx`
- All TypeScript types in `src/types.ts`
- App layout, navigation, themes in `src/App.tsx`
- Audio engine `src/utils/audio.ts`
- Express server skeleton `server.ts`
- Telegram bot command handlers (already implemented in `server.ts`)
- AI routes: barcode lookup, invoice parsing, inventory forecasting

**The prototype stores ALL state in React `useState` (in-memory)**. On page refresh everything is lost. That is the primary problem to solve.

---

## 3. What Must Be Built (Agent Task List)

### 3.1 Database Layer

**Choose:** PostgreSQL (recommended) or SQLite (for single-machine deployments).

Create tables matching the existing TypeScript types exactly:

```sql
-- Core tables (map 1:1 to src/types.ts)
products         (id, name, barcode, category, sku, image_url, price_buy, price_sell, price_wholesale, stock, min_stock, unit, supplier_id, responsible_employee_id)
categories       (id, name, sku_prefix)
suppliers        (id, name, phone, company, debt)
customers        (id, name, phone, telegram_chat_id, debt, debt_limit, discount_percent, notes)
employees        (id, name, role, phone, pin_hash, telegram_chat_id, is_online, status, join_date)
employee_documents (id, employee_id, type, number, issue_date, expiry_date, notes, scans jsonb, monthly_payments jsonb)
sale_transactions (id, timestamp, cashier_name, items jsonb, total_price_buy, total_before_discount, total_discount, final_price, payment_method, paid_cash, paid_card, paid_debt, customer_id, synced)
debt_payments    (id, customer_id, customer_name, amount, payment_method, timestamp, synced)
stock_correction_logs (id, product_id, product_name, old_stock, new_stock, type, timestamp, notes, cashier_name)
security_audit_logs   (id, timestamp, role, user_name, action, details, severity)
sync_tasks       (id, type, payload jsonb, timestamp, status)
business_expenses (id, category, amount, timestamp, date, notes)
```

**ORM:** Use `drizzle-orm` or `prisma` — agent's choice based on familiarity.

**Migrations:** All schema changes via migration files (never raw ALTER in application code).

### 3.2 REST API Endpoints

Replace the current in-memory `LATEST_SESSION_STATE` object with real DB queries. Implement full CRUD for every entity:

#### Products
```
GET    /api/products              # list all, support ?search=&category=
POST   /api/products              # create
PUT    /api/products/:id          # update
DELETE /api/products/:id          # delete
POST   /api/products/:id/adjust-stock  # body: { delta, type, notes, cashier_name }
```

#### Categories
```
GET    /api/categories
POST   /api/categories
PUT    /api/categories/:id
DELETE /api/categories/:id
```

#### Customers
```
GET    /api/customers
POST   /api/customers
PUT    /api/customers/:id
DELETE /api/customers/:id
```

#### Suppliers
```
GET    /api/suppliers
POST   /api/suppliers
PUT    /api/suppliers/:id
DELETE /api/suppliers/:id
```

#### Employees
```
GET    /api/employees
POST   /api/employees
PUT    /api/employees/:id
DELETE /api/employees/:id
POST   /api/employees/:id/verify-pin   # body: { pin } → returns { valid: bool }
```

#### Sales
```
GET    /api/sales              # support ?from=&to=&cashier=
POST   /api/sales              # create transaction (also updates product stock, customer debt)
GET    /api/sales/:id
```

#### Debt Payments
```
GET    /api/debt-payments
POST   /api/debt-payments      # also updates customer.debt
```

#### Stock Corrections
```
GET    /api/stock-corrections
POST   /api/stock-corrections
```

#### Expenses
```
GET    /api/expenses           # support ?from=&to=
POST   /api/expenses
DELETE /api/expenses/:id
```

#### Security Audit Log
```
GET    /api/audit-logs
POST   /api/audit-logs         # internal use only
```

#### Sync (keep existing endpoints, back with DB)
```
POST   /api/session/sync       # already exists — now persist to DB
GET    /api/sync/pending       # list unsynced tasks
POST   /api/sync/resolve/:id   # mark task resolved
```

#### AI endpoints (already exist — keep as-is)
```
GET    /api/barcode?code=...          # Gemini barcode lookup
POST   /api/parse-invoice             # Gemini invoice OCR
POST   /api/inventory/forecast        # Gemini stock forecast
POST   /api/telegram/send             # send Telegram message
```

### 3.3 Authentication & Authorization

The prototype already has a PIN-based login system and role enum (`OWNER`, `ADMIN`, `CASHIER`, `WAREHOUSE`). Wire it up properly:

**PIN Auth:**
- Store PIN as bcrypt hash in `employees.pin_hash`
- `POST /api/auth/login` body: `{ pin }` → returns employee object + signed JWT
- JWT payload: `{ employeeId, name, role, exp }`
- JWT secret from env var `JWT_SECRET`
- Token lifetime: 8 hours (one shift)

**Role-based access on API routes:**
| Role | Access |
|---|---|
| `OWNER` | Full access to all endpoints |
| `ADMIN` | All except DELETE employees, change owner PIN |
| `CASHIER` | POST /api/sales, GET /api/products, GET /api/customers, POST /api/debt-payments |
| `WAREHOUSE` | GET/POST /api/products, POST /api/stock-corrections |

**Middleware:** Create `requireAuth(roles?: UserRole[])` Express middleware. Attach it to all routes except `/api/auth/login` and the Telegram webhook.

### 3.4 Frontend Data Layer

Replace all React `useState` holding server data with API calls.

**Pattern to use:** React Query (`@tanstack/react-query`) or SWR — agent's choice.

**Key changes in `App.tsx`:**
1. On app load → `GET /api/products`, `GET /api/customers`, `GET /api/employees`, etc. to hydrate state
2. All create/update/delete operations → call the corresponding API endpoint, then invalidate/refetch
3. Remove `INITIAL_*` mock data imports from `data.ts` (keep file for reference but stop using it)
4. Pass JWT token in `Authorization: Bearer <token>` header on all requests
5. On 401 → redirect to login screen

**State that stays in React (do not move to DB):**
- Cart contents during active sale
- Active tab / UI state
- Toast notifications
- Theme preference (keep in localStorage)

### 3.5 Offline Support (SyncManager)

The `SyncManager.tsx` component already has the UI. Implement the backend:

1. When a sale is made offline (no server connection), write to `sync_tasks` table locally (or IndexedDB if fully offline)
2. On reconnect, the sync manager calls `POST /api/session/sync` with the queued tasks
3. Server processes tasks in order, resolves conflicts (e.g., stock went negative), marks tasks as `RESOLVED` or `CONFLICT`
4. Conflicts surface in the Sync Manager UI for manual resolution

**Conflict resolution rules:**
- `SALE_TRANSACTION`: if stock would go negative → mark `CONFLICT`, notify admin
- `DEBT_PAYMENT`: always apply (no conflict possible)
- `STOCK_CORRECTION`: apply with latest timestamp winning
- `CUSTOMER_UPDATE`: last-write-wins

### 3.6 Telegram Bot Integration

Two bots are already fully implemented in `server.ts`. Wire them to the database:

**Internal bot** (owner/admin commands):
- `/status` → query DB for today's sales total, active cashier
- `/revenue` → query `sale_transactions` for financial summary
- `/low_stock` → query `products` WHERE `stock <= min_stock`
- `/alerts` → test event notifications

**Client bot** (customer debt self-service):
- Deep link `?start=client_<customerId>` → look up customer in DB
- "My debt" → query `customers.debt` by linked `telegram_chat_id`
- "Payment history" → query `debt_payments` by `customer_id`

**Webhook setup:**
- `POST /api/telegram/webhook/internal` and `POST /api/telegram/webhook/client`
- Register webhooks at startup via Telegram Bot API: `setWebhook`
- Remove polling — use webhooks in production

**Env vars required:**
```
TELEGRAM_BOT_TOKEN_INTERNAL=
TELEGRAM_BOT_TOKEN_CLIENT=
OWNER_TELEGRAM_CHAT_ID=
```

### 3.7 Environment Configuration

Create `.env.example` (already exists) and document all required vars:

```env
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/rvad_retailos
# Or for SQLite:
# DATABASE_URL=file:./data/retailos.db

# Auth
JWT_SECRET=<generate with: openssl rand -hex 32>

# AI
GEMINI_API_KEY=

# Telegram
TELEGRAM_BOT_TOKEN_INTERNAL=
TELEGRAM_BOT_TOKEN_CLIENT=
OWNER_TELEGRAM_CHAT_ID=

# Server
PORT=3000
NODE_ENV=production

# App URL (needed for Telegram webhook registration)
APP_URL=https://yourdomain.com
```

### 3.8 Image / File Storage

Products have `imageUrl` and employee documents have `scans` (base64 or URLs).

**Implementation:**
- Accept image uploads via `POST /api/upload` (multipart/form-data)
- Store files on disk in `./uploads/` directory (or S3-compatible object storage for cloud)
- Return a permanent URL: `/uploads/<filename>`
- Serve `/uploads` as static in Express
- Store only the URL (not base64) in the database

### 3.9 Data Seeding

Port `src/data.ts` into a seed script:

```
scripts/seed.ts   # inserts INITIAL_CATEGORIES, INITIAL_SUPPLIERS, INITIAL_PRODUCTS, INITIAL_CUSTOMERS
```

Run via: `npm run seed`

This allows fresh installs to have demo data immediately.

---

## 4. Deployment

### Option A: Single VPS (recommended for small store)

```
/opt/rvad-retailos/
├── dist/           ← built frontend (vite build output)
├── dist/server.cjs ← compiled server
├── uploads/        ← user-uploaded files
└── .env            ← secrets
```

**Process manager:** PM2
```bash
pm2 start dist/server.cjs --name rvad-retailos
pm2 save
pm2 startup
```

**Reverse proxy:** Nginx
```nginx
server {
    listen 443 ssl;
    server_name yourdomain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    location /uploads/ {
        alias /opt/rvad-retailos/uploads/;
        expires 30d;
    }
}
```

**SSL:** Certbot + Let's Encrypt

**Database backup:** Daily cron → `pg_dump` to `/backups/` + optionally push to S3

### Option B: Docker Compose

```yaml
# docker-compose.yml
services:
  app:
    build: .
    ports:
      - "3000:3000"
    env_file: .env
    volumes:
      - ./uploads:/app/uploads
    depends_on:
      - db

  db:
    image: postgres:16-alpine
    volumes:
      - pgdata:/var/lib/postgresql/data
    environment:
      POSTGRES_DB: rvad_retailos
      POSTGRES_USER: rvad
      POSTGRES_PASSWORD: ${DB_PASSWORD}

volumes:
  pgdata:
```

---

## 5. Build & Scripts

Add to `package.json`:
```json
{
  "scripts": {
    "dev": "tsx server.ts",
    "build": "vite build && esbuild server.ts --bundle --platform=node --format=cjs --packages=external --sourcemap --outfile=dist/server.cjs",
    "start": "node dist/server.cjs",
    "db:migrate": "drizzle-kit migrate",
    "db:seed": "tsx scripts/seed.ts",
    "db:studio": "drizzle-kit studio"
  }
}
```

---

## 6. New Dependencies to Add

```bash
# Database
npm install drizzle-orm pg
npm install -D drizzle-kit @types/pg

# Auth
npm install jsonwebtoken bcrypt
npm install -D @types/jsonwebtoken @types/bcrypt

# Data fetching (frontend)
npm install @tanstack/react-query

# File uploads
npm install multer
npm install -D @types/multer
```

---

## 7. File Structure After Implementation

```
rvad-retailos/
├── src/                          ← frontend (unchanged)
│   ├── components/               ← all existing components (unchanged)
│   ├── types.ts                  ← unchanged
│   ├── App.tsx                   ← update: replace useState with react-query
│   ├── data.ts                   ← keep for reference, stop importing
│   └── utils/
│       ├── audio.ts              ← unchanged
│       └── api.ts                ← NEW: typed API client functions
├── server/                       ← NEW: split server.ts into modules
│   ├── index.ts                  ← entry point (replaces monolithic server.ts)
│   ├── db/
│   │   ├── schema.ts             ← Drizzle schema
│   │   ├── migrate.ts            ← migration runner
│   │   └── seed.ts               ← seed script
│   ├── routes/
│   │   ├── auth.ts
│   │   ├── products.ts
│   │   ├── customers.ts
│   │   ├── suppliers.ts
│   │   ├── employees.ts
│   │   ├── sales.ts
│   │   ├── debtPayments.ts
│   │   ├── expenses.ts
│   │   ├── stockCorrections.ts
│   │   ├── auditLogs.ts
│   │   ├── sync.ts
│   │   ├── upload.ts
│   │   └── ai.ts                 ← existing AI routes (barcode, invoice, forecast)
│   ├── middleware/
│   │   ├── requireAuth.ts
│   │   └── errorHandler.ts
│   └── telegram/
│       ├── internal.ts           ← internal bot handlers
│       └── client.ts             ← client bot handlers
├── uploads/                      ← runtime, gitignored
├── .env.example                  ← updated with all vars
├── .env                          ← gitignored
├── server.ts                     ← keep as legacy shim or delete after migration
├── vite.config.ts                ← unchanged
├── package.json                  ← updated with new deps & scripts
└── docker-compose.yml            ← NEW
```

---

## 8. Implementation Order (Recommended)

1. **Database schema + migrations** — define all tables, run migrations
2. **Auth endpoints** — `POST /api/auth/login`, `requireAuth` middleware
3. **Products CRUD** — most other modules depend on products
4. **Sales endpoint** — the most complex: atomic stock update + customer debt update + audit log
5. **All remaining CRUD routes** — customers, suppliers, employees, expenses, etc.
6. **Frontend API client** (`src/utils/api.ts`) — typed wrappers for every endpoint
7. **Update App.tsx** — replace useState+data.ts with react-query calls
8. **Image upload** — multer endpoint + update product/employee forms
9. **Telegram webhooks** — replace polling with webhooks, connect to DB queries
10. **Offline sync** — connect SyncManager to real queue in DB
11. **Seed script** — port data.ts to seed
12. **Docker + deployment** — containerize, write nginx config, PM2 setup
13. **Testing** — at minimum smoke-test every API endpoint

---

## 9. Critical Business Logic Rules

These rules are embedded in the prototype and must be preserved exactly:

**Sale transaction (atomic):**
1. For each cart item: decrease `products.stock` by `quantity`
2. If `paymentMethod === 'DEBT'` or `paidDebt > 0`: increase `customers.debt` by `paidDebt`
3. If `paymentMethod === 'SPLIT'`: apply both cash/card and debt portions
4. Write `sale_transactions` record
5. Write `stock_correction_logs` records (type: `SALE`) for each item
6. Write `security_audit_logs` record (severity: `INFO`)
7. All of the above in a single DB transaction — if any step fails, rollback all

**Debt payment (atomic):**
1. Decrease `customers.debt` by `amount` (floor at 0)
2. Write `debt_payments` record
3. Write `security_audit_logs` record

**Stock correction:**
1. Update `products.stock` to new value
2. Write `stock_correction_logs` record
3. If new stock > 0 and was previously below `min_stock` → trigger Telegram notification to internal bot

**Employee PIN:**
- PINs are 4 digits
- Store as bcrypt hash (salt rounds: 10)
- Never return PIN hash in API responses
- `OWNER` role can change any PIN
- `ADMIN` role can change `CASHIER`/`WAREHOUSE` PINs only

**Debt limits:**
- When creating a sale with `paymentMethod === 'DEBT'`: check `customer.debt + paidDebt <= customer.debtLimit`
- If over limit: reject sale with error `DEBT_LIMIT_EXCEEDED`
- `OWNER`/`ADMIN` can override with explicit flag `{ forceOverLimit: true }`

---

## 10. What NOT to Change

- Do not change any component file in `src/components/`
- Do not change `src/types.ts`
- Do not change the existing UI/UX, themes, or navigation
- Do not change `src/utils/audio.ts`
- Do not change the Telegram bot command structure or message formatting
- Do not change the AI prompt templates in the existing server routes
- Do not change `vite.config.ts`

The prototype is complete and correct in terms of UI and business rules. The only job is to give it a real backbone.

---

*Generated from prototype analysis of RVAD RetailOS (Google AI Studio export, May 2026)*
