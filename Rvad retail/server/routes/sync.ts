import { Router } from 'express';
import { db } from '../db/connection';
import { syncTasks, saleTransactions, products, customers, stockCorrectionLogs, securityAuditLogs, debtPayments, employees } from '../db/schema';
import { eq } from 'drizzle-orm';
import { requireAuth } from '../middleware/requireAuth';
import { UserRole } from '../../src/types';

const router = Router();

// GET all pending sync tasks
router.get('/pending', requireAuth(), async (req, res) => {
  try {
    const list = await db.select().from(syncTasks).where(eq(syncTasks.status, 'PENDING'));
    return res.json(list);
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// POST resolve a task manually
router.post('/resolve/:id', requireAuth([UserRole.OWNER, UserRole.ADMIN]), async (req, res) => {
  const { id } = req.params;
  const { status } = req.body; // 'RESOLVED' or 'CONFLICT'
  try {
    await db.update(syncTasks).set({ status }).where(eq(syncTasks.id, id));
    return res.json({ success: true });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// POST session sync - handles queue processing
router.post('/session/sync', requireAuth(), async (req, res) => {
  const { tasks } = req.body;

  try {
    // Dynamically mark the current operator as online
    if ((req as any).user) {
      await db.update(employees)
        .set({ isOnline: true })
        .where(eq(employees.id, (req as any).user.id));
    }

    const results: any[] = [];
    if (tasks && Array.isArray(tasks)) {
      for (const task of tasks) {
        const taskId = task.id || `task-${Math.floor(1000 + Math.random() * 9000)}`;
        
        // Save the task to the DB first
        await db.insert(syncTasks).values({
          id: taskId,
          type: task.type,
          payload: task.payload,
          timestamp: task.timestamp ? new Date(task.timestamp) : new Date(),
          status: 'PENDING',
        });

        // Run conflict resolution rules
        try {
          const resolveResult = await db.transaction(async (tx) => {
            if (task.type === 'SALE_TRANSACTION') {
              const sale = task.payload;
              
              // Conflict rule: if stock goes negative, raise conflict
              for (const item of sale.items) {
                const prod = await tx.select().from(products).where(eq(products.id, item.productId));
                if (prod.length === 0 || prod[0].stock < item.quantity) {
                  throw new Error('CONFLICT_NEGATIVE_STOCK');
                }
              }

              // Apply sale transaction customer debt updates
              if (sale.customerId && (sale.paymentMethod === 'DEBT' || sale.paidDebt > 0)) {
                const cust = await tx.select().from(customers).where(eq(customers.id, sale.customerId));
                if (cust.length > 0) {
                  const addDebt = sale.paymentMethod === 'DEBT' ? sale.finalPrice : sale.paidDebt;
                  await tx.update(customers)
                    .set({ debt: cust[0].debt + addDebt })
                    .where(eq(customers.id, sale.customerId));
                }
              }

              // Update products stock & write logs
              for (const item of sale.items) {
                const prod = (await tx.select().from(products).where(eq(products.id, item.productId)))[0];
                await tx.update(products)
                  .set({ stock: Math.max(0, prod.stock - item.quantity) })
                  .where(eq(products.id, item.productId));

                await tx.insert(stockCorrectionLogs).values({
                  id: `corr-${Math.floor(10000 + Math.random() * 90000)}`,
                  productId: item.productId,
                  productName: prod.name,
                  oldStock: prod.stock,
                  newStock: Math.max(0, prod.stock - item.quantity),
                  type: 'SALE',
                  notes: `Синхронизация офлайн-чека #${sale.id.split('-').pop()?.toUpperCase() || sale.id.toUpperCase()}`,
                  cashierName: sale.cashierName || 'Offline Cashier',
                });
              }

              // Insert transaction record
              await tx.insert(saleTransactions).values({
                ...sale,
                timestamp: new Date(sale.timestamp),
                synced: true,
              });

              // Mark task resolved
              await tx.update(syncTasks).set({ status: 'RESOLVED' }).where(eq(syncTasks.id, taskId));
              return { taskId, status: 'RESOLVED' };

            } else if (task.type === 'DEBT_PAYMENT') {
              const payment = task.payload;
              const cust = await tx.select().from(customers).where(eq(customers.id, payment.customerId));
              if (cust.length > 0) {
                await tx.update(customers)
                  .set({ debt: Math.max(0, cust[0].debt - payment.amount) })
                  .where(eq(customers.id, payment.customerId));
              }

              await tx.insert(debtPayments).values({
                ...payment,
                timestamp: new Date(payment.timestamp),
                synced: true,
              });

              await tx.update(syncTasks).set({ status: 'RESOLVED' }).where(eq(syncTasks.id, taskId));
              return { taskId, status: 'RESOLVED' };

            } else if (task.type === 'STOCK_CORRECTION') {
              const corr = task.payload;
              const prod = await tx.select().from(products).where(eq(products.id, corr.productId));
              if (prod.length > 0) {
                await tx.update(products).set({ stock: corr.newStock }).where(eq(products.id, corr.productId));
                await tx.insert(stockCorrectionLogs).values({
                  ...corr,
                  timestamp: new Date(corr.timestamp),
                });
              }

              await tx.update(syncTasks).set({ status: 'RESOLVED' }).where(eq(syncTasks.id, taskId));
              return { taskId, status: 'RESOLVED' };

            } else if (task.type === 'CUSTOMER_UPDATE') {
              const cust = task.payload;
              await tx.update(customers).set(cust).where(eq(customers.id, cust.id));
              await tx.update(syncTasks).set({ status: 'RESOLVED' }).where(eq(syncTasks.id, taskId));
              return { taskId, status: 'RESOLVED' };
            }

            return { taskId, status: 'PENDING' };
          });
          results.push(resolveResult);
        } catch (err: any) {
          console.error(`Offline sync conflict for task ${taskId}:`, err.message);
          await db.update(syncTasks).set({ status: 'CONFLICT' }).where(eq(syncTasks.id, taskId));
          results.push({ taskId, status: 'CONFLICT', error: err.message });
        }
      }
    }

    // Return the latest synced state from DB to update client
    const dbCustomers = await db.select().from(customers);
    const dbDebtPayments = await db.select().from(debtPayments);

    return res.json({
      ok: true,
      tasksResults: results,
      customers: dbCustomers,
      debtPayments: dbDebtPayments,
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

export default router;
