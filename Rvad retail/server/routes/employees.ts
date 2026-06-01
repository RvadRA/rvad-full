import { Router } from 'express';
import { db } from '../db/connection';
import { employees, employeeDocuments } from '../db/schema';
import { eq } from 'drizzle-orm';
import bcrypt from 'bcrypt';
import { requireAuth } from '../middleware/requireAuth';
import { UserRole } from '../../src/types';

const router = Router();

// GET all employees with nested documents
router.get('/', requireAuth(), async (req, res) => {
  try {
    const employeeRows = await db.select().from(employees);
    const docRows = await db.select().from(employeeDocuments);
    
    const list = employeeRows.map(emp => {
      const docs = docRows.filter(doc => doc.employeeId === emp.id);
      const { pinHash, ...data } = emp;
      return {
        ...data,
        pin: '****',
        documents: docs
      };
    });
    
    return res.json(list);
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// POST create employee
router.post('/', requireAuth([UserRole.OWNER, UserRole.ADMIN]), async (req, res) => {
  const { id, name, role, phone, pin, status, joinDate, documents } = req.body;
  const empId = id || `emp-${Math.floor(1000 + Math.random() * 9000)}`;
  
  try {
    const pinStr = (pin && pin !== '****') ? pin : '1111';
    const pinHash = await bcrypt.hash(pinStr, 10);
    
    const newEmp = {
      id: empId,
      name,
      role,
      phone,
      pinHash,
      status: status || 'ACTIVE',
      joinDate: joinDate ? new Date(joinDate) : new Date(),
    };
    
    await db.transaction(async (tx) => {
      await tx.insert(employees).values(newEmp);
      if (documents && Array.isArray(documents)) {
        for (const doc of documents) {
          await tx.insert(employeeDocuments).values({
            id: doc.id || `doc-${Math.floor(10000 + Math.random() * 90000)}`,
            employeeId: empId,
            type: doc.type,
            number: doc.number,
            issueDate: doc.issueDate,
            expiryDate: doc.expiryDate,
            notes: doc.notes || '',
            scans: doc.scans || [],
            monthlyPayments: doc.monthlyPayments || [],
          });
        }
      }
    });
    
    return res.json({
      id: empId,
      name,
      role,
      phone,
      status: newEmp.status,
      joinDate: newEmp.joinDate.toISOString(),
      documents: documents || [],
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// PUT update employee
router.put('/:id', requireAuth([UserRole.OWNER, UserRole.ADMIN]), async (req, res) => {
  const { id } = req.params;
  const { name, role, phone, pin, status, joinDate, telegramChatId, isOnline, documents } = req.body;
  
  try {
    const updateData: any = {};
    if (name !== undefined) updateData.name = name;
    if (role !== undefined) {
      const targetEmp = await db.select().from(employees).where(eq(employees.id, id));
      const currentUser = (req as any).user;
      if (currentUser.role === UserRole.ADMIN && (role === UserRole.OWNER || targetEmp[0]?.role === UserRole.OWNER)) {
        return res.status(403).json({ error: 'Администратор не может менять права владельца.' });
      }
      updateData.role = role;
    }
    if (phone !== undefined) updateData.phone = phone;
    if (pin !== undefined && pin !== '' && pin !== '****') {
      const targetEmp = await db.select().from(employees).where(eq(employees.id, id));
      const currentUser = (req as any).user;
      if (currentUser.role === UserRole.ADMIN && targetEmp[0]?.role === UserRole.OWNER) {
        return res.status(403).json({ error: 'Администратор не может менять ПИН владельца.' });
      }
      updateData.pinHash = await bcrypt.hash(pin, 10);
    }
    if (status !== undefined) updateData.status = status;
    if (telegramChatId !== undefined) updateData.telegramChatId = telegramChatId;
    if (isOnline !== undefined) updateData.isOnline = isOnline;
    if (joinDate !== undefined) updateData.joinDate = new Date(joinDate);
    
    await db.transaction(async (tx) => {
      if (Object.keys(updateData).length > 0) {
        await tx.update(employees).set(updateData).where(eq(employees.id, id));
      }
      
      if (documents && Array.isArray(documents)) {
        await tx.delete(employeeDocuments).where(eq(employeeDocuments.employeeId, id));
        for (const doc of documents) {
          await tx.insert(employeeDocuments).values({
            id: doc.id || `doc-${Math.floor(10000 + Math.random() * 90000)}`,
            employeeId: id,
            type: doc.type,
            number: doc.number,
            issueDate: doc.issueDate,
            expiryDate: doc.expiryDate,
            notes: doc.notes || '',
            scans: doc.scans || [],
            monthlyPayments: doc.monthlyPayments || [],
          });
        }
      }
    });
    
    return res.json({ success: true });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// DELETE employee (Requires OWNER)
router.delete('/:id', requireAuth([UserRole.OWNER]), async (req, res) => {
  const { id } = req.params;
  try {
    await db.delete(employees).where(eq(employees.id, id));
    return res.json({ success: true });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// POST verify employee pin
router.post('/:id/verify-pin', requireAuth(), async (req, res) => {
  const { id } = req.params;
  const { pin } = req.body;
  if (!pin || typeof pin !== 'string') {
    return res.status(400).json({ error: 'ПИН-код не указан.' });
  }
  
  try {
    const empList = await db.select().from(employees).where(eq(employees.id, id));
    if (empList.length === 0) {
      return res.status(404).json({ error: 'Сотрудник не найден.' });
    }
    
    const valid = await bcrypt.compare(pin, empList[0].pinHash);
    return res.json({ valid });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

export default router;
