import { pgTable, text, integer, boolean, timestamp, jsonb, pgEnum } from 'drizzle-orm/pg-core';

export const userRoleEnum = pgEnum('user_role', ['OWNER', 'ADMIN', 'CASHIER', 'WAREHOUSE']);

export const categories = pgTable('categories', {
  id: text('id').primaryKey(),
  name: text('name').notNull().unique(),
  skuPrefix: text('sku_prefix'),
});

export const suppliers = pgTable('suppliers', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  phone: text('phone').notNull(),
  company: text('company').notNull(),
  debt: integer('debt').default(0).notNull(), // stored in cents/integer currency representation
});

export const customers = pgTable('customers', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  phone: text('phone').notNull(),
  telegramChatId: text('telegram_chat_id'),
  debt: integer('debt').default(0).notNull(),
  debtLimit: integer('debt_limit').default(50000).notNull(),
  discountPercent: integer('discount_percent').default(0).notNull(),
  notes: text('notes'),
  // Nullable — existing customers (added by employees) won't have a password hash.
  // Only customers who self-register via the storefront will have this set.
  passwordHash: text('password_hash'),
});

export const employees = pgTable('employees', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  role: userRoleEnum('role').notNull(),
  phone: text('phone').notNull(),
  pinHash: text('pin_hash').notNull(), // bcrypt hash of 4-digit PIN
  telegramChatId: text('telegram_chat_id'),
  isOnline: boolean('is_online').default(false).notNull(),
  status: text('status').$type<'ACTIVE' | 'INACTIVE'>().default('ACTIVE').notNull(),
  joinDate: timestamp('join_date', { withTimezone: true }).defaultNow().notNull(),
});

export const employeeDocuments = pgTable('employee_documents', {
  id: text('id').primaryKey(),
  employeeId: text('employee_id').notNull().references(() => employees.id, { onDelete: 'cascade' }),
  type: text('type').notNull(), // 'Патент', 'Виза', 'Регистрация'
  number: text('number').notNull(),
  issueDate: text('issue_date').notNull(),
  expiryDate: text('expiry_date').notNull(),
  notes: text('notes'),
  scans: jsonb('scans').$type<string[]>().default([]).notNull(), // array of urls
  monthlyPayments: jsonb('monthly_payments').$type<{ date: string; amount: number; receiptScan?: string }[]>().default([]).notNull(),
});

export const products = pgTable('products', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  barcode: text('barcode').notNull().unique(),
  category: text('category').notNull(),
  sku: text('sku').notNull(),
  imageUrl: text('image_url'),
  priceBuy: integer('price_buy').notNull(),
  priceSell: integer('price_sell').notNull(),
  priceWholesale: integer('price_wholesale'),
  stock: integer('stock').notNull(),
  minStock: integer('min_stock').default(5).notNull(),
  unit: text('unit').notNull(), // 'шт', 'кг', 'кв.м'
  supplierId: text('supplier_id').references(() => suppliers.id, { onDelete: 'set null' }),
  responsibleEmployeeId: text('responsible_employee_id').references(() => employees.id, { onDelete: 'set null' }),
  originalPriceSell: integer('original_price_sell'),
  isPromo: boolean('is_promo').default(false).notNull(),
  promoLabel: text('promo_label'),
});

export const saleTransactions = pgTable('sale_transactions', {
  id: text('id').primaryKey(),
  timestamp: timestamp('timestamp', { withTimezone: true }).defaultNow().notNull(),
  cashierName: text('cashier_name').notNull(),
  items: jsonb('items').$type<{
    productId: string;
    productName: string;
    quantity: number;
    priceBuy: number;
    priceSell: number;
    discountPercent: number;
  }[]>().notNull(),
  totalPriceBuy: integer('total_price_buy').notNull(),
  totalBeforeDiscount: integer('total_before_discount').notNull(),
  totalDiscount: integer('total_discount').notNull(),
  finalPrice: integer('final_price').notNull(),
  paymentMethod: text('payment_method').$type<'CASH' | 'CARD' | 'DEBT' | 'SPLIT'>().notNull(),
  paidCash: integer('paid_cash').default(0).notNull(),
  paidCard: integer('paid_card').default(0).notNull(),
  paidDebt: integer('paid_debt').default(0).notNull(),
  customerId: text('customer_id').references(() => customers.id, { onDelete: 'set null' }),
  synced: boolean('synced').default(true).notNull(),
  status: text('status').$type<'processing' | 'shipping' | 'delivered' | 'cancelled'>().default('processing').notNull(),
  orderType: text('order_type').$type<'delivery' | 'pickup'>(),
  deliveryAddress: text('delivery_address'),
  comment: text('comment'),
});

export const debtPayments = pgTable('debt_payments', {
  id: text('id').primaryKey(),
  customerId: text('customer_id').notNull().references(() => customers.id, { onDelete: 'cascade' }),
  customerName: text('customer_name').notNull(),
  amount: integer('amount').notNull(),
  paymentMethod: text('payment_method').$type<'CASH' | 'CARD'>().notNull(),
  timestamp: timestamp('timestamp', { withTimezone: true }).defaultNow().notNull(),
  synced: boolean('synced').default(true).notNull(),
});

export const stockCorrectionLogs = pgTable('stock_correction_logs', {
  id: text('id').primaryKey(),
  productId: text('product_id').notNull().references(() => products.id, { onDelete: 'cascade' }),
  productName: text('product_name').notNull(),
  oldStock: integer('old_stock').notNull(),
  newStock: integer('new_stock').notNull(),
  type: text('type').$type<'INVENTORY_COUNT' | 'DAMAGE' | 'RESTOCK' | 'CORRECTION' | 'SALE'>().notNull(),
  timestamp: timestamp('timestamp', { withTimezone: true }).defaultNow().notNull(),
  notes: text('notes'),
  cashierName: text('cashier_name').notNull(),
});

export const securityAuditLogs = pgTable('security_audit_logs', {
  id: text('id').primaryKey(),
  timestamp: timestamp('timestamp', { withTimezone: true }).defaultNow().notNull(),
  role: userRoleEnum('role').notNull(),
  userName: text('user_name').notNull(),
  action: text('action').notNull(),
  details: text('details').notNull(),
  severity: text('severity').$type<'INFO' | 'WARNING' | 'DANGER'>().notNull(),
});

export const syncTasks = pgTable('sync_tasks', {
  id: text('id').primaryKey(),
  type: text('type').$type<'SALE_TRANSACTION' | 'DEBT_PAYMENT' | 'STOCK_CORRECTION' | 'CUSTOMER_UPDATE'>().notNull(),
  payload: jsonb('payload').notNull(),
  timestamp: timestamp('timestamp', { withTimezone: true }).defaultNow().notNull(),
  status: text('status').$type<'PENDING' | 'RESOLVED' | 'CONFLICT'>().default('PENDING').notNull(),
});

export const businessExpenses = pgTable('business_expenses', {
  id: text('id').primaryKey(),
  category: text('category').$type<'Аренда' | 'Зарплата' | 'Закупка товара' | 'Маркетинг' | 'Коммунальные услуги' | 'Питание' | 'Прочее'>().notNull(),
  amount: integer('amount').notNull(),
  timestamp: timestamp('timestamp', { withTimezone: true }).defaultNow().notNull(),
  date: text('date').notNull(), // format YYYY-MM-DD
  notes: text('notes'),
});

export const productReviews = pgTable('product_reviews', {
  id: text('id').primaryKey(),
  productId: text('product_id').notNull().references(() => products.id, { onDelete: 'cascade' }),
  customerName: text('customer_name').notNull(),
  rating: integer('rating').notNull(),
  text: text('text').notNull(),
  timestamp: timestamp('timestamp', { withTimezone: true }).defaultNow().notNull(),
});

