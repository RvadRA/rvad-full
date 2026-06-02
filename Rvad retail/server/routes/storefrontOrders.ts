/**
 * storefrontOrders.ts
 * Storefront order placement and order history endpoints.
 *
 * Routes:
 *   POST /api/storefront/orders  — place an order (full atomic DB transaction)
 *   GET  /api/storefront/orders  — get order history for the authenticated customer
 */

import { Router } from 'express';
import { db } from '../db/connection';
import {
  products,
  customers,
  saleTransactions,
  stockCorrectionLogs,
  securityAuditLogs,
  debtPayments,
} from '../db/schema';
import { eq, desc } from 'drizzle-orm';
import jwt from 'jsonwebtoken';

const router = Router();
import { notifyOwnersOfNewOrder } from '../telegram/internal';

const JWT_SECRET =
  process.env.JWT_SECRET ||
  '4f63c8a9134b22c7128d546ef81a4b6c321d54f67e89ab0c210d3e5b6c7a8d9e';

const CLIENT_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN_CLIENT;

// ─── Middleware: verify customer JWT ────────────────────────────────────────
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

// ─── POST /api/storefront/orders ────────────────────────────────────────────
// Body: {
//   items: [{ productId, quantity }],
//   orderType: 'delivery' | 'pickup',
//   deliveryAddress?: string,
//   comment?: string,
//   paymentMethod?: 'CASH' | 'CARD' | 'DEBT',
// }
router.post('/', requireCustomerAuth, async (req: any, res) => {
  const {
    items,
    orderType = 'pickup',
    deliveryAddress,
    comment,
    paymentMethod = 'CASH',
  } = req.body;

  const { customerId, name } = req.customer;

  if (!items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'Корзина пуста.' });
  }

  try {
    const result = await db.transaction(async (tx) => {
      // 1. Load customer to get discount and check debt limit
      const customerList = await tx
        .select()
        .from(customers)
        .where(eq(customers.id, customerId));

      if (customerList.length === 0) {
        throw new Error('Клиент не найден.');
      }

      const customer = customerList[0];
      const discountPercent = customer.discountPercent || 0;

      // 2. Validate products and compute totals
      let totalPriceBuy = 0;
      let totalBeforeDiscount = 0;
      const enrichedItems: {
        productId: string;
        productName: string;
        quantity: number;
        priceBuy: number;
        priceSell: number;
        discountPercent: number;
      }[] = [];

      for (const item of items) {
        const { productId, quantity } = item;

        if (!productId || !quantity || quantity < 1) {
          throw new Error(`Некорректный товар: ${productId}`);
        }

        const prodList = await tx
          .select()
          .from(products)
          .where(eq(products.id, productId));

        if (prodList.length === 0) {
          throw new Error(`Товар ${productId} не найден.`);
        }

        const product = prodList[0];

        if (product.stock < quantity) {
          throw new Error(
            `Недостаточно товара «${product.name}» на складе. Доступно: ${product.stock}`
          );
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

      const totalDiscount = Math.round((totalBeforeDiscount * discountPercent) / 100);
      const finalPrice = totalBeforeDiscount - totalDiscount;

      // 3. Handle DEBT payment — check limit
      if (paymentMethod === 'DEBT') {
        const newDebt = customer.debt + finalPrice;
        if (newDebt > customer.debtLimit) {
          throw new Error(
            `DEBT_LIMIT_EXCEEDED: лимит долга ${customer.debtLimit}, текущий долг ${customer.debt}, заказ ${finalPrice}`
          );
        }
        await tx
          .update(customers)
          .set({ debt: newDebt })
          .where(eq(customers.id, customerId));
      }

      // 4. Deduct stock + write correction logs
      for (const item of enrichedItems) {
        const prodSnapshot = await tx
          .select()
          .from(products)
          .where(eq(products.id, item.productId));

        const product = prodSnapshot[0];
        const newStock = product.stock - item.quantity;

        await tx
          .update(products)
          .set({ stock: newStock })
          .where(eq(products.id, item.productId));

        await tx.insert(stockCorrectionLogs).values({
          id: `corr-sf-${Date.now()}-${Math.floor(Math.random() * 9999)}`,
          productId: item.productId,
          productName: item.productName,
          oldStock: product.stock,
          newStock,
          type: 'SALE',
          notes: `Интернет-заказ клиента ${name} (${
            orderType === 'delivery' ? 'Доставка' : 'Самовывоз'
          })`,
          cashierName: `Storefront: ${name}`,
        });
      }

      // 5. Insert saleTransaction
      const saleId = `sf-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`;
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
        paymentMethod: paymentMethod as 'CASH' | 'CARD' | 'DEBT' | 'SPLIT',
        paidCash: paymentMethod === 'CASH' ? finalPrice : 0,
        paidCard: paymentMethod === 'CARD' ? finalPrice : 0,
        paidDebt: paymentMethod === 'DEBT' ? finalPrice : 0,
        customerId,
        synced: true,
        orderType: orderType as 'delivery' | 'pickup',
        deliveryAddress: orderType === 'delivery' ? deliveryAddress : null,
        comment,
      });

      // 6. Insert audit log
      await tx.insert(securityAuditLogs).values({
        id: `aud-sf-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`,
        timestamp: saleTimestamp,
        role: 'CASHIER',
        userName: `Storefront: ${name}`,
        action: 'Онлайн-заказ принят',
        details: `Заказ #${saleId} от клиента ${name}. Сумма: ${finalPrice} руб. Тип: ${orderType}${
          deliveryAddress ? '. Адрес: ' + deliveryAddress : ''
        }`,
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
        paymentMethod,
        timestamp: saleTimestamp.toISOString(),
        phoneNumber: customer.phone,
        items: enrichedItems.map(item => ({
          productId: item.productId,
          productName: item.productName,
          quantity: item.quantity,
          priceSell: item.priceSell
        }))
      };
    });

    // 7. Non-blocking Telegram notification to customer
    sendOrderNotification(
      result,
      name,
      customerId,
      deliveryAddress,
      comment,
      CLIENT_BOT_TOKEN
    );

    // 8. Non-blocking Telegram notification to owners
    notifyOwnersOfNewOrder(
      result,
      name,
      deliveryAddress,
      comment
    );

    return res.status(201).json({ success: true, ...result });
  } catch (error: any) {
    console.error('[storefrontOrders] POST error:', error.message);

    if (error.message?.startsWith('DEBT_LIMIT_EXCEEDED')) {
      return res
        .status(400)
        .json({ error: 'DEBT_LIMIT_EXCEEDED', description: error.message });
    }

    return res.status(500).json({ error: error.message });
  }
});

// ─── GET /api/storefront/orders ─────────────────────────────────────────────
// Returns the authenticated customer's full order history.
router.get('/', requireCustomerAuth, async (req: any, res) => {
  try {
    const { customerId } = req.customer;

    const orders = await db
      .select()
      .from(saleTransactions)
      .where(eq(saleTransactions.customerId, customerId))
      .orderBy(desc(saleTransactions.timestamp));

    return res.json(orders);
  } catch (error: any) {
    console.error('[storefrontOrders] GET history error:', error.message);
    return res.status(500).json({ error: error.message });
  }
});

// ─── GET /api/storefront/orders/reconciliation ─────────────────────────────
// Returns the authenticated customer's chronological reconciliation statement list
router.get('/reconciliation', requireCustomerAuth, async (req: any, res) => {
  try {
    const { customerId } = req.customer;

    // 1. Fetch all sale transactions for this customer
    const sales = await db
      .select()
      .from(saleTransactions)
      .where(eq(saleTransactions.customerId, customerId));

    // 2. Fetch all debt payments for this customer
    const payments = await db
      .select()
      .from(debtPayments)
      .where(eq(debtPayments.customerId, customerId));

    // 3. Map sales to reconciliation entries
    const saleEntries = sales.map(s => ({
      id: s.id,
      timestamp: s.timestamp.toISOString(),
      description: s.cashierName.startsWith('Storefront:') ? `Интернет-заказ №${s.id}` : `Покупка (Касса) №${s.id}`,
      debit: s.finalPrice,
      credit: s.paidCash + s.paidCard,
    }));

    // 4. Map debt payments to reconciliation entries
    const paymentEntries = payments.map(p => ({
      id: p.id,
      timestamp: p.timestamp.toISOString(),
      description: `Погашение долга №${p.id} (${p.paymentMethod === 'CARD' ? 'Карта' : 'Наличные'})`,
      debit: 0,
      credit: p.amount,
    }));

    // 5. Combine and sort
    const allEntries = [...saleEntries, ...paymentEntries].sort((a, b) => {
      return new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime();
    });

    return res.json(allEntries);
  } catch (error: any) {
    console.error('[storefrontOrders] GET reconciliation error:', error.message);
    return res.status(500).json({ error: error.message });
  }
});

// ─── Helper: Telegram notification ──────────────────────────────────────────
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
    const customerList = await db
      .select({ telegramChatId: customers.telegramChatId })
      .from(customers)
      .where(eq(customers.id, customerId));

    if (!customerList.length || !customerList[0].telegramChatId) return;

    const chatId = customerList[0].telegramChatId;

    const text =
      `✅ *Ваш заказ принят!*\n\n` +
      `🔖 Номер: \`${order.orderId}\`\n` +
      `💰 Сумма: *${order.finalPrice} руб.*\n` +
      (order.discountApplied > 0 ? `🎁 Скидка: ${order.discountApplied}%\n` : '') +
      `💳 Способ оплаты: *${
        order.paymentMethod === 'CASH' ? 'Наличные' :
        order.paymentMethod === 'CARD' ? 'Карта' :
        order.paymentMethod === 'DEBT' ? 'В долг (Насия)' : order.paymentMethod
      }*\n` +
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
    // Non-critical — order is already saved, Telegram failure is acceptable
    console.warn('[storefrontOrders] Telegram notification failed:', e);
  }
}

export default router;
