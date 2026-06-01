import { Router } from 'express';
import { db } from '../db/connection';
import { products, customers, saleTransactions, stockCorrectionLogs, securityAuditLogs } from '../db/schema';
import { eq } from 'drizzle-orm';
import { requireAuth } from '../middleware/requireAuth';
import { UserRole } from '../../src/types';

const router = Router();

// GET all sales transactions
router.get('/', requireAuth(), async (req, res) => {
  try {
    const list = await db.select().from(saleTransactions);
    return res.json(list);
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// POST checkout transaction (Atomic)
router.post('/', requireAuth([UserRole.OWNER, UserRole.ADMIN, UserRole.CASHIER]), async (req, res) => {
  const {
    id,
    timestamp,
    cashierName,
    items,
    totalPriceBuy,
    totalBeforeDiscount,
    totalDiscount,
    finalPrice,
    paymentMethod,
    paidCash,
    paidCard,
    paidDebt,
    customerId,
    forceOverLimit
  } = req.body;

  try {
    const saleId = id || `sale-${Math.floor(10000 + Math.random() * 90000)}`;
    const saleTimestamp = timestamp ? new Date(timestamp) : new Date();

    const resultTransaction = await db.transaction(async (tx) => {
      // 1. Process customer debt if payment is debt or split
      if (customerId && (paymentMethod === 'DEBT' || paidDebt > 0)) {
        const customerList = await tx.select().from(customers).where(eq(customers.id, customerId));
        if (customerList.length === 0) {
          throw new Error('Customer not found');
        }

        const customer = customerList[0];
        const additionalDebt = paymentMethod === 'DEBT' ? finalPrice : paidDebt;
        const newDebt = customer.debt + additionalDebt;

        // Check debt limit rules
        if (newDebt > customer.debtLimit) {
          const userRole = (req as any).user.role;
          const isPrivileged = userRole === UserRole.OWNER || userRole === UserRole.ADMIN;
          if (!isPrivileged || !forceOverLimit) {
            throw new Error('DEBT_LIMIT_EXCEEDED');
          }
        }

        // Update customer debt
        await tx.update(customers)
          .set({ debt: newDebt })
          .where(eq(customers.id, customerId));
      }

      // 2. Adjust products stock & write stock correction logs
      for (const item of items) {
        const productList = await tx.select().from(products).where(eq(products.id, item.productId));
        if (productList.length === 0) {
          throw new Error(`Product ${item.productId} not found`);
        }

        const product = productList[0];
        const oldStock = product.stock;
        const newStock = Math.max(0, oldStock - item.quantity);

        // Update product stock
        await tx.update(products)
          .set({ stock: newStock })
          .where(eq(products.id, item.productId));

        // Write Stock Correction Log (type: 'SALE')
        await tx.insert(stockCorrectionLogs).values({
          id: `corr-${Math.floor(10000 + Math.random() * 90000)}`,
          productId: item.productId,
          productName: product.name,
          oldStock,
          newStock,
          type: 'SALE',
          timestamp: saleTimestamp,
          notes: `Продажа по чеку #${saleId.split('-').pop()?.toUpperCase() || saleId.toUpperCase()}`,
          cashierName: cashierName || (req as any).user.name || 'System',
        });
      }

      // 3. Write sale transaction record
      const newTransaction = {
        id: saleId,
        timestamp: saleTimestamp,
        cashierName: cashierName || (req as any).user.name || 'System',
        items,
        totalPriceBuy,
        totalBeforeDiscount,
        totalDiscount,
        finalPrice,
        paymentMethod,
        paidCash: paidCash || 0,
        paidCard: paidCard || 0,
        paidDebt: paidDebt || 0,
        customerId: customerId || null,
        synced: true,
        status: 'delivered' as const,
      };

      await tx.insert(saleTransactions).values(newTransaction);

      // 4. Write Security Audit Log
      await tx.insert(securityAuditLogs).values({
        id: `aud-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`,
        timestamp: saleTimestamp,
        role: (req as any).user.role,
        userName: (req as any).user.name,
        action: 'Продажа проведена',
        details: `Пробит чек #${saleId.split('-').pop()?.toUpperCase() || saleId.toUpperCase()} на сумму ${finalPrice} руб. Способ оплаты: ${paymentMethod}.`,
        severity: 'INFO',
      });

      return newTransaction;
    });

    return res.json(resultTransaction);
  } catch (error: any) {
    if (error.message === 'DEBT_LIMIT_EXCEEDED') {
      return res.status(400).json({ error: 'DEBT_LIMIT_EXCEEDED', description: 'Превышен лимит долга клиента.' });
    }
    return res.status(500).json({ error: error.message });
  }
});

// PATCH update order delivery status
router.patch('/:id/status', requireAuth(), async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  if (!['processing', 'shipping', 'delivered', 'cancelled'].includes(status)) {
    return res.status(400).json({ error: 'Неверный статус заказа.' });
  }

  try {
    await db.update(saleTransactions)
      .set({ status })
      .where(eq(saleTransactions.id, id));

    return res.json({ success: true, status });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

export default router;
