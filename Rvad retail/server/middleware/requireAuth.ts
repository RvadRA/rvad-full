import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { db } from '../db/connection';
import { employees } from '../db/schema';
import { eq } from 'drizzle-orm';
import { UserRole } from '../../src/types';

export interface AuthenticatedRequest extends Request {
  user?: typeof employees.$inferSelect;
}

export function requireAuth(allowedRoles?: UserRole[]) {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Требуется авторизация.' });
    }

    const token = authHeader.split(' ')[1];
    try {
      const jwtSecret = process.env.JWT_SECRET || '4f63c8a9134b22c7128d546ef81a4b6c321d54f67e89ab0c210d3e5b6c7a8d9e';
      const decoded = jwt.verify(token, jwtSecret) as { employeeId: string; role: UserRole };
      
      const employeeList = await db.select().from(employees).where(eq(employees.id, decoded.employeeId));
      if (employeeList.length === 0) {
        return res.status(401).json({ error: 'Пользователь не найден.' });
      }

      const employee = employeeList[0];
      if (employee.status !== 'ACTIVE') {
        return res.status(403).json({ error: 'Учетная запись деактивирована.' });
      }

      // Check role permissions
      if (allowedRoles && allowedRoles.length > 0 && !allowedRoles.includes(employee.role as UserRole)) {
        return res.status(403).json({ error: 'Доступ запрещен (недостаточно прав).' });
      }

      req.user = employee;
      next();
    } catch (error) {
      return res.status(401).json({ error: 'Неверный или просроченный токен.' });
    }
  };
}
