/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { QueryClient, QueryClientProvider, useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, apiTokenManager } from './utils/api';
import {
  UserRole,
  Product,
  Category,
  Customer,
  Supplier,
  SaleTransaction,
  DebtPayment,
  StockCorrectionLog,
  SecurityAuditLog,
  SyncTask,
  CartItem,
  BusinessExpense,
  Employee,
  EmployeeDocument
} from './types';

// Component imports
import POS from './components/POS';
import Inventory from './components/Inventory';
import DebtTracker from './components/DebtTracker';
import CRM from './components/CRM';
import Analytics from './components/Analytics';
import SyncManager from './components/SyncManager';
import AdminPanel from './components/AdminPanel';
import ArchitectureHub from './components/ArchitectureHub';
import Employees from './components/Employees';
import ExpensesManagement from './components/ExpensesManagement';
import DeadStock from './components/DeadStock';
import ShiftAuditDashboard from './components/ShiftAuditDashboard';
import Orders from './components/Orders';
import { soundEngine } from './utils/audio';

import {
  Smartphone,
  Package,
  Shield,
  RefreshCw,
  TrendingUp,
  Users,
  Wifi,
  WifiOff,
  Bell,
  Sliders,
  Database,
  Lock,
  Menu,
  X,
  LogOut,
  Receipt,
  Clock,
  ChevronLeft,
  ChevronRight,
  ShoppingBag
} from 'lucide-react';

const THEME_PRESETS: Record<string, { id: string, name: string, circleBg: string, circleBorder: string }> = {
  original: {
    id: 'original',
    name: 'Космическая',
    circleBg: 'bg-[#0F1115]',
    circleBorder: 'border-slate-705'
  },
  neutral: {
    id: 'neutral',
    name: 'Нейтральная',
    circleBg: 'bg-[#F3F4F6]',
    circleBorder: 'border-[#111827]'
  },
  sea: {
    id: 'sea',
    name: 'Морская волна',
    circleBg: 'bg-[#081E22]',
    circleBorder: 'border-[#86DCD0]'
  },
  peach: {
    id: 'peach',
    name: 'Персиковый сад',
    circleBg: 'bg-[#FDF3F0]',
    circleBorder: 'border-[#795548]'
  },
  lavender: {
    id: 'lavender',
    name: 'Лаванда',
    circleBg: 'bg-[#F0ECF6]',
    circleBorder: 'border-[#6A528F]'
  }
};

function AppContent() {
  // Navigation
  const [activeTab, setActiveTabState] = useState<string>(() => {
    return localStorage.getItem('retail_active_tab') || 'pos';
  });
  const setActiveTab = (tab: string) => {
    soundEngine.playClick();
    localStorage.setItem('retail_active_tab', tab);
    setActiveTabState(tab);
  };
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Sidebar collapse support
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(() => {
    return localStorage.getItem('retail_sidebar_collapsed') === 'true';
  });

  const toggleSidebar = () => {
    soundEngine.playClick();
    setIsSidebarCollapsed(prev => {
      const newVal = !prev;
      localStorage.setItem('retail_sidebar_collapsed', String(newVal));
      return newVal;
    });
  };

  // Theme support
  const [currentTheme, setCurrentTheme] = useState<string>(() => {
    return localStorage.getItem('retail_current_theme') || 'original';
  });

  useEffect(() => {
    localStorage.setItem('retail_current_theme', currentTheme);
  }, [currentTheme]);

  // Connection State (Simulated network latency / toggling)
  const [isOnline, setIsOnline] = useState<boolean>(true);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);

  // Telegram Toast State
  const [telegramToast, setTelegramToast] = useState<{ message: string, type: 'OFFLINE' | 'ONLINE' } | null>(null);

  const [syncLogs, setSyncLogs] = useState<string[]>([
    'Система RetailOS успешно запущена.',
    'Связь с сервером: Стабильная.',
    'Локальный кэш IndexedDB сверен с PostgreSQL.'
  ]);

  // Role management (Dynamic permissions switcher)
  const [currentUserId, setCurrentUserId] = useState<string | null>(() => {
    return localStorage.getItem('retail_current_user') || null;
  });

  const queryClient = useQueryClient();
  const [jwtToken, setJwtToken] = useState<string | null>(() => apiTokenManager.getToken());
  const [authenticatingEmployee, setAuthenticatingEmployee] = useState<Employee | null>(null);
  const [enteredPin, setEnteredPin] = useState('');
  const [pinError, setPinError] = useState('');

  // Local client-side offline queue and logs
  const [syncQueue, setSyncQueue] = useState<SyncTask[]>(() => {
    const cached = localStorage.getItem('retail_sync_queue');
    return cached ? JSON.parse(cached) : [];
  });

  useEffect(() => {
    localStorage.setItem('retail_sync_queue', JSON.stringify(syncQueue));
  }, [syncQueue]);

  // React Query server-state definitions
  const { data: products = [] } = useQuery<Product[]>({
    queryKey: ['products'],
    queryFn: () => api.products.list(),
    enabled: !!currentUserId
  });

  const { data: categories = [] } = useQuery<Category[]>({
    queryKey: ['categories'],
    queryFn: () => api.categories.list(),
    enabled: !!currentUserId
  });

  const { data: expenses = [] } = useQuery<BusinessExpense[]>({
    queryKey: ['expenses'],
    queryFn: () => api.expenses.list(),
    enabled: !!currentUserId
  });

  const { data: customers = [] } = useQuery<Customer[]>({
    queryKey: ['customers'],
    queryFn: () => api.customers.list(),
    enabled: !!currentUserId,
    refetchInterval: 2000
  });

  const { data: suppliers = [] } = useQuery<Supplier[]>({
    queryKey: ['suppliers'],
    queryFn: () => api.suppliers.list(),
    enabled: !!currentUserId
  });

  const { data: sales = [] } = useQuery<SaleTransaction[]>({
    queryKey: ['sales'],
    queryFn: () => api.sales.list(),
    enabled: !!currentUserId,
    refetchInterval: 2000
  });

  const { data: debtPayments = [] } = useQuery<DebtPayment[]>({
    queryKey: ['debtPayments'],
    queryFn: () => api.debtPayments.list(),
    enabled: !!currentUserId,
    refetchInterval: 2000
  });

  const { data: correctionLogs = [] } = useQuery<StockCorrectionLog[]>({
    queryKey: ['correctionLogs'],
    queryFn: () => api.stockCorrections.list(),
    enabled: !!currentUserId
  });

  const { data: employees = [] } = useQuery<Employee[]>({
    queryKey: ['employees'],
    queryFn: () => api.employees.list(),
    enabled: !!currentUserId
  });

  const { data: activeEmployees = [] } = useQuery<Employee[]>({
    queryKey: ['activeEmployees'],
    queryFn: () => fetch('/api/auth/employees').then(res => res.json()),
    enabled: !currentUserId
  });

  const currentUser = employees.find(e => e.id === currentUserId) || null;
  const currentRole = currentUser?.role || UserRole.CASHIER;
  const currentName = currentUser?.name || 'Гость';
  const roleDisplay = currentRole === UserRole.OWNER ? 'Владелец' : currentRole === UserRole.ADMIN ? 'Администратор' : currentRole === UserRole.WAREHOUSE ? 'Кладовщик' : 'Кассир';

  const { data: auditLogs = [] } = useQuery<SecurityAuditLog[]>({
    queryKey: ['auditLogs'],
    queryFn: () => api.auditLogs.list(),
    enabled: !!currentUserId && (currentRole === UserRole.OWNER || currentRole === UserRole.ADMIN)
  });

  // API unauthorized event handler redirecting to login screen
  useEffect(() => {
    const handleUnauthorized = () => {
      setCurrentUserId(null);
      setJwtToken(null);
    };
    window.addEventListener('api-unauthorized', handleUnauthorized);
    return () => window.removeEventListener('api-unauthorized', handleUnauthorized);
  }, []);

  // Sync active session state to server so Telegram Bot can calculate metrics in real-time
  useEffect(() => {
    const syncSessionState = async () => {
      if (!currentUserId) return;
      try {
        const activeUser = employees.find(e => e.id === currentUserId);
        const activeCashierName = activeUser ? activeUser.name : 'Айбек';

        const response = await fetch('/api/session/sync', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${jwtToken}`
          },
          body: JSON.stringify({
            activeCashier: activeCashierName
          })
        });

        const data = await response.json();
        if (data.ok) {
          // Invalidate CRM/debt data if bot updated them on backend
          queryClient.invalidateQueries({ queryKey: ['customers'] });
          queryClient.invalidateQueries({ queryKey: ['debtPayments'] });
        }
      } catch (err) {
        console.error("Failed to sync session state with the Express backend:", err);
      }
    };

    const delayTimer = setTimeout(syncSessionState, 1000);
    return () => clearTimeout(delayTimer);
  }, [products, sales, customers, debtPayments, employees, currentUserId, jwtToken]);

  // Listen for physical keyboard PIN presses when PIN entry is active
  useEffect(() => {
    if (!authenticatingEmployee) return;

    const pinLength = 4;

    const handlePhysicalKeyPress = (val: string) => {
      soundEngine.playClick();
      setPinError('');
      if (val === 'C') {
        setEnteredPin('');
      } else if (val === 'B') {
        setEnteredPin(prev => prev.slice(0, -1));
      } else {
        if (enteredPin.length < pinLength) {
          const newPin = enteredPin + val;
          setEnteredPin(newPin);

          if (newPin.length === pinLength) {
            api.auth.login(newPin, authenticatingEmployee.id).then((res) => {
              soundEngine.playAuthSuccess();
              setCurrentUserId(res.employee.id);
              setJwtToken(res.token);
              setAuthenticatingEmployee(null);
              setEnteredPin('');
              queryClient.invalidateQueries();
            }).catch(() => {
              soundEngine.playError();
              setPinError('Неверный ПИН-код!');
              setEnteredPin('');
            });
          }
        }
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (/^\d$/.test(e.key)) {
        handlePhysicalKeyPress(e.key);
      } else if (e.key === 'Backspace') {
        handlePhysicalKeyPress('B');
      } else if (e.key === 'Escape') {
        setAuthenticatingEmployee(null);
        setEnteredPin('');
        setPinError('');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [authenticatingEmployee, enteredPin]);

  // Background AI Inventory Analysis
  useEffect(() => {
    const lastForecast = localStorage.getItem('last_auto_ai_forecast');
    const today = new Date().toDateString();

    if (lastForecast !== today && currentUserId) {
      const timer = setTimeout(() => {
        handleAutoAiForecast(today);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [currentUserId]);

  const handleAutoAiForecast = async (today: string) => {
    try {
      await api.ai.forecast(sales, products, undefined, true);
      localStorage.setItem('last_auto_ai_forecast', today);
      console.log('Daily AI Inventory Forecast completed automatically.');
    } catch (e) {
      console.error('Auto AI Forecast failed:', e);
    }
  };

  // Persist currentUserId locally
  useEffect(() => {
    if (currentUserId) {
      localStorage.setItem('retail_current_user', currentUserId);
    } else {
      localStorage.removeItem('retail_current_user');
    }
  }, [currentUserId]);

  // Redirect restricted roles to 'pos' if their stored tab is not accessible
  useEffect(() => {
    if (currentUserId && employees.length > 0) {
      const user = employees.find(e => e.id === currentUserId);
      const role = user?.role || UserRole.CASHIER;
      
      if (role === UserRole.CASHIER) {
        const allowedCashierTabs = ['pos', 'orders', 'crm', 'sync'];
        if (!allowedCashierTabs.includes(activeTab)) {
          setActiveTab('pos');
        }
      } else if (role === UserRole.WAREHOUSE) {
        const allowedWarehouseTabs = ['pos', 'inventory', 'orders', 'crm', 'deadstock', 'sync'];
        if (!allowedWarehouseTabs.includes(activeTab)) {
          setActiveTab('pos');
        }
      }
    }
  }, [currentUserId, employees, activeTab]);

  const sendTelegramNotification = async (message: string) => {
    try {
      const owners = employees.filter(e => e.role === UserRole.OWNER && e.telegramChatId);
      if (owners.length === 0) return;

      const uniqueChatIds = Array.from(new Set(owners.map(o => o.telegramChatId)));

      for (const chatId of uniqueChatIds) {
        await api.telegram.send(chatId, message, 'internal');
      }
    } catch (e) {
      console.error("Failed to send telegram notification:", e);
    }
  };

  // Helper: append new security audit logs

  const lastNotifiedOnline = useRef<boolean | null>(null);

  // When network state toggles, simulate Telegram bot push notification
  useEffect(() => {
    if (!currentUserId) {
      lastNotifiedOnline.current = null;
      return;
    }

    // Skip if the status hasn't changed to prevent duplicate triggers
    if (lastNotifiedOnline.current === isOnline) return;

    // Skip sending an online notification for the initial load
    if (lastNotifiedOnline.current === null && isOnline) {
      lastNotifiedOnline.current = isOnline;
      return;
    }

    const msg = isOnline
      ? `📱 Telegram Bot: Розничная Точка снова онлайн. Пользователь: ${currentName}. Очередь на синхронизацию: ${syncQueue.length} транзакций.`
      : `📱 Telegram Bot (АХТУНГ!): Розничная Точка перешла в автономный оффлайн-режим. Запись ведется в резервный кэш браузера.`;

    sendTelegramNotification(msg);
    lastNotifiedOnline.current = isOnline;
  }, [isOnline, currentUserId, currentName]);

  const addAuditLog = async (action: string, details: string, severity: 'INFO' | 'WARNING' | 'DANGER' = 'INFO') => {
    try {
      await api.auditLogs.create({
        role: currentRole,
        user: `${currentName} (${roleDisplay})`,
        action,
        details,
        severity
      });
      queryClient.invalidateQueries({ queryKey: ['auditLogs'] });
    } catch (e) {
      console.error("Failed to create audit log:", e);
    }

    // Fraud/Security Alerts to Telegram
    if (severity === 'DANGER' || severity === 'WARNING') {
      sendTelegramNotification(`⚠️ ФРОД-МОНИТОРИНГ:\n\nСобытие: ${action}\nДетали: ${details}\nПользователь: ${currentName || 'Гость'}`);
    }
  };

  const handleCloseShift = () => {
    try {
      const now = new Date();
      const todayStr = now.toLocaleDateString('ru-RU');

      // Calculate today's stats - use safer date check
      const todaySales = sales.filter(s => {
        try {
          return new Date(s.timestamp).toDateString() === now.toDateString();
        } catch (e) {
          return false;
        }
      });

      const totalRev = todaySales.reduce((sum, s) => sum + s.finalPrice, 0);
      const totalCost = todaySales.reduce((sum, s) => sum + s.totalPriceBuy, 0);
      const profit = Math.max(0, totalRev - totalCost);

      const getRoleDisplayLocal = (role: UserRole) => {
        switch (role) {
          case UserRole.OWNER: return 'Владелец';
          case UserRole.ADMIN: return 'Администратор';
          case UserRole.WAREHOUSE: return 'Кладовщик';
          case UserRole.CASHIER: return 'Кассир';
          default: return role;
        }
      };

      const onlineEmployees = employees.filter(e => e.isOnline && e.status === 'ACTIVE');
      const operatorsList = onlineEmployees.length > 0
        ? onlineEmployees.map(e => `  • ${e.name} (${getRoleDisplayLocal(e.role)})`).join('\n')
        : '  • Нет операторов в сети';

      const report = `🏁 Смена закрыта (${todayStr})\n\n` +
        `💰 Выручка: ${totalRev.toLocaleString()} руб.\n` +
        `📈 Прибыль: ${profit.toLocaleString()} руб.\n` +
        `🧾 Чеков пробито: ${todaySales.length} шт.\n\n` +
        `👥 Активные операторы в смене:\n${operatorsList}\n\n` +
        `👤 Смену закрыл(а): ${currentName} (${roleDisplay})\n` +
        `⏰ Время: ${now.toLocaleTimeString('ru-RU')}`;

      sendTelegramNotification(report);
      addAuditLog('Смена закрыта', `Итого за день: ${totalRev} руб. прибыль ${profit} руб.`);

      // Force logout after shift closure for UX clarity
      handleLogout();
    } catch (err) {
      console.error("Shift closure failed:", err);
      // Even if notification fails, we should logout
      handleLogout();
    }
  };

  /**
   * Action Handler: Formulate POS Sales Checkout
   */
  /**
   * Safe notification for low stock levels
   */
  const checkLowStockAlerts = (updatedProducts: Product[], previousProducts: Product[]) => {
    updatedProducts.forEach(newP => {
      const oldP = previousProducts.find(p => p.id === newP.id);
      if (oldP && newP.stock <= newP.minStock && oldP.stock > newP.minStock) {
        sendTelegramNotification(`🔔 КРИТИЧЕСКИЙ ОСТАТОК:\n\nТовар: ${newP.name}\nОсталось: ${newP.stock} ${newP.unit}\nМинимум: ${newP.minStock} ${newP.unit}`);
      }
    });
  };

  const handleAddTransaction = async (
    cart: CartItem[],
    paymentMethod: 'CASH' | 'CARD' | 'DEBT' | 'SPLIT',
    paidCash: number,
    paidCard: number,
    paidDebt: number,
    customerId?: string
  ) => {
    const saleId = `sale-${Math.floor(10000 + Math.random() * 90000)}`;
    const timestamp = new Date().toISOString();

    const itemsForSale = cart.map(item => ({
      productId: item.product.id,
      productName: item.product.name,
      quantity: item.quantity,
      priceBuy: item.product.priceBuy,
      priceSell: item.customPrice ?? item.product.priceSell,
      discountPercent: item.discountPercent
    }));

    const totalBeforeDiscount = cart.reduce((sum, item) => sum + ((item.customPrice ?? item.product.priceSell) * item.quantity), 0);
    const client = customers.find(c => c.id === customerId);
    const clientDiscPercent = client ? client.discountPercent : 0;

    const totalDiscount = cart.reduce((sum, item) => {
      const currentPrice = item.customPrice ?? item.product.priceSell;
      const itemDisc = (currentPrice * item.quantity) * (item.discountPercent / 100);
      const custBonus = ((currentPrice * item.quantity) - itemDisc) * (clientDiscPercent / 100);
      return sum + itemDisc + custBonus;
    }, 0);

    const finalPrice = Math.max(0, Math.round(totalBeforeDiscount - totalDiscount));
    const totalPriceBuy = cart.reduce((sum, item) => sum + (item.product.priceBuy * item.quantity), 0);

    const newSale: SaleTransaction = {
      id: saleId,
      timestamp,
      cashierName: currentName,
      items: itemsForSale,
      totalPriceBuy,
      totalBeforeDiscount,
      totalDiscount,
      finalPrice,
      paymentMethod,
      paidCash,
      paidCard,
      paidDebt,
      customerId,
      synced: isOnline
    };

    if (isOnline) {
      await api.sales.checkout({ ...newSale });
      queryClient.invalidateQueries({ queryKey: ['sales'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      queryClient.invalidateQueries({ queryKey: ['auditLogs'] });
      queryClient.invalidateQueries({ queryKey: ['correctionLogs'] });
    } else {
      const newTask: SyncTask = {
        id: `task-${Math.floor(1000 + Math.random() * 9000)}`,
        type: 'SALE_TRANSACTION',
        payload: { ...newSale, synced: false },
        timestamp,
        status: 'PENDING'
      };
      setSyncQueue(prev => [...prev, newTask]);
      setSyncLogs(prev => [
        ...prev,
        `[ОФЛАЙН] Создан локальный чек #${saleId.split('-').pop()?.toUpperCase() || saleId.toUpperCase()}. Пакет добавлен в буфер.`
      ]);
    }
    return newSale;
  };

  const handleAddDebtPayment = async (customerId: string, amount: number, method: 'CASH' | 'CARD') => {
    const timestamp = new Date().toISOString();
    const customerName = customers.find(c => c.id === customerId)?.name || 'Неизвестный клиент';

    const newPayment: DebtPayment = {
      id: `pay-${Math.floor(10000 + Math.random() * 90000)}`,
      customerId,
      customerName,
      amount,
      paymentMethod: method,
      timestamp,
      synced: isOnline
    };

    if (isOnline) {
      await api.debtPayments.create({ ...newPayment });
      queryClient.invalidateQueries({ queryKey: ['debtPayments'] });
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      queryClient.invalidateQueries({ queryKey: ['auditLogs'] });
    } else {
      const newTask: SyncTask = {
        id: `task-${Math.floor(1000 + Math.random() * 9000)}`,
        type: 'DEBT_PAYMENT',
        payload: newPayment,
        timestamp,
        status: 'PENDING'
      };
      setSyncQueue(prev => [...prev, newTask]);
      setSyncLogs(prev => [
        ...prev,
        `[ОФЛАЙН] Внесено погашение долга от '${customerName}' на ${amount} руб. Добавлено в очередь.`
      ]);
    }
  };

  const handleUpdateProduct = async (updatedProduct: Product) => {
    await api.products.update(updatedProduct.id, updatedProduct);
    queryClient.invalidateQueries({ queryKey: ['products'] });
    queryClient.invalidateQueries({ queryKey: ['auditLogs'] });
  };

  const handleCorrectStock = async (
    productId: string,
    newStock: number,
    type: 'INVENTORY_COUNT' | 'DAMAGE' | 'RESTOCK' | 'CORRECTION' | 'SALE',
    notes?: string
  ) => {
    const product = products.find(p => p.id === productId);
    if (!product) return;

    const oldStock = product.stock;
    const delta = newStock - oldStock;

    if (type === 'SALE' && newStock < oldStock) {
      const soldQty = oldStock - newStock;
      const saleId = `sale-rev-${Math.floor(1000 + Math.random() * 9000)}`;
      await api.sales.checkout({
        id: saleId,
        cashierName: `${roleDisplay} ${currentName} (Ревизия)`,
        items: [{
          productId: product.id,
          productName: product.name,
          quantity: soldQty,
          priceBuy: product.priceBuy,
          priceSell: product.priceSell,
          discountPercent: 0
        }],
        totalPriceBuy: product.priceBuy * soldQty,
        totalBeforeDiscount: product.priceSell * soldQty,
        totalDiscount: 0,
        finalPrice: product.priceSell * soldQty,
        paymentMethod: 'CASH',
        paidCash: product.priceSell * soldQty,
        paidCard: 0,
        paidDebt: 0
      });
    } else {
      await api.products.adjustStock(productId, delta, type, notes, currentName);
    }

    queryClient.invalidateQueries({ queryKey: ['products'] });
    queryClient.invalidateQueries({ queryKey: ['correctionLogs'] });
    queryClient.invalidateQueries({ queryKey: ['auditLogs'] });
  };

  const handleAddCustomer = async (custData: Omit<Customer, 'id' | 'debt'>) => {
    await api.customers.create({ ...custData, debt: 0 });
    queryClient.invalidateQueries({ queryKey: ['customers'] });
    queryClient.invalidateQueries({ queryKey: ['auditLogs'] });
  };

  const handleUpdateCustomer = async (updatedCustomer: Customer) => {
    await api.customers.update(updatedCustomer.id, updatedCustomer);
    queryClient.invalidateQueries({ queryKey: ['customers'] });
  };

  const handleDeleteCustomer = async (id: string) => {
    await api.customers.delete(id);
    queryClient.invalidateQueries({ queryKey: ['customers'] });
    queryClient.invalidateQueries({ queryKey: ['auditLogs'] });
  };

  const handleAddSupplier = async (supData: Omit<Supplier, 'id' | 'debt'>) => {
    await api.suppliers.create({ ...supData, debt: 0 });
    queryClient.invalidateQueries({ queryKey: ['suppliers'] });
    queryClient.invalidateQueries({ queryKey: ['auditLogs'] });
  };

  const handleUpdateSupplier = async (updatedSupplier: Supplier) => {
    await api.suppliers.update(updatedSupplier.id, updatedSupplier);
    queryClient.invalidateQueries({ queryKey: ['suppliers'] });
  };

  const handleDeleteSupplier = async (id: string) => {
    await api.suppliers.delete(id);
    queryClient.invalidateQueries({ queryKey: ['suppliers'] });
    queryClient.invalidateQueries({ queryKey: ['auditLogs'] });
  };

  const handleInteractivelyAddCategory = (name: string, skuPrefix?: string): Category | null => {
    const trimmed = name.trim();
    if (!trimmed) return null;
    if (categories.some(c => c.name.toLowerCase() === trimmed.toLowerCase())) {
      alert('Ошибка: Категория с таким наименованием уже присутствует в базе!');
      return null;
    }
    const prefix = (skuPrefix || trimmed.slice(0, 2)).toUpperCase().replace(/[^A-ZА-Я0-9]/g, '') || 'CAT';

    const tempId = `cat-${Math.floor(1000 + Math.random() * 9000)}`;
    const newCat: Category = { id: tempId, name: trimmed, skuPrefix: prefix };

    api.categories.create({ name: trimmed, skuPrefix: prefix }).then(() => {
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      queryClient.invalidateQueries({ queryKey: ['auditLogs'] });
    }).catch(err => {
      console.error("Failed to add category asynchronously:", err);
    });

    return newCat;
  };

  const handleEditCategory = async (id: string, newName: string, newPrefix?: string) => {
    const oldCat = categories.find(c => c.id === id);
    if (!oldCat) return;
    const trimmed = newName.trim();
    if (!trimmed) return;

    const finalPrefix = newPrefix ? newPrefix.trim().toUpperCase() : (oldCat.skuPrefix || trimmed.slice(0, 2).toUpperCase());
    await api.categories.update(id, { name: trimmed, skuPrefix: finalPrefix });

    queryClient.invalidateQueries({ queryKey: ['categories'] });
    queryClient.invalidateQueries({ queryKey: ['products'] });
    queryClient.invalidateQueries({ queryKey: ['auditLogs'] });
  };

  const handleDeleteCategory = async (id: string) => {
    await api.categories.delete(id);
    queryClient.invalidateQueries({ queryKey: ['categories'] });
    queryClient.invalidateQueries({ queryKey: ['products'] });
    queryClient.invalidateQueries({ queryKey: ['auditLogs'] });
  };

  const handleDeleteProduct = async (id: string) => {
    await api.products.delete(id);
    queryClient.invalidateQueries({ queryKey: ['products'] });
    queryClient.invalidateQueries({ queryKey: ['auditLogs'] });
  };

  const handleAddExpense = async (
    category: BusinessExpense['category'],
    amount: number,
    date: string,
    notes?: string
  ) => {
    await api.expenses.create({ category, amount, date, notes });
    queryClient.invalidateQueries({ queryKey: ['expenses'] });
    queryClient.invalidateQueries({ queryKey: ['auditLogs'] });
  };

  const handleUpdateExpense = async (
    id: string,
    category: BusinessExpense['category'],
    amount: number,
    date: string,
    notes?: string
  ) => {
    await api.expenses.delete(id);
    await api.expenses.create({ category, amount, date, notes });
    queryClient.invalidateQueries({ queryKey: ['expenses'] });
    queryClient.invalidateQueries({ queryKey: ['auditLogs'] });
  };

  const handleDeleteExpense = async (id: string) => {
    await api.expenses.delete(id);
    queryClient.invalidateQueries({ queryKey: ['expenses'] });
    queryClient.invalidateQueries({ queryKey: ['auditLogs'] });
  };

  const handleInteractivelyAddExpense = (
    category: BusinessExpense['category'],
    amount: number,
    notes?: string
  ) => {
    handleAddExpense(category, amount, new Date().toISOString().split('T')[0], notes);
  };

  const handleRestockFromSupplier = async (productId: string, quantity: number, priceBuy: number, supplierId: string, isCredit: boolean = true) => {
    await api.products.adjustStock(productId, quantity, 'RESTOCK', 'Закупка партии товара', 'Снабжение');
    const sup = suppliers.find(s => s.id === supplierId);
    if (sup) {
      if (isCredit) {
        await api.suppliers.update(supplierId, { debt: sup.debt + (quantity * priceBuy) });
      } else {
        // Paid cash: create business expense instead of increasing debt!
        await api.expenses.create({
          category: 'Закупка товара',
          amount: quantity * priceBuy,
          date: new Date().toISOString().split('T')[0],
          notes: `Наличный приход товара у поставщика ${sup.company} (${sup.name})`
        });
      }
    }
    queryClient.invalidateQueries({ queryKey: ['products'] });
    queryClient.invalidateQueries({ queryKey: ['suppliers'] });
    queryClient.invalidateQueries({ queryKey: ['expenses'] });
    queryClient.invalidateQueries({ queryKey: ['auditLogs'] });
    queryClient.invalidateQueries({ queryKey: ['correctionLogs'] });
  };

  const handleTriggerSync = async () => {
    if (!isOnline) {
      alert('Ошибка: Не удается синхронизировать! Сначала включите Интернет-соединение.');
      return;
    }

    if (syncQueue.length === 0) {
      alert('Справка: Локальная очередь пуста.');
      return;
    }

    setIsSyncing(true);
    setSyncLogs(prev => [...prev, 'ИНИЦИАЛИЗАЦИЯ ИНТЕГРАЦИИ С ОБЛАКОМ...', `Найдено пакетов к отправке: ${syncQueue.length}`]);

    try {
      const res = await api.sync.sessionSync(syncQueue);
      if (res.ok) {
        setSyncQueue([]);
        setIsSyncing(false);
        setSyncLogs(prev => [
          ...prev,
          '✅ ВСЕ ЛОКАЛЬНЫЕ ДАННЫЕ УСПЕШНО СИНХРОНИЗИРОВАНЫ!',
          'Складские остатки и начисления долгов скорректированы.'
        ]);
        queryClient.invalidateQueries();
      }
    } catch (e: any) {
      console.error('Offline sync failed:', e.message);
      setIsSyncing(false);
      alert(`Синхронизация завершилась с ошибкой: ${e.message}`);
    }
  };

  const handleClearQueue = () => {
    if (window.confirm('Внимание! Вы хотите безвозвратно стереть офлайн-очередь?')) {
      setSyncQueue([]);
      setSyncLogs(prev => [...prev, '⚠️ Локальная очередь очищена.']);
    }
  };

  const handleLogout = async () => {
    await api.auth.logout();
    setCurrentUserId(null);
    setJwtToken(null);
    setAuthenticatingEmployee(null);
    setEnteredPin('');
    setPinError('');
    setActiveTab('pos');
  };

  if (!currentUserId) {
    if (authenticatingEmployee) {
      const pinLength = 4;

      const handlePinKeyPress = (val: string) => {
        soundEngine.playClick();
        setPinError('');
        if (val === 'C') {
          setEnteredPin('');
        } else if (val === 'B') {
          setEnteredPin(prev => prev.slice(0, -1));
        } else {
          if (enteredPin.length < pinLength) {
            const newPin = enteredPin + val;
            setEnteredPin(newPin);

            if (newPin.length === pinLength) {
              api.auth.login(newPin, authenticatingEmployee.id).then((res) => {
                soundEngine.playAuthSuccess();
                setCurrentUserId(res.employee.id);
                setJwtToken(res.token);
                setAuthenticatingEmployee(null);
                setEnteredPin('');
                queryClient.invalidateQueries();
              }).catch(() => {
                soundEngine.playError();
                setPinError('Неверный ПИН-код!');
                setEnteredPin('');
              });
            }
          }
        }
      };

      return (
        <div className="min-h-screen bg-[#0F1115] font-sans text-slate-200 flex flex-col justify-center items-center py-12 px-4 selection:bg-sky-600 selection:text-white">
          <div className="max-w-md w-full bg-[#161920] border border-slate-800/80 p-8 rounded-3xl shadow-2xl relative overflow-hidden flex flex-col items-center">
            <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-blue-500 to-sky-500"></div>

            <button
              onClick={() => {
                setAuthenticatingEmployee(null);
                setEnteredPin('');
                setPinError('');
              }}
              className="self-start text-xs font-semibold text-slate-400 hover:text-white flex items-center gap-1.5 mb-6 transition"
            >
              ← Вернуться к выбору аккаунта
            </button>

            <div className="text-center space-y-3 mb-6">
              <div className="w-16 h-16 rounded-full bg-slate-800 flex items-center justify-center font-black text-2xl text-sky-450 border border-slate-700 mx-auto">
                {authenticatingEmployee.name.charAt(0)}
              </div>
              <div>
                <h2 className="text-lg font-black text-white">{authenticatingEmployee.name}</h2>
                <span className="text-[10px] text-sky-400 font-mono uppercase tracking-widest bg-sky-500/10 px-2.5 py-1 rounded-full border border-sky-500/20 inline-block mt-1">
                  {authenticatingEmployee.role === UserRole.OWNER && 'Владелец'}
                  {authenticatingEmployee.role === UserRole.ADMIN && 'Администратор'}
                  {authenticatingEmployee.role === UserRole.CASHIER && 'Кассир (POS)'}
                  {authenticatingEmployee.role === UserRole.WAREHOUSE && 'Кладовщик'}
                </span>
              </div>
            </div>

            <div className="space-y-2 mb-8 w-full text-center">
              <p className="text-[10px] uppercase font-bold text-slate-500 font-mono tracking-widest">Введите ПИН-код</p>
              <div className="flex justify-center gap-3 py-2">
                {Array.from({ length: pinLength }).map((_, idx) => (
                  <div
                    key={idx}
                    className={`w-3.5 h-3.5 rounded-full border border-slate-700 transition-all duration-150 ${idx < enteredPin.length
                        ? 'bg-sky-500 border-sky-400 scale-110 shadow-[0_0_8px_rgba(56,189,248,0.5)]'
                        : 'bg-transparent border-slate-700'
                      }`}
                  ></div>
                ))}
              </div>
              {pinError ? (
                <p className="text-xs text-rose-450 font-bold font-mono animate-bounce">{pinError}</p>
              ) : (
                <p className="text-xs text-slate-500 italic font-mono h-4">Вход защищен PIN-паролем</p>
              )}
            </div>

            <div className="grid grid-cols-3 gap-3 w-full max-w-[280px]">
              {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map(val => (
                <button
                  key={val}
                  onClick={() => handlePinKeyPress(val)}
                  className="h-14 rounded-2xl bg-[#1C1E26] hover:bg-[#252833] active:scale-95 border border-slate-800/80 text-lg font-black text-white transition-all font-mono"
                >
                  {val}
                </button>
              ))}
              <button
                onClick={() => handlePinKeyPress('C')}
                className="h-14 rounded-2xl bg-[#2D1F23]/50 hover:bg-rose-950/40 text-rose-400 active:scale-95 border border-rose-950 text-[10px] font-bold transition-all uppercase font-mono"
              >
                СБРОС
              </button>
              <button
                onClick={() => handlePinKeyPress('0')}
                className="h-14 rounded-2xl bg-[#1C1E26] hover:bg-[#252833] active:scale-95 border border-slate-800/80 text-lg font-black text-white transition-all font-mono"
              >
                0
              </button>
              <button
                onClick={() => handlePinKeyPress('B')}
                className="h-14 rounded-2xl bg-[#1D252E] hover:bg-sky-950/40 text-sky-400 active:scale-95 border border-sky-950 text-base font-bold transition-all flex items-center justify-center font-mono font-bold"
              >
                ←
              </button>
            </div>

            <div className="mt-8 text-center text-[10px] text-slate-600 font-mono">
              Вход защищен шифрованием и локальной сессией
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="min-h-screen bg-[#0F1115] font-sans text-slate-200 flex flex-col justify-center items-center py-12 px-4 selection:bg-sky-600 selection:text-white">
        <div className="max-w-md w-full bg-[#161920] border border-slate-800/80 p-8 rounded-3xl shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-blue-500 to-sky-500"></div>

          <div className="text-center space-y-4 mb-8">
            <div className="bg-sky-500/10 p-4 rounded-full inline-block">
              <Smartphone className="w-8 h-8 text-sky-400" />
            </div>
            <div>
              <h1 className="text-2xl font-black tracking-tight text-white">RVAD RetailOS</h1>
              <p className="text-slate-400 text-sm font-medium mt-1">Авторизация в системе</p>
            </div>
          </div>

          <div className="space-y-4">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-widest text-center font-mono">Выберите ваш аккаунт</p>
            <div className="grid grid-cols-1 gap-3">
              {activeEmployees.map(emp => (
                <button
                  key={emp.id}
                  onClick={() => {
                    setAuthenticatingEmployee(emp);
                    setEnteredPin('');
                    setPinError('');
                  }}
                  className="flex items-center justify-between p-4 rounded-xl border border-slate-700 bg-[#1C1E26] hover:bg-[#252833] hover:border-slate-500 transition-all group"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center font-black text-slate-300 border border-slate-700 group-hover:bg-sky-500 group-hover:text-white group-hover:border-sky-400 transition-colors">
                      {emp.name.charAt(0)}
                    </div>
                    <div className="text-left font-medium text-slate-200 group-hover:text-white transition-colors">
                      <div className="text-sm font-bold">{emp.name}</div>
                      <div className="text-[10px] text-sky-400 font-mono uppercase tracking-widest flex items-center gap-1.5">
                        <span>
                          {emp.role === UserRole.OWNER && 'Владелец'}
                          {emp.role === UserRole.ADMIN && 'Администратор'}
                          {emp.role === UserRole.CASHIER && 'Кассир (POS)'}
                          {emp.role === UserRole.WAREHOUSE && 'Кладовщик'}
                        </span>
                        <span className="text-[10px] text-slate-500 font-bold font-mono">🔑 PIN</span>
                      </div>
                    </div>
                  </div>
                  <Users className="w-4 h-4 text-slate-600 group-hover:text-sky-400 transition-colors" />
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen bg-[#0F1115] font-sans text-slate-200 flex flex-col antialiased selection:bg-blue-600 selection:text-white pb-10 theme-${currentTheme}`}>

      {/* 1. TOP NAV BAR */}
      <header className="sticky top-0 z-40 bg-[#0A0C10] text-slate-200 shadow-xl px-4 py-3 border-b border-slate-800/80">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Smartphone className="text-blue-400 w-5 h-5 shrink-0" />
            <div>
              <h1 className="text-sm font-black tracking-tight flex items-baseline gap-1">
                RVAD RetailOS <span className="text-[10px] font-bold text-blue-400 uppercase tracking-widest hidden sm:inline">Operating System</span>
              </h1>
              <p className="text-[9px] text-slate-500 font-medium font-mono">Управление продажами и складом</p>
            </div>
          </div>

          {/* Connection status and Role switches indicators */}
          <div className="flex items-center gap-4">
            {/* Net connection Toggler */}
            <button
              onClick={() => setIsOnline(!isOnline)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-bold transition ${isOnline
                  ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20 shadow-[0_0_8px_rgba(16,185,129,0.15)]'
                  : 'bg-rose-500/10 border-rose-500/20 text-rose-400 hover:bg-rose-500/20'
                }`}
            >
              {isOnline ? (
                <>
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span> Сеть: В сети
                </>
              ) : (
                <>
                  <span className="w-2 h-2 rounded-full bg-rose-500"></span> Сеть: Офлайн
                </>
              )}
            </button>

            {/* Current Session Role Level */}
            <div className="hidden md:flex items-center gap-1.5 bg-[#161920] px-3 py-1.5 rounded-xl border border-slate-800 text-xs">
              <span className="text-slate-500 font-medium">Роль:</span>
              <span className="font-bold text-blue-400 uppercase tracking-wider">
                {currentRole === UserRole.OWNER && 'Владелец'}
                {currentRole === UserRole.ADMIN && 'Администратор'}
                {currentRole === UserRole.CASHIER && 'Кассир (POS)'}
                {currentRole === UserRole.WAREHOUSE && 'Кладовщик'}
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* MORE MENU BOTTOM SHEET */}
      {mobileMenuOpen && (
        <div className="md:hidden fixed inset-0 z-[45] flex items-end justify-center bg-black/60 backdrop-blur-sm px-2 pb-20"
          onClick={() => setMobileMenuOpen(false)}>
          <div className="bg-[#0A0C10] w-full rounded-t-3xl p-5 pb-32 space-y-4 shadow-2xl border-t border-slate-800 max-h-[85vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}>
            <div className="w-12 h-1.5 bg-slate-700 rounded-full mx-auto mb-2" />

            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-black text-white px-1">Меню управления</h3>
              <button onClick={() => setMobileMenuOpen(false)} className="p-2 text-slate-500 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs mb-4">
              <button
                onClick={() => setIsOnline(!isOnline)}
                className={`flex items-center justify-center gap-1 py-3 rounded-2xl text-center font-bold ${isOnline ? 'bg-emerald-600/20 text-emerald-400 border border-emerald-500/30' : 'bg-rose-600/20 text-rose-400 border border-rose-500/30'
                  }`}
              >
                {isOnline ? 'Инет: Включен' : 'Инет: Отключен'}
              </button>
              <div className="bg-slate-800 py-3 rounded-2xl text-center font-bold text-indigo-400 border border-slate-700">
                {roleDisplay}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-2 text-sm font-medium">
              {/* PRIMARY MOBILE SECTIONS */}
              {(currentRole === UserRole.OWNER || currentRole === UserRole.ADMIN) && (
                <button
                  onClick={() => { setActiveTab('b3s'); setMobileMenuOpen(false); }}
                  className={`flex items-center p-4 rounded-2xl transition-all ${activeTab === 'b3s' ? 'bg-indigo-600 text-white font-bold shadow-lg shadow-indigo-900/20' : 'bg-[#161920] border border-slate-800 text-slate-300 shadow-sm'}`}
                >
                  <Clock className="w-5 h-5 mr-3 shrink-0 text-amber-400" />
                  <span>Закрытие смены / Аудит (B3S)</span>
                </button>
              )}

              {currentRole !== UserRole.CASHIER && (
                <button
                  onClick={() => { setActiveTab('deadstock'); setMobileMenuOpen(false); }}
                  className={`flex items-center p-4 rounded-2xl transition-all ${activeTab === 'deadstock' ? 'bg-indigo-600 text-white font-bold shadow-lg shadow-indigo-900/20' : 'bg-[#161920] border border-slate-800 text-slate-300 shadow-sm'}`}
                >
                  <Package className="w-5 h-5 mr-3 shrink-0 text-rose-400" />
                  <span>Мертвый Груз (AI Маркетинг)</span>
                </button>
              )}

              <div className="h-px bg-slate-800/50 my-1" />

              <button
                onClick={() => { setActiveTab('crm'); setMobileMenuOpen(false); }}
                className={`flex items-center p-4 rounded-2xl transition-all ${activeTab === 'crm' ? 'bg-indigo-600 text-white font-bold shadow-lg shadow-indigo-900/20' : 'bg-[#161920] border border-slate-800 text-slate-300 shadow-sm'}`}
              >
                <Users className="w-5 h-5 mr-3 shrink-0 text-emerald-400" />
                <span>Клиенты и Поставщики</span>
              </button>

              <button
                onClick={() => { setActiveTab('orders'); setMobileMenuOpen(false); }}
                className={`flex items-center p-4 rounded-2xl transition-all ${activeTab === 'orders' ? 'bg-indigo-600 text-white font-bold shadow-lg shadow-indigo-900/20' : 'bg-[#161920] border border-slate-800 text-slate-300 shadow-sm'}`}
              >
                <ShoppingBag className="w-5 h-5 mr-3 shrink-0 text-indigo-400" />
                <span>Заказы и Продажи</span>
              </button>

              {(currentRole === UserRole.OWNER || currentRole === UserRole.ADMIN) && (
                <>
                  <button
                    onClick={() => { setActiveTab('analytics'); setMobileMenuOpen(false); }}
                    className={`flex items-center p-4 rounded-2xl transition-all ${activeTab === 'analytics' ? 'bg-indigo-600 text-white font-bold shadow-lg shadow-indigo-900/20' : 'bg-[#161920] border border-slate-800 text-slate-300 shadow-sm'}`}
                  >
                    <TrendingUp className="w-5 h-5 mr-3 shrink-0 text-blue-400" />
                    <span>Фин. Аналитика</span>
                  </button>

                  <button
                    onClick={() => { setActiveTab('employees'); setMobileMenuOpen(false); }}
                    className={`flex items-center p-4 rounded-2xl transition-all ${activeTab === 'employees' ? 'bg-indigo-600 text-white font-bold shadow-lg shadow-indigo-900/20' : 'bg-[#161920] border border-slate-800 text-slate-300 shadow-sm'}`}
                  >
                    <Users className="w-5 h-5 mr-3 shrink-0 text-sky-400" />
                    <span>Сотрудники</span>
                  </button>

                  <button
                    onClick={() => { setActiveTab('expenses'); setMobileMenuOpen(false); }}
                    className={`flex items-center p-4 rounded-2xl transition-all ${activeTab === 'expenses' ? 'bg-indigo-600 text-white font-bold shadow-lg shadow-indigo-900/20' : 'bg-[#161920] border border-slate-800 text-slate-300 shadow-sm'}`}
                  >
                    <Receipt className="w-5 h-5 mr-3 shrink-0 text-indigo-400" />
                    <span>Учет расходов</span>
                  </button>

                  <button
                    onClick={() => { setActiveTab('admin'); setMobileMenuOpen(false); }}
                    className={`flex items-center p-4 rounded-2xl transition-all ${activeTab === 'admin' ? 'bg-indigo-600 text-white font-bold shadow-lg shadow-indigo-900/20' : 'bg-[#161920] border border-slate-800 text-slate-300 shadow-sm'}`}
                  >
                    <Shield className="w-5 h-5 mr-3 shrink-0 text-slate-400" />
                    <span>Системная Админка (Логи)</span>
                  </button>

                  <button
                    onClick={() => { setActiveTab('architecture'); setMobileMenuOpen(false); }}
                    className={`flex items-center p-4 rounded-2xl transition-all ${activeTab === 'architecture' ? 'bg-indigo-600 text-white font-bold shadow-lg shadow-indigo-900/20' : 'bg-[#161920] border border-slate-800 text-slate-300 shadow-sm'}`}
                  >
                    <Database className="w-5 h-5 mr-3 shrink-0 text-slate-500" />
                    <span>Спецификации БД</span>
                  </button>
                </>
              )}

              <button
                onClick={() => { setActiveTab('sync'); setMobileMenuOpen(false); }}
                className={`flex items-center p-4 rounded-2xl transition-all ${activeTab === 'sync' ? 'bg-indigo-600 text-white font-bold shadow-lg shadow-indigo-900/20' : 'bg-[#161920] border border-slate-800 text-slate-300 shadow-sm'}`}
              >
                <RefreshCw className="w-5 h-5 mr-3 shrink-0 text-blue-500" />
                <span>Синхронизация ({syncQueue.length})</span>
              </button>

              <div className="border-t border-slate-800/80 pt-4 mt-2 space-y-2.5">
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-500 font-mono tracking-widest block">Настройка темы</span>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  {Object.values(THEME_PRESETS).map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setCurrentTheme(t.id)}
                      className={`flex items-center gap-2 p-3 rounded-xl border text-[11px] font-bold transition-all text-left cursor-pointer ${currentTheme === t.id
                          ? 'bg-blue-600/15 border-blue-500 text-blue-400 shadow-md shadow-blue-900/20'
                          : 'bg-[#161920] border-slate-800/80 text-slate-400'
                        }`}
                    >
                      <span className={`w-3 h-3 rounded-full shrink-0 border border-slate-700/55 ${t.circleBg} ${t.circleBorder}`} />
                      <span className="truncate">{t.name}</span>
                    </button>
                  ))}
                </div>
              </div>

              <button
                onClick={handleLogout}
                className="mt-4 flex items-center justify-center gap-2 p-4 rounded-2xl text-rose-400 hover:bg-rose-900/30 font-bold transition border border-rose-900/50 w-full"
              >
                <LogOut className="w-5 h-5 shrink-0" />
                Выйти из системы
              </button>
            </div>
          </div>
        </div>
      )}

      {/* FIXED BOTTOM NAVIGATION BAR FOR MOBILE */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-[#0A0C10] border-t border-slate-800/80 pb-safe shadow-2xl px-2 py-1.5 flex items-center justify-between">
        <button
          onClick={() => { setActiveTab('pos'); setMobileMenuOpen(false); }}
          className={`flex flex-col items-center justify-center w-full py-2 rounded-xl transition ${activeTab === 'pos' ? 'text-blue-400 bg-blue-500/5' : 'text-slate-500'}`}
        >
          <Smartphone className="w-5 h-5 mb-1" />
          <span className="text-[10px] font-bold">Касса</span>
        </button>

        {currentRole !== UserRole.CASHIER && (
          <button
            onClick={() => { setActiveTab('inventory'); setMobileMenuOpen(false); }}
            className={`flex flex-col items-center justify-center w-full py-2 rounded-xl transition ${activeTab === 'inventory' ? 'text-blue-400 bg-blue-500/5' : 'text-slate-500'}`}
          >
            <Package className="w-5 h-5 mb-1" />
            <span className="text-[10px] font-bold">Склад</span>
          </button>
        )}

        {(currentRole === UserRole.OWNER || currentRole === UserRole.ADMIN) && (
          <button
            onClick={() => { setActiveTab('debt'); setMobileMenuOpen(false); }}
            className={`flex flex-col items-center justify-center w-full py-2 rounded-xl transition ${activeTab === 'debt' ? 'text-blue-400 bg-blue-500/5' : 'text-slate-500'}`}
          >
            <Sliders className="w-5 h-5 mb-1" />
            <span className="text-[10px] font-bold">Долги</span>
          </button>
        )}

        <button
          onClick={() => { setActiveTab('orders'); setMobileMenuOpen(false); }}
          className={`flex flex-col items-center justify-center w-full py-2 rounded-xl transition ${activeTab === 'orders' ? 'text-blue-400 bg-blue-500/5' : 'text-slate-500'}`}
        >
          <ShoppingBag className="w-5 h-5 mb-1" />
          <span className="text-[10px] font-bold">Заказы</span>
        </button>

        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className={`flex flex-col items-center justify-center w-full py-2 rounded-xl transition ${mobileMenuOpen ? 'text-indigo-400 bg-indigo-500/5' : 'text-slate-500'}`}
        >
          <Menu className="w-5 h-5 mb-1" />
          <span className="text-[10px] font-bold">Еще</span>
        </button>
      </nav>

      {/* 2. SUB-APP MASTER LAYOUT CONTAINER */}
      <div className="max-w-7xl mx-auto w-full px-4 mt-6 grid grid-cols-1 md:grid-cols-12 gap-6 flex-1 items-start pb-32 md:pb-8">

        {/* DESKTOP SIDEBAR NAVIGATION */}
        <aside className={`hidden md:block bg-[#0A0C10] rounded-2xl border border-slate-800/80 shadow-2xl space-y-1 transition-all duration-300 ${isSidebarCollapsed ? 'md:col-span-1 p-3' : 'md:col-span-3 p-5'
          }`}>
          <div className="flex items-center justify-between mb-3 px-1">
            {!isSidebarCollapsed && (
              <span className="text-[10px] uppercase font-bold text-slate-500 px-2 tracking-widest font-mono">Навигация ОС</span>
            )}
            <button
              onClick={toggleSidebar}
              className={`p-1.5 rounded-xl hover:bg-[#161920] text-slate-500 hover:text-slate-200 transition-colors ${isSidebarCollapsed ? 'mx-auto' : ''
                }`}
              title={isSidebarCollapsed ? "Развернуть меню" : "Свернуть меню"}
            >
              {isSidebarCollapsed ? (
                <ChevronRight className="w-4 h-4" />
              ) : (
                <ChevronLeft className="w-4 h-4" />
              )}
            </button>
          </div>

          <button
            onClick={() => setActiveTab('pos')}
            className={`w-full flex items-center rounded-xl text-xs font-bold transition-all ${isSidebarCollapsed
                ? 'justify-center p-2.5'
                : 'gap-2.5 px-3 py-2.5'
              } ${activeTab === 'pos'
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/45 font-black'
                : 'text-slate-400 hover:bg-[#161920] hover:text-slate-200'
              }`}
            title="POS Касса"
          >
            <Smartphone className="w-4.5 h-4.5 shrink-0" />
            {!isSidebarCollapsed && <span>POS Касса</span>}
          </button>

          <button
            onClick={() => setActiveTab('orders')}
            className={`w-full flex items-center rounded-xl text-xs font-bold transition-all ${isSidebarCollapsed
                ? 'justify-center p-2.5'
                : 'gap-2.5 px-3 py-2.5'
              } ${activeTab === 'orders'
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/45 font-black'
                : 'text-slate-400 hover:bg-[#161920] hover:text-slate-200'
              }`}
            title="Заказы и Продажи"
          >
            <ShoppingBag className="w-4.5 h-4.5 shrink-0" />
            {!isSidebarCollapsed && <span>Заказы и Продажи</span>}
          </button>

          {currentRole !== UserRole.CASHIER && (
            <button
              onClick={() => setActiveTab('inventory')}
              className={`w-full flex items-center rounded-xl text-xs font-bold transition-all ${isSidebarCollapsed
                  ? 'justify-center p-2.5'
                  : 'gap-2.5 px-3 py-2.5'
                } ${activeTab === 'inventory'
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/45 font-black'
                  : 'text-slate-400 hover:bg-[#161920] hover:text-slate-200'
                }`}
              title="Склад и Запасы"
            >
              <Package className="w-4.5 h-4.5 shrink-0" />
              {!isSidebarCollapsed && <span>Склад и Запасы</span>}
            </button>
          )}

          <button
            onClick={() => setActiveTab('crm')}
            className={`w-full flex items-center rounded-xl text-xs font-bold transition-all ${isSidebarCollapsed
                ? 'justify-center p-2.5'
                : 'gap-2.5 px-3 py-2.5'
              } ${activeTab === 'crm'
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/45 font-black'
                : 'text-slate-400 hover:bg-[#161920] hover:text-slate-200'
              }`}
            title="CRM & Поставщики"
          >
            <Users className="w-4.5 h-4.5 shrink-0" />
            {!isSidebarCollapsed && <span>CRM & Поставщики</span>}
          </button>

          {currentRole !== UserRole.CASHIER && (
            <button
              onClick={() => setActiveTab('deadstock')}
              className={`w-full flex items-center rounded-xl text-xs font-bold transition-all ${isSidebarCollapsed
                  ? 'justify-center p-2.5'
                  : 'gap-2.5 px-3 py-2.5'
                } ${activeTab === 'deadstock'
                  ? 'bg-amber-600 text-white shadow-lg shadow-amber-900/45 font-black'
                  : 'text-slate-400 hover:bg-[#161920] hover:text-slate-200'
                }`}
              title="Мертвый Груз"
            >
              <Package className="w-4.5 h-4.5 shrink-0" />
              {!isSidebarCollapsed && <span>Мертвый Груз</span>}
            </button>
          )}

          {(currentRole === UserRole.OWNER || currentRole === UserRole.ADMIN) && (
            <>
              <button
                onClick={() => setActiveTab('debt')}
                className={`w-full flex items-center rounded-xl text-xs font-bold transition-all ${isSidebarCollapsed
                    ? 'justify-center p-2.5'
                    : 'gap-2.5 px-3 py-2.5'
                  } ${activeTab === 'debt'
                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/45 font-black'
                    : 'text-slate-400 hover:bg-[#161920] hover:text-slate-200'
                  }`}
                title="Долги"
              >
                <Sliders className="w-4.5 h-4.5 shrink-0" />
                {!isSidebarCollapsed && <span>Долги</span>}
              </button>

              <button
                onClick={() => setActiveTab('employees')}
                className={`w-full flex items-center rounded-xl text-xs font-bold transition-all ${isSidebarCollapsed
                    ? 'justify-center p-2.5'
                    : 'gap-2.5 px-3 py-2.5'
                  } ${activeTab === 'employees'
                    ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-900/45 font-black'
                    : 'text-slate-400 hover:bg-[#161920] hover:text-slate-200'
                  }`}
                title="Сотрудники"
              >
                <Users className="w-4.5 h-4.5 shrink-0" />
                {!isSidebarCollapsed && <span>Сотрудники</span>}
              </button>

              <button
                onClick={() => setActiveTab('b3s')}
                className={`w-full flex items-center rounded-xl text-xs font-bold transition-all ${isSidebarCollapsed
                    ? 'justify-center p-2.5'
                    : 'gap-2.5 px-3 py-2.5'
                  } ${activeTab === 'b3s'
                    ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-900/45 font-black'
                    : 'text-slate-400 hover:bg-[#161920] hover:text-slate-200'
                  }`}
                title="Закрытие смены / Аудит"
              >
                <Clock className="w-4.5 h-4.5 shrink-0" />
                {!isSidebarCollapsed && <span>Закрытие смены / Аудит</span>}
              </button>
            </>
          )}

          {(currentRole === UserRole.OWNER || currentRole === UserRole.ADMIN) && (
            <button
              onClick={() => setActiveTab('expenses')}
              className={`w-full flex items-center rounded-xl text-xs font-bold transition-all ${isSidebarCollapsed
                  ? 'justify-center p-2.5'
                  : 'gap-2.5 px-3 py-2.5'
                } ${activeTab === 'expenses'
                  ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-900/45 font-black'
                  : 'text-slate-400 hover:bg-[#161920] hover:text-slate-200'
                }`}
              title="Учет расходов"
            >
              <Receipt className="w-4.5 h-4.5 shrink-0" />
              {!isSidebarCollapsed && <span>Учет расходов</span>}
            </button>
          )}

          {currentRole !== UserRole.CASHIER && currentRole !== UserRole.WAREHOUSE && (
            <button
              onClick={() => setActiveTab('analytics')}
              className={`w-full flex items-center rounded-xl text-xs font-bold transition-all ${isSidebarCollapsed
                  ? 'justify-center p-2.5'
                  : 'gap-2.5 px-3 py-2.5'
                } ${activeTab === 'analytics'
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/45 font-black'
                  : 'text-slate-400 hover:bg-[#161920] hover:text-slate-200'
                }`}
              title="Фин. Аналитика"
            >
              <TrendingUp className="w-4.5 h-4.5 shrink-0" />
              {!isSidebarCollapsed && <span>Фин. Аналитика</span>}
            </button>
          )}

          <button
            onClick={() => setActiveTab('sync')}
            className={`w-full flex items-center rounded-xl text-xs font-bold transition-all relative ${isSidebarCollapsed
                ? 'justify-center p-2.5'
                : 'justify-between px-3 py-2.5'
              } ${activeTab === 'sync'
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/45 font-black'
                : 'text-slate-400 hover:bg-[#161920] hover:text-slate-200'
              }`}
            title="Синхронизация"
          >
            <span className={`flex items-center ${isSidebarCollapsed ? '' : 'gap-2.5'}`}>
              <RefreshCw className={`w-4.5 h-4.5 shrink-0 ${isSyncing ? 'animate-spin' : ''}`} />
              {!isSidebarCollapsed && <span>Синхронизация</span>}
            </span>
            {syncQueue.length > 0 && (
              <span className={`font-black rounded-full ${isSidebarCollapsed
                  ? 'absolute -top-1 -right-1 px-1.5 py-0.5 text-[8px] bg-rose-500 text-white shadow-sm z-10 border border-[#0A0C10]'
                  : `px-2 py-0.5 text-[10px] ${activeTab === 'sync' ? 'bg-white text-blue-700' : 'bg-rose-500 text-white animate-bounce'}`
                }`}>
                {syncQueue.length}
              </span>
            )}
          </button>

          {(currentRole === UserRole.OWNER || currentRole === UserRole.ADMIN) && (
            <>
              <button
                onClick={() => setActiveTab('admin')}
                className={`w-full flex items-center rounded-xl text-xs font-bold transition-all ${isSidebarCollapsed
                    ? 'justify-center p-2.5'
                    : 'gap-2.5 px-3 py-2.5'
                  } ${activeTab === 'admin'
                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/45 font-black'
                    : 'text-slate-400 hover:bg-[#161920] hover:text-slate-200'
                  }`}
                title="Админка / База"
              >
                <Shield className="w-4.5 h-4.5 shrink-0" />
                {!isSidebarCollapsed && <span>Админка / База</span>}
              </button>

              <button
                onClick={() => setActiveTab('architecture')}
                className={`w-full flex items-center rounded-xl text-xs font-bold transition-all ${isSidebarCollapsed
                    ? 'justify-center p-2.5'
                    : 'gap-2.5 px-3 py-2.5'
                  } ${activeTab === 'architecture'
                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/45 font-black'
                    : 'text-slate-400 hover:bg-[#161920] hover:text-slate-200'
                  }`}
                title="Архитектура SQL"
              >
                <Database className="w-4.5 h-4.5 shrink-0" />
                {!isSidebarCollapsed && <span>Архитектура SQL</span>}
              </button>
            </>
          )}

          {/* Настройка внешнего вида */}
          {!isSidebarCollapsed && (
            <div className="pt-4 mt-4 border-t border-slate-800/80 space-y-2.5">
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-500 font-mono tracking-widest block">Темы оформления</span>
              </div>

              <div className="grid grid-cols-2 gap-2">
                {Object.values(THEME_PRESETS).map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setCurrentTheme(t.id)}
                    className={`flex items-center gap-1.5 p-2 rounded-xl border text-[10px] font-bold transition-all text-left cursor-pointer ${currentTheme === t.id
                        ? 'bg-blue-600/15 border-blue-500 text-blue-400'
                        : 'bg-[#161920] border-slate-850 text-slate-400 hover:text-slate-200 hover:border-slate-700'
                      }`}
                  >
                    <span className={`w-3 h-3 rounded-full shrink-0 border border-slate-700/55 ${t.circleBg} ${t.circleBorder}`} />
                    <span className="truncate">{t.name}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {!isSidebarCollapsed && (
            <div className="pt-4 mt-4 border-t border-slate-800 text-[10px] text-slate-500 px-3 space-y-1 font-mono">
              <p>DB: postgresql://127.0.0.1</p>
              <p>Sync status: OK (ACID)</p>
              <p className="text-blue-400 font-bold hover:underline select-none pointer-events-none">Версия MVP 1.0.0</p>
            </div>
          )}

          <button
            onClick={handleLogout}
            className={`w-full mt-6 flex items-center justify-center rounded-lg text-rose-400 hover:bg-rose-900/30 font-bold transition border border-rose-900/50 ${isSidebarCollapsed ? 'p-2.5' : 'gap-2 p-3'
              }`}
            title="Выйти из аккаунта"
          >
            <LogOut className="w-5 h-5 shrink-0" />
            {!isSidebarCollapsed && <span>Выйти из аккаунта</span>}
          </button>
        </aside>

        {/* ACTIVE MODULE CONTAINER VIEW */}
        <main className={`transition-all space-y-6 ${isSidebarCollapsed ? 'md:col-span-11' : 'md:col-span-9'
          }`}>

          {/* Offline warning banner on screen */}
          {!isOnline && (
            <div className="bg-gradient-to-r from-red-900/40 via-orange-950/20 to-slate-900 border border-rose-500/35 text-slate-150 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-[0_0_20px_rgba(239,68,68,0.1)] text-xs animate-pulse">
              <div className="flex items-start gap-3">
                <WifiOff className="w-5.5 h-5.5 text-rose-500 shrink-0 mt-0.5 animate-bounce" />
                <div className="space-y-1">
                  <span className="font-extrabold uppercase tracking-wider text-rose-400 block text-[10.5px]">ВНИМАНИЕ: АКТИВИРОВАН АВТОНОМНЫЙ ОФЛАЙН-РЕЖИМ</span>
                  <p className="leading-relaxed text-slate-400">
                    Связь с торговой СУБД PostgreSQL временно отсутствует. Все пробитые на кассе чеки и взносы заносятся во внутренний буфер надежности. Складские остатки обновляются на месте.
                  </p>
                </div>
              </div>
              <div className="bg-rose-950/80 border border-rose-500/30 px-3 py-2 rounded-xl text-center shrink-0 w-full sm:w-auto">
                <span className="text-[10px] text-rose-300 font-mono block">НАКОПЛЕНО В БУФЕРЕ</span>
                <span className="text-lg font-black font-mono text-white block">{syncQueue.length} чеков</span>
                <span className="text-[9px] text-rose-400 font-medium font-mono">ожидают СУБД</span>
              </div>
            </div>
          )}

          {activeTab === 'pos' && (
            <POS
              products={products}
              customers={customers}
              sales={sales}
              cashierName={`${currentName} (${roleDisplay})`}
              onAddTransaction={handleAddTransaction}
            />
          )}

          {activeTab === 'orders' && (
            <Orders
              sales={sales}
              customers={customers}
              products={products}
            />
          )}

          {activeTab === 'inventory' && currentRole !== UserRole.CASHIER && (
            <Inventory
              products={products}
              categories={categories}
              suppliers={suppliers}
              correctionLogs={correctionLogs}
              sales={sales}
              employees={employees}
              onCorrectStock={handleCorrectStock}
              onUpdateProduct={handleUpdateProduct}
              onAddCategory={handleInteractivelyAddCategory}
              onEditCategory={handleEditCategory}
              onDeleteCategory={handleDeleteCategory}
              onDeleteProduct={handleDeleteProduct}
              onAddProduct={async (p) => {
                try {
                  await api.products.create(p);
                  queryClient.invalidateQueries({ queryKey: ['products'] });
                  addAuditLog('Товар внесен', `Кладовщик внес в каталог новый товар '${p.name}' со штрихкодом ${p.barcode}.`);
                } catch (err: any) {
                  alert(`Ошибка при внесении товара: ${err.message}`);
                }
              }}
            />
          )}

          {activeTab === 'debt' && (
            <DebtTracker
              customers={customers}
              debtPayments={debtPayments}
              onAddDebtPayment={handleAddDebtPayment}
              onUpdateCustomer={handleUpdateCustomer}
            />
          )}

          {activeTab === 'crm' && (
            <CRM
              customers={customers}
              suppliers={suppliers}
              products={products}
              sales={sales}
              debtPayments={debtPayments}
              expenses={expenses}
              correctionLogs={correctionLogs}
              onAddCustomer={handleAddCustomer}
              onUpdateCustomer={handleUpdateCustomer}
              onDeleteCustomer={handleDeleteCustomer}
              onAddSupplier={handleAddSupplier}
              onUpdateSupplier={handleUpdateSupplier}
              onDeleteSupplier={handleDeleteSupplier}
              onRestockFromSupplier={async (productId, qty, price, supplierId, isCredit) => {
                // If supplier debt is incremented automatically
                await handleRestockFromSupplier(productId, qty, price, supplierId, isCredit);
              }}
              onAddProduct={async (p: any) => {
                try {
                  const created = await api.products.create(p);
                  queryClient.invalidateQueries({ queryKey: ['products'] });
                  addAuditLog('Товар внесен из накладной', `Кладовщик импортировал товар '${p.name}' со штрихкодом ${p.barcode}.`);
                  return created;
                } catch (err: any) {
                  alert(`Ошибка при импорте товара: ${err.message}`);
                  throw err;
                }
              }}
              categories={categories}
              onAddCategory={handleInteractivelyAddCategory}
              onUpdateProduct={handleUpdateProduct}
            />
          )}

          {activeTab === 'employees' && (
            <Employees
              employees={employees}
              onAddEmployee={async (employee) => {
                try {
                  await api.employees.create(employee);
                  queryClient.invalidateQueries({ queryKey: ['employees'] });
                  addAuditLog('Сотрудник добавлен', `Добавлен новый сотрудник ${employee.name}.`);
                } catch (err: any) {
                  alert(`Ошибка добавления сотрудника: ${err.message}`);
                }
              }}
              onUpdateEmployee={async (employee) => {
                try {
                  await api.employees.update(employee.id, employee);
                  queryClient.invalidateQueries({ queryKey: ['employees'] });
                  addAuditLog('Сотрудник обновлен', `Обновлены данные сотрудника ${employee.name}.`);
                } catch (err: any) {
                  alert(`Ошибка обновления сотрудника: ${err.message}`);
                }
              }}
              onDeleteEmployee={async (id) => {
                const emp = employees.find(e => e.id === id);
                if (emp) {
                  // Protection: cannot delete the last owner
                  const owners = employees.filter(e => e.role === UserRole.OWNER);
                  if (emp.role === UserRole.OWNER && owners.length <= 1) {
                    setTelegramToast({
                      message: '🚨 Ошибка безопасности: В системе должен оставаться как минимум один Владелец!',
                      type: 'OFFLINE'
                    });
                    return;
                  }

                  try {
                    await api.employees.delete(id);
                    queryClient.invalidateQueries({ queryKey: ['employees'] });
                    addAuditLog('Сотрудник удален', `Удален сотрудник ${emp.name}.`, 'WARNING');

                    // Logout if deleting self
                    if (id === currentUserId) {
                      handleLogout();
                    }
                  } catch (err: any) {
                    alert(`Ошибка удаления сотрудника: ${err.message}`);
                  }
                }
              }}
            />
          )}

       
          {activeTab === 'deadstock' && (
            <DeadStock 
              products={products} 
              sales={sales} 
              onUpdateProduct={handleUpdateProduct} 
            />
          )}

          {activeTab === 'b3s' && (
            <ShiftAuditDashboard employees={employees} onCloseShift={handleCloseShift} />
          )}

          {activeTab === 'expenses' && currentRole !== UserRole.CASHIER && (
            <ExpensesManagement
              expenses={expenses}
              onAddExpense={handleAddExpense}
              onUpdateExpense={handleUpdateExpense}
              onDeleteExpense={handleDeleteExpense}
              currentRole={currentRole}
            />
          )}

          {activeTab === 'analytics' && currentRole !== UserRole.CASHIER && currentRole !== UserRole.WAREHOUSE && (
            <Analytics
              sales={sales}
              products={products}
              expenses={expenses}
              employees={employees}
              onAddExpense={handleInteractivelyAddExpense}
            />
          )}

          {activeTab === 'sync' && (
            <SyncManager
              isOnline={isOnline}
              setIsOnline={setIsOnline}
              syncQueue={syncQueue}
              isSyncing={isSyncing}
              syncLogs={syncLogs}
              onTriggerSync={handleTriggerSync}
              onClearQueue={handleClearQueue}
              products={products}
              sales={sales}
              customers={customers}
              employees={employees}
            />
          )}

          {activeTab === 'admin' && (
            <AdminPanel
              currentRole={currentRole}
              setCurrentRole={() => { }}
              auditLogs={auditLogs}
              products={products}
              categories={categories}
              customers={customers}
              suppliers={suppliers}
              sales={sales}
            />
          )}

          {activeTab === 'architecture' && (
            <ArchitectureHub />
          )}
        </main>
      </div>

      {telegramToast && (
        <div className="fixed bottom-6 right-6 max-w-sm z-[9999] animate-in slide-in-from-right-10 fade-in duration-300">
          <div className={`p-4 rounded-3xl border shadow-2xl flex gap-3 backdrop-blur-md ${telegramToast.type === 'ONLINE'
              ? 'bg-blue-600/90 border-blue-500 text-white'
              : 'bg-rose-600/95 border-rose-500 text-white'
            }`}>
            <span className="text-[13px] font-semibold leading-relaxed tracking-wide font-sans">{telegramToast.message}</span>
          </div>
        </div>
      )}
    </div>
  );
}

const queryClientInstance = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

export default function App() {
  return (
    <QueryClientProvider client={queryClientInstance}>
      <AppContent />
    </QueryClientProvider>
  );
}
