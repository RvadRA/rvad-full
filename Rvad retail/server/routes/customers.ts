import { Router } from 'express';
import { db } from '../db/connection';
import { customers } from '../db/schema';
import { eq, asc } from 'drizzle-orm';
import { requireAuth } from '../middleware/requireAuth';
import { UserRole } from '../../src/types';

const router = Router();

import bcrypt from 'bcrypt';

router.get('/', requireAuth(), async (req, res) => {
  try {
    const list = await db.select().from(customers).orderBy(asc(customers.name));
    return res.json(list);
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

router.post('/', requireAuth(), async (req, res) => {
  try {
    const data = { ...req.body };
    const id = data.id || `cust-${Math.floor(1000 + Math.random() * 9000)}`;
    
    let passwordHash = null;
    if (data.password) {
      passwordHash = await bcrypt.hash(data.password, 10);
    }
    delete data.password;

    const newCustomer = {
      ...data,
      id,
      ...(passwordHash ? { passwordHash } : {}),
    };
    await db.insert(customers).values(newCustomer);
    return res.json(newCustomer);
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

router.put('/:id', requireAuth(), async (req, res) => {
  const { id } = req.params;
  try {
    const data = { ...req.body };
    
    let passwordHash = undefined;
    if (data.password !== undefined) {
      if (data.password === '') {
        passwordHash = null;
      } else {
        passwordHash = await bcrypt.hash(data.password, 10);
      }
    }
    delete data.password;

    const updateData = {
      ...data,
      ...(passwordHash !== undefined ? { passwordHash } : {}),
    };

    await db.update(customers).set(updateData).where(eq(customers.id, id));
    return res.json({ success: true });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

router.delete('/:id', requireAuth([UserRole.OWNER, UserRole.ADMIN]), async (req, res) => {
  const { id } = req.params;
  try {
    await db.delete(customers).where(eq(customers.id, id));
    return res.json({ success: true });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

export default router;
