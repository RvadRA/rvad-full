/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export enum UserRole {
  OWNER = 'OWNER',         // Владелец
  ADMIN = 'ADMIN',         // Администратор
  CASHIER = 'CASHIER',     // Кассир
  WAREHOUSE = 'WAREHOUSE', // Кладовщик
}

export interface Product {
  id: string;
  name: string;
  barcode: string;
  category: string;
  sku: string;
  imageUrl?: string;
  priceBuy: number;       // Закупочная цена (KGS / RUB)
  priceSell: number;      // Розничная цена
  priceWholesale?: number;// Оптовая цена
  stock: number;          // Текущий остаток
  minStock: number;       // Минимальный остаток для оповещения
  unit: string;           // Ед. измерения (шт, кг, кв.м)
  supplierId: string;
  responsibleEmployeeId?: string; // Responsible employee for this product
  isPromo?: boolean;
  promoLabel?: string | null;
  originalPriceSell?: number | null;
}

export interface EmployeeDocument {
  id: string;
  type: string; // e.g., 'Патент', 'Виза', 'Регистрация'
  number: string;
  issueDate: string;
  expiryDate: string;
  notes?: string;
  scans: string[]; // URLs or base64
  monthlyPayments: { date: string; amount: number; receiptScan?: string }[];
}

export interface Employee {
  id: string;
  name: string;
  role: UserRole;
  phone: string;
  pin?: string; // PIN code for system authentication (e.g. 4 digits)
  telegramChatId?: string; // New field
  isOnline?: boolean;
  status: 'ACTIVE' | 'INACTIVE';
  documents: EmployeeDocument[];
  joinDate: string;
}

export interface Category {
  id: string;
  name: string;
  skuPrefix?: string;
}

export interface Customer {
  id: string;
  name: string;
  phone: string;
  telegramChatId?: string;
  debt: number;           // Текущий долг
  debtLimit: number;      // Лимит долга
  discountPercent: number;// Персональная скидка %
  notes?: string;
  password?: string;      // Optional password for storefront
  passwordHash?: string;  // Optional password hash from database
}

export interface Supplier {
  id: string;
  name: string;
  phone: string;
  company: string;
  debt: number;           // Наш долг перед поставщиком
}

export interface CartItem {
  product: Product;
  quantity: number;
  discountPercent: number;
  customPrice?: number;
}

export interface SaleTransaction {
  id: string;
  timestamp: string;
  cashierName: string;
  items: {
    productId: string;
    productName: string;
    quantity: number;
    priceBuy: number;
    priceSell: number;
    discountPercent: number;
  }[];
  totalPriceBuy: number;
  totalBeforeDiscount: number;
  totalDiscount: number;
  finalPrice: number;
  paymentMethod: 'CASH' | 'CARD' | 'DEBT' | 'SPLIT';
  paidCash: number;
  paidCard: number;
  paidDebt: number; // записано в долг
  customerId?: string;
  synced: boolean;
  status?: 'processing' | 'shipping' | 'shipped' | 'delivered' | 'cancelled';
}

export interface DebtPayment {
  id: string;
  customerId: string;
  customerName: string;
  amount: number;
  paymentMethod: 'CASH' | 'CARD';
  timestamp: string;
  synced: boolean;
}

export interface StockCorrectionLog {
  id: string;
  productId: string;
  productName: string;
  oldStock: number;
  newStock: number;
  type: 'INVENTORY_COUNT' | 'DAMAGE' | 'RESTOCK' | 'CORRECTION' | 'SALE';
  timestamp: string;
  notes?: string;
  cashierName: string;
}

export interface TelegramConfig {
  botToken: string;
  chatId: string;
  enabled: boolean;
}

export interface SecurityAuditLog {
  id: string;
  timestamp: string;
  role: UserRole;
  user: string;
  action: string;
  details: string;
  severity: 'INFO' | 'WARNING' | 'DANGER';
}

export interface SyncTask {
  id: string;
  type: 'SALE_TRANSACTION' | 'DEBT_PAYMENT' | 'STOCK_CORRECTION' | 'CUSTOMER_UPDATE';
  payload: any;
  timestamp: string;
  status: 'PENDING' | 'RESOLVED' | 'CONFLICT';
}

export interface BusinessExpense {
  id: string;
  category: 'Аренда' | 'Зарплата' | 'Закупка товара' | 'Маркетинг' | 'Коммунальные услуги' | 'Питание' | 'Прочее';
  amount: number;
  timestamp: string;
  date: string; // YYYY-MM-DD
  notes?: string;
}
