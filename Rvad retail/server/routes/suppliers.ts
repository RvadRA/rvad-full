import { Router } from 'express';
import { db } from '../db/connection';
import { suppliers } from '../db/schema';
import { eq } from 'drizzle-orm';
import { requireAuth } from '../middleware/requireAuth';
import { UserRole } from '../../src/types';

const router = Router();

router.get('/', requireAuth(), async (req, res) => {
  try {
    const list = await db.select().from(suppliers);
    return res.json(list);
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

router.post('/', requireAuth(), async (req, res) => {
  try {
    const data = req.body;
    const id = data.id || `sup-${Math.floor(1000 + Math.random() * 9000)}`;
    const newSupplier = { ...data, id };
    await db.insert(suppliers).values(newSupplier);
    return res.json(newSupplier);
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

router.put('/:id', requireAuth(), async (req, res) => {
  const { id } = req.params;
  try {
    const data = req.body;
    await db.update(suppliers).set(data).where(eq(suppliers.id, id));
    return res.json({ success: true });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

router.delete('/:id', requireAuth([UserRole.OWNER, UserRole.ADMIN]), async (req, res) => {
  const { id } = req.params;
  try {
    await db.delete(suppliers).where(eq(suppliers.id, id));
    return res.json({ success: true });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

export default router;
