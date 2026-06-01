import { Router } from 'express';
import { db } from '../db/connection';
import { categories } from '../db/schema';
import { eq, ilike } from 'drizzle-orm';
import { requireAuth } from '../middleware/requireAuth';
import { UserRole } from '../../src/types';

const router = Router();

router.get('/', requireAuth(), async (req, res) => {
  try {
    const list = await db.select().from(categories);
    return res.json(list);
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

router.post('/', requireAuth([UserRole.OWNER, UserRole.ADMIN]), async (req, res) => {
  try {
    const data = req.body;
    if (!data.name) {
      return res.status(400).json({ error: 'Name is required' });
    }
    const nameTrimmed = data.name.trim();
    // Check if category name already exists (case-insensitive)
    const existing = await db.select().from(categories).where(ilike(categories.name, nameTrimmed)).limit(1);
    if (existing.length > 0) {
      return res.json(existing[0]);
    }
    const id = data.id || `cat-${Math.floor(1000 + Math.random() * 9000)}`;
    const newCategory = { ...data, id, name: nameTrimmed };
    await db.insert(categories).values(newCategory);
    return res.json(newCategory);
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

router.put('/:id', requireAuth([UserRole.OWNER, UserRole.ADMIN]), async (req, res) => {
  const { id } = req.params;
  try {
    const data = req.body;
    await db.update(categories).set(data).where(eq(categories.id, id));
    return res.json({ success: true });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

router.delete('/:id', requireAuth([UserRole.OWNER, UserRole.ADMIN]), async (req, res) => {
  const { id } = req.params;
  try {
    await db.delete(categories).where(eq(categories.id, id));
    return res.json({ success: true });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

export default router;
