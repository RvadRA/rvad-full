export interface Product {
  id: string;
  name: string;
  price: number;
  image: string;
  categoryId: string;
  description?: string;
  article?: string;
  unit?: string;
  rating?: number;
  ratingCount?: number;
  isPromo?: boolean;
  promoLabel?: string;
  originalPrice?: number;
}

export interface Category {
  id: string;
  name: string;
}

export interface CartItem extends Product {
  quantity: number;
}

export interface OrderItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
}

export interface Order {
  id: string;
  date: string;
  status: 'processing' | 'shipping' | 'shipped' | 'delivered' | 'cancelled';
  total: number;
  items: OrderItem[];
  cashierName: string;
  orderType?: 'delivery' | 'pickup';
  deliveryAddress?: string;
  comment?: string;
  paymentMethod?: 'CASH' | 'CARD' | 'DEBT' | 'SPLIT';
}

export interface UserProfile {
  id: string;
  name: string;
  phone: string;
  debt: number;
  creditLimit: number;
  discountPercentage: number;
  telegramLinked: boolean;
}
