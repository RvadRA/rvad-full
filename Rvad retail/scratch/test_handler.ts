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

const reqBody = {
  name: 'Золото 9 кг',
  barcode: '4602401575567',
  sku: 'ФА-001',
  category: 'Фасовочные пакеты и пакеты-майки',
  priceBuy: 121.5,
  priceSell: 180,
  priceWholesale: 130,
  stock: 200,
  minStock: 5,
  unit: 'шт',
  supplierId: 'sup-2'
};

const newProduct: any = {};
for (const key of allowedKeys) {
  if (key in reqBody) {
    let val = (reqBody as any)[key];
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

console.log("Processed product:", newProduct);
