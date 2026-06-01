/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Product, Category, Customer, Supplier, SaleTransaction, SecurityAuditLog, UserRole, StockCorrectionLog } from './types';

export const INITIAL_CATEGORIES: Category[] = [
  { id: 'cat-1', name: 'Электрика и Свет', skuPrefix: 'EL' },
  { id: 'cat-2', name: 'Инструменты', skuPrefix: 'TL' },
  { id: 'cat-3', name: 'Крепеж и Метизы', skuPrefix: 'FS' },
  { id: 'cat-4', name: 'Бытовая Химия и Клеи', skuPrefix: 'CH' },
  { id: 'cat-5', name: 'Сантехника', skuPrefix: 'PL' },
  { id: 'cat-6', name: 'Расходные материалы', skuPrefix: 'RM' }
];

export const INITIAL_SUPPLIERS: Supplier[] = [
  { id: 'sup-1', name: 'ИП Ахмедов С.А.', company: 'СветЭлектроСнаб', phone: '+7 (926) 431-12-88', debt: 15400 },
  { id: 'sup-2', name: 'ООО МетизТрейд', company: 'Крепежный Мир', phone: '+7 (495) 777-66-55', debt: 0 },
  { id: 'sup-3', name: 'ИП Ким В.Д.', company: 'ИнструментМастер', phone: '+7 (903) 124-55-33', debt: 4500 },
  { id: 'sup-4', name: 'ООО СантехОпт', company: 'Аква-Ресурс', phone: '+7 (499) 888-11-22', debt: 28000 }
];

export const INITIAL_PRODUCTS: Product[] = [
  {
    id: 'prod-1',
    name: 'Светодиодная лампа 12W E27 4000K',
    barcode: '4601234567890',
    category: 'Электрика и Свет',
    sku: 'EL-012',
    imageUrl: 'https://images.unsplash.com/photo-1549448833-287705ab2d48?auto=format&fit=crop&q=80&w=400',
    priceBuy: 85,
    priceSell: 150,
    priceWholesale: 110,
    stock: 42,
    minStock: 10,
    unit: 'шт',
    supplierId: 'sup-1'
  },
  {
    id: 'prod-2',
    name: 'Набор отверток 6 в 1 Профи',
    barcode: '4609876543210',
    category: 'Инструменты',
    sku: 'TL-543',
    imageUrl: 'https://images.unsplash.com/photo-1572981779307-38b8cabb2407?auto=format&fit=crop&q=80&w=400',
    priceBuy: 280,
    priceSell: 450,
    priceWholesale: 330,
    stock: 15,
    minStock: 5,
    unit: 'наб',
    supplierId: 'sup-3'
  },
  {
    id: 'prod-3',
    name: 'Удлинитель 3 розеток 5 метров с заземлением',
    barcode: '4604561237894',
    category: 'Электрика и Свет',
    sku: 'EL-041',
    priceBuy: 210,
    priceSell: 380,
    priceWholesale: 260,
    stock: 8,
    minStock: 10, // Малый остаток!
    unit: 'шт',
    supplierId: 'sup-1'
  },
  {
    id: 'prod-4',
    name: 'Молоток слесарный фиберглас 500г',
    barcode: '4607891234568',
    category: 'Инструменты',
    sku: 'TL-102',
    priceBuy: 190,
    priceSell: 320,
    priceWholesale: 220,
    stock: 12,
    minStock: 3,
    unit: 'шт',
    supplierId: 'sup-3'
  },
  {
    id: 'prod-5',
    name: 'Батарейка АА Duracell (уп. 4 шт)',
    barcode: '5000394140733',
    category: 'Расходные материалы',
    sku: 'BT-002',
    priceBuy: 180,
    priceSell: 310,
    priceWholesale: 210,
    stock: 64,
    minStock: 15,
    unit: 'уп',
    supplierId: 'sup-1'
  },
  {
    id: 'prod-6',
    name: 'Супер клей Монолит Секундный 3г',
    barcode: '4601112223334',
    category: 'Бытовая Химия и Клеи',
    sku: 'CH-901',
    priceBuy: 22,
    priceSell: 50,
    priceWholesale: 30,
    stock: 4,
    minStock: 20, // Очень малый остаток!
    unit: 'шт',
    supplierId: 'sup-3'
  },
  {
    id: 'prod-7',
    name: 'Изолента ПВХ синяя Сибртех 20м',
    barcode: '4605556667778',
    category: 'Расходные материалы',
    sku: 'CH-052',
    priceBuy: 30,
    priceSell: 65,
    priceWholesale: 40,
    stock: 110,
    minStock: 25,
    unit: 'шт',
    supplierId: 'sup-1'
  },
  {
    id: 'prod-8',
    name: 'Саморез по металлу 3.5х25 (1000 шт)',
    barcode: '4603334445556',
    category: 'Крепеж и Метизы',
    sku: 'FS-325',
    priceBuy: 320,
    priceSell: 550,
    priceWholesale: 400,
    stock: 19,
    minStock: 5,
    unit: 'кор',
    supplierId: 'sup-2'
  },
  {
    id: 'prod-9',
    name: 'Замок навесной Авангард 50мм латунь',
    barcode: '4604445556667',
    category: 'Инструменты',
    sku: 'TL-882',
    priceBuy: 250,
    priceSell: 420,
    priceWholesale: 315,
    stock: 0, // Завершился!
    minStock: 4,
    unit: 'шт',
    supplierId: 'sup-3'
  },
  {
    id: 'prod-10',
    name: 'Гибкая подводка для воды 1/2" г-г 60см',
    barcode: '4602223334445',
    category: 'Сантехника',
    sku: 'PL-301',
    priceBuy: 110,
    priceSell: 200,
    priceWholesale: 140,
    stock: 22,
    minStock: 8,
    unit: 'шт',
    supplierId: 'sup-4'
  }
];

export const INITIAL_CUSTOMERS: Customer[] = [
  {
    id: 'cust-1',
    name: 'Алибек Усенов',
    phone: '+7 (999) 555-44-11',
    debt: 4200,
    debtLimit: 10000,
    discountPercent: 3,
    notes: 'Постоянный клиент из мясного павильона. Отдает быстро.'
  },
  {
    id: 'cust-2',
    name: 'ООО СтройСервис (Нурбек)',
    phone: '+7 (912) 345-67-89',
    debt: 12500,
    debtLimit: 30000,
    discountPercent: 5,
    notes: 'Прораб строительного сектора. Оплата раз в месяц по безналу.'
  },
  {
    id: 'cust-3',
    name: 'Мария Иванова',
    phone: '+7 (903) 777-88-99',
    debt: 0,
    debtLimit: 3000,
    discountPercent: 0,
    notes: 'Местный житель, берет хозяйственные товары по мелочи.'
  },
  {
    id: 'cust-4',
    name: 'Камиль Садыков',
    phone: '+7 (965) 000-11-22',
    debt: 900,
    debtLimit: 5000,
    discountPercent: 2,
    notes: 'Владелец соседней точки хозтоваров. Иногда перехватывает лампочки.'
  }
];

export const INITIAL_SALES: SaleTransaction[] = [];

export const INITIAL_AUDITS: SecurityAuditLog[] = [];

export const INITIAL_CORRECTIONS: StockCorrectionLog[] = [];
