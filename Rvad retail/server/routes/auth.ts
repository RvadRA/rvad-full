import { Router } from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import { db } from '../db/connection';
import { employees } from '../db/schema';
import { eq, and } from 'drizzle-orm';
import { UserRole } from '../../src/types';

const router = Router();

router.get('/employees', async (req, res) => {
  try {
    const activeEmployees = await db.select({
      id: employees.id,
      name: employees.name,
      role: employees.role,
      status: employees.status,
      isOnline: employees.isOnline,
      telegramChatId: employees.telegramChatId,
    }).from(employees).where(eq(employees.status, 'ACTIVE'));
    return res.json(activeEmployees);
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

router.post('/login', async (req, res) => {
  const { pin, employeeId } = req.body;
  if (!pin || typeof pin !== 'string') {
    return res.status(400).json({ error: 'ПИН-код не указан.' });
  }

  try {
    let matchedEmployee = null;

    if (employeeId) {
      const empList = await db.select().from(employees).where(
        and(eq(employees.id, employeeId), eq(employees.status, 'ACTIVE'))
      );
      if (empList.length > 0) {
        const match = await bcrypt.compare(pin, empList[0].pinHash);
        if (match) {
          matchedEmployee = empList[0];
        }
      }
    } else {
      const activeEmployees = await db.select().from(employees).where(eq(employees.status, 'ACTIVE'));
      for (const emp of activeEmployees) {
        const match = await bcrypt.compare(pin, emp.pinHash);
        if (match) {
          matchedEmployee = emp;
          break;
        }
      }
    }

    if (!matchedEmployee) {
      return res.status(401).json({ error: 'Неверный ПИН-код.' });
    }

    // Update online status in database
    await db.update(employees)
      .set({ isOnline: true })
      .where(eq(employees.id, matchedEmployee.id));

    const jwtSecret = process.env.JWT_SECRET || '4f63c8a9134b22c7128d546ef81a4b6c321d54f67e89ab0c210d3e5b6c7a8d9e';
    const token = jwt.sign(
      {
        employeeId: matchedEmployee.id,
        name: matchedEmployee.name,
        role: matchedEmployee.role,
      },
      jwtSecret,
      { expiresIn: '8h' }
    );

    // Remove pinHash from response
    const { pinHash, ...employeeData } = matchedEmployee;

    return res.json({
      token,
      employee: {
        ...employeeData,
        isOnline: true
      },
    });
  } catch (error: any) {
    console.error('Login error:', error);
    return res.status(500).json({ error: 'Внутренняя ошибка сервера при авторизации.' });
  }
});

router.post('/logout', async (req, res) => {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    try {
      const jwtSecret = process.env.JWT_SECRET || '4f63c8a9134b22c7128d546ef81a4b6c321d54f67e89ab0c210d3e5b6c7a8d9e';
      const decoded = jwt.verify(token, jwtSecret) as { employeeId: string };
      await db.update(employees)
        .set({ isOnline: false })
        .where(eq(employees.id, decoded.employeeId));
    } catch (e) {}
  }
  return res.json({ ok: true });
});

export default router;
