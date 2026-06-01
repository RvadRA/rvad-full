import { db } from '../server/db/connection';
import { products } from '../server/db/schema';

async function test() {
  try {
    const newProduct = {
      id: 'prod-29668',
      name: 'Золото 9 кг',
      barcode: '4602401575567',
      category: 'Фасовочные пакеты и пакеты-майки',
      sku: 'ФА-001',
      priceBuy: 121.5,
      priceSell: 180,
      priceWholesale: 130,
      stock: 200,
      minStock: 5,
      unit: 'шт',
      supplierId: 'sup-2'
    };
    
    console.log("Trying to insert product with float priceBuy: 121.5...");
    // Let's try raw SQL or Drizzle insert
    await db.insert(products).values(newProduct as any);
    console.log("Insert succeeded!");
  } catch (err: any) {
    console.error("Insert failed with error:", err);
  }
}

test().then(() => process.exit(0));
