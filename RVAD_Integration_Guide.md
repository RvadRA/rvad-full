# Rvad Retail ↔ Customer Storefront — Full Integration Guide

> **For: Antigravity Developer**
> **Systems:** Rvad retail (Express + PostgreSQL + Drizzle ORM) + customer-storefront (React SPA)
> **Goal:** Replace all mock/localStorage data in the storefront with live calls to the Rvad retail API, and handle orders end-to-end.

---

## 1. Architecture Overview

```
customer-storefront (React)
        │
        │  HTTP/REST  (+ CORS)
        ▼
Rvad retail server (Express, port 3000)
        │
        ▼
PostgreSQL (Drizzle ORM)
```

The storefront currently has **zero real API calls** — everything is mocked in `src/data.ts` and `localStorage`. The Rvad retail server already has all the necessary routes. The work is:

1. Add a **storefront auth system** to Rvad retail (customers, not employees)
2. Add a **public products endpoint** (no employee JWT needed)
3. Add a **storefront orders endpoint** (creates a sale transaction from customer order)
4. Add **CORS** to the Rvad retail server
5. Replace mock data in storefront with real API calls
6. Wire the checkout to actually POST to the server

---

## 2. What Already Exists in Rvad Retail

| Route | Method | Notes |
|---|---|---|
| `/api/products` | GET | Exists — needs public access (currently requires employee JWT) |
| `/api/categories` | GET | Exists — needs public access |
| `/api/customers` | GET / POST / PUT | Exists — for looking up and creating customers |
| `/api/sales` | POST | Exists — the atomic sale transaction endpoint |
| `/api/telegram/webhook/client` | POST | Exists — for Telegram order notifications |

---

## 3. Changes Required in Rvad Retail

### 3.1 Add CORS

In `server/index.ts`, before all route mounting, add:

```typescript
import cors from 'cors';

// Add this near the top of startServer(), before app.use('/api/...')
app.use(cors({
  origin: process.env.STOREFRONT_URL || 'http://localhost:5173',
  credentials: true,
}));
```

Install the package:
```bash
npm install cors
npm install --save-dev @types/cors
```

Add `STOREFRONT_URL` to `.env`:
```
STOREFRONT_URL=https://your-storefront-domain.com
```

---

### 3.2 Add Customer Auth Routes

The storefront needs its own auth — customers log in by phone + password, NOT by employee PIN. Create a new file:

**`server/routes/storefrontAuth.ts`**

```typescript
import { Router } from 'express';
import { db } from '../db/connection';
import { customers } from '../db/schema';
import { eq } from 'drizzle-orm';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

const router = Router();

const JWT_SECRET = process.env.JWT_SECRET || '4f63c8a9134b22c7128d546ef81a4b6c321d54f67e89ab0c210d3e5b6c7a8d9e';

// POST /api/storefront/auth/register
// Body: { name, phone, password }
router.post('/register', async (req, res) => {
  const { name, phone, password } = req.body;
  if (!name || !phone || !password) {
    return res.status(400).json({ error: 'name, phone и password обязательны.' });
  }
  if (password.length < 4) {
    return res.status(400).json({ error: 'Пароль должен быть не менее 4 символов.' });
  }

  try {
    // Check if customer already exists by phone
    const existing = await db.select().from(customers).where(eq(customers.phone, phone));
    if (existing.length > 0) {
      return res.status(409).json({ error: 'Клиент с таким телефоном уже зарегистрирован.' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const id = `cust-${Math.floor(10000 + Math.random() * 90000)}`;

    const newCustomer = {
      id,
      name,
      phone,
      passwordHash,   // <-- ADD THIS FIELD TO SCHEMA (see 3.3)
      debt: 0,
      debtLimit: 50000,
      discountPercent: 0,
      notes: null,
      telegramChatId: null,
    };

    await db.insert(customers).values(newCustomer);

    const token = jwt.sign({ customerId: id, name, phone }, JWT_SECRET, { expiresIn: '30d' });

    return res.json({
      token,
      customer: {
        id,
        name,
        phone,
        debt: 0,
        debtLimit: 50000,
        discountPercent: 0,
        telegramLinked: false,
      },
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// POST /api/storefront/auth/login
// Body: { phone, password }
router.post('/login', async (req, res) => {
  const { phone, password } = req.body;
  if (!phone || !password) {
    return res.status(400).json({ error: 'phone и password обязательны.' });
  }

  try {
    const list = await db.select().from(customers).where(eq(customers.phone, phone));
    if (list.length === 0) {
      return res.status(401).json({ error: 'Клиент не найден.' });
    }

    const customer = list[0];

    // Customer registered before password system existed — no hash
    if (!customer.passwordHash) {
      return res.status(401).json({ error: 'Пожалуйста, зарегистрируйтесь заново для установки пароля.' });
    }

    const match = await bcrypt.compare(password, customer.passwordHash);
    if (!match) {
      return res.status(401).json({ error: 'Неверный пароль.' });
    }

    const token = jwt.sign(
      { customerId: customer.id, name: customer.name, phone: customer.phone },
      JWT_SECRET,
      { expiresIn: '30d' }
    );

    return res.json({
      token,
      customer: {
        id: customer.id,
        name: customer.name,
        phone: customer.phone,
        debt: customer.debt,
        debtLimit: customer.debtLimit,
        discountPercent: customer.discountPercent,
        telegramLinked: !!customer.telegramChatId,
      },
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// GET /api/storefront/auth/me  — get current customer profile (requires customer JWT)
router.get('/me', async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Не авторизован.' });
  }

  try {
    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, JWT_SECRET) as { customerId: string };
    const list = await db.select().from(customers).where(eq(customers.id, decoded.customerId));
    if (list.length === 0) {
      return res.status(404).json({ error: 'Клиент не найден.' });
    }
    const c = list[0];
    return res.json({
      id: c.id,
      name: c.name,
      phone: c.phone,
      debt: c.debt,
      debtLimit: c.debtLimit,
      discountPercent: c.discountPercent,
      telegramLinked: !!c.telegramChatId,
    });
  } catch (error: any) {
    return res.status(401).json({ error: 'Токен недействителен или истёк.' });
  }
});

export default router;
```

---

### 3.3 Add `passwordHash` Column to Customers Table

In `server/db/schema.ts`, add one field to `customers`:

```typescript
export const customers = pgTable('customers', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  phone: text('phone').notNull(),
  telegramChatId: text('telegram_chat_id'),
  debt: integer('debt').default(0).notNull(),
  debtLimit: integer('debt_limit').default(50000).notNull(),
  discountPercent: integer('discount_percent').default(0).notNull(),
  notes: text('notes'),
  passwordHash: text('password_hash'),   // <-- ADD THIS LINE (nullable — existing customers won't have it)
});
```

Then run the Drizzle migration:
```bash
npx drizzle-kit generate
npx drizzle-kit migrate
```

---

### 3.4 Add Public Products + Categories Endpoints

Currently, `GET /api/products` requires an employee JWT (`requireAuth()`). The storefront needs to access products without being an employee. Two options:

**Option A (recommended) — add a separate public route:**

In `server/index.ts`, before mounting the protected products router, add:

```typescript
// Public product listing for customer storefront — no auth required
app.get('/api/storefront/products', async (req, res) => {
  try {
    const { search, category } = req.query;
    const conditions: any[] = [];
    
    if (category && typeof category === 'string') {
      conditions.push(eq(products.category, category));
    }
    if (search && typeof search === 'string') {
      conditions.push(
        or(
          ilike(products.name, `%${search}%`),
          ilike(products.sku, `%${search}%`)
        )
      );
    }
    
    // Only return fields the storefront needs — DO NOT expose priceBuy
    const query = db.select({
      id: products.id,
      name: products.name,
      category: products.category,
      sku: products.sku,
      imageUrl: products.imageUrl,
      priceSell: products.priceSell,
      priceWholesale: products.priceWholesale,
      stock: products.stock,
      unit: products.unit,
      isPromo: products.isPromo,
      promoLabel: products.promoLabel,
    }).from(products);

    const results = conditions.length > 0
      ? await query.where(and(...conditions))
      : await query;

    return res.json(results);
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// Public categories for storefront
app.get('/api/storefront/categories', async (req, res) => {
  try {
    const list = await db.select().from(categories);
    return res.json(list);
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});
```

Add missing imports at the top of `server/index.ts`:
```typescript
import { products, categories } from './db/schema';
import { eq, ilike, and, or } from 'drizzle-orm';
```

---

### 3.5 Add Storefront Order Endpoint

This is the most important endpoint — it receives an order from the storefront and creates a full `saleTransaction` in the database (with stock deduction), then optionally sends a Telegram notification.

Create **`server/routes/storefrontOrders.ts`**:

```typescript
import { Router } from 'express';
import { db } from '../db/connection';
import {
  products, customers, saleTransactions,
  stockCorrectionLogs, securityAuditLogs
} from '../db/schema';
import { eq } from 'drizzle-orm';
import jwt from 'jsonwebtoken';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || '4f63c8a9134b22c7128d546ef81a4b6c321d54f67e89ab0c210d3e5b6c7a8d9e';
const CLIENT_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN_CLIENT;

// Middleware: verify customer JWT
function requireCustomerAuth(req: any, res: any, next: any) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Требуется авторизация.' });
  }
  try {
    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, JWT_SECRET) as { customerId: string; name: string; phone: string };
    req.customer = decoded;
    next();
  } catch {
    return res.status(401).json({ error: 'Токен недействителен или истёк.' });
  }
}

// POST /api/storefront/orders
// Body: {
//   items: [{ productId, quantity }],
//   orderType: 'delivery' | 'pickup',
//   deliveryAddress?: string,
//   comment?: string,
//   paymentMethod: 'CASH' | 'CARD' | 'DEBT',
// }
router.post('/', requireCustomerAuth, async (req: any, res) => {
  const { items, orderType, deliveryAddress, comment, paymentMethod = 'CASH' } = req.body;
  const { customerId, name } = req.customer;

  if (!items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'Корзина пуста.' });
  }

  try {
    const result = await db.transaction(async (tx) => {
      // 1. Load customer to get discount
      const customerList = await tx.select().from(customers).where(eq(customers.id, customerId));
      if (customerList.length === 0) {
        throw new Error('Клиент не найден.');
      }
      const customer = customerList[0];
      const discountPercent = customer.discountPercent || 0;

      // 2. Validate products and compute totals
      let totalPriceBuy = 0;
      let totalBeforeDiscount = 0;
      const enrichedItems: any[] = [];

      for (const item of items) {
        const { productId, quantity } = item;
        if (!productId || !quantity || quantity < 1) {
          throw new Error(`Некорректный товар: ${productId}`);
        }

        const prodList = await tx.select().from(products).where(eq(products.id, productId));
        if (prodList.length === 0) {
          throw new Error(`Товар ${productId} не найден.`);
        }
        const product = prodList[0];

        if (product.stock < quantity) {
          throw new Error(`Недостаточно товара "${product.name}" на складе. Доступно: ${product.stock}`);
        }

        totalPriceBuy += product.priceBuy * quantity;
        totalBeforeDiscount += product.priceSell * quantity;

        enrichedItems.push({
          productId: product.id,
          productName: product.name,
          quantity,
          priceBuy: product.priceBuy,
          priceSell: product.priceSell,
          discountPercent,
        });
      }

      const totalDiscount = Math.round(totalBeforeDiscount * discountPercent / 100);
      const finalPrice = totalBeforeDiscount - totalDiscount;

      // 3. Handle DEBT payment
      if (paymentMethod === 'DEBT' || paymentMethod === 'SPLIT') {
        const newDebt = customer.debt + finalPrice;
        if (newDebt > customer.debtLimit) {
          throw new Error(`DEBT_LIMIT_EXCEEDED: лимит долга ${customer.debtLimit}, текущий долг ${customer.debt}, заказ ${finalPrice}`);
        }
        await tx.update(customers)
          .set({ debt: newDebt })
          .where(eq(customers.id, customerId));
      }

      // 4. Deduct stock and write stock correction logs
      for (const item of enrichedItems) {
        const prodList = await tx.select().from(products).where(eq(products.id, item.productId));
        const product = prodList[0];
        const newStock = product.stock - item.quantity;

        await tx.update(products)
          .set({ stock: newStock })
          .where(eq(products.id, item.productId));

        await tx.insert(stockCorrectionLogs).values({
          id: `corr-sf-${Date.now()}-${Math.floor(Math.random() * 9999)}`,
          productId: item.productId,
          productName: item.productName,
          oldStock: product.stock,
          newStock,
          type: 'SALE',
          notes: `Интернет-заказ клиента ${name} (${orderType === 'delivery' ? 'Доставка' : 'Самовывоз'})`,
          cashierName: `Storefront: ${name}`,
        });
      }

      // 5. Create sale transaction record
      const saleId = `sf-${Math.floor(100000 + Math.random() * 900000)}`;
      const saleTimestamp = new Date();

      await tx.insert(saleTransactions).values({
        id: saleId,
        timestamp: saleTimestamp,
        cashierName: `Storefront: ${name}`,
        items: enrichedItems,
        totalPriceBuy,
        totalBeforeDiscount,
        totalDiscount,
        finalPrice,
        paymentMethod: paymentMethod as any,
        paidCash: paymentMethod === 'CASH' ? finalPrice : 0,
        paidCard: paymentMethod === 'CARD' ? finalPrice : 0,
        paidDebt: paymentMethod === 'DEBT' ? finalPrice : 0,
        customerId,
        synced: true,
      });

      // 6. Write audit log
      await tx.insert(securityAuditLogs).values({
        id: `aud-sf-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`,
        timestamp: saleTimestamp,
        role: 'CASHIER' as any,
        userName: `Storefront: ${name}`,
        action: 'Онлайн-заказ принят',
        details: `Заказ #${saleId} от клиента ${name} на сумму ${finalPrice} руб. Тип: ${orderType}. ${deliveryAddress ? 'Адрес: ' + deliveryAddress : ''}`,
        severity: 'INFO',
      });

      return {
        orderId: saleId,
        finalPrice,
        discountApplied: discountPercent,
        totalBeforeDiscount,
        totalDiscount,
        itemCount: enrichedItems.length,
        orderType,
      };
    });

    // 7. Send Telegram notification to client bot (non-blocking)
    sendOrderNotification(result, name, customerId, deliveryAddress, comment, CLIENT_BOT_TOKEN);

    return res.json({ success: true, ...result });
  } catch (error: any) {
    if (error.message?.startsWith('DEBT_LIMIT_EXCEEDED')) {
      return res.status(400).json({ error: 'DEBT_LIMIT_EXCEEDED', description: error.message });
    }
    return res.status(500).json({ error: error.message });
  }
});

// GET /api/storefront/orders — get order history for current customer
router.get('/', requireCustomerAuth, async (req: any, res) => {
  try {
    const { customerId } = req.customer;
    const { eq } = await import('drizzle-orm');
    const orders = await db.select().from(saleTransactions)
      .where(eq(saleTransactions.customerId, customerId));
    
    return res.json(orders);
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// Helper: send Telegram notification
async function sendOrderNotification(
  order: any,
  customerName: string,
  customerId: string,
  deliveryAddress?: string,
  comment?: string,
  botToken?: string
) {
  if (!botToken) return;

  try {
    // Get the customer's telegramChatId from DB
    const { eq } = await import('drizzle-orm');
    const customerList = await db.select({
      telegramChatId: customers.telegramChatId
    }).from(customers).where(eq(customers.id, customerId));

    if (!customerList.length || !customerList[0].telegramChatId) return;

    const chatId = customerList[0].telegramChatId;
    const text = `✅ *Ваш заказ принят!*\n\n` +
      `🔖 Номер: \`${order.orderId}\`\n` +
      `💰 Сумма: *${order.finalPrice} руб.*\n` +
      (order.discountApplied > 0 ? `🎁 Скидка: ${order.discountApplied}%\n` : '') +
      (deliveryAddress ? `📍 Адрес: ${deliveryAddress}\n` : '') +
      (comment ? `💬 Комментарий: ${comment}\n` : '') +
      `\nМы свяжемся с вами для подтверждения.`;

    await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: 'Markdown',
      }),
    });
  } catch (e) {
    // Non-critical — don't fail the order if Telegram fails
    console.warn('Telegram notification failed:', e);
  }
}

export default router;
```

---

### 3.6 Mount the New Routes in `server/index.ts`

Add these imports:

```typescript
import storefrontAuthRouter from './routes/storefrontAuth';
import storefrontOrdersRouter from './routes/storefrontOrders';
```

And mount them (before Vite middleware, alongside the other routes):

```typescript
app.use('/api/storefront/auth', storefrontAuthRouter);
app.use('/api/storefront/orders', storefrontOrdersRouter);
// Public (no auth needed):
// app.get('/api/storefront/products', ...) — already added inline above
// app.get('/api/storefront/categories', ...) — already added inline above
```

---

## 4. Changes Required in customer-storefront

### 4.1 Create an API client

Create **`src/api.ts`**:

```typescript
const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

function getToken(): string | null {
  return localStorage.getItem('storefront_token');
}

async function apiFetch(path: string, options: RequestInit = {}): Promise<any> {
  const token = getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {}),
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`${BASE_URL}${path}`, { ...options, headers });
  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.error || `HTTP ${res.status}`);
  }
  return data;
}

// --- Auth ---
export const storefrontApi = {
  register: (name: string, phone: string, password: string) =>
    apiFetch('/api/storefront/auth/register', {
      method: 'POST',
      body: JSON.stringify({ name, phone, password }),
    }),

  login: (phone: string, password: string) =>
    apiFetch('/api/storefront/auth/login', {
      method: 'POST',
      body: JSON.stringify({ phone, password }),
    }),

  getMe: () => apiFetch('/api/storefront/auth/me'),

  // --- Products ---
  getProducts: (search?: string, category?: string) => {
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    if (category && category !== 'all') params.set('category', category);
    return apiFetch(`/api/storefront/products?${params.toString()}`);
  },

  getCategories: () => apiFetch('/api/storefront/categories'),

  // --- Orders ---
  placeOrder: (payload: {
    items: { productId: string; quantity: number }[];
    orderType: 'delivery' | 'pickup';
    deliveryAddress?: string;
    comment?: string;
    paymentMethod?: 'CASH' | 'CARD' | 'DEBT';
  }) =>
    apiFetch('/api/storefront/orders', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  getOrders: () => apiFetch('/api/storefront/orders'),
};
```

Add to `customer-storefront/.env` (create if not exists):
```
VITE_API_URL=http://localhost:3000
```

For production:
```
VITE_API_URL=https://your-rvad-server.com
```

---

### 4.2 Replace Mock Auth in `App.tsx`

**Find** `handleAuthSubmit` and replace the mock localStorage logic with real API calls:

```typescript
// At top of App.tsx, add:
import { storefrontApi } from './api';

// Replace the login/register section inside handleAuthSubmit:
const handleAuthSubmit = async (e: React.FormEvent) => {
  e.preventDefault();
  setAuthError('');

  try {
    let result: any;

    if (authMode === 'signup') {
      if (!authName.trim()) { setAuthError('Укажите ваше имя.'); return; }
      result = await storefrontApi.register(authName, authPhone, authPassword);
    } else {
      result = await storefrontApi.login(authPhone, authPassword);
    }

    // Save token and user
    localStorage.setItem('storefront_token', result.token);
    localStorage.setItem('logged_in_user', JSON.stringify(result.customer));
    setCurrentUser(result.customer);

    SoundEngine.playSuccess();
    const time = new Date().toLocaleTimeString('ru-RU');
    setSystemLogs(prev => [
      `[${time}] [AUTH] ${authMode === 'signup' ? 'Регистрация' : 'Вход'} успешен. Клиент: ${result.customer.name}`,
      ...prev
    ]);
  } catch (err: any) {
    SoundEngine.playTick();
    setAuthError(err.message || 'Ошибка авторизации.');
  }
};
```

Update `handleLogout` to also remove the token:
```typescript
const handleLogout = () => {
  SoundEngine.playTick();
  setCurrentUser(null);
  localStorage.removeItem('logged_in_user');
  localStorage.removeItem('storefront_token');  // <-- ADD THIS
  setActiveTab('catalog');
};
```

---

### 4.3 Replace Mock Products with Real API Calls

**Remove** the static imports from `App.tsx`:
```typescript
// DELETE this line:
import { PRODUCTS, CATEGORIES, MOCK_ORDERS, MOCK_USER } from './data';
```

**Add** useEffect to load products and categories:

```typescript
// Add these state declarations:
const [productsData, setProductsData] = useState<Product[]>([]);
const [categoriesData, setCategoriesData] = useState<Category[]>([]);
const [isLoadingProducts, setIsLoadingProducts] = useState(true);

// Add this useEffect (near the top of App component):
useEffect(() => {
  const loadCatalog = async () => {
    try {
      setIsLoadingProducts(true);
      const [prods, cats] = await Promise.all([
        storefrontApi.getProducts(),
        storefrontApi.getCategories(),
      ]);

      // Map server product format to storefront Product type
      const mapped: Product[] = prods.map((p: any) => ({
        id: p.id,
        name: p.name,
        price: p.priceSell,   // priceSell from server = display price in kopecks
        image: p.imageUrl || 'https://placehold.co/400x400?text=No+Image',
        categoryId: p.category,
        unit: p.unit,
        article: p.sku,
        rating: 4.8,
        ratingCount: 12,
      }));

      const mappedCats: Category[] = [
        { id: 'all', name: 'Все товары' },
        ...cats.map((c: any) => ({ id: c.id, name: c.name })),
      ];

      setProductsData(mapped);
      setCategoriesData(mappedCats);
    } catch (err) {
      console.error('Failed to load catalog:', err);
    } finally {
      setIsLoadingProducts(false);
    }
  };

  loadCatalog();
}, []);
```

**Replace all references to `PRODUCTS` and `CATEGORIES`** in JSX:
- `PRODUCTS` → `productsData`
- `CATEGORIES` → `categoriesData`

**Note on prices:** The Rvad retail DB stores prices as **integers in kopecks** (e.g., 15000 = 150 rubles). The storefront `formatPrice` uses `Intl.NumberFormat` with `currency: 'RUB'`. You need to decide: either divide by 100 when mapping, or change `formatPrice`. The safest approach is to divide during mapping:

```typescript
price: Math.round(p.priceSell / 100),   // convert kopecks to rubles
```

Check what unit your existing seed data uses and be consistent.

---

### 4.4 Load Real Order History

Replace `MOCK_ORDERS` usage. Add a useEffect that loads orders when the user is logged in:

```typescript
// Replace: const [ordersList, setOrdersList] = useState<Order[]>(MOCK_ORDERS);
const [ordersList, setOrdersList] = useState<Order[]>([]);

// Add this useEffect:
useEffect(() => {
  if (!currentUser) return;

  const loadOrders = async () => {
    try {
      const orders = await storefrontApi.getOrders();
      // Map from saleTransaction format to storefront Order format
      const mapped: Order[] = orders.map((o: any) => ({
        id: o.id,
        date: new Date(o.timestamp).toLocaleString('ru-RU'),
        status: 'delivered',   // Will be real status once order status tracking is added
        total: o.finalPrice,
        items: o.items.map((item: any) => ({
          id: item.productId,
          name: item.productName,
          price: item.priceSell,
          quantity: item.quantity,
        })),
      }));
      setOrdersList(mapped);
    } catch (err) {
      console.error('Failed to load orders:', err);
    }
  };

  loadOrders();
}, [currentUser]);
```

---

### 4.5 Wire Checkout to the Real API

**Replace** `handleCheckoutSubmit` with a real API call:

```typescript
const handleCheckoutSubmit = async (e: React.FormEvent) => {
  e.preventDefault();

  try {
    const orderItems = cart.map(item => ({
      productId: item.id,
      quantity: item.quantity,
    }));

    const result = await storefrontApi.placeOrder({
      items: orderItems,
      orderType,
      deliveryAddress: orderType === 'delivery' ? customerInfo.address : undefined,
      comment: customerInfo.comment || undefined,
      paymentMethod: 'CASH',   // Or make this a user selection in checkout form
    });

    SoundEngine.playSuccess();
    setOrderNumber(result.orderId);

    // Add to local order history immediately
    const newOrderRecord: Order = {
      id: result.orderId,
      date: 'Сегодня, ' + new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }),
      status: 'processing',
      total: result.finalPrice,
      items: cart.map(item => ({
        id: item.id,
        name: item.name,
        price: item.price,
        quantity: item.quantity,
      })),
    };
    setOrdersList(prev => [newOrderRecord, ...prev]);
    setCart([]);
    setActiveTab('success');
    addToast(`Заказ ${result.orderId} успешно оформлен!`, 'success', result.orderId);

    const timestamp = new Date().toLocaleTimeString('ru-RU');
    setSystemLogs(prev => [
      `[${timestamp}] [ORDER] Заказ ${result.orderId} создан. Сумма: ${result.finalPrice} руб.`,
      ...prev
    ]);
  } catch (err: any) {
    SoundEngine.playTick();
    if (err.message === 'DEBT_LIMIT_EXCEEDED') {
      addToast('Превышен лимит долга. Свяжитесь с менеджером.', 'warning');
    } else {
      addToast(`Ошибка оформления: ${err.message}`, 'warning');
    }
  }
};
```

---

### 4.6 Load Real Customer Profile on Login

After login, refresh the user profile from the server to get real debt/discount values:

```typescript
// In the useEffect that watches currentUser:
useEffect(() => {
  if (!currentUser) return;

  storefrontApi.getMe()
    .then(freshProfile => {
      setCurrentUser(freshProfile);
      localStorage.setItem('logged_in_user', JSON.stringify(freshProfile));
    })
    .catch(err => console.warn('Profile refresh failed:', err));
}, [currentUser?.id]);   // Only re-run when the user ID changes
```

---

## 5. Environment Variables Summary

### Rvad retail `.env`
```
# Existing
DATABASE_URL=postgresql://...
JWT_SECRET=your_secret
TELEGRAM_BOT_TOKEN_INTERNAL=...
TELEGRAM_BOT_TOKEN_CLIENT=...
APP_URL=https://your-rvad-server.com

# NEW — add this:
STOREFRONT_URL=https://your-storefront-domain.com
```

### customer-storefront `.env` (create this file)
```
VITE_API_URL=https://your-rvad-server.com
```

---

## 6. New API Endpoints Reference

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/api/storefront/auth/register` | None | Register new customer |
| POST | `/api/storefront/auth/login` | None | Login customer, returns JWT |
| GET | `/api/storefront/auth/me` | Customer JWT | Get current customer profile |
| GET | `/api/storefront/products` | None | Get products (safe fields only) |
| GET | `/api/storefront/categories` | None | Get all categories |
| POST | `/api/storefront/orders` | Customer JWT | Place order → creates saleTransaction |
| GET | `/api/storefront/orders` | Customer JWT | Get customer order history |

---

## 7. Data Flow: Full Order Lifecycle

```
Customer fills cart in storefront
        │
        ▼
POST /api/storefront/orders
        │
        ├── Validate JWT → get customerId
        ├── Load customer → get discountPercent
        ├── Validate items → check stock
        ├── Compute totals (with discount)
        ├── DB transaction:
        │       ├── Deduct stock from products
        │       ├── Write stockCorrectionLogs (type: SALE)
        │       ├── Insert saleTransaction
        │       └── Insert securityAuditLog
        ├── Send Telegram notification to customer
        └── Return { orderId, finalPrice, ... }
```

The order appears immediately in:
- Rvad retail → Analytics tab (as a sale)
- Rvad retail → Inventory (stock already reduced)
- Rvad retail → CRM → customer debt (if DEBT payment)
- customer-storefront → History tab (via GET /api/storefront/orders)

---

## 8. Order Status Tracking (Optional Enhancement)

Currently `saleTransactions` has no `status` field. If you want real order status (processing → shipped → delivered), add this:

**In `server/db/schema.ts`:**
```typescript
// Add to saleTransactions table:
orderStatus: text('order_status')
  .$type<'NEW' | 'CONFIRMED' | 'SHIPPING' | 'DELIVERED' | 'CANCELLED'>()
  .default('NEW'),
orderType: text('order_type').$type<'delivery' | 'pickup'>(),
deliveryAddress: text('delivery_address'),
orderComment: text('order_comment'),
```

Then run migration. The storefront's `getStatusDetails()` function and the order history progress bar will correctly reflect these.

---

## 9. Deployment Checklist

- [ ] Run `npx drizzle-kit generate` after schema changes
- [ ] Run `npx drizzle-kit migrate` against production DB
- [ ] Set `STOREFRONT_URL` in Rvad retail `.env`
- [ ] Set `VITE_API_URL` in storefront `.env`
- [ ] Build storefront: `npm run build`
- [ ] Verify CORS by opening storefront in browser and checking network tab
- [ ] Test register → login → browse products → checkout flow end-to-end
- [ ] Confirm the new order appears in Rvad retail Analytics and Inventory panels

---

## 10. Files Modified / Created Summary

### In Rvad retail:

| File | Action |
|---|---|
| `server/db/schema.ts` | Add `passwordHash` to `customers` |
| `server/index.ts` | Add CORS, public product/category routes, mount new routers |
| `server/routes/storefrontAuth.ts` | **NEW** — customer register/login/me |
| `server/routes/storefrontOrders.ts` | **NEW** — place order, get history |
| `.env` | Add `STOREFRONT_URL` |

### In customer-storefront:

| File | Action |
|---|---|
| `src/api.ts` | **NEW** — all API calls in one place |
| `src/App.tsx` | Replace mock auth, mock products, mock orders, mock checkout |
| `.env` | **NEW** — add `VITE_API_URL` |
