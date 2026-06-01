import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import dotenv from 'dotenv';
import { db } from './db/connection';
import { employees, products, categories, productReviews } from './db/schema';
import { eq, ilike, and, or, desc } from 'drizzle-orm';
import jwt from 'jsonwebtoken';

// Import routes
import authRouter from './routes/auth';
import productsRouter from './routes/products';
import categoriesRouter from './routes/categories';
import customersRouter from './routes/customers';
import suppliersRouter from './routes/suppliers';
import employeesRouter from './routes/employees';
import salesRouter from './routes/sales';
import expensesRouter from './routes/expenses';
import debtPaymentsRouter from './routes/debtPayments';
import stockCorrectionsRouter from './routes/stockCorrections';
import auditLogsRouter from './routes/auditLogs';
import syncRouter from './routes/sync';
import uploadRouter from './routes/upload';
import aiRouter from './routes/ai';
import telegramRouter from './routes/telegram';
import storefrontAuthRouter from './routes/storefrontAuth';
import storefrontOrdersRouter from './routes/storefrontOrders';

// Import Telegram modules
import { handleInternalBotUpdate } from './telegram/internal';
import { handleClientBotUpdate } from './telegram/client';
import { startPolling } from './telegram/polling';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = parseInt(process.env.PORT || '3000', 10);
  const NODE_ENV = process.env.NODE_ENV || 'development';

  // Middlewares
  app.use(express.json({ limit: '20mb' }));
  app.use(express.urlencoded({ limit: '20mb', extended: true }));

  app.use((req, res, next) => {
    console.log(`[HTTP] ${req.method} ${req.url}`);
    next();
  });

  // CORS — allows the customer storefront browser app to call this API
  const allowedOrigins = [
    'http://localhost:5173',
    'http://localhost:3000',
    'http://localhost:5174',
  ];
  if (process.env.STOREFRONT_URL) {
    const cleanStorefrontUrl = process.env.STOREFRONT_URL.replace(/\/$/, '');
    allowedOrigins.push(cleanStorefrontUrl);
  }

  app.use(cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      const cleanOrigin = origin.replace(/\/$/, '');
      if (allowedOrigins.includes(cleanOrigin)) {
        callback(null, true);
      } else {
        console.warn(`[CORS] Rejected origin: ${origin}`);
        callback(new Error(`Origin ${origin} not allowed by CORS`));
      }
    },
    credentials: true,
  }));

  // Static uploads directory serving
  const uploadsPath = path.join(process.cwd(), 'uploads');
  app.use('/uploads', express.static(uploadsPath));

  // Mount API Routers
  app.use('/api/auth', authRouter);
  app.use('/api/products', productsRouter);
  app.use('/api/categories', categoriesRouter);
  app.use('/api/customers', customersRouter);
  app.use('/api/suppliers', suppliersRouter);
  app.use('/api/employees', employeesRouter);
  app.use('/api/sales', salesRouter);
  app.use('/api/expenses', expensesRouter);
  app.use('/api/debt-payments', debtPaymentsRouter);
  app.use('/api/stock-corrections', stockCorrectionsRouter);
  app.use('/api/audit-logs', auditLogsRouter);
  app.use('/api', syncRouter); // mounts /api/session/sync, /api/sync/pending, /api/sync/resolve/:id
  app.use('/api/upload', uploadRouter);
  app.use('/api', aiRouter); // mounts /api/barcode, /api/parse-invoice, /api/inventory/forecast
  app.use('/api/telegram', telegramRouter);

  // ── Storefront Auth & Orders (customer JWT, NOT employee JWT) ──────────────
  app.use('/api/storefront/auth', storefrontAuthRouter);
  app.use('/api/storefront/orders', storefrontOrdersRouter);

  // ── Public storefront catalog — no auth required, priceBuy hidden ──────────
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
        originalPriceSell: products.originalPriceSell,
      }).from(products);

      const results = conditions.length > 0
        ? await query.where(and(...conditions))
        : await query;

      return res.json(results);
    } catch (error: any) {
      return res.status(500).json({ error: error.message });
    }
  });

  app.get('/api/storefront/categories', async (req, res) => {
    try {
      const list = await db.select().from(categories);
      return res.json(list);
    } catch (error: any) {
      return res.status(500).json({ error: error.message });
    }
  });

  // ── Product Reviews ──────────────────────────────────────────────────────────
  const JWT_SECRET = process.env.JWT_SECRET || '4f63c8a9134b22c7128d546ef81a4b6c321d54f67e89ab0c210d3e5b6c7a8d9e';

  function requireCustomerAuth(req: any, res: any, next: any) {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Требуется авторизация.' });
    }
    try {
      const token = authHeader.split(' ')[1];
      const decoded = jwt.verify(token, JWT_SECRET) as {
        customerId: string;
        name: string;
        phone: string;
      };
      req.customer = decoded;
      next();
    } catch {
      return res.status(401).json({ error: 'Токен недействителен или истёк.' });
    }
  }

  // GET reviews for a product
  app.get('/api/storefront/products/:productId/reviews', async (req, res) => {
    try {
      const { productId } = req.params;
      const list = await db
        .select()
        .from(productReviews)
        .where(eq(productReviews.productId, productId))
        .orderBy(desc(productReviews.timestamp));
      return res.json(list);
    } catch (error: any) {
      return res.status(500).json({ error: error.message });
    }
  });

  // POST a new review for a product (requires customer auth)
  app.post('/api/storefront/products/:productId/reviews', requireCustomerAuth, async (req: any, res) => {
    try {
      const { productId } = req.params;
      const { rating, text } = req.body;
      const { name } = req.customer;

      if (typeof rating !== 'number' || rating < 1 || rating > 5) {
        return res.status(400).json({ error: 'Рейтинг должен быть числом от 1 до 5.' });
      }
      if (!text || !text.trim()) {
        return res.status(400).json({ error: 'Текст отзыва не может быть пустым.' });
      }

      const reviewId = `rev-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;
      await db.insert(productReviews).values({
        id: reviewId,
        productId,
        customerName: name,
        rating,
        text: text.trim(),
      });

      return res.status(201).json({ success: true, reviewId });
    } catch (error: any) {
      return res.status(500).json({ error: error.message });
    }
  });

  // Telegram Tokens
  const internalToken = process.env.TELEGRAM_BOT_TOKEN_INTERNAL;
  const clientToken = process.env.TELEGRAM_BOT_TOKEN_CLIENT;
  const appUrl = process.env.APP_URL;

  // Webhook Routes
  app.post('/api/telegram/webhook/internal', async (req, res) => {
    try {
      if (internalToken && req.body && req.body.message) {
        await handleInternalBotUpdate(internalToken, req.body.message);
      }
      return res.sendStatus(200);
    } catch (e: any) {
      console.error('Error handling internal bot webhook update:', e.message);
      return res.sendStatus(500);
    }
  });

  app.post('/api/telegram/webhook/client', async (req, res) => {
    try {
      if (clientToken && req.body && req.body.message) {
        await handleClientBotUpdate(clientToken, req.body.message);
      }
      return res.sendStatus(200);
    } catch (e: any) {
      console.error('Error handling client bot webhook update:', e.message);
      return res.sendStatus(500);
    }
  });

  // Telegram Integration Startup (Webhook registration vs Polling fallback)
  const isProdAppUrl = appUrl && appUrl.startsWith('https://') && !appUrl.includes('localhost') && !appUrl.includes('127.0.0.1');

  if (isProdAppUrl) {
    console.log(`🌐 APP_URL configured. Registering Telegram Webhooks at: ${appUrl}`);
    try {
      if (internalToken) {
        const webhookUrl = `${appUrl}/api/telegram/webhook/internal`;
        const res = await fetch(`https://api.telegram.org/bot${internalToken}/setWebhook`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: webhookUrl })
        });
        const data: any = await res.json();
        if (data.ok) {
          console.log(`✅ Webhook set for Internal Bot: ${webhookUrl}`);
        } else {
          console.error(`❌ Failed to set Webhook for Internal Bot:`, data.description);
        }
      }
      if (clientToken) {
        const webhookUrl = `${appUrl}/api/telegram/webhook/client`;
        const res = await fetch(`https://api.telegram.org/bot${clientToken}/setWebhook`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: webhookUrl })
        });
        const data: any = await res.json();
        if (data.ok) {
          console.log(`✅ Webhook set for Client Bot: ${webhookUrl}`);
        } else {
          console.error(`❌ Failed to set Webhook for Client Bot:`, data.description);
        }
      }
    } catch (err: any) {
      console.error('❌ Failed to register Telegram Webhooks:', err.message);
    }
  } else {
    console.log('⚠️ APP_URL is not configured as public HTTPS. Deleting webhooks and falling back to local Telegram polling...');
    try {
      if (internalToken) {
        const res = await fetch(`https://api.telegram.org/bot${internalToken}/deleteWebhook`);
        const data: any = await res.json();
        if (data.ok) {
          console.log('✅ Webhook successfully deleted for Internal Bot.');
        } else {
          console.warn('⚠️ deleteWebhook for Internal Bot returned not ok:', data.description);
        }
      }
      if (clientToken) {
        const res = await fetch(`https://api.telegram.org/bot${clientToken}/deleteWebhook`);
        const data: any = await res.json();
        if (data.ok) {
          console.log('✅ Webhook successfully deleted for Client Bot.');
        } else {
          console.warn('⚠️ deleteWebhook for Client Bot returned not ok:', data.description);
        }
      }
    } catch (err: any) {
      console.error('❌ Failed to delete Telegram Webhooks:', err.message);
    }
    startPolling(internalToken, clientToken);
  }

  // Vite Development Server Integration vs Production Static Assets
  if (NODE_ENV !== 'production') {
    console.log('🔧 Running in DEVELOPMENT mode. Mounting Vite middleware...');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    console.log('📦 Running in PRODUCTION mode. Serving static files...');
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  // Error Handler Middleware
  app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error('Unhandled request error:', err);
    res.status(500).json({ error: err.message || 'Internal server error' });
  });

  // Reset all employee online statuses on server boot
  try {
    await db.update(employees).set({ isOnline: false });
    console.log('🧹 Cleared all employee online statuses on server boot.');
  } catch (bootErr: any) {
    console.error('❌ Failed to clear employee online statuses on boot:', bootErr.message);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Server successfully launched on port ${PORT} (http://localhost:${PORT})`);
  });
}

startServer();
