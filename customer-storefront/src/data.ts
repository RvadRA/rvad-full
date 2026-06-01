import { Product, Category, Order, UserProfile } from './types';

export const CATEGORIES: Category[] = [
  { id: 'all', name: 'Все товары' },
  { id: 'packaging', name: 'Упаковка' },
  { id: 'electrical', name: 'Электрика' },
  { id: 'household', name: 'Для дома' },
  { id: 'tools', name: 'Инструменты' },
];

export const PRODUCTS: Product[] = [
  {
    id: '1',
    name: 'Скотч прозрачный 48мм x 66м',
    price: 85,
    categoryId: 'packaging',
    image: 'https://images.unsplash.com/photo-1586520786520-40e118837e20?auto=format&fit=crop&q=80&w=400&h=300',
    unit: 'рулон',
    article: 'PKG-001'
  },
  {
    id: '2',
    name: 'Пакеты фасовочные 24х37 (500 шт)',
    price: 320,
    categoryId: 'packaging',
    image: 'https://images.unsplash.com/photo-1620023473489-0ae284824579?auto=format&fit=crop&q=80&w=400&h=300',
    unit: 'уп',
    article: 'PKG-002'
  },
  {
    id: '3',
    name: 'Батарейки AA Duracell (4 шт)',
    price: 250,
    categoryId: 'electrical',
    image: 'https://images.unsplash.com/photo-1611311394344-93ff1db671a5?auto=format&fit=crop&q=80&w=400&h=300',
    unit: 'уп',
    article: 'EL-001'
  },
  {
    id: '4',
    name: 'Лампочка LED E27 15W',
    price: 110,
    categoryId: 'electrical',
    image: 'https://images.unsplash.com/photo-1505322022379-7a070ce30154?auto=format&fit=crop&q=80&w=400&h=300',
    unit: 'шт',
    article: 'EL-002'
  },
  {
    id: '5',
    name: 'Губки для посуды (10 шт)',
    price: 90,
    categoryId: 'household',
    image: 'https://images.unsplash.com/photo-1585907474447-fd980c6114a2?auto=format&fit=crop&q=80&w=400&h=300',
    unit: 'уп',
    article: 'HH-001'
  },
  {
    id: '6',
    name: 'Перчатки х/б с ПВХ (10 пар)',
    price: 180,
    categoryId: 'tools',
    image: 'https://images.unsplash.com/photo-1603531475704-58a36fa33c7f?auto=format&fit=crop&q=80&w=400&h=300',
    unit: 'уп',
    article: 'TL-001'
  },
  {
    id: '7',
    name: 'Рулетка измерительная 5м',
    price: 240,
    categoryId: 'tools',
    image: 'https://images.unsplash.com/photo-1544131557-61c028ccbfbe?auto=format&fit=crop&q=80&w=400&h=300',
    unit: 'шт',
    article: 'TL-002'
  },
  {
    id: '8',
    name: 'Набор супер-клея Момент (5 шт)',
    price: 150,
    categoryId: 'tools',
    image: 'https://images.unsplash.com/photo-1590233639485-802ca923cbcf?auto=format&fit=crop&q=80&w=400&h=300',
    unit: 'уп',
    article: 'TL-003'
  },
  {
    id: '9',
    name: 'Мешки для мусора 60л с завязками (30 шт)',
    price: 140,
    categoryId: 'household',
    image: 'https://images.unsplash.com/photo-1532996127006-02cd7ae48200?auto=format&fit=crop&q=80&w=400&h=300',
    unit: 'уп',
    article: 'HH-002'
  },
  {
    id: '10',
    name: 'Кабель питающий USB-C 1.5м',
    price: 195,
    categoryId: 'electrical',
    image: 'https://images.unsplash.com/photo-1543269865-cbf427effbad?auto=format&fit=crop&q=80&w=400&h=300',
    unit: 'шт',
    article: 'EL-003'
  },
  {
    id: '11',
    name: 'Термокружка дорожная сталь 450мл',
    price: 520,
    categoryId: 'household',
    image: 'https://images.unsplash.com/photo-1577937927133-66ef06acdf18?auto=format&fit=crop&q=80&w=400&h=300',
    unit: 'шт',
    article: 'HH-003'
  },
];

export const MOCK_ORDERS: Order[] = [
  {
    id: 'ORD-1092',
    date: '10 Марта 2024, 14:30',
    status: 'delivered',
    total: 820,
    cashierName: 'Storefront: Mock',
    items: [
      { id: '1', name: 'Скотч прозрачный 48мм x 66м', price: 85, quantity: 2 },
      { id: '3', name: 'Батарейки AA Duracell (4 шт)', price: 250, quantity: 1 },
      { id: '5', name: 'Губки для посуды (10 шт)', price: 90, quantity: 4 }
    ]
  },
  {
    id: 'ORD-1085',
    date: '05 Марта 2024, 09:15',
    status: 'shipping',
    total: 3200,
    cashierName: 'Storefront: Mock',
    items: [
      { id: '2', name: 'Пакеты фасовочные 24х37 (500 шт)', price: 320, quantity: 10 }
    ]
  },
  {
    id: 'ORD-1070',
    date: '01 Марта 2024, 11:00',
    status: 'processing',
    total: 250,
    cashierName: 'Storefront: Mock',
    items: [
      { id: '3', name: 'Батарейки AA Duracell (4 шт)', price: 250, quantity: 1 }
    ]
  }
];

export const MOCK_USER: UserProfile = {
  id: 'cust-mock',
  name: 'Иван Иванов',
  phone: '+7 (999) 123-45-67',
  debt: 1250,
  creditLimit: 10000,
  discountPercentage: 5,
  telegramLinked: true,
};

