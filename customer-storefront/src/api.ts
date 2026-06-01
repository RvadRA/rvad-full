/**
 * api.ts — All Rvad retail API calls for the customer storefront.
 *
 * Reads the server base URL from VITE_API_URL env variable.
 * Falls back to http://localhost:3000 for local development.
 *
 * JWT is stored in localStorage under 'storefront_token'.
 */

const getBaseUrl = (): string => { 
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL;
  }
  
  if (typeof window !== 'undefined') {
    const { protocol, hostname, port } = window.location;
    
    // Support VS Code/Github Dev Tunnels (e.g. lnk527dq-5173.usw3.devtunnels.ms -> lnk527dq-3000.usw3.devtunnels.ms)
    if (hostname.includes('devtunnels.ms')) {
      const newHostname = hostname.replace('-5173', '-3000');
      return `${protocol}//${newHostname}`;
    }
    
    // Support local IP / localhost with port replacements
    if (port === '5173') {
      return `${protocol}//${hostname}:3000`;
    }
  }
  
  return 'http://localhost:3000';
};

const BASE_URL = getBaseUrl();


function getToken(): string | null {
  return localStorage.getItem('storefront_token');
}

async function apiFetch(path: string, options: RequestInit = {}): Promise<any> {
  const token = getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...((options.headers as Record<string, string>) || {}),
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`${BASE_URL}${path}`, { ...options, headers });
  
  let data: any = null;
  const contentType = res.headers.get('content-type');
  if (contentType && contentType.includes('application/json')) {
    try {
      data = await res.json();
    } catch (e) {
      data = {};
    }
  } else {
    const text = await res.text().catch(() => '');
    throw new Error(`Неверный формат ответа: ожидался JSON, получен HTML. Текст: ${text.slice(0, 100)}`);
  }

  if (!res.ok) {
    throw new Error(data?.error || `HTTP ${res.status}`);
  }

  return data;
}

export const storefrontApi = {
  // ── Auth ────────────────────────────────────────────────────────────────

  /** Register a new customer account */
  register: (name: string, phone: string, password: string) =>
    apiFetch('/api/storefront/auth/register', {
      method: 'POST',
      body: JSON.stringify({ name, phone, password }),
    }),

  /** Login with phone + password, returns { token, customer } */
  login: (phone: string, password: string) =>
    apiFetch('/api/storefront/auth/login', {
      method: 'POST',
      body: JSON.stringify({ phone, password }),
    }),

  /** Get the authenticated customer's fresh profile from the server */
  getMe: () => apiFetch('/api/storefront/auth/me'),

  /** Request password reset code */
  requestReset: (phone: string) =>
    apiFetch('/api/storefront/auth/request-reset', {
      method: 'POST',
      body: JSON.stringify({ phone }),
    }),

  /** Reset password for a customer account using the code */
  resetPassword: (phone: string, code: string, password: string) =>
    apiFetch('/api/storefront/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({ phone, code, password }),
    }),

  // ── Catalog ─────────────────────────────────────────────────────────────

  /**
   * Get products. Optionally filter by search query and/or category id.
   * NOTE: priceSell from the server is stored as integer kopecks (e.g. 15000 = 150 rubles).
   * Divide by 100 when mapping to display prices.
   */
  getProducts: (search?: string, category?: string) => {
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    if (category && category !== 'all') params.set('category', category);
    const qs = params.toString();
    return apiFetch(`/api/storefront/products${qs ? '?' + qs : ''}`);
  },

  /** Get all product categories */
  getCategories: () => apiFetch('/api/storefront/categories'),

  // ── Orders ──────────────────────────────────────────────────────────────

  /**
   * Place an order. This triggers the full atomic DB transaction in Rvad retail:
   * stock deduction → saleTransaction → stockCorrectionLog → auditLog → Telegram notification.
   * The order appears immediately in Rvad retail's Analytics and Inventory views.
   */
  placeOrder: (payload: {
    items: { productId: string; quantity: number }[];
    orderType: 'delivery' | 'pickup';
    deliveryAddress?: string;
    comment?: string;
    paymentMethod?: 'CASH' | 'CARD' | 'DEBT';
  }) =>
    apiFetch('/api/storefront/orders', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  /** Get the authenticated customer's full order history */
  getOrders: () => apiFetch('/api/storefront/orders'),

  /** Get reviews for a product */
  getReviews: (productId: string) => apiFetch(`/api/storefront/products/${productId}/reviews`),

  /** Add a review for a product */
  addReview: (productId: string, rating: number, text: string) =>
    apiFetch(`/api/storefront/products/${productId}/reviews`, {
      method: 'POST',
      body: JSON.stringify({ rating, text }),
    }),

  /** Get customer's reconciliation report entries */
  getReconciliation: () => apiFetch('/api/storefront/orders/reconciliation'),
};
