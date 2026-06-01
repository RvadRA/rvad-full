import { Router } from 'express';
import { db } from '../db/connection';
import { products, stockCorrectionLogs, securityAuditLogs } from '../db/schema';
import { eq, ilike, and, or } from 'drizzle-orm';
import { requireAuth } from '../middleware/requireAuth';
import { UserRole } from '../../src/types';

const router = Router();

// GET /api/products - list all products, support optional ?search= and ?category=
router.get('/', requireAuth(), async (req, res) => {
  const { search, category } = req.query;
  try {
    const conditions = [];
    if (category && typeof category === 'string' && category !== '') {
      conditions.push(eq(products.category, category));
    }
    if (search && typeof search === 'string' && search !== '') {
      conditions.push(
        or(
          ilike(products.name, `%${search}%`),
          ilike(products.barcode, `%${search}%`),
          ilike(products.sku, `%${search}%`)
        )
      );
    }
    
    const query = db.select().from(products);
    const results = conditions.length > 0 
      ? await query.where(and(...conditions))
      : await query;
      
    return res.json(results);
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// POST /api/products - create product
router.post('/', requireAuth([UserRole.OWNER, UserRole.ADMIN, UserRole.WAREHOUSE]), async (req, res) => {
  try {
    const allowedKeys = [
      'name',
      'barcode',
      'category',
      'sku',
      'imageUrl',
      'priceBuy',
      'priceSell',
      'priceWholesale',
      'stock',
      'minStock',
      'unit',
      'supplierId',
      'responsibleEmployeeId',
      'originalPriceSell',
      'isPromo',
      'promoLabel',
    ];
    const integerKeys = ['priceBuy', 'priceSell', 'priceWholesale', 'stock', 'minStock', 'originalPriceSell'];
    const newProduct: any = {};
    for (const key of allowedKeys) {
      if (key in req.body) {
        let val = req.body[key];
        if (integerKeys.includes(key) && val !== null && val !== undefined) {
          if (typeof val === 'number') {
            val = Math.round(val);
          } else if (typeof val === 'string' && val.trim() !== '') {
            const parsed = parseFloat(val);
            val = isNaN(parsed) ? null : Math.round(parsed);
          } else {
            val = null;
          }
        }
        newProduct[key] = val;
      }
    }
    newProduct.id = req.body.id || `prod-${Math.floor(10000 + Math.random() * 90000)}`;
    
    await db.insert(products).values(newProduct);
    
    // Add audit log
    await db.insert(securityAuditLogs).values({
      id: `aud-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`,
      role: (req as any).user.role,
      userName: (req as any).user.name,
      action: 'Создание товара',
      details: `Создан товар '${req.body.name}' (Код: ${req.body.barcode}, SKU: ${req.body.sku})`,
      severity: 'INFO',
    });

    return res.json(newProduct);
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// PUT /api/products/:id - update product
router.put('/:id', requireAuth([UserRole.OWNER, UserRole.ADMIN, UserRole.WAREHOUSE]), async (req, res) => {
  const { id } = req.params;
  try {
    const allowedKeys = [
      'name',
      'barcode',
      'category',
      'sku',
      'imageUrl',
      'priceBuy',
      'priceSell',
      'priceWholesale',
      'stock',
      'minStock',
      'unit',
      'supplierId',
      'responsibleEmployeeId',
      'originalPriceSell',
      'isPromo',
      'promoLabel',
    ];
    const integerKeys = ['priceBuy', 'priceSell', 'priceWholesale', 'stock', 'minStock', 'originalPriceSell'];
    const updateData: any = {};
    for (const key of allowedKeys) {
      if (key in req.body) {
        let val = req.body[key];
        if (integerKeys.includes(key) && val !== null && val !== undefined) {
          if (typeof val === 'number') {
            val = Math.round(val);
          } else if (typeof val === 'string' && val.trim() !== '') {
            const parsed = parseFloat(val);
            val = isNaN(parsed) ? null : Math.round(parsed);
          } else {
            val = null;
          }
        }
        updateData[key] = val;
      }
    }
    await db.update(products).set(updateData).where(eq(products.id, id));
    
    // Add audit log
    await db.insert(securityAuditLogs).values({
      id: `aud-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`,
      role: (req as any).user.role,
      userName: (req as any).user.name,
      action: 'Изменение товара',
      details: `Обновлен товар '${req.body.name}' (Код: ${req.body.barcode})`,
      severity: 'INFO',
    });

    return res.json({ success: true });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// DELETE /api/products/:id - delete product
router.delete('/:id', requireAuth([UserRole.OWNER, UserRole.ADMIN]), async (req, res) => {
  const { id } = req.params;
  try {
    // Get product info for audit
    const prodList = await db.select().from(products).where(eq(products.id, id));
    if (prodList.length > 0) {
      const prod = prodList[0];
      await db.delete(products).where(eq(products.id, id));
      
      // Add audit log
      await db.insert(securityAuditLogs).values({
        id: `aud-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`,
        role: (req as any).user.role,
        userName: (req as any).user.name,
        action: 'Удаление товара',
        details: `Удален товар '${prod.name}' (Код: ${prod.barcode})`,
        severity: 'WARNING',
      });
    }

    return res.json({ success: true });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// POST /api/products/:id/adjust-stock - adjust stock levels manually
router.post('/:id/adjust-stock', requireAuth([UserRole.OWNER, UserRole.ADMIN, UserRole.WAREHOUSE]), async (req, res) => {
  const { id } = req.params;
  const { delta, type, notes, cashierName } = req.body;
  
  if (typeof delta !== 'number') {
    return res.status(400).json({ error: 'Delta must be a number' });
  }
  
  try {
    const result = await db.transaction(async (tx) => {
      const prodList = await tx.select().from(products).where(eq(products.id, id));
      if (prodList.length === 0) {
        throw new Error('Product not found');
      }
      
      const product = prodList[0];
      const oldStock = product.stock;
      const newStock = Math.max(0, oldStock + delta);
      
      // Update stock
      await tx.update(products)
        .set({ stock: newStock })
        .where(eq(products.id, id));
        
      // Write stock correction log
      const logId = `corr-${Math.floor(10000 + Math.random() * 90000)}`;
      await tx.insert(stockCorrectionLogs).values({
        id: logId,
        productId: id,
        productName: product.name,
        oldStock,
        newStock,
        type,
        notes: notes || '',
        cashierName: cashierName || (req as any).user.name || 'System',
      });
      
      return { oldStock, newStock, product };
    });
    
    return res.json({ success: true, ...result });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

export default router;
