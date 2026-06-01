import {
  Product,
  Category,
  Customer,
  Supplier,
  SaleTransaction,
  DebtPayment,
  StockCorrectionLog,
  SecurityAuditLog,
  SyncTask,
  BusinessExpense,
  Employee
} from '../types';

let jwtToken: string | null = localStorage.getItem('jwt_token');

export const apiTokenManager = {
  setToken(token: string | null) {
    jwtToken = token;
    if (token) {
      localStorage.setItem('jwt_token', token);
    } else {
      localStorage.removeItem('jwt_token');
    }
  },
  getToken() {
    return jwtToken;
  }
};

async function apiRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers || {});
  
  if (jwtToken) {
    headers.set('Authorization', `Bearer ${jwtToken}`);
  }
  
  if (!headers.has('Content-Type') && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(path, {
    ...options,
    headers
  });

  if (response.status === 401) {
    apiTokenManager.setToken(null);
    window.dispatchEvent(new Event('api-unauthorized'));
    throw new Error('Unauthorized');
  }

  let data: any = null;
  const contentType = response.headers.get('content-type');
  if (contentType && contentType.includes('application/json')) {
    data = await response.json().catch(() => null);
  } else {
    const text = await response.text().catch(() => '');
    data = text ? { message: text } : {};
  }

  if (!response.ok) {
    throw new Error(data?.error || data?.description || data?.message || `HTTP error ${response.status}`);
  }

  return data as T;
}

export const api = {
  auth: {
    async login(pin: string, employeeId?: string): Promise<{ token: string; employee: Employee }> {
      const res = await apiRequest<{ token: string; employee: Employee }>('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ pin, employeeId })
      });
      apiTokenManager.setToken(res.token);
      return res;
    },
    async logout(): Promise<void> {
      await apiRequest('/api/auth/logout', { method: 'POST' }).catch(() => {});
      apiTokenManager.setToken(null);
    }
  },

  products: {
    list(search?: string, category?: string): Promise<Product[]> {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      if (category) params.set('category', category);
      const query = params.toString() ? `?${params.toString()}` : '';
      return apiRequest<Product[]>(`/api/products${query}`);
    },
    create(data: Omit<Product, 'id'> & { id?: string }): Promise<Product> {
      return apiRequest<Product>('/api/products', {
        method: 'POST',
        body: JSON.stringify(data)
      });
    },
    update(id: string, data: Partial<Product>): Promise<void> {
      return apiRequest<void>(`/api/products/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data)
      });
    },
    delete(id: string): Promise<void> {
      return apiRequest<void>(`/api/products/${id}`, {
        method: 'DELETE'
      });
    },
    adjustStock(id: string, delta: number, type: string, notes?: string, cashierName?: string): Promise<{ success: boolean; newStock: number }> {
      return apiRequest<{ success: boolean; newStock: number }>(`/api/products/${id}/adjust-stock`, {
        method: 'POST',
        body: JSON.stringify({ delta, type, notes, cashierName })
      });
    }
  },

  categories: {
    list(): Promise<Category[]> {
      return apiRequest<Category[]>('/api/categories');
    },
    create(data: Omit<Category, 'id'> & { id?: string }): Promise<Category> {
      return apiRequest<Category>('/api/categories', {
        method: 'POST',
        body: JSON.stringify(data)
      });
    },
    update(id: string, data: Partial<Category>): Promise<void> {
      return apiRequest<void>(`/api/categories/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data)
      });
    },
    delete(id: string): Promise<void> {
      return apiRequest<void>(`/api/categories/${id}`, {
        method: 'DELETE'
      });
    }
  },

  customers: {
    list(): Promise<Customer[]> {
      return apiRequest<Customer[]>('/api/customers');
    },
    create(data: Omit<Customer, 'id'> & { id?: string }): Promise<Customer> {
      return apiRequest<Customer>('/api/customers', {
        method: 'POST',
        body: JSON.stringify(data)
      });
    },
    update(id: string, data: Partial<Customer>): Promise<void> {
      return apiRequest<void>(`/api/customers/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data)
      });
    },
    delete(id: string): Promise<void> {
      return apiRequest<void>(`/api/customers/${id}`, {
        method: 'DELETE'
      });
    }
  },

  suppliers: {
    list(): Promise<Supplier[]> {
      return apiRequest<Supplier[]>('/api/suppliers');
    },
    create(data: Omit<Supplier, 'id'> & { id?: string }): Promise<Supplier> {
      return apiRequest<Supplier>('/api/suppliers', {
        method: 'POST',
        body: JSON.stringify(data)
      });
    },
    update(id: string, data: Partial<Supplier>): Promise<void> {
      return apiRequest<void>(`/api/suppliers/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data)
      });
    },
    delete(id: string): Promise<void> {
      return apiRequest<void>(`/api/suppliers/${id}`, {
        method: 'DELETE'
      });
    }
  },

  employees: {
    list(): Promise<Employee[]> {
      return apiRequest<Employee[]>('/api/employees');
    },
    create(data: Omit<Employee, 'id'> & { id?: string; pin?: string }): Promise<Employee> {
      return apiRequest<Employee>('/api/employees', {
        method: 'POST',
        body: JSON.stringify(data)
      });
    },
    update(id: string, data: Partial<Employee> & { pin?: string }): Promise<void> {
      return apiRequest<void>(`/api/employees/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data)
      });
    },
    delete(id: string): Promise<void> {
      return apiRequest<void>(`/api/employees/${id}`, {
        method: 'DELETE'
      });
    },
    async verifyPin(id: string, pin: string): Promise<boolean> {
      const res = await apiRequest<{ valid: boolean }>(`/api/employees/${id}/verify-pin`, {
        method: 'POST',
        body: JSON.stringify({ pin })
      });
      return res.valid;
    }
  },

  sales: {
    list(): Promise<SaleTransaction[]> {
      return apiRequest<SaleTransaction[]>('/api/sales');
    },
    checkout(data: Omit<SaleTransaction, 'id' | 'timestamp' | 'synced'> & { id?: string; timestamp?: string; forceOverLimit?: boolean }): Promise<SaleTransaction> {
      return apiRequest<SaleTransaction>('/api/sales', {
        method: 'POST',
        body: JSON.stringify(data)
      });
    }
  },

  expenses: {
    list(from?: string, to?: string): Promise<BusinessExpense[]> {
      const params = new URLSearchParams();
      if (from) params.set('from', from);
      if (to) params.set('to', to);
      const query = params.toString() ? `?${params.toString()}` : '';
      return apiRequest<BusinessExpense[]>(`/api/expenses${query}`);
    },
    create(data: Omit<BusinessExpense, 'id' | 'timestamp'> & { id?: string; timestamp?: string }): Promise<BusinessExpense> {
      return apiRequest<BusinessExpense>('/api/expenses', {
        method: 'POST',
        body: JSON.stringify(data)
      });
    },
    delete(id: string): Promise<void> {
      return apiRequest<void>(`/api/expenses/${id}`, {
        method: 'DELETE'
      });
    }
  },

  debtPayments: {
    list(): Promise<DebtPayment[]> {
      return apiRequest<DebtPayment[]>('/api/debt-payments');
    },
    create(data: Omit<DebtPayment, 'id' | 'timestamp' | 'synced'> & { id?: string; timestamp?: string }): Promise<DebtPayment> {
      return apiRequest<DebtPayment>('/api/debt-payments', {
        method: 'POST',
        body: JSON.stringify(data)
      });
    }
  },

  stockCorrections: {
    list(): Promise<StockCorrectionLog[]> {
      return apiRequest<StockCorrectionLog[]>('/api/stock-corrections');
    },
    create(data: Omit<StockCorrectionLog, 'id' | 'timestamp'> & { id?: string; timestamp?: string }): Promise<StockCorrectionLog> {
      return apiRequest<StockCorrectionLog>('/api/stock-corrections', {
        method: 'POST',
        body: JSON.stringify(data)
      });
    }
  },

  auditLogs: {
    list(): Promise<SecurityAuditLog[]> {
      return apiRequest<SecurityAuditLog[]>('/api/audit-logs');
    },
    create(data: Omit<SecurityAuditLog, 'id' | 'timestamp'> & { id?: string; timestamp?: string }): Promise<SecurityAuditLog> {
      return apiRequest<SecurityAuditLog>('/api/audit-logs', {
        method: 'POST',
        body: JSON.stringify(data)
      });
    }
  },

  sync: {
    getPending(): Promise<SyncTask[]> {
      return apiRequest<SyncTask[]>('/api/sync/pending');
    },
    resolve(id: string, status: 'RESOLVED' | 'CONFLICT'): Promise<void> {
      return apiRequest<void>(`/api/sync/resolve/${id}`, {
        method: 'POST',
        body: JSON.stringify({ status })
      });
    },
    sessionSync(tasks: any[]): Promise<{ ok: boolean; customers: Customer[]; debtPayments: DebtPayment[] }> {
      return apiRequest<{ ok: boolean; customers: Customer[]; debtPayments: DebtPayment[] }>('/api/session/sync', {
        method: 'POST',
        body: JSON.stringify({ tasks })
      });
    }
  },

  async upload(file: File): Promise<{ url: string }> {
    const formData = new FormData();
    formData.append('file', file);
    return apiRequest<{ url: string }>('/api/upload', {
      method: 'POST',
      body: formData
    });
  },

  ai: {
    barcode(code: string): Promise<any> {
      return apiRequest<any>(`/api/barcode?code=${encodeURIComponent(code)}`);
    },
    parseInvoice(fileName: string, mimeType: string, fileData: string, existingProducts: any[]): Promise<{ items: any[] }> {
      return apiRequest<{ items: any[] }>('/api/parse-invoice', {
        method: 'POST',
        body: JSON.stringify({ fileName, mimeType, fileData, existingProducts })
      });
    },
    forecast(sales: SaleTransaction[], products: Product[], ownerChatId?: string, isAuto?: boolean): Promise<any> {
      return apiRequest<any>('/api/inventory/forecast', {
        method: 'POST',
        body: JSON.stringify({ sales, products, ownerChatId, isAuto })
      });
    }
  },

  telegram: {
    send(chatId: string, message: string, botType: 'client' | 'internal'): Promise<any> {
      return apiRequest<any>('/api/telegram/send', {
        method: 'POST',
        body: JSON.stringify({ chatId, message, botType })
      });
    }
  }
};
