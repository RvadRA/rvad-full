import { Router } from 'express';
import { db } from '../db/connection';
import { businessExpenses } from '../db/schema';
import { eq, and, gte, lte } from 'drizzle-orm';
import { requireAuth } from '../middleware/requireAuth';
import { UserRole } from '../../src/types';

const router = Router();

router.get('/', requireAuth(), async (req, res) => {
  const { from, to } = req.query;
  try {
    const conditions = [];
    if (from && typeof from === 'string' && from !== '') {
      conditions.push(gte(businessExpenses.date, from));
    }
    if (to && typeof to === 'string' && to !== '') {
      conditions.push(lte(businessExpenses.date, to));
    }

    const query = db.select().from(businessExpenses);
    const list = conditions.length > 0
      ? await query.where(and(...conditions))
      : await query;

    return res.json(list);
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

router.post('/', requireAuth(), async (req, res) => {
  try {
    const data = req.body;
    const id = data.id || `exp-${Math.floor(1000 + Math.random() * 9000)}`;
    const timestamp = data.timestamp ? new Date(data.timestamp) : new Date();
    
    const newExpense = {
      ...data,
      id,
      timestamp,
    };
    
    await db.insert(businessExpenses).values(newExpense);
    return res.json(newExpense);
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

router.delete('/:id', requireAuth([UserRole.OWNER, UserRole.ADMIN]), async (req, res) => {
  const { id } = req.params;
  try {
    await db.delete(businessExpenses).where(eq(businessExpenses.id, id));
    return res.json({ success: true });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

export default router;
