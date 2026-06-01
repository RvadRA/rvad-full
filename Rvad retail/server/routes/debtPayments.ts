import { Router } from 'express';
import { db } from '../db/connection';
import { debtPayments, customers, securityAuditLogs } from '../db/schema';
import { eq } from 'drizzle-orm';
import { requireAuth } from '../middleware/requireAuth';
import { UserRole } from '../../src/types';

const router = Router();

router.get('/', requireAuth(), async (req, res) => {
  try {
    const list = await db.select().from(debtPayments);
    return res.json(list);
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

router.post('/', requireAuth([UserRole.OWNER, UserRole.ADMIN, UserRole.CASHIER]), async (req, res) => {
  const { id, customerId, customerName, amount, paymentMethod, timestamp } = req.body;
  
  if (typeof amount !== 'number' || amount <= 0) {
    return res.status(400).json({ error: 'Amount must be a positive number' });
  }

  try {
    const paymentId = id || `pay-${Math.floor(10000 + Math.random() * 90000)}`;
    const paymentTimestamp = timestamp ? new Date(timestamp) : new Date();

    const result = await db.transaction(async (tx) => {
      // 1. Get customer info
      const customerList = await tx.select().from(customers).where(eq(customers.id, customerId));
      if (customerList.length === 0) {
        throw new Error('Customer not found');
      }

      const customer = customerList[0];
      // 2. Calculate and floor debt at 0
      const newDebt = Math.max(0, customer.debt - amount);

      // 3. Update customer debt
      await tx.update(customers)
        .set({ debt: newDebt })
        .where(eq(customers.id, customerId));

      // 4. Write debt payment log
      const newPayment = {
        id: paymentId,
        customerId,
        customerName,
        amount,
        paymentMethod,
        timestamp: paymentTimestamp,
        synced: true,
      };
      await tx.insert(debtPayments).values(newPayment);

      // 5. Write Security Audit Log
      await tx.insert(securityAuditLogs).values({
        id: `aud-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`,
        timestamp: paymentTimestamp,
        role: (req as any).user.role,
        userName: (req as any).user.name,
        action: 'Долг погашен',
        details: `Клиент '${customerName}' внес ${amount} руб. (${paymentMethod}). Остаток долга: ${newDebt} руб.`,
        severity: 'INFO',
      });

      return newPayment;
    });

    return res.json(result);
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

export default router;
