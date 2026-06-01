import { Router } from 'express';
import { db } from '../db/connection';
import { securityAuditLogs } from '../db/schema';
import { requireAuth } from '../middleware/requireAuth';
import { UserRole } from '../../src/types';

const router = Router();

router.get('/', requireAuth([UserRole.OWNER, UserRole.ADMIN]), async (req, res) => {
  try {
    const list = await db.select().from(securityAuditLogs);
    // Map userName back to user for frontend compatibility
    const mappedList = list.map(log => ({
      id: log.id,
      timestamp: log.timestamp.toISOString(),
      role: log.role,
      user: log.userName,
      action: log.action,
      details: log.details,
      severity: log.severity
    }));
    return res.json(mappedList);
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

router.post('/', requireAuth(), async (req, res) => {
  try {
    const data = req.body;
    const id = data.id || `aud-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;
    const timestamp = data.timestamp ? new Date(data.timestamp) : new Date();
    
    // Map user field to userName for Drizzle schema
    const newLogVal = {
      id,
      timestamp,
      role: data.role,
      userName: data.user || 'System',
      action: data.action,
      details: data.details,
      severity: data.severity,
    };
    
    await db.insert(securityAuditLogs).values(newLogVal);
    
    // Return frontend-shaped JSON object
    return res.json({
      id,
      timestamp: timestamp.toISOString(),
      role: data.role,
      user: data.user || 'System',
      action: data.action,
      details: data.details,
      severity: data.severity,
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

export default router;
