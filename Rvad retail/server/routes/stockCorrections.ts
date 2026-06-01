import { Router } from 'express';
import { db } from '../db/connection';
import { stockCorrectionLogs } from '../db/schema';
import { requireAuth } from '../middleware/requireAuth';

const router = Router();

router.get('/', requireAuth(), async (req, res) => {
  try {
    const list = await db.select().from(stockCorrectionLogs);
    return res.json(list);
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

router.post('/', requireAuth(), async (req, res) => {
  try {
    const data = req.body;
    const id = data.id || `corr-${Math.floor(10000 + Math.random() * 90000)}`;
    const timestamp = data.timestamp ? new Date(data.timestamp) : new Date();
    
    const newLog = {
      ...data,
      id,
      timestamp,
    };
    
    await db.insert(stockCorrectionLogs).values(newLog);
    return res.json(newLog);
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

export default router;
