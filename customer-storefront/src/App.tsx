import React, { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Search, ShoppingCart, Plus, Minus, ArrowLeft, CheckCircle2, 
  ChevronRight, MapPin, CreditCard, Home, History as HistoryIcon, 
  User, Percent, MessageCircle, ChevronDown, Receipt, AlertCircle, 
  CheckCircle, Package, Volume2, VolumeX, Sparkles, X, ArrowUpDown, Bell, Info, ShieldCheck,
  Store, Compass, Map, Smartphone, Heart, LogOut, Lock, Phone, Key, Eye, EyeOff, Send, Star
} from 'lucide-react';
import { storefrontApi } from './api';
import { CartItem, Product, Category, Order, UserProfile } from './types';

// Web Audio API Sound Generator for rich, server-independent micro-interactions
const SoundEngine = {
  playTick: () => {
    try {
      const saved = localStorage.getItem('sound_enabled');
      if (saved === 'false') return;
      
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      
      osc.type = 'sine';
      osc.frequency.setValueAtTime(450, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(120, ctx.currentTime + 0.03);
      
      gain.gain.setValueAtTime(0.015, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.03);
      
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.03);
    } catch (e) {
      console.warn("Audio blocked by browser gesture constraints", e);
    }
  },
  
  playChime: () => {
    try {
      const saved = localStorage.getItem('sound_enabled');
      if (saved === 'false') return;
      
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const now = ctx.currentTime;
      
      // First high pitch bell - extremely soft & glass-like E5 (659Hz)
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(659.25, now);
      gain1.gain.setValueAtTime(0.012, now);
      gain1.gain.exponentialRampToValueAtTime(0.0001, now + 0.12);
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.start();
      osc1.stop(now + 0.12);

      // Second crisp harmonic - A5 (880Hz)
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(880.00, now + 0.04);
      gain2.gain.setValueAtTime(0.008, now + 0.04);
      gain2.gain.exponentialRampToValueAtTime(0.0001, now + 0.18);
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.start();
      osc2.stop(now + 0.18);
    } catch (e) {}
  },

  playSuccess: () => {
    try {
      const saved = localStorage.getItem('sound_enabled');
      if (saved === 'false') return;
      
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const now = ctx.currentTime;
      // Uplifting A Major chord: A4(440), C#5(554.37), E5(659.25), A5(880)
      const notes = [440, 554.37, 659.25, 880];
      
      notes.forEach((f, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(f, now + idx * 0.04);
        gain.gain.setValueAtTime(0.012 - (idx * 0.002), now + idx * 0.04);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + idx * 0.04 + 0.3);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(now + idx * 0.04 + 0.3);
      });
    } catch (e) {}
  }
};

// Premium Theme mapping options
export interface Toast {
  id: string;
  message: string;
  type: 'info' | 'success' | 'warning';
  orderId?: string;
}

export interface ThemeConfig {
  id: string;
  name: string;
  bodyClass: string;
  cardClass: string;
  headerClass: string;
  borderClass: string;
  textClass: string;
  mutedTextClass: string;
  accentBgClass: string;
  accentTextClass: string;
  accentHoverBgClass: string;
  accentLightBgClass: string;
  accentLightTextClass: string;
  pillSelectedClass: string;
  badgeBgClass: string;
  inputBgClass: string;
  cardHighlightClass: string;
  ringClass: string;
}

const THEMES: Record<string, ThemeConfig> = {
  emerald: {
    id: 'emerald',
    name: 'Изумрудный (Стекло)',
    bodyClass: 'bg-gradient-to-br from-[#d4f0df] via-[#e2f3e8] to-[#c1e8d1] min-h-screen',
    cardClass: 'bg-white/50 backdrop-blur-xl border-white/60 shadow-[0_8px_32px_0_rgba(15,159,110,0.05)]',
    headerClass: 'bg-white/60 backdrop-blur-xl border-b border-white/60',
    borderClass: 'border-white/60',
    textClass: 'text-[#192b20]',
    mutedTextClass: 'text-[#536e5f]',
    accentBgClass: 'bg-[#0f9f6e]',
    accentTextClass: 'text-white',
    accentHoverBgClass: 'hover:bg-[#0b8258]',
    accentLightBgClass: 'bg-white/60',
    accentLightTextClass: 'text-[#046c4e]',
    pillSelectedClass: 'bg-[#0f9f6e] text-white shadow-[0_4px_12px_rgba(15,159,110,0.3)]',
    badgeBgClass: 'bg-[#0f9f6e]',
    inputBgClass: 'bg-white/50 backdrop-blur-md border border-white/60 focus:bg-white/80',
    cardHighlightClass: 'bg-white/40',
    ringClass: 'focus:ring-[#0f9f6e]/30',
  },
  dark: {
    id: 'dark',
    name: 'Полночь (Стекло)',
    bodyClass: 'bg-gradient-to-br from-[#0f172a] via-[#1e1b4b] to-[#0f172a] min-h-screen text-white',
    cardClass: 'bg-[#1e1b4b]/30 backdrop-blur-xl border-white/10 shadow-[0_8px_32px_0_rgba(0,0,0,0.3)]',
    headerClass: 'bg-[#0f172a]/50 backdrop-blur-xl border-b border-white/10',
    borderClass: 'border-white/10',
    textClass: 'text-[#f1f5f9]',
    mutedTextClass: 'text-[#94a3b8]',
    accentBgClass: 'bg-[#8b5cf6]',
    accentTextClass: 'text-white',
    accentHoverBgClass: 'hover:bg-[#7c3aed]',
    accentLightBgClass: 'bg-white/10',
    accentLightTextClass: 'text-[#c084fc]',
    pillSelectedClass: 'bg-[#8b5cf6] text-white shadow-[0_4px_12px_rgba(139,92,246,0.3)]',
    badgeBgClass: 'bg-[#8b5cf6]',
    inputBgClass: 'bg-black/20 backdrop-blur-md border border-white/10 focus:bg-white/10 text-white',
    cardHighlightClass: 'bg-white/5',
    ringClass: 'focus:ring-[#8b5cf6]/40',
  },
  amber: {
    id: 'amber',
    name: 'Солнечный (Стекло)',
    bodyClass: 'bg-gradient-to-br from-[#fef0d6] via-[#fef7ec] to-[#fde5c0] min-h-screen',
    cardClass: 'bg-white/50 backdrop-blur-xl border-white/60 shadow-[0_8px_32px_0_rgba(245,108,16,0.05)]',
    headerClass: 'bg-white/60 backdrop-blur-xl border-b border-white/60',
    borderClass: 'border-white/60',
    textClass: 'text-[#451d05]',
    mutedTextClass: 'text-[#8c6542]',
    accentBgClass: 'bg-[#f56c10]',
    accentTextClass: 'text-white',
    accentHoverBgClass: 'hover:bg-[#d85805]',
    accentLightBgClass: 'bg-white/60',
    accentLightTextClass: 'text-[#b24707]',
    pillSelectedClass: 'bg-[#f56c10] text-white shadow-[0_4px_12px_rgba(245,108,16,0.3)]',
    badgeBgClass: 'bg-[#f56c10]',
    inputBgClass: 'bg-white/50 backdrop-blur-md border border-white/60 focus:bg-white/80',
    cardHighlightClass: 'bg-white/40',
    ringClass: 'focus:ring-[#f56c10]/30',
  },
  nordic: {
    id: 'nordic',
    name: 'Скандинавия (Стекло)',
    bodyClass: 'bg-gradient-to-br from-[#e2e8f0] via-[#f1f5f9] to-[#cbd5e1] min-h-screen',
    cardClass: 'bg-white/50 backdrop-blur-xl border-white/60 shadow-[0_8px_32px_0_rgba(15,23,42,0.05)]',
    headerClass: 'bg-white/60 backdrop-blur-xl border-b border-white/60',
    borderClass: 'border-white/60',
    textClass: 'text-[#0f172a]',
    mutedTextClass: 'text-[#64748b]',
    accentBgClass: 'bg-[#0f172a]',
    accentTextClass: 'text-white',
    accentHoverBgClass: 'hover:bg-[#1e293b]',
    accentLightBgClass: 'bg-white/60',
    accentLightTextClass: 'text-[#0f172a]',
    pillSelectedClass: 'bg-[#0f172a] text-white shadow-[0_4px_12px_rgba(15,23,42,0.3)]',
    badgeBgClass: 'bg-red-500',
    inputBgClass: 'bg-white/50 backdrop-blur-md border border-white/60 focus:bg-white/80',
    cardHighlightClass: 'bg-white/40',
    ringClass: 'focus:ring-gray-900/10',
  }
};

const formatPrice = (price: number) => {
  return new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB', maximumFractionDigits: 0 }).format(price);
};

export default function App() {
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(() => {
    const saved = localStorage.getItem('logged_in_user');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) {}
    }
    return null;
  });

  const [activeTab, setActiveTab] = useState<'catalog' | 'favorites' | 'cart' | 'history' | 'profile' | 'checkout' | 'success'>(() => {
    const saved = localStorage.getItem('storefront_active_tab');
    if (saved && ['catalog', 'favorites', 'cart', 'history', 'profile', 'checkout', 'success'].includes(saved)) {
      return saved as any;
    }
    return 'catalog';
  });

  useEffect(() => {
    localStorage.setItem('storefront_active_tab', activeTab);
  }, [activeTab]);

  const [cart, setCart] = useState<CartItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategoryId, setActiveCategoryId] = useState('all');
  
  // Favorites storage
  const [favorites, setFavorites] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('favorites_list');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Sync favorites
  useEffect(() => {
    localStorage.setItem('favorites_list', JSON.stringify(favorites));
  }, [favorites]);

  // Auth screen toggle sub-states
  const [authMode, setAuthMode] = useState<'login' | 'signup' | 'forgot'>('login');
  const [authName, setAuthName] = useState('');
  const [authPhone, setAuthPhone] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [forgotStep, setForgotStep] = useState<'phone' | 'code' | 'new_password'>('phone');
  const [authResetCode, setAuthResetCode] = useState('');
  const [tgResetLinked, setTgResetLinked] = useState(true);

  // Custom Dynamic Upgrades & Comfort Enhancements
  const [selectedThemeId, setSelectedThemeId] = useState<string>(() => {
    return localStorage.getItem('theme_id') || 'emerald';
  });
  const [soundEnabled, setSoundEnabled] = useState<boolean>(() => {
    const saved = localStorage.getItem('sound_enabled');
    return saved !== 'false';
  });
  
  const [sortBy, setSortBy] = useState<'default' | 'priceAsc' | 'priceDesc'>('default');
  const [quickArticleCode, setQuickArticleCode] = useState('');
  const [quickArticleQty, setQuickArticleQty] = useState(1);
  const [quickOrderNotice, setQuickOrderNotice] = useState<string | null>(null);
  const [promoBannerVisible, setPromoBannerVisible] = useState(true);
  
  // Custom states added for WH / wholesales adjustments
  const [isQuickOrderOpen, setIsQuickOrderOpen] = useState<boolean>(() => {
    return localStorage.getItem('quick_order_open') !== 'false';
  });
  
  const [telegramStatus, setTelegramStatus] = useState<'disconnected' | 'connecting' | 'connected'>(() => {
    const saved = localStorage.getItem('tg_status');
    if (saved) return saved as any;
    return 'disconnected';
  });
  
  const [isTgModalOpen, setIsTgModalOpen] = useState(false);
  const [quickViewProduct, setQuickViewProduct] = useState<Product | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [notifications, setNotifications] = useState<Toast[]>(() => {
    const welcomeDismissed = localStorage.getItem('welcome_notification_dismissed') === 'true';
    const saved = localStorage.getItem('storefront_notifications');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          if (welcomeDismissed) {
            return parsed.filter(n => n.id !== 'welcome');
          }
          return parsed;
        }
      } catch (e) {}
    }
    if (welcomeDismissed) {
      return [];
    }
    return [
      {
        id: 'welcome',
        message: 'Добро пожаловать в интернет-магазин «1000 Мелочей»! Здесь вы будете получать обновления по вашим заказам и скидкам.',
        type: 'info'
      }
    ];
  });
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [reviewRating, setReviewRating] = useState(0);
  const [reviewHoverRating, setReviewHoverRating] = useState(0);
  const [reviewText, setReviewText] = useState("");
  const [activeReviews, setActiveReviews] = useState<any[]>([]);
  const [isReconciliationOpen, setIsReconciliationOpen] = useState(false);
  const [reconciliationData, setReconciliationData] = useState<any[]>([]);
  const [isReconciliationLoading, setIsReconciliationLoading] = useState(false);
  const [historyFilter, setHistoryFilter] = useState<'all' | 'online' | 'pos'>('all');

  useEffect(() => {
    localStorage.setItem('storefront_notifications', JSON.stringify(notifications));
  }, [notifications]);

  const handleAddReview = async (productId: string) => {
    if (reviewRating === 0 || !reviewText.trim()) return;
    try {
      await storefrontApi.addReview(productId, reviewRating, reviewText);
      SoundEngine.playSuccess();
      setReviewText("");
      setReviewRating(0);
      const list = await storefrontApi.getReviews(productId);
      setActiveReviews(Array.isArray(list) ? list : []);
    } catch (err: any) {
      console.error("Failed to add review:", err);
      addToast("Не удалось отправить отзыв: " + err.message, "warning");
    }
  };

  const handleQuickView = async (product: Product) => {
    SoundEngine.playTick();
    setQuickViewProduct(product);
    setActiveReviews([]);
    try {
      const list = await storefrontApi.getReviews(product.id);
      setActiveReviews(Array.isArray(list) ? list : []);
    } catch (err) {
      console.error("Failed to load reviews:", err);
      setActiveReviews([]);
    }
  };

  const handleOpenReconciliation = async () => {
    SoundEngine.playChime();
    setIsReconciliationOpen(true);
    setIsReconciliationLoading(true);
    try {
      const data = await storefrontApi.getReconciliation();
      setReconciliationData(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Failed to load reconciliation data:", err);
      setReconciliationData([]);
    } finally {
      setIsReconciliationLoading(false);
    }
  };
  const [catalogFilter, setCatalogFilter] = useState<'all' | 'packaging_unit' | 'single_unit' | 'special_price' | 'promo'>('all');
  
  // Integration Logs corresponding to the trading ERP/system payload posts
  const [systemLogs, setSystemLogs] = useState<string[]>(() => {
    return [
      `[${new Date().toLocaleTimeString('ru-RU')}] Инициализация интеграции с системой учета "1000 Мелочей"...`,
      `[${new Date().toLocaleTimeString('ru-RU')}] База данных: Готова к синхронизации.`,
    ];
  });

  // GPS / Geolocation / Map Selector states
  const [isMapModalOpen, setIsMapModalOpen] = useState(false);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [gpsCoords, setGpsCoords] = useState<{lat: number, lng: number} | null>(null);
  const [gpsAccuracy, setGpsAccuracy] = useState<number | null>(null);
  const [selectedMapPoint, setSelectedMapPoint] = useState<{lat: number, lng: number; label: string}>({
    lat: 55.7558,
    lng: 37.6173,
    label: "Центр (Пресненская наб., д. 10)"
  });

  // ── Real product & category data loaded from Rvad retail API ───────────────
  const [productsData, setProductsData] = useState<Product[]>([]);
  const [categoriesData, setCategoriesData] = useState<Category[]>([{ id: 'all', name: 'Все товары' }]);
  const [isLoadingProducts, setIsLoadingProducts] = useState(true);

  const [orderType, setOrderType] = useState<'delivery' | 'pickup'>('delivery');
  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'CARD' | 'DEBT'>('CASH');
  const [customerInfo, setCustomerInfo] = useState({ name: '', phone: '', address: '', comment: '' });
  const [orderNumber, setOrderNumber] = useState('');
  const [expandedOrders, setExpandedOrders] = useState<Record<string, boolean>>({});
  const [ordersList, setOrdersList] = useState<Order[]>([]);

  // Sync customerInfo when currentUser is changed
  useEffect(() => {
    if (currentUser) {
      setCustomerInfo(prev => ({
        ...prev,
        name: currentUser.name,
        phone: currentUser.phone
      }));
    }
  }, [currentUser]);

  // ── Load catalog (products + categories) from Rvad retail API ────────────
  useEffect(() => {
    const loadCatalog = async () => {
      try {
        setIsLoadingProducts(true);
        const [prods, cats] = await Promise.all([
          storefrontApi.getProducts(),
          storefrontApi.getCategories(),
        ]);

        // Map server product format to storefront Product type
        const mapped: Product[] = prods.map((p: any) => {
          const matchedCat = cats.find((c: any) => c.name === p.category);
          return {
            id: p.id,
            name: p.name,
            price: p.priceSell,
            image: p.imageUrl || `https://placehold.co/400x300/f1f5f9/64748b?text=${encodeURIComponent(p.name)}`,
            categoryId: matchedCat ? matchedCat.id : 'all',
            unit: p.unit,
            article: p.sku,
            rating: 4.8,
            ratingCount: 12,
            isPromo: p.isPromo,
            promoLabel: p.promoLabel,
            originalPrice: p.originalPriceSell,
          };
        });

        const mappedCats: Category[] = [
          { id: 'all', name: 'Все товары' },
          ...cats.map((c: any) => ({ id: c.id, name: c.name })),
        ];

        setProductsData(mapped);
        setCategoriesData(mappedCats);

        const time = new Date().toLocaleTimeString('ru-RU');
        setSystemLogs(prev => [
          `[${time}] [API] Каталог загружен: ${mapped.length} товаров, ${cats.length} категорий.`,
          ...prev,
        ]);
      } catch (err: any) {
        console.error('Failed to load catalog:', err);
        const time = new Date().toLocaleTimeString('ru-RU');
        setSystemLogs(prev => [
          `[${time}] [API_ERROR] Не удалось загрузить каталог: ${err.message}`,
          ...prev,
        ]);
      } finally {
        setIsLoadingProducts(false);
      }
    };

    loadCatalog();
  }, []);

  // ── Load user profile from Rvad retail API ────────────────────────────────
  useEffect(() => {
    const loadProfile = async () => {
      const token = localStorage.getItem('storefront_token');
      if (!token) return;

      try {
        const result = await storefrontApi.getMe();
        const user: UserProfile = {
          id: result.customer.id,
          name: result.customer.name,
          phone: result.customer.phone,
          debt: result.customer.debt ?? 0,
          creditLimit: result.customer.debtLimit ?? 0,
          discountPercentage: result.customer.discountPercent ?? 0,
          telegramLinked: result.customer.telegramLinked ?? false,
        };
        localStorage.setItem('logged_in_user', JSON.stringify(user));
        setCurrentUser(user);
      } catch (err: any) {
        console.error('Failed to load profile on mount:', err);
      }
    };

    loadProfile();
  }, []);

  // Sync telegramStatus state with currentUser's linked status from backend
  useEffect(() => {
    if (currentUser) {
      setTelegramStatus(currentUser.telegramLinked ? 'connected' : 'disconnected');
    } else {
      setTelegramStatus('disconnected');
    }
  }, [currentUser?.telegramLinked]);

  // ── Load real order history when user logs in ────────────────────────────
  useEffect(() => {
    if (!currentUser) {
      setOrdersList([]);
      return;
    }

    const loadOrders = async () => {
      try {
        const orders = await storefrontApi.getOrders();
        const mapped: Order[] = orders.map((o: any) => ({
          id: o.id,
          date: new Date(o.timestamp).toLocaleString('ru-RU'),
          status: (o.status || 'processing') as Order['status'],
          total: o.finalPrice,
          cashierName: o.cashierName || '',
          orderType: o.orderType || o.order_type,
          deliveryAddress: o.deliveryAddress || o.delivery_address,
          comment: o.comment,
          paymentMethod: o.paymentMethod || o.payment_method,
          items: (o.items || []).map((item: any) => ({
            id: item.productId,
            name: item.productName,
            price: item.priceSell,
            quantity: item.quantity,
          })),
        }));
        setOrdersList(mapped);
      } catch (err: any) {
        console.error('Failed to load orders:', err);
      }
    };

    loadOrders();
    const interval = setInterval(loadOrders, 3000);
    return () => clearInterval(interval);
  }, [currentUser?.id]);

  const t = THEMES[selectedThemeId] || THEMES.emerald;

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');

    // Forgot password flow with Telegram OTP code
    if (authMode === 'forgot') {
      if (forgotStep === 'phone') {
        if (!authPhone.trim()) {
          setAuthError('Укажите мобильный телефон.');
          SoundEngine.playTick();
          return;
        }
        try {
          const res = await storefrontApi.requestReset(authPhone);
          setTgResetLinked(res.telegramLinked);
          setForgotStep('code');
          setAuthResetCode('');
          SoundEngine.playChime();
        } catch (err: any) {
          setAuthError(err.message || 'Ошибка отправки запроса сброса.');
          SoundEngine.playTick();
        }
        return;
      }
      if (forgotStep === 'code') {
        if (authResetCode.trim().length !== 4) {
          setAuthError('Код должен состоять из 4 цифр.');
          SoundEngine.playTick();
          return;
        }
        setForgotStep('new_password');
        setAuthPassword('');
        return;
      }
      if (forgotStep === 'new_password') {
        if (authPassword.length < 4) {
          setAuthError('Пароль должен содержать не менее 4 символов.');
          SoundEngine.playTick();
          return;
        }
        try {
          await storefrontApi.resetPassword(authPhone, authResetCode, authPassword);
          SoundEngine.playSuccess();
          const time = new Date().toLocaleTimeString('ru-RU');
          setSystemLogs(prev => [
            `[${time}] [AUTH] Пароль успешно сохранен в базе данных`,
            ...prev
          ]);
          setAuthMode('login');
          setAuthPassword('');
          setAuthResetCode('');
          setForgotStep('phone');
        } catch (err: any) {
          setAuthError(err.message || 'Не удалось обновить пароль.');
          SoundEngine.playTick();
        }
        return;
      }
    }

    if (!authPhone.trim()) {
      setAuthError('Укажите мобильный телефон.');
      SoundEngine.playTick();
      return;
    }

    if (authMode === 'signup' && !authName.trim()) {
      setAuthError('Укажите ваше имя.');
      SoundEngine.playTick();
      return;
    }

    if (authPassword.length < 4) {
      setAuthError('Пароль должен содержать не менее 4 символов.');
      SoundEngine.playTick();
      return;
    }

    // Real API call — register or login
    try {
      let result: any;
      if (authMode === 'signup') {
        result = await storefrontApi.register(authName, authPhone, authPassword);
      } else {
        result = await storefrontApi.login(authPhone, authPassword);
      }

      // Persist JWT and user profile
      localStorage.setItem('storefront_token', result.token);

      // Map server customer fields → storefront UserProfile shape
      const user: UserProfile = {
        id: result.customer.id,
        name: result.customer.name,
        phone: result.customer.phone,
        debt: result.customer.debt ?? 0,
        creditLimit: result.customer.debtLimit ?? 0,
        discountPercentage: result.customer.discountPercent ?? 0,
        telegramLinked: result.customer.telegramLinked ?? false,
      };

      localStorage.setItem('logged_in_user', JSON.stringify(user));
      setCurrentUser(user);

      SoundEngine.playSuccess();
      const time = new Date().toLocaleTimeString('ru-RU');
      setSystemLogs(prev => [
        `[${time}] [AUTH] ${authMode === 'signup' ? 'Регистрация' : 'Вход'} успешен. Клиент: ${user.name}`,
        ...prev
      ]);
    } catch (err: any) {
      SoundEngine.playTick();
      setAuthError(err.message || 'Ошибка авторизации.');
    }
  };

  const handleLogout = () => {
    SoundEngine.playTick();
    setCurrentUser(null);
    localStorage.removeItem('logged_in_user');
    localStorage.removeItem('storefront_token'); // Remove JWT on logout
    setActiveTab('catalog');
    
    const time = new Date().toLocaleTimeString('ru-RU');
    setSystemLogs(prev => [
      `[${time}] [LOG_OUT] Пользователь вышел из личного кабинета. Сессия закрыта.`,
      ...prev
    ]);
  };

  const renderAuthGate = () => {
    return (
      <div className={`min-h-[100dvh] w-full flex items-center justify-center p-4 transition-colors duration-300 relative overflow-hidden ${t.bodyClass}`}>
        {/* Global Abstract Background Blobs */}
        <div className="absolute top-[10%] left-[20%] w-[350px] h-[350px] bg-white/30 rounded-full blur-[100px] pointer-events-none z-0" />
        <div className="absolute bottom-[10%] right-[20%] w-[350px] h-[350px] bg-[#8b5cf6]/20 rounded-full blur-[120px] pointer-events-none z-0" />
        <div className="absolute top-[40%] left-[60%] w-[250px] h-[250px] bg-blue-400/20 rounded-full blur-[90px] pointer-events-none z-0" />

        <motion.div 
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className={`w-full max-w-sm rounded-[2rem] p-6 md:p-8 border shadow-[0_32px_64px_-16px_rgba(0,0,0,0.1)] space-y-6 ${t.cardClass} relative z-10`}
        >
          <div className="text-center space-y-2">
            <div className={`w-12 h-12 rounded-[1.25rem] flex items-center justify-center text-white mx-auto shadow-sm ${t.accentBgClass}`}>
              <Sparkles className="w-6 h-6 text-yellow-300 fill-yellow-300" />
            </div>
            <h1 className={`text-2xl font-black tracking-tight ${t.textClass}`}>1000 Мелочей</h1>
          </div>

          {/* Tab Selection */}
          {authMode !== 'forgot' && (
            <div className="flex border-b border-black/10 dark:border-white/10 select-none">
              <button
                type="button"
                onClick={() => { SoundEngine.playTick(); setAuthMode('login'); setAuthError(''); }}
                className={`flex-1 py-3 text-xs font-black uppercase tracking-wider transition-all cursor-pointer border-b-2 ${authMode === 'login' ? `border-gray-800 dark:border-white shadow-none ${t.textClass}` : `border-transparent ${t.mutedTextClass} hover:opacity-100`}`}
              >
                Вход
              </button>
              <button
                type="button"
                onClick={() => { SoundEngine.playTick(); setAuthMode('signup'); setAuthError(''); }}
                className={`flex-1 py-3 text-xs font-black uppercase tracking-wider transition-all cursor-pointer border-b-2 ${authMode === 'signup' ? `border-gray-800 dark:border-white shadow-none ${t.textClass}` : `border-transparent ${t.mutedTextClass} hover:opacity-100`}`}
              >
                Регистрация
              </button>
            </div>
          )}

          <form onSubmit={handleAuthSubmit} className="space-y-4">
            {authError && (
              <div className="p-3.5 rounded-xl bg-red-50 dark:bg-red-950/10 border border-red-100 dark:border-red-900/45 text-xs text-red-600 dark:text-red-400 font-semibold flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{authError}</span>
              </div>
            )}

            {authMode === 'forgot' && forgotStep === 'phone' && (
              <div className="space-y-4">
                <div className="text-center text-sm font-semibold mb-2 space-y-1">
                  <p className={t.textClass}>Восстановление пароля</p>
                  <p className={`text-xs ${t.mutedTextClass}`}>
                    Укажите ваш контактный телефон для сброса пароля.
                  </p>
                </div>
                <div className="space-y-1.5">
                  <label className={`block text-[10px] font-black uppercase tracking-wider ${t.mutedTextClass}`}>Контактный телефон</label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">
                      <Phone className="w-4 h-4" />
                    </span>
                    <input
                      type="tel"
                      value={authPhone}
                      onChange={e => setAuthPhone(e.target.value)}
                      placeholder="+7 (999) 000-00-00"
                      className={`w-full pl-10 pr-4 py-3 rounded-2xl border border-black/10 dark:border-white/10 outline-none font-medium text-sm transition-all focus:ring-2 ${t.ringClass} ${t.inputBgClass} ${t.textClass}`}
                      required
                    />
                  </div>
                </div>
                <button
                  type="submit"
                  className={`w-full font-black text-xs uppercase tracking-widest rounded-2xl py-4 transition-all flex items-center justify-center gap-2 active:scale-[0.98] mt-6 cursor-pointer text-white shadow-sm ${t.accentBgClass} ${t.accentHoverBgClass}`}
                >
                  Продолжить
                </button>
                <div className="text-center pt-2">
                  <button type="button" onClick={() => setAuthMode('login')} className={`text-[10px] font-black uppercase tracking-wider ${t.mutedTextClass} hover:opacity-100 transition-opacity cursor-pointer`}>Назад ко входу</button>
                </div>
              </div>
            )}

            {authMode === 'forgot' && forgotStep === 'code' && (
              <div className="space-y-4">
                <div className="text-center text-sm font-semibold mb-2 space-y-1">
                  <p className={t.textClass}>Код подтверждения</p>
                  <p className={`text-xs ${t.mutedTextClass}`}>
                    Мы отправили код подтверждения в наш Telegram-бот.
                  </p>
                </div>
                
                {!tgResetLinked && (
                  <div className="p-3.5 rounded-2xl bg-amber-500/5 dark:bg-amber-500/10 border border-amber-500/20 text-xs text-amber-600 dark:text-amber-400 font-semibold space-y-2">
                    <p>Ваш Telegram не привязан к системе.</p>
                    <p className="font-normal text-[11px] leading-relaxed">
                      Пожалуйста, перейдите в наш Telegram-бот, нажмите кнопку <b>СТАРТ</b> (для привязки телефона), после чего бот вышлет вам код сброса пароля:
                    </p>
                    <a
                      href={`https://t.me/melochey_control_bot?start=reset_${authPhone.replace(/\D/g, '')}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#039be5] text-white rounded-xl text-xs font-bold hover:bg-[#0288d1] transition-all cursor-pointer"
                    >
                      🚀 Открыть бота и привязать
                    </a>
                  </div>
                )}

                <div className="space-y-1.5">
                  <label className={`block text-[10px] font-black uppercase tracking-wider ${t.mutedTextClass}`}>Код из Telegram</label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">
                      <Lock className="w-4 h-4" />
                    </span>
                    <input
                      type="text"
                      maxLength={4}
                      value={authResetCode}
                      onChange={e => setAuthResetCode(e.target.value.replace(/\D/g, ''))}
                      placeholder="0000"
                      className={`w-full pl-10 pr-4 py-3 rounded-2xl border border-black/10 dark:border-white/10 outline-none font-mono text-center font-bold text-lg tracking-widest transition-all focus:ring-2 ${t.ringClass} ${t.inputBgClass} ${t.textClass}`}
                      required
                    />
                  </div>
                </div>
                <button
                  type="submit"
                  className={`w-full font-black text-xs uppercase tracking-widest rounded-2xl py-4 transition-all flex items-center justify-center gap-2 active:scale-[0.98] mt-6 cursor-pointer text-white shadow-sm ${t.accentBgClass} ${t.accentHoverBgClass}`}
                >
                  Подтвердить код
                </button>
                <div className="text-center pt-2">
                  <button type="button" onClick={() => setForgotStep('phone')} className={`text-[10px] font-black uppercase tracking-wider ${t.mutedTextClass} hover:opacity-100 transition-opacity cursor-pointer`}>Назад к телефону</button>
                </div>
              </div>
            )}

            {authMode === 'forgot' && forgotStep === 'new_password' && (
              <div className="space-y-4">
                <div className="text-center text-sm font-semibold mb-2 space-y-1">
                  <p className={t.textClass}>Новый пароль</p>
                  <p className={`text-xs ${t.mutedTextClass}`}>
                    Придумайте новый надежный пароль.
                  </p>
                </div>
                <div className="space-y-1.5">
                  <label className={`block text-[10px] font-black uppercase tracking-wider ${t.mutedTextClass}`}>Новый пароль</label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">
                      <Lock className="w-4 h-4" />
                    </span>
                    <input
                      type={showPassword ? "text" : "password"}
                      value={authPassword}
                      onChange={e => setAuthPassword(e.target.value)}
                      placeholder="••••••••"
                      className={`w-full pl-10 pr-12 py-3 rounded-2xl border border-black/10 dark:border-white/10 outline-none font-medium text-sm transition-all focus:ring-2 ${t.ringClass} ${t.inputBgClass} ${t.textClass}`}
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 focus:outline-none cursor-pointer"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                <button
                  type="submit"
                  className={`w-full font-black text-xs uppercase tracking-widest rounded-2xl py-4 transition-all flex items-center justify-center gap-2 active:scale-[0.98] mt-6 cursor-pointer text-white shadow-sm ${t.accentBgClass} ${t.accentHoverBgClass}`}
                >
                  <CheckCircle className="w-4 h-4" />
                  Сохранить пароль
                </button>
              </div>
            )}

            {authMode !== 'forgot' && (
              <>
                {authMode === 'signup' && (
                  <div className="space-y-1.5">
                    <label className={`block text-[10px] font-black uppercase tracking-wider ${t.mutedTextClass}`}>Ваше имя</label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">
                        <User className="w-4 h-4" />
                      </span>
                      <input
                        type="text"
                        value={authName}
                        onChange={e => setAuthName(e.target.value)}
                        placeholder="Например, Иван Иванов"
                        className={`w-full pl-10 pr-4 py-3 rounded-2xl border border-black/10 dark:border-white/10 outline-none font-medium text-sm transition-all focus:ring-2 ${t.ringClass} ${t.inputBgClass} ${t.textClass}`}
                        required
                      />
                    </div>
                  </div>
                )}
                
                <div className="space-y-1.5">
                  <label className={`block text-[10px] font-black uppercase tracking-wider ${t.mutedTextClass}`}>Контактный телефон</label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">
                      <Phone className="w-4 h-4" />
                    </span>
                    <input
                      type="tel"
                      value={authPhone}
                      onChange={e => setAuthPhone(e.target.value)}
                      placeholder="+7 (999) 000-00-00"
                      className={`w-full pl-10 pr-4 py-3 rounded-2xl border border-black/10 dark:border-white/10 outline-none font-medium text-sm transition-all focus:ring-2 ${t.ringClass} ${t.inputBgClass} ${t.textClass}`}
                      required
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <div className="flex justify-between items-center">
                    <label className={`block text-[10px] font-black uppercase tracking-wider ${t.mutedTextClass}`}>Пароль доступа</label>
                    {authMode === 'login' && (
                      <button 
                        type="button"
                        onClick={() => { setAuthMode('forgot'); setAuthError(''); setAuthPassword(''); setAuthPhone(''); setForgotStep('phone'); }}
                        className={`text-[10px] font-bold ${t.mutedTextClass} hover:opacity-100 transition-opacity cursor-pointer`}
                      >
                        Забыли пароль?
                      </button>
                    )}
                  </div>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">
                      <Lock className="w-4 h-4" />
                    </span>
                    <input
                      type={showPassword ? "text" : "password"}
                      value={authPassword}
                      onChange={e => setAuthPassword(e.target.value)}
                      placeholder="••••••••"
                      className={`w-full pl-10 pr-12 py-3 rounded-2xl border border-black/10 dark:border-white/10 outline-none font-medium text-sm transition-all focus:ring-2 ${t.ringClass} ${t.inputBgClass} ${t.textClass}`}
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 focus:outline-none cursor-pointer"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  className={`w-full font-black text-xs uppercase tracking-widest rounded-2xl py-4 transition-all flex items-center justify-center gap-2 active:scale-[0.98] mt-6 cursor-pointer text-white shadow-sm ${t.accentBgClass} ${t.accentHoverBgClass}`}
                >
                  {authMode === 'signup' ? <Package className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
                  {authMode === 'signup' ? 'Зарегистрироваться' : 'Войти в профиль'}
                </button>
              </>
            )}
          </form>
        </motion.div>
      </div>
    );
  };

  // Sync quick order collapsible selection
  useEffect(() => {
    localStorage.setItem('quick_order_open', String(isQuickOrderOpen));
  }, [isQuickOrderOpen]);

  // Sync telegram status
  useEffect(() => {
    localStorage.setItem('tg_status', telegramStatus);
  }, [telegramStatus]);

  // Save selection states to localStorage
  useEffect(() => {
    localStorage.setItem('theme_id', selectedThemeId);
    
    // Dynamically apply background class to real browser body and html
    if (typeof document !== 'undefined') {
      const cleanClass = t.bodyClass;
      document.body.className = `transition-colors duration-300 ${cleanClass}`;
      document.documentElement.className = `transition-colors duration-300 ${cleanClass}`;
      
      // Clear explicit fallback overrides to allow tailwind gradients to work
      document.body.style.backgroundColor = '';
      document.documentElement.style.backgroundColor = '';
    }
  }, [selectedThemeId, t.bodyClass]);

  useEffect(() => {
    localStorage.setItem('sound_enabled', String(soundEnabled));
  }, [soundEnabled]);

  // Audio trigger utility wrapper
  const handleTabSwitch = (tab: any) => {
    SoundEngine.playTick();
    setActiveTab(tab);
    if (tab === 'catalog') {
      setCatalogFilter('all');
      setActiveCategoryId('all');
    }
  };

  const handleToggleSound = () => {
    const newVal = !soundEnabled;
    setSoundEnabled(newVal);
    localStorage.setItem('sound_enabled', String(newVal));
    if (newVal) {
      setTimeout(() => SoundEngine.playChime(), 100);
    }
  };

  const toggleFavorite = (productId: string) => {
    SoundEngine.playChime();
    setFavorites(prev => {
      if (prev.includes(productId)) {
        return prev.filter(id => id !== productId);
      } else {
        return [...prev, productId];
      }
    });
  };

  // Cart actions with crisp sounds
  const addToCart = (product: Product) => {
    SoundEngine.playChime();
    setCart(prev => {
      const existing = prev.find(item => item.id === product.id);
      if (existing) {
        return prev.map(item => item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item);
      }
      return [...prev, { ...product, quantity: 1 }];
    });
  };

  const updateQuantity = (id: string, delta: number) => {
    SoundEngine.playTick();
    setCart(prev => prev.map(item => {
      if (item.id === id) {
        const newQ = item.quantity + delta;
        return { ...item, quantity: Math.max(0, newQ) };
      }
      return item;
    }).filter(item => item.quantity > 0));
  };

  const handleRepeatOrder = (order: Order) => {
    SoundEngine.playSuccess();
    setCart(prev => {
      let updated = [...prev];
      order.items.forEach(orderItem => {
        const prod = productsData.find(p => p.id === orderItem.id);
        if (prod) {
          const existing = updated.find(u => u.id === orderItem.id);
          if (existing) {
            existing.quantity += orderItem.quantity;
          } else {
            updated.push({ ...prod, quantity: orderItem.quantity });
          }
        }
      });
      return updated;
    });
    setQuickOrderNotice(`Товары из заказа ${order.id} добавлены в корзину!`);
    setActiveTab('cart');
    setTimeout(() => setQuickOrderNotice(null), 4000);
  };

  // Blitz Quick Order Form Logic
  const handleQuickOrderSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickArticleCode) return;

    const matchedProd = productsData.find(p => 
      p.article?.toLowerCase() === quickArticleCode.trim().toLowerCase()
    );

    if (matchedProd) {
      SoundEngine.playSuccess();
      setCart(prev => {
        const existing = prev.find(item => item.id === matchedProd.id);
        if (existing) {
          return prev.map(item => item.id === matchedProd.id ? { ...item, quantity: item.quantity + quickArticleQty } : item);
        }
        return [...prev, { ...matchedProd, quantity: quickArticleQty }];
      });
      setQuickOrderNotice(`Успешно: ${matchedProd.name} (${quickArticleQty} шт) добавлено в корзину!`);
      setQuickArticleCode('');
      setQuickArticleQty(1);
    } else {
      SoundEngine.playTick();
      setQuickOrderNotice(`Ошибка: Артикул "${quickArticleCode}" не найден.`);
    }

    setTimeout(() => {
      setQuickOrderNotice(null);
    }, 4000);
  };

  const cartTotal = useMemo(() => cart.reduce((sum, item) => sum + (item.price * item.quantity), 0), [cart]);
  const cartItemsCount = useMemo(() => cart.reduce((sum, item) => sum + item.quantity, 0), [cart]);

  // Catalog filtering and sorting
  const filteredProducts = useMemo(() => {
    let result = productsData.filter(p => {
      const query = searchQuery.toLowerCase();
      const matchesSearch = p.name.toLowerCase().includes(query) || 
                            (p.article && p.article.toLowerCase().includes(query));
      const matchesCategory = activeCategoryId === 'all' || p.categoryId === activeCategoryId;
      return matchesSearch && matchesCategory;
    });

    if (catalogFilter === 'packaging_unit') {
      result = result.filter(p => p.unit === 'уп');
    } else if (catalogFilter === 'single_unit') {
      result = result.filter(p => p.unit === 'шт' || p.unit === 'рулон');
    } else if (catalogFilter === 'special_price') {
      result = result.filter(p => p.price <= 150);
    } else if (catalogFilter === 'promo') {
      result = result.filter(p => p.isPromo);
    }

    if (sortBy === 'priceAsc') {
      result = [...result].sort((a, b) => a.price - b.price);
    } else if (sortBy === 'priceDesc') {
      result = [...result].sort((a, b) => b.price - a.price);
    }
    return result;
  }, [productsData, searchQuery, activeCategoryId, sortBy, catalogFilter]);

  const handleAutoGpsLocate = () => {
    SoundEngine.playTick();
    if (!navigator.geolocation) {
      alert("Геолокация не поддерживается вашим устройством.");
      return;
    }
    setGpsLoading(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude, accuracy } = position.coords;
        setGpsCoords({ lat: latitude, lng: longitude });
        setGpsAccuracy(accuracy);
        setGpsLoading(false);
        SoundEngine.playSuccess();
        
        const calculatedAddress = `Региональная Зона Доставки (GPS: ${latitude.toFixed(5)}°N, ${longitude.toFixed(5)}°E, точность ±${Math.round(accuracy)}м)`;
        setCustomerInfo(prev => ({ ...prev, address: calculatedAddress }));
        
        const timestamp = new Date().toLocaleTimeString('ru-RU');
        setSystemLogs(prev => [
          `[${timestamp}] [GEOLOCATION] Успешно получена GPS-позиция: ${latitude.toFixed(6)}, ${longitude.toFixed(6)}`,
          `[${timestamp}] [GEOLOCATION] Точность позиционирования: ±${Math.round(accuracy)} метров`,
          `[${timestamp}] [GEOLOCATION] Поле «Адрес доставки» автоматически перезаписано.`,
          ...prev
        ]);
      },
      (error) => {
        setGpsLoading(false);
        SoundEngine.playChime();
        // Fallback: GPS ungranted or timeout. Generate a beautiful regional warehouse address matching 1000 Melochey ERP list
        const simulatedList = [
          "г. Москва, ул. Хозяйственная, корп. 12, Склад А-4",
          "г. Казань, пр. Строителей, д. 88, Склад Б-2",
          "г. Екатеринбург, ул. Торговая, д. 101, Комплекс №1",
          "г. Краснодар, ул. Торговая, д. 5, Литер В"
        ];
        const randomSimulatedAddr = simulatedList[Math.floor(Math.random() * simulatedList.length)];
        setCustomerInfo(prev => ({ ...prev, address: randomSimulatedAddr }));
        
        const timestamp = new Date().toLocaleTimeString('ru-RU');
        let errorMsg = "Неизвестная ошибка";
        if (error.code === 1) errorMsg = "Доступ к GPS заблокирован пользователем или iframe";
        else if (error.code === 2) errorMsg = "Позиция сотовой связи недоступна";
        else if (error.code === 3) errorMsg = "Превышено время ожидания GPS";
        
        setSystemLogs(prev => [
          `[${timestamp}] [GEOLOCATION_WARNING] Не удалось получить координаты: ${errorMsg}.`,
          `[${timestamp}] [GEOLOCATION_FALLBACK] Автоматически подобран оптимальный адрес доставки партнера: ${randomSimulatedAddr}`,
          ...prev
        ]);
      },
      { enableHighAccuracy: true, timeout: 6000 }
    );
  };

  const handleCheckoutSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const orderItems = cart.map(item => ({
        productId: item.id,
        quantity: item.quantity,
      }));

      const result = await storefrontApi.placeOrder({
        items: orderItems,
        orderType,
        deliveryAddress: orderType === 'delivery' ? customerInfo.address : undefined,
        comment: customerInfo.comment || undefined,
        paymentMethod: paymentMethod,
      });

      SoundEngine.playSuccess();
      setOrderNumber(result.orderId);

      // Add to local order list immediately so the History tab updates right away
      const newOrderRecord: Order = {
        id: result.orderId,
        date: 'Сегодня, ' + new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }),
        status: 'processing',
        total: result.finalPrice,
        cashierName: 'Storefront: ' + (currentUser?.name || ''),
        paymentMethod: paymentMethod,
        items: cart.map(item => ({
          id: item.id,
          name: item.name,
          price: item.price,
          quantity: item.quantity,
        })),
      };

      setOrdersList(prev => [newOrderRecord, ...prev]);
      setCart([]);
      setPaymentMethod('CASH');
      setActiveTab('success');
      addToast(`Заказ ${result.orderId} успешно оформлен!`, 'success', result.orderId);

      const timestamp = new Date().toLocaleTimeString('ru-RU');
      setSystemLogs(prev => [
        `[${timestamp}] [ORDER] Заказ ${result.orderId} создан в базе Rvad retail. Сумма: ${Math.round(result.finalPrice / 100)} руб.`,
        `[${timestamp}] [STOCK] Списание товаров со склада выполнено автоматически.`,
        ...prev,
      ]);
    } catch (err: any) {
      SoundEngine.playTick();
      if (err.message === 'DEBT_LIMIT_EXCEEDED') {
        addToast('Превышен лимит долга. Свяжитесь с менеджером.', 'warning');
      } else {
        addToast(`Ошибка оформления: ${err.message}`, 'warning');
      }
    }
  };

  const addToast = (message: string, type: Toast['type'] = 'info', orderId?: string) => {
    const id = Math.random().toString(36).substring(2, 9);
    const newToast = { id, message, type, orderId };
    setToasts(prev => [...prev, newToast]);
    setNotifications(prev => [newToast, ...prev].slice(0, 20)); // Keep last 20
    
    // Play sound if notification
    if (type === 'success') SoundEngine.playSuccess();
    else SoundEngine.playChime();

    // Auto-remove
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 5000);
  };

  // Order Status Simulator removed to control statuses directly from backend

  const toggleOrder = (id: string) => {
    SoundEngine.playTick();
    setExpandedOrders(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const filteredOrders = useMemo(() => {
    return ordersList.filter(order => {
      const isOnline = order.orderType === 'delivery' || order.orderType === 'pickup' || !!(order.cashierName && (order.cashierName.startsWith('Storefront:') || order.cashierName.includes('Storefront')));
      if (historyFilter === 'online') return isOnline;
      if (historyFilter === 'pos') return !isOnline;
      return true; // 'all'
    });
  }, [ordersList, historyFilter]);

  const promoCategories = useMemo(() => {
    const categoriesWithPromo = new Set<string>();
    productsData.forEach(p => {
      if (p.isPromo) {
        const cat = categoriesData.find(c => c.id === p.categoryId);
        if (cat && cat.id !== 'all') {
          categoriesWithPromo.add(cat.name);
        }
      }
    });
    return Array.from(categoriesWithPromo);
  }, [productsData, categoriesData]);

  const promoBannerTitle = useMemo(() => {
    if (promoCategories.length > 0) {
      const list = promoCategories.slice(0, 2).join(' и ');
      return `Скидки на ${list} до 10%`;
    }
    return 'Скидки на хозяйственные мелочи до 10%';
  }, [promoCategories]);

  const navItems = [
    { id: 'catalog', label: 'Каталог', icon: Home },
    { id: 'favorites', label: 'Избранное', icon: Heart },
    { id: 'cart', label: 'Корзина', icon: ShoppingCart },
    { id: 'history', label: 'Заказы', icon: HistoryIcon },
    { id: 'profile', label: 'Профиль', icon: User },
  ];

  const renderCatalog = () => (
    <div className="space-y-6">
      
      {/* Promo banner */}
      {promoBannerVisible && (
        <div className="px-4 md:px-6">
          <motion.div 
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            className={`relative rounded-3xl p-5 md:p-6 text-white overflow-hidden shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4 ${t.id === 'dark' ? 'bg-gradient-to-r from-violet-600 to-indigo-700' : t.id === 'amber' ? 'bg-gradient-to-r from-orange-500 to-amber-600' : t.id === 'nordic' ? 'bg-[#1e293b]' : 'bg-gradient-to-r from-emerald-600 to-teal-700'}`}
          >
            <div className="flex-1 space-y-1 z-10">
              <span className="inline-block bg-white/20 backdrop-blur-md px-3 py-1 rounded-full text-xs font-black tracking-widest uppercase mb-2">Акция Недели</span>
              <h3 className="text-xl font-black tracking-tight leading-none text-white flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-yellow-300" /> {promoBannerTitle}
              </h3>
              <p className="text-sm opacity-90 font-normal">Ваша персональная скидка {currentUser ? currentUser.discountPercentage : 5}% суммируется автоматически!</p>
            </div>
            <div className="flex items-center gap-3 z-10 self-stretch md:self-auto justify-end">
              <button
                onClick={() => { SoundEngine.playSuccess(); setCatalogFilter('promo'); }}
                className="bg-white text-slate-900 hover:bg-slate-100 transition-all rounded-2xl px-4 py-2 text-xs font-black uppercase tracking-wider outline-none active:scale-95 shadow-xs cursor-pointer"
              >
                Смотреть товары
              </button>
              <button 
                onClick={() => setPromoBannerVisible(false)}
                className="bg-white/10 hover:bg-white/20 transition-all rounded-full p-2 text-white outline-none active:scale-95"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Grid of Search, Sorting, and Sound indicators */}
      <div className="px-4 md:px-6 space-y-3">
        {/* Search header with extra comfort controls */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
              <Search className={`h-5 w-5 ${t.id === 'dark' ? 'text-slate-500' : 'text-gray-400'}`} />
            </div>
            <input
              type="text"
              placeholder="Поиск по артикулу или названию..."
              className={`block w-full pl-11 pr-10 py-3.5 border-none rounded-2xl shadow-sm text-[15px] font-medium placeholder:font-normal outline-none transition-all focus:ring-2 ${t.ringClass} ${t.cardClass} ${t.textClass}`}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button 
                onClick={() => { setSearchQuery(''); SoundEngine.playTick(); }}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Sorter Pillet */}
          <div className="flex gap-2">
            <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-2xl border ${t.cardClass} shadow-sm`}>
              <ArrowUpDown className="w-4 h-4 opacity-70" />
              <select 
                value={sortBy} 
                onChange={(e) => { setSortBy(e.target.value as any); SoundEngine.playTick(); }}
                className={`bg-transparent text-xs font-bold uppercase tracking-wider border-none outline-none cursor-pointer pr-1 py-1 ${t.textClass}`}
              >
                <option value="default">Сортировка</option>
                <option value="priceAsc">Сначала дешевые</option>
                <option value="priceDesc">Сначала дорогие</option>
              </select>
            </div>

            <button
              onClick={() => { setIsNotificationsOpen(!isNotificationsOpen); SoundEngine.playTick(); }}
              className={`p-3 rounded-2xl border flex items-center justify-center transition-all shadow-sm ${t.cardClass} hover:opacity-95 active:scale-95 relative`}
            >
              <Bell className={`w-5 h-5 ${t.id === 'dark' ? 'text-violet-400' : 'text-gray-950'}`} />
              {notifications.length > 0 && (
                <span className="absolute top-2.5 right-2.5 w-2 h-2 rounded-full bg-red-500 ring-2 ring-white dark:ring-[#1e1b4b]" />
              )}
            </button>

            {/* In-app sound indicator quick-control */}
            <button
              onClick={handleToggleSound}
              title={soundEnabled ? "Выключить звук" : "Включить звук"}
              className={`p-3 rounded-2xl border flex items-center justify-center transition-all shadow-sm ${t.cardClass} hover:opacity-95 active:scale-95`}
            >
              {soundEnabled ? (
                <Volume2 className={`w-5 h-5 ${t.id === 'dark' ? 'text-violet-400' : 'text-gray-950'}`} />
              ) : (
                <VolumeX className="w-5 h-5 text-gray-400" />
              )}
            </button>
          </div>
        </div>

        {/* Quick Article Order Form (Extremely comfortable for variety store clients!) */}
        <div className={`rounded-2xl border shadow-sm ${t.cardHighlightClass} ${t.borderClass} overflow-hidden`}>
          <button
            type="button"
            onClick={() => { SoundEngine.playTick(); setIsQuickOrderOpen(!isQuickOrderOpen); }}
            className="w-full text-left p-4 flex items-center justify-between outline-none cursor-pointer focus:outline-none"
          >
            <div className="flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full bg-orange-500 ${isQuickOrderOpen ? 'animate-pulse' : ''}`}></span>
              <h4 className={`text-xs font-black uppercase tracking-wider ${t.textClass}`}>Блиц-заказ по артикулу</h4>
            </div>
            <div className={`text-xs font-bold flex items-center gap-1.5 ${t.accentLightTextClass} bg-black/5 px-2.5 py-1 rounded-lg`}>
              {isQuickOrderOpen ? 'Скрыть ▲' : 'Быстрый заказ ▼'}
            </div>
          </button>
          
          <AnimatePresence initial={false}>
            {isQuickOrderOpen && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="px-4 pb-4 pt-1 border-t border-black/5"
              >
                <form onSubmit={handleQuickOrderSubmit} className="flex flex-wrap items-center gap-3 mt-2">
                  <div className="flex-1 min-w-[140px]">
                    <input 
                      type="text"
                      placeholder="Код (например: PKG-001)"
                      value={quickArticleCode}
                      onChange={e => setQuickArticleCode(e.target.value)}
                      className={`w-full px-3 py-2 rounded-xl text-sm border-none ring-1 outline-none transition-shadow font-medium ${t.ringClass} ${t.id === 'dark' ? 'bg-[#1b253b] ring-slate-700 text-white' : 'bg-white ring-gray-200 text-gray-900'}`}
                    />
                  </div>
                  
                  <div className="flex items-center bg-white rounded-xl ring-1 ring-gray-200 py-1 px-2 shrink-0 select-none shadow-sm h-9">
                    <button 
                      type="button" 
                      onClick={() => { SoundEngine.playTick(); setQuickArticleQty(q => Math.max(1, q - 1)); }}
                      className="p-1 text-gray-400 hover:text-gray-900"
                    >
                      <Minus className="w-3.5 h-3.5" />
                    </button>
                    <span className="px-3 text-xs font-bold text-gray-900">{quickArticleQty} шт</span>
                    <button 
                      type="button" 
                      onClick={() => { SoundEngine.playTick(); setQuickArticleQty(q => q + 1); }}
                      className="p-1 text-gray-400 hover:text-gray-900"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <button
                    type="submit"
                    className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all shadow-sm shrink-0 active:scale-95 cursor-pointer ${t.accentBgClass} ${t.accentTextClass} ${t.accentHoverBgClass}`}
                  >
                    Добавить в корзину
                  </button>
                </form>

                {quickOrderNotice && (
                  <motion.div 
                     initial={{ opacity: 0, y: 5 }} 
                     animate={{ opacity: 1, y: 0 }} 
                     className={`text-xs mt-3.5 font-bold p-2.5 rounded-xl border flex items-center gap-2 ${quickOrderNotice.startsWith('Ошибка') ? 'bg-red-50 text-red-700 border-red-100' : 'bg-green-50 text-green-700 border-green-100'}`}
                  >
                    {quickOrderNotice.startsWith('Ошибка') ? <AlertCircle className="w-4 h-4 shrink-0" /> : <CheckCircle className="w-4 h-4 shrink-0" />}
                    {quickOrderNotice}
                  </motion.div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Categories Horizontal Slider */}
      <div className="px-4 md:px-6 flex overflow-x-auto gap-2 pb-2 scrollbar-none snap-x">
        {categoriesData.map(cat => (
          <button
            key={cat.id}
            onClick={() => { SoundEngine.playTick(); setActiveCategoryId(cat.id); setCatalogFilter('all'); }}
            className={`whitespace-nowrap px-5 py-2.5 rounded-[1.25rem] font-bold transition-all text-sm snap-start outline-none ${
              activeCategoryId === cat.id 
                ? t.pillSelectedClass
                : `${t.cardClass} ${t.mutedTextClass} shadow-sm ring-1 ring-black/5 hover:opacity-90`
            }`}
          >
            {cat.name}
          </button>
        ))}
      </div>

      {/* Wholesaler Quick Smart Filters Row 
      <div className="px-4 md:px-6 flex overflow-x-auto gap-1.5 pb-1 select-none scrollbar-none">
        {[
          { id: 'all', label: '⚡️ Все товары' },
          { id: 'promo', label: '🔥 Акции и скидки' },
          { id: 'packaging_unit', label: '📦 Только упаковками' },
          { id: 'single_unit', label: '🧼 Поштучно / рулоны' },
          { id: 'special_price', label: '💰 Бюджет до 150 ₽' }
        ].map(filterOpt => {
          const isSelected = catalogFilter === filterOpt.id;
          return (
            <button
              key={filterOpt.id}
              onClick={() => { SoundEngine.playTick(); setCatalogFilter(filterOpt.id as any); }}
              className={`whitespace-nowrap px-3.5 py-1.5 rounded-xl font-bold transition-all text-xs outline-none cursor-pointer ${
                isSelected 
                  ? `${t.accentLightBgClass} ${t.accentLightTextClass} ring-1 ring-emerald-500/20 shadow-xs scale-[1.02]`
                  : `bg-black/5 hover:bg-black/10 ${t.mutedTextClass} border border-transparent`
              }`}
            >
              {filterOpt.label}
            </button>
          );
        })}
      </div>
*/}
      {/* Product Scannable Grid */}
      {isLoadingProducts ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-4 gap-3 md:gap-4 px-4 md:px-6">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className={`rounded-[1.5rem] p-2 border animate-pulse ${t.cardClass}`}>
              <div className="aspect-square bg-gray-200/60 rounded-2xl mb-2" />
              <div className="space-y-2 px-1 pb-1">
                <div className="h-2.5 bg-gray-200/60 rounded-full w-4/5" />
                <div className="h-2.5 bg-gray-200/60 rounded-full w-3/5" />
                <div className="h-6 bg-gray-200/60 rounded-xl mt-2" />
              </div>
            </div>
          ))}
        </div>
      ) : (
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-4 gap-3 md:gap-4 px-4 md:px-6">
        {filteredProducts.map(product => {
          const quantity = cart.find(i => i.id === product.id)?.quantity || 0;
          return (
            <div 
              key={product.id} 
              onClick={() => handleQuickView(product)}
              className={`cursor-pointer rounded-[1.5rem] p-2 shadow-sm border flex flex-col transition-all duration-300 hover:shadow-md group relative ${t.cardClass} ${t.cardHighlightClass}`}
            >
              <div className="aspect-square bg-white rounded-2xl overflow-hidden relative mb-2 flex items-center justify-center border border-black/5">
                <img 
                  src={product.image} 
                  alt={product.name} 
                  loading="lazy"
                  className="w-full h-full aspect-video group-hover:scale-105 transition-transform duration-500" 
                />
                {product.isPromo && product.promoLabel && (
                  <div className="absolute top-2 left-2 bg-rose-500 text-white font-extrabold text-[9px] px-2 py-0.5 rounded-lg uppercase tracking-wider shadow-sm z-20">
                    {product.promoLabel}
                  </div>
                )}
                {product.article && (
                  <div className={`absolute ${product.isPromo ? 'top-7' : 'top-2'} left-2 bg-white/95 backdrop-blur-sm px-2 py-0.5 rounded-lg text-[9px] font-mono font-bold tracking-tight text-gray-800 shadow-sm border border-gray-100 z-10`}>
                    {product.article}
                  </div>
                )}
                {/* Heart / Favorite Button */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleFavorite(product.id);
                  }}
                  className="absolute top-2 right-2 w-7 h-7 rounded-full bg-white/90 backdrop-blur-xs flex items-center justify-center text-rose-500 hover:scale-110 active:scale-90 transition-all shadow-xs z-10 cursor-pointer"
                  title="Добавить в избранное"
                >
                  <Heart className={`w-4 h-4 transition-colors ${favorites.includes(product.id) ? 'fill-rose-500 text-rose-500' : 'text-gray-400'}`} />
                </button>
              </div>
              <div className="px-2 pb-2 flex flex-col flex-1">
                <div className="flex items-center gap-1 mb-1">
                  <Star className="w-3 h-3 text-yellow-500 fill-yellow-500" />
                  <span className={`text-[10px] font-bold ${t.mutedTextClass}`}>{product.rating || 4.8}</span>
                  <span className={`text-[10px] opacity-60 ${t.mutedTextClass}`}>({product.ratingCount || Math.floor(Math.random() * 50) + 10})</span>
                </div>
                <h3 className={`text-xs sm:text-sm font-semibold tracking-tight leading-snug mb-1 line-clamp-2 ${t.textClass}`}>
                  {product.name}
                </h3>
                
                <div className="mt-auto pt-3 flex items-end justify-between gap-2 border-t border-black/5">
                  <div>
                    {product.isPromo && product.originalPrice && (
                      <div className="text-[10px] sm:text-xs text-rose-500 font-bold line-through mb-1">
                        {formatPrice(product.originalPrice)}
                      </div>
                    )}
                    <div className={`font-black text-sm sm:text-base leading-none ${t.textClass}`}>
                       {formatPrice(product.price)}
                    </div>
                    {product.unit && (
                      <div className={`text-[10px] font-semibold mt-1 ${t.mutedTextClass}`}>
                        за {product.unit}
                      </div>
                    )}
                  </div>
                  
                  {quantity > 0 ? (
                    <div className="flex items-center gap-1.5 p-1 bg-black/5 rounded-full select-none shrink-0 border border-black/5">
                      <button 
                        onClick={(e) => { e.stopPropagation(); updateQuantity(product.id, -1); }}
                        className={`w-6 sm:w-7 h-6 sm:h-7 flex items-center justify-center bg-white rounded-full shadow-sm text-gray-900 transition-transform active:scale-90`}
                      >
                        <Minus className="w-3.5 h-3.5" />
                      </button>
                      <span className={`text-[11px] sm:text-xs font-black w-4 text-center ${t.textClass}`}>{quantity}</span>
                      <button 
                        onClick={(e) => { e.stopPropagation(); updateQuantity(product.id, 1); }}
                        className={`w-6 sm:w-7 h-6 sm:h-7 flex items-center justify-center rounded-full shadow-sm text-white transition-transform active:scale-95 ${t.accentBgClass}`}
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ) : (
                    <motion.button 
                      whileTap={{ scale: 0.8 }}
                      onClick={(e: React.MouseEvent) => { e.stopPropagation(); addToCart(product); }}
                      className={`w-8 sm:w-9 h-8 sm:h-9 rounded-full flex items-center justify-center transition-all hover:opacity-95 shrink-0 shadow-sm ${t.accentBgClass} ${t.accentTextClass}`}
                    >
                      <Plus className="w-4 sm:w-5 h-4 sm:h-5" />
                    </motion.button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
      )}
      
      {!isLoadingProducts && filteredProducts.length === 0 && (
        <div className="text-center py-20 px-4">
          <div className="bg-gray-100 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4">
             <Package className="w-8 h-8 text-gray-400" />
          </div>
          <h3 className="text-lg font-bold text-gray-900">Ничего не найдено</h3>
          <p className="text-gray-500 mt-1 text-sm max-w-sm mx-auto">По запросу "{searchQuery}" товары отсутствуют в каталоге.</p>
        </div>
      )}
    </div>
  );

  const renderFavorites = () => {
    const favoriteProducts = productsData.filter(product => favorites.includes(product.id));

    return (
      <div className="space-y-6">
        <div className="px-4 md:px-6 flex justify-between items-center">
          <div>
            <h2 className={`text-2xl font-bold tracking-tight ${t.textClass}`}>Избранные товары</h2>
            <p className={`text-xs ${t.mutedTextClass} mt-0.5`}>Товары, которые вы сохранили для быстрого доступа</p>
          </div>
          {favoriteProducts.length > 0 && (
            <button
              onClick={() => {
                SoundEngine.playTick();
                setFavorites([]);
              }}
              className="text-xs font-semibold text-rose-500 hover:underline cursor-pointer"
            >
              Очистить все
            </button>
          )}
        </div>

        {favoriteProducts.length === 0 ? (
          <div className={`mx-4 md:mx-6 text-center py-20 rounded-3xl border shadow-sm ${t.cardClass}`}>
            <div className="bg-rose-50 text-rose-500 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4 border border-rose-100">
              <Heart className="w-8 h-8 fill-rose-500/20" />
            </div>
            <h3 className="text-lg font-bold text-gray-900 mb-2">Список избранного пуст</h3>
            <p className="text-gray-500 mt-1 mb-6 text-sm max-w-sm mx-auto">Нажимайте сердечки на карточках товаров в каталоге, чтобы быстро находить их здесь.</p>
            <button 
              onClick={() => handleTabSwitch('catalog')}
              className={`font-semibold rounded-full px-8 py-3 transition-colors ${t.accentBgClass} ${t.accentTextClass} ${t.accentHoverBgClass}`}
            >
              В каталог
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-4 gap-3 md:gap-4 px-4 md:px-6">
            {favoriteProducts.map(product => {
              const quantity = cart.find(i => i.id === product.id)?.quantity || 0;
              return (
                <div 
                  key={product.id} 
                  className={`rounded-[1.5rem] p-2 shadow-sm border flex flex-col transition-all duration-300 hover:shadow-md group relative ${t.cardClass} ${t.cardHighlightClass}`}
                >
                  <div className="aspect-square bg-white rounded-2xl overflow-hidden relative mb-2 flex items-center justify-center border border-black/5">
                    <img 
                      src={product.image} 
                      alt={product.name} 
                      loading="lazy"
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" 
                    />
                    {product.isPromo && product.promoLabel && (
                      <div className="absolute top-2 left-2 bg-rose-500 text-white font-extrabold text-[9px] px-2 py-0.5 rounded-lg uppercase tracking-wider shadow-sm z-20">
                        {product.promoLabel}
                      </div>
                    )}
                    {product.article && (
                      <div className={`absolute ${product.isPromo ? 'top-7' : 'top-2'} left-2 bg-white/95 backdrop-blur-sm px-2 py-0.5 rounded-lg text-[9px] font-mono font-bold tracking-tight text-gray-800 shadow-sm border border-gray-100 z-10`}>
                        {product.article}
                      </div>
                    )}
                    {/* Heart / Favorite Button */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleFavorite(product.id);
                      }}
                      className="absolute top-2 right-2 w-7 h-7 rounded-full bg-white/90 backdrop-blur-xs flex items-center justify-center text-rose-500 hover:scale-110 active:scale-95 transition-all shadow-xs z-10 cursor-pointer animate-none"
                    >
                      <Heart className="w-4 h-4 fill-rose-500 text-rose-500" />
                    </button>
                  </div>
                  <div className="px-2 pb-2 flex flex-col flex-1">
                    <h3 className={`text-xs sm:text-sm font-semibold tracking-tight leading-snug mb-1 line-clamp-2 ${t.textClass}`}>
                      {product.name}
                    </h3>
                    
                    <div className="mt-auto pt-3 flex items-end justify-between gap-2 border-t border-black/5">
                      <div>
                        {product.isPromo && product.originalPrice && (
                          <div className="text-[10px] sm:text-xs text-rose-500 font-bold line-through mb-1">
                            {formatPrice(product.originalPrice)}
                          </div>
                        )}
                        <div className={`font-black text-sm sm:text-base leading-none ${t.textClass}`}>
                          {formatPrice(product.price)}
                        </div>
                        {product.unit && (
                          <div className={`text-[10px] font-semibold mt-1 ${t.mutedTextClass}`}>
                            за {product.unit}
                          </div>
                        )}
                      </div>
                      
                      {quantity > 0 ? (
                        <div className="flex items-center gap-1.5 p-1 bg-black/5 rounded-full select-none shrink-0 border border-black/5">
                          <button 
                            onClick={() => updateQuantity(product.id, -1)}
                            className={`w-6 sm:w-7 h-6 sm:h-7 flex items-center justify-center bg-white rounded-full shadow-sm text-gray-900 transition-transform active:scale-90`}
                          >
                            <Minus className="w-3.5 h-3.5" />
                          </button>
                          <span className={`text-[11px] sm:text-xs font-black w-4 text-center ${t.textClass}`}>{quantity}</span>
                          <button 
                            onClick={() => updateQuantity(product.id, 1)}
                            className={`w-6 sm:w-7 h-6 sm:h-7 flex items-center justify-center rounded-full shadow-sm text-white transition-transform active:scale-95 ${t.accentBgClass}`}
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        <button 
                          onClick={() => addToCart(product)}
                          className={`w-8 sm:w-9 h-8 sm:h-9 rounded-full flex items-center justify-center transition-all active:scale-90 hover:opacity-95 shrink-0 shadow-sm ${t.accentBgClass} ${t.accentTextClass}`}
                        >
                          <Plus className="w-4 sm:w-5 h-4 sm:h-5" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  const renderCart = () => (
    <div className="px-4 md:px-6 max-w-3xl mx-auto">
      <h2 className={`text-2xl font-bold tracking-tight mb-6 ${t.textClass}`}>Корзина товаров</h2>
      
      {cart.length === 0 ? (
        <div className={`text-center py-20 rounded-3xl border shadow-sm ${t.cardClass}`}>
          <div className="bg-gray-50 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4 ring-8 ring-gray-100/50">
            <ShoppingCart className="w-8 h-8 text-gray-400" />
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Здесь пока пусто</h2>
          <p className="text-gray-500 mb-8 max-w-xs mx-auto text-sm">Выберите хозяйственные или бытовые товары в каталоге, чтобы оформить заказ.</p>
          <button 
            onClick={() => handleTabSwitch('catalog')}
            className={`font-semibold rounded-full px-8 py-3 transition-colors ${t.accentBgClass} ${t.accentTextClass} ${t.accentHoverBgClass}`}
          >
            В каталог
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8">
          <div className="lg:col-span-2 space-y-3">
             {cart.map(item => (
                <div key={item.id} className={`rounded-3xl p-3 shadow-sm border flex gap-4 items-center ${t.cardClass}`}>
                  <div className="w-16 h-16 bg-white border border-black/5 rounded-2xl overflow-hidden flex-shrink-0 flex items-center justify-center">
                     <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className={`font-semibold text-sm leading-snug truncate pr-4 ${t.textClass}`}>{item.name}</h3>
                    {item.article && <div className={`text-[10px] font-mono mt-0.5 opacity-80 ${t.mutedTextClass}`}>{item.article}</div>}
                    <div className={`font-bold mt-2 ${t.textClass}`}>{formatPrice(item.price * item.quantity)}</div>
                  </div>
                  <div className="flex items-center gap-1.5 bg-black/5 rounded-full p-1 border border-black/5 mr-2 shrink-0">
                    <button onClick={() => updateQuantity(item.id, -1)} className="w-8 h-8 flex items-center justify-center bg-white rounded-full shadow-sm text-gray-600 active:scale-95 transition-transform"><Minus className="w-4 h-4" /></button>
                    <span className={`text-sm font-bold w-6 text-center ${t.textClass}`}>{item.quantity}</span>
                    <button onClick={() => updateQuantity(item.id, 1)} className="w-8 h-8 flex items-center justify-center bg-white rounded-full shadow-sm text-gray-600 active:scale-95 transition-transform"><Plus className="w-4 h-4" /></button>
                  </div>
                </div>
             ))}
          </div>

          <div className="lg:col-span-1">
             <div className={`rounded-3xl p-6 shadow-sm border sticky top-24 ${t.cardClass} ${t.cardHighlightClass}`}>
                <h3 className={`text-lg font-bold mb-6 ${t.textClass}`}>Сводка Заказа</h3>
                <div className={`space-y-3 text-sm font-medium pb-6 border-b ${t.borderClass} ${t.mutedTextClass}`}>
                  <div className="flex justify-between"><span>Товары ({cartItemsCount})</span><span className={t.textClass}>{formatPrice(cartTotal)}</span></div>
                  {(currentUser?.discountPercentage || 0) > 0 && (
                     <div className="flex justify-between text-green-600 font-bold">
                       <span>Ваша скидка ({currentUser?.discountPercentage || 0}%)</span>
                       <span>-{formatPrice(cartTotal * ((currentUser?.discountPercentage || 0) / 100))}</span>
                     </div>
                  )}
                </div>
                <div className="flex justify-between items-end mt-6 mb-8">
                  <span className={`font-medium ${t.mutedTextClass}`}>Итого</span>
                  <span className={`text-2xl font-black tracking-tight ${t.textClass}`}>
                    {formatPrice(cartTotal * (1 - (currentUser?.discountPercentage || 0) / 100))}
                  </span>
                </div>
                <button 
                  onClick={() => handleTabSwitch('checkout')}
                  className={`w-full font-bold rounded-2xl py-4 transition-all active:scale-[0.98] cursor-pointer shadow-sm focus:ring-4 ${t.accentBgClass} ${t.accentTextClass} ${t.accentHoverBgClass} ${t.ringClass}`}
                >
                  Оформить доставку
                </button>
             </div>
          </div>
        </div>
      )}
    </div>
  );

  const getStatusDetails = (status: string, orderType?: 'delivery' | 'pickup') => {
    const isPickup = orderType === 'pickup';
    switch (status) {
      case 'processing': return { label: 'Обрабатывается', step: 1, color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-500' };
      case 'shipping': return { label: isPickup ? 'Готов к выдаче' : 'В пути', step: 2, color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-500' };
      case 'delivered': return { label: isPickup ? 'Выдан' : 'Доставлен', step: 3, color: 'text-emerald-600 dark:text-emerald-450', bg: 'bg-emerald-500' };
      case 'cancelled': return { label: 'Отменен', step: 0, color: 'text-red-600 dark:text-red-400', bg: 'bg-red-500' };
      default: return { label: 'Обрабатывается', step: 1, color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-500' };
    }
  };

  const renderHistory = () => (
    <div className="max-w-3xl mx-auto px-4 md:px-6">
      <h2 className={`text-2xl font-bold tracking-tight mb-6 ${t.textClass}`}>История заказов</h2>
      
      {/* History Tabs */}
      <div className="flex gap-2 mb-6 bg-black/5 dark:bg-white/5 p-1 rounded-2xl shrink-0 select-none">
        {[
          { id: 'all', label: 'Все' },
          { id: 'online', label: 'Онлайн' },
          { id: 'pos', label: 'Самовывоз' },
        ].map(opt => (
          <button
            key={opt.id}
            onClick={() => { SoundEngine.playTick(); setHistoryFilter(opt.id as any); }}
            className={`flex-1 py-2 px-3 rounded-xl font-bold text-xs uppercase tracking-wider transition-all outline-none cursor-pointer ${
              historyFilter === opt.id
                ? t.pillSelectedClass
                : `${t.mutedTextClass} hover:opacity-90`
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      <div className="space-y-4">
        {filteredOrders.length === 0 ? (
          <div className={`rounded-3xl border p-8 text-center flex flex-col items-center justify-center gap-4 ${t.cardClass}`}>
            <div className="w-16 h-16 rounded-2xl bg-black/5 dark:bg-white/5 flex items-center justify-center text-slate-400">
              <HistoryIcon className="w-8 h-8 opacity-60" />
            </div>
            <div className="space-y-1">
              <h3 className={`text-base font-extrabold ${t.textClass}`}>У вас пока нет заказов</h3>
              <p className={`text-xs max-w-sm ${t.mutedTextClass}`}>
                {historyFilter === 'all' 
                  ? 'Здесь будет отображаться история ваших онлайн-заказов и покупок на кассе.' 
                  : historyFilter === 'online' 
                    ? 'У вас нет оформленных онлайн-заказов.' 
                    : 'У вас нет оформленных покупок самовывозом.'}
              </p>
            </div>
            <button
              onClick={() => handleTabSwitch('catalog')}
              className={`px-6 py-2.5 rounded-2xl text-xs font-black uppercase tracking-widest transition-all ${t.accentBgClass} ${t.accentTextClass} ${t.accentHoverBgClass} cursor-pointer active:scale-95`}
            >
              Перейти в каталог
            </button>
          </div>
        ) : (
          filteredOrders.map(order => {
            const isOnline = order.orderType === 'delivery' || order.orderType === 'pickup' || !!(order.cashierName && (order.cashierName.startsWith('Storefront:') || order.cashierName.includes('Storefront')));
            const statusInfo = isOnline ? getStatusDetails(order.status, order.orderType) : { label: 'Выдан (Касса)', step: 0, color: 'text-emerald-600 dark:text-emerald-450', bg: 'bg-emerald-500' };
            
            return (
             <div key={order.id} className={`rounded-3xl shadow-sm border overflow-hidden transition-shadow hover:shadow-md ${t.cardClass}`}>
               <button 
                 onClick={() => toggleOrder(order.id)}
                 className="w-full p-5 flex flex-col gap-4 text-left outline-none"
               >
                 <div className="flex items-center justify-between w-full">
                   <div className="flex items-center gap-4">
                     <div className={`w-12 h-12 rounded-2xl flex items-center justify-center border ${t.accentLightBgClass} ${t.accentLightTextClass}`}>
                       <Receipt className="w-6 h-6" />
                     </div>
                     <div>
                       <div className={`font-black tracking-tight text-base ${t.textClass}`}>{order.id}</div>
                       <div className={`text-xs font-medium mt-0.5 ${t.mutedTextClass}`}>{order.date}</div>
                       <div className={`sm:hidden text-[10px] uppercase tracking-wider font-extrabold ${statusInfo.color} mt-1 flex items-center gap-1`}>
                         {statusInfo.step < 3 && statusInfo.step > 0 && <span className={`w-1.5 h-1.5 rounded-full ${statusInfo.bg} animate-pulse`}></span>}
                         {statusInfo.label}
                       </div>
                     </div>
                   </div>
                   
                   <div className="flex items-center gap-5">
                     <div className="text-right hidden sm:block">
                       <div className={`font-black text-sm sm:text-base ${t.textClass}`}>{formatPrice(order.total)}</div>
                       <div className={`text-[10px] uppercase tracking-wider font-extrabold ${statusInfo.color} mt-1 flex items-center justify-end gap-1`}>
                         {statusInfo.step < 3 && statusInfo.step > 0 && <span className={`w-1.5 h-1.5 rounded-full ${statusInfo.bg} animate-pulse`}></span>}
                         {statusInfo.label}
                       </div>
                     </div>
                     <motion.div animate={{ rotate: expandedOrders[order.id] ? 180 : 0 }} transition={{ duration: 0.2 }}>
                       <ChevronDown className="w-5 h-5 opacity-70" />
                     </motion.div>
                   </div>
                 </div>
 
                 {/* Progress bar */}
                 {statusInfo.step > 0 && (
                   <div className="w-full mt-1">
                     <div className="flex justify-between mb-2 px-1">
                       <span className={`text-[9px] font-bold uppercase tracking-wider ${statusInfo.step >= 1 ? t.textClass : t.mutedTextClass + ' opacity-50'}`}>Обработка</span>
                       <span className={`text-[9px] font-bold uppercase tracking-wider ${statusInfo.step >= 2 ? t.textClass : t.mutedTextClass + ' opacity-50'}`}>{order.orderType === 'pickup' ? 'Готов к выдаче' : 'В пути'}</span>
                       <span className={`text-[9px] font-bold uppercase tracking-wider ${statusInfo.step >= 3 ? t.textClass : t.mutedTextClass + ' opacity-50'}`}>{order.orderType === 'pickup' ? 'Выдан' : 'Доставлен'}</span>
                     </div>
                     <div className="h-1.5 w-full bg-black/5 dark:bg-white/10 rounded-full overflow-hidden flex">
                        <div className={`h-full transition-all duration-1000 ease-out rounded-full ${statusInfo.bg}`} style={{ width: statusInfo.step === 1 ? '33.3%' : statusInfo.step === 2 ? '66.6%' : '100%' }} />
                     </div>
                   </div>
                 )}
               </button>
               
               <AnimatePresence>
                 {expandedOrders[order.id] && (
                   <motion.div
                     initial={{ height: 0, opacity: 0 }}
                     animate={{ height: 'auto', opacity: 1 }}
                     exit={{ height: 0, opacity: 0 }}
                     className={`overflow-hidden border-t ${t.cardHighlightClass} ${t.borderClass}`}
                   >
                     <div className="p-5">
                       <div className="flex justify-between items-center mb-4">
                         <span className={`text-[11px] font-black uppercase tracking-wider ${t.mutedTextClass}`}>Купленные позиции</span>
                         <button 
                           onClick={() => handleRepeatOrder(order)}
                           className={`px-3.5 py-1.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all scale-95 active:scale-90 ${t.accentBgClass} ${t.accentTextClass} ${t.accentHoverBgClass}`}
                         >
                           Повторить заказ
                         </button>
                       </div>
                       
                       <div className="space-y-3.5">
                         {order.items.map(item => (
                           <div key={item.id} className="flex justify-between items-start text-sm">
                             <div className="flex-1 pr-6">
                               <span className={`font-semibold ${t.textClass}`}>{item.name}</span>
                               <div className={`text-xs font-medium mt-0.5 ${t.mutedTextClass}`}>{item.quantity} шт × {formatPrice(item.price)}</div>
                             </div>
                             <div className={`font-bold whitespace-nowrap ${t.textClass}`}>
                               {formatPrice(item.price * item.quantity)}
                             </div>
                           </div>
                         ))}
                       </div>
 
                       {/* Display Payment Method */}
                       {order.paymentMethod && (
                         <div className={`mt-4 pt-3.5 border-t border-black/5 flex justify-between items-center text-xs ${t.mutedTextClass}`}>
                           <span>Способ оплаты:</span>
                           <span className={`font-bold uppercase ${t.textClass}`}>
                             {order.paymentMethod === 'CASH' ? 'Наличные' :
                              order.paymentMethod === 'CARD' ? 'Карта' :
                              order.paymentMethod === 'DEBT' ? 'В долг (Насия)' :
                              order.paymentMethod === 'SPLIT' ? 'Смешанный' : order.paymentMethod}
                           </span>
                         </div>
                       )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })
        )}
      </div>
    </div>
  );

  const renderProfile = () => (
    <div className="max-w-3xl mx-auto px-4 md:px-6 space-y-6">
      <h2 className={`text-2xl font-bold tracking-tight mb-2 ${t.textClass}`}>Личный кабинет</h2>
      
      {/* Dynamic Theme Selection Swapper */}
      <div className={`rounded-3xl p-5 md:p-6 border shadow-sm ${t.cardClass}`}>
        <h3 className={`text-sm font-black uppercase tracking-wider mb-4 flex items-center gap-2 ${t.textClass}`}>
          <Sparkles className="w-4 h-4 text-amber-500" /> Выберите оформление интерфейса
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {Object.values(THEMES).map(themeOption => {
            const isSel = selectedThemeId === themeOption.id;
            return (
              <button
                key={themeOption.id}
                onClick={() => {
                  SoundEngine.playChime();
                  setSelectedThemeId(themeOption.id);
                }}
                className={`py-3 px-4 rounded-2xl flex flex-col items-center justify-center text-center transition-all border outline-none cursor-pointer ${isSel ? 'border-gray-900 bg-gray-900 text-white shadow-sm scale-102' : 'border-gray-200 bg-white text-gray-800 hover:bg-gray-50'}`}
              >
                <div className={`w-6 h-6 rounded-full mb-1 border shadow-inner ${themeOption.id === 'emerald' ? 'bg-[#0f9f6e]' : themeOption.id === 'dark' ? 'bg-[#8b5cf6]' : themeOption.id === 'amber' ? 'bg-[#f56c10]' : 'bg-[#0f172a]'}`} />
                <span className="text-xs font-black truncate max-w-full">{themeOption.name.split(' ')[0]}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className={`rounded-3xl p-6 shadow-sm border flex flex-col items-center justify-center text-center relative overflow-hidden ${t.cardClass} ${t.cardHighlightClass}`}>
        <button
          onClick={handleLogout}
          title="Выйти из кабинета"
          className="absolute top-4 right-4 p-2 rounded-xl bg-red-50 hover:bg-red-100 text-red-500 transition-all cursor-pointer hover:scale-105 active:scale-95 animate-none"
        >
          <LogOut className="w-4 h-4" />
        </button>
        <div className="w-16 h-16 bg-black/5 rounded-full flex items-center justify-center mb-4 border border-black/5">
          <User className="w-8 h-8 opacity-70" />
        </div>
        <h3 className={`text-xl font-bold ${t.textClass}`}>{currentUser ? currentUser.name : 'Иван Иванов'}</h3>
        <p className={`text-sm font-semibold mt-1 ${t.mutedTextClass}`}>{currentUser ? currentUser.phone : '+7 (999) 123-45-67'}</p>
      </div>

      {/* Telegram Bind Bot Widget */}
      <div className={`rounded-3xl p-5 shadow-sm border flex flex-col gap-4 ${t.cardClass}`}>
         <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
            <div className="flex items-center gap-4 self-start sm:self-auto">
              <div className="w-12 h-12 bg-sky-50 text-[#039be5] rounded-2xl flex items-center justify-center border border-sky-100 shrink-0">
                <MessageCircle className="w-6 h-6 fill-[#039be5] animate-pulse" />
              </div>
              <div>
                <div className={`font-bold tracking-tight text-base ${t.textClass}`}>Telegram-код управления</div>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className={`w-2 h-2 rounded-full ${telegramStatus === 'connected' ? 'bg-green-500' : 'bg-red-400'}`}></span>
                  <span className={`text-xs font-semibold ${t.mutedTextClass}`}>
                    {telegramStatus === 'connected' ? 'Связь с ботом настроена (Успешно)' : 'Уведомления не подключены'}
                  </span>
                </div>
              </div>
            </div>
            
            <button 
              onClick={() => {
                SoundEngine.playTick();
                if (telegramStatus === 'connected') {
                  setTelegramStatus('disconnected');
                  const time = new Date().toLocaleTimeString('ru-RU');
                  setSystemLogs(prev => [
                    `[${time}] [TG_API] Интеграция с Telegram-ботом отключена пользователем.`,
                    ...prev
                  ]);
                } else {
                  SoundEngine.playChime();
                  window.open("https://t.me/melochey_control_bot?start=client_" + (currentUser ? currentUser.id : "cust-4"), "_blank");
                  setTelegramStatus('connected');
                  const time = new Date().toLocaleTimeString('ru-RU');
                  setSystemLogs(prev => [
                    `[${time}] [SUCCESS] Webhook принят! Chat ID #2049104 успешно связан с ${currentUser ? currentUser.name : 'Иван Иванов'}`,
                    `[${time}] [TG_API] Клиент перешел по внешней глубокой ссылке Telegram-бота: melochey_control_bot`,
                    ...prev
                  ]);
                }
              }}
              className={`w-full sm:w-auto px-6 py-2.5 rounded-full font-bold text-xs uppercase tracking-widest transition-all active:scale-95 cursor-pointer ${telegramStatus === 'connected' ? 'bg-gray-100 text-gray-700 hover:bg-gray-200 border border-black/5' : 'bg-[#039be5] text-white shadow-sm hover:bg-[#0288d1]'}`}
            >
              {telegramStatus === 'connected' ? 'Сбросить' : 'Связать с ботом'}
            </button>
         </div>

         {/* Context-aware information helper for clients, detailing anti-gravity system bot sequence */}
         <div className="bg-sky-50/50 p-4 rounded-2xl border border-sky-100/50 text-xs text-[#0288d1] leading-relaxed">
            <p className="font-semibold mb-1">Как запустить Telegram-помощника?</p>
            Наш официальный Telegram-бот автоматически отправляет вам статусы заказов и напоминает о приближении лимита. Привязка связывает ваш Telegram ID с учетной записью <strong className="font-bold">{currentUser ? currentUser.name : 'Иван Иванов'}</strong> напрямую.
         </div>
       </div>

      {/* Reconciliation Statement Card */}
      <div className={`rounded-3xl p-5 border shadow-sm ${t.cardClass} flex items-center justify-between`}>
        <div className="space-y-0.5">
          <div className={`font-bold ${t.textClass}`}>Акт сверки взаиморасчетов</div>
          <div className={`text-xs ${t.mutedTextClass}`}>Выписка по покупкам, оплатам и текущему балансу</div>
        </div>
        <button 
          onClick={handleOpenReconciliation}
          className={`px-5 py-2.5 rounded-full font-black text-xs uppercase tracking-wider transition-all select-none outline-none active:scale-95 border ${t.accentBgClass} ${t.accentTextClass} ${t.accentHoverBgClass} border-transparent cursor-pointer`}
        >
          📋 Показать
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Debt Card */}
        {((currentUser?.debt || 0) > 0 || (currentUser?.creditLimit || 0) > 0) && (
          <div className={`rounded-3xl p-6 shadow-sm border ${(currentUser?.debt || 0) > 0 ? 'bg-red-50/50 border-red-100' : 'bg-green-50/50 border-green-100'}`}>
            <div className="flex items-center gap-2.5 mb-3">
               {(currentUser?.debt || 0) > 0 ? <AlertCircle className="w-5 h-5 text-red-500" /> : <CheckCircle className="w-5 h-5 text-green-500" />}
               <span className={`font-semibold tracking-tight ${(currentUser?.debt || 0) > 0 ? 'text-red-800' : 'text-green-800'}`}>Текущий долг</span>
            </div>
            <div className={`text-3xl sm:text-4xl font-black tracking-tight mb-2 ${(currentUser?.debt || 0) > 0 ? 'text-red-700' : 'text-green-700'}`}>
              {formatPrice(currentUser?.debt || 0)}
            </div>
            <div className={`text-sm font-semibold ${(currentUser?.debt || 0) > 0 ? 'text-red-600/80' : 'text-green-600/80'}`}>
              Лимит доверия: {formatPrice(currentUser?.creditLimit || 0)}
            </div>
            {(currentUser?.debt || 0) > 0 && (
               <div className="w-full bg-white/50 border border-red-100 rounded-full h-2 mt-4 overflow-hidden">
                  <div className="bg-red-500 h-full rounded-full transition-all duration-1000" style={{ width: `${Math.min(((currentUser?.debt || 0) / (currentUser?.creditLimit || 1)) * 100, 100)}%` }}></div>
               </div>
            )}
          </div>
        )}

        {/* Discount Card */}
        {(currentUser?.discountPercentage || 0) > 0 && (
          <div className={`rounded-3xl p-6 shadow-sm border flex flex-col justify-center ${t.id === 'dark' ? 'bg-[#1e1b4b] border-indigo-900' : 'bg-blue-50/30 border-blue-100'}`}>
            <div className="flex items-center gap-2.5 mb-3">
               <Percent className="w-5 h-5 text-blue-500" />
               <span className="font-semibold tracking-tight text-blue-800">Ваша скидка</span>
            </div>
            <div className="text-3xl sm:text-4xl font-black tracking-tight text-blue-700 mb-2">{currentUser?.discountPercentage || 0}%</div>
            <div className="text-sm font-semibold text-blue-600/80">Применяется автоматически ко всем позициям корзины</div>
          </div>
        )}
      </div>

      {/* Audio Setup and Sounds testing */}
      <div className={`rounded-3xl p-5 border shadow-sm ${t.cardClass} flex items-center justify-between`}>
         <div className="space-y-0.5">
           <div className={`font-bold ${t.textClass}`}>Звуковое сопровождение</div>
           <div className={`text-xs ${t.mutedTextClass}`}>Озвучка кнопок, добавления в корзину и заказов</div>
         </div>
         <button 
           onClick={handleToggleSound}
           className={`px-5 py-2.5 rounded-full font-black text-xs uppercase tracking-wider transition-all select-none outline-none active:scale-95 border ${soundEnabled ? `${t.accentBgClass} ${t.accentTextClass} ${t.accentHoverBgClass} border-transparent` : 'bg-white border-gray-200 text-gray-500'}`}
         >
           {soundEnabled ? 'Включен 🔊' : 'Выключен ❌'}
         </button>
      </div>





      {/* System events logs card removed */}
    </div>
  );

  const renderCheckout = () => (
    <div className="px-4 md:px-6 max-w-2xl mx-auto">
      <button onClick={() => handleTabSwitch('cart')} className={`flex items-center gap-2 font-bold mb-6 transition-colors group ${t.mutedTextClass}`}>
        <ArrowLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
        Назад в корзину
      </button>

      <form onSubmit={handleCheckoutSubmit} className="space-y-6">
        <h2 className={`text-2xl font-bold tracking-tight ${t.textClass}`}>Оформление заказа</h2>
        
        {/* Delivery Type */}
        <div className={`p-1.5 rounded-2xl flex border ${t.cardClass} ${t.cardHighlightClass}`}>
          <button type="button" onClick={() => { SoundEngine.playTick(); setOrderType('delivery'); }} className={`flex-1 py-3 rounded-[14px] font-bold text-sm transition-all outline-none ${orderType === 'delivery' ? `${t.accentBgClass} ${t.accentTextClass} shadow-sm` : `opacity-70 ${t.textClass}`}`}>
            Доставка
          </button>
          <button type="button" onClick={() => { SoundEngine.playTick(); setOrderType('pickup'); }} className={`flex-1 py-3 rounded-[14px] font-bold text-sm transition-all outline-none ${orderType === 'pickup' ? `${t.accentBgClass} ${t.accentTextClass} shadow-sm` : `opacity-70 ${t.textClass}`}`}>
            Самовывоз (Склад)
          </button>
        </div>

        <div className={`rounded-3xl shadow-sm border p-6 space-y-5 ${t.cardClass}`}>
          <h3 className={`font-bold ${t.textClass}`}>Данные получателя</h3>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={`block text-[10px] font-black uppercase tracking-wider mb-2 ${t.mutedTextClass}`}>Ваше имя</label>
              <input required type="text" value={customerInfo.name} onChange={e => setCustomerInfo({...customerInfo, name: e.target.value})} className={`w-full px-4 py-3.5 rounded-2xl border-none outline-none font-medium text-sm transition-all focus:ring-2 ${t.ringClass} ${t.inputBgClass} ${t.textClass}`} />
            </div>
            <div>
              <label className={`block text-[10px] font-black uppercase tracking-wider mb-2 ${t.mutedTextClass}`}>Телефон представителя</label>
              <input required type="tel" value={customerInfo.phone} onChange={e => setCustomerInfo({...customerInfo, phone: e.target.value})} className={`w-full px-4 py-3.5 rounded-2xl border-none outline-none font-medium text-sm transition-all focus:ring-2 ${t.ringClass} ${t.inputBgClass} ${t.textClass}`} />
            </div>
          </div>
          
          {orderType === 'pickup' && (
            <div className={`p-4 rounded-2xl border ${t.id === 'dark' ? 'bg-[#1b253b] border-slate-700/80' : 'bg-gray-50 border-gray-100'} text-xs space-y-2`}>
              <div className="flex items-center gap-2 font-bold text-gray-800">
                <Store className="w-4 h-4 text-orange-500" />
                <span>Пункт выдачи самовывоза</span>
              </div>
              <p className={t.mutedTextClass}>
                Основной распределительный склад: <strong className="font-bold text-gray-800">г. Челябинск, Рынок "Караван", корпус 10, бокс 10.8 | Тел: +7 9088101002</strong>
              </p>
              <p className="text-[10px] text-gray-400">
                Сборка занимает не более 15 минут после автоматического прохождения платежа во внутренней книге счетов.
              </p>
            </div>
          )}

          {orderType === 'delivery' && (
            <div className="space-y-3.5">
              <div>
                <label className={`block text-[10px] font-black uppercase tracking-wider mb-2 ${t.mutedTextClass}`}>Адрес доставки партнера</label>
                <div className="relative">
                  <input 
                    required 
                    type="text" 
                    value={customerInfo.address} 
                    onChange={e => setCustomerInfo({...customerInfo, address: e.target.value})} 
                    className={`w-full pl-4 pr-10 py-3.5 rounded-2xl border-none outline-none font-medium text-sm transition-all focus:ring-2 ${t.ringClass} ${t.inputBgClass} ${t.textClass} placeholder:opacity-50`} 
                    placeholder="Укажите адрес или нажмите авто-определение..." 
                  />
                  <div className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-gray-400">
                    <MapPin className="w-4 h-4 pointer-events-none" />
                  </div>
                </div>
              </div>

              {/* Advanced Geolocation Quick tools */}
              <div className="flex flex-wrap gap-2 pt-0.5">
                <button
                  type="button"
                  onClick={handleAutoGpsLocate}
                  disabled={gpsLoading}
                  className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 transition-all active:scale-95 border cursor-pointer border-transparent bg-emerald-50 text-emerald-700 hover:bg-emerald-100 disabled:opacity-50`}
                >
                  {gpsLoading ? (
                    <>
                      <span className="w-3.5 h-3.5 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin"></span>
                      Ищем GPS координаты...
                    </>
                  ) : (
                    <>
                      <Compass className="w-3.5 h-3.5 text-emerald-600 animate-pulse" />
                      📍 Авто-определение (GPS)
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => { SoundEngine.playTick(); setIsMapModalOpen(true); }}
                  className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 transition-all active:scale-95 border cursor-pointer border-transparent bg-sky-50 text-sky-700 hover:bg-sky-100`}
                >
                  <Map className="w-3.5 h-3.5 text-sky-600" />
                  🗺️ Показать на карте
                </button>
              </div>
            </div>
          )}

          {/* Interactive Map Selector Overlay Modal */}
          {isMapModalOpen && (
            <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
              <motion.div 
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                onClick={(e) => e.stopPropagation()}
                className={`w-full max-w-lg rounded-3xl p-6 border shadow-2xl space-y-5 ${t.cardClass}`}
              >
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className={`text-lg font-black tracking-tight ${t.textClass}`}>Выбор местоположения доставки</h3>
                    <p className={`text-xs ${t.mutedTextClass}`}>Кликните на карту, чтобы установить точные координаты доставки товара</p>
                  </div>
                  <button 
                    type="button" 
                    onClick={() => { SoundEngine.playTick(); setIsMapModalOpen(false); }}
                    className={`p-1.5 rounded-full hover:bg-gray-100 ${t.mutedTextClass}`}
                  >
                    ✕
                  </button>
                </div>

                {/* Simulated Visual Grid Map representing delivery sector blocks */}
                <div className="relative border rounded-2xl overflow-hidden aspect-video bg-slate-900 border-black/10 select-none cursor-crosshair">
                  {/* Grid layout */}
                  <div className="absolute inset-0 grid grid-cols-12 grid-rows-6 pointer-events-none opacity-20">
                    {Array.from({length: 72}).map((_, i) => (
                      <div key={i} className="border border-white/40" />
                    ))}
                  </div>

                  {/* Canvas interactive element click wrapper */}
                  <div 
                    onClick={(e) => {
                      SoundEngine.playTick();
                      const rect = e.currentTarget.getBoundingClientRect();
                      const clickX = e.clientX - rect.left;
                      const clickY = e.clientY - rect.top;
                      const pctX = clickX / rect.width;
                      const pctY = clickY / rect.height;
                      
                      const simulatedLat = 53.2006 + (0.05 * (1 - pctY));
                      const simulatedLng = 50.1505 + (0.08 * pctX);
                      
                      let calculatedLabel = "Промзона №4 (Северный сектор)";
                      if (pctX < 0.5 && pctY < 0.5) calculatedLabel = "Западный складской комплекс (Сектор А)";
                      else if (pctX >= 0.5 && pctY < 0.5) calculatedLabel = "Северный пункт выдачи";
                      else if (pctX < 0.5 && pctY >= 0.5) calculatedLabel = "Юго-Западный терминал разгрузки";
                      else calculatedLabel = "Восточная грузовая база (Сектор В)";
                      
                      setSelectedMapPoint({ lat: simulatedLat, lng: simulatedLng, label: calculatedLabel });
                    }}
                    className="absolute inset-0"
                  >
                    {/* Delivery center base marker */}
                    <div className="absolute top-[35%] left-[45%] flex flex-col items-center">
                      <div className="w-3.5 h-3.5 bg-sky-500 rounded-full animate-ping absolute" />
                      <div className="w-3 h-3 bg-sky-600 rounded-full border border-white z-10" />
                      <span className="text-[9px] text-sky-200 mt-1 bg-slate-950/80 px-1 py-0.5 rounded font-mono">Базовый РЦ</span>
                    </div>

                    {/* Regional presets markers */}
                    <div className="absolute top-[18%] left-[22%] w-1.5 h-1.5 bg-orange-400 rounded-full" />
                    <div className="absolute top-[68%] left-[78%] w-1.5 h-1.5 bg-orange-400 rounded-full" />
                    <div className="absolute top-[82%] left-[34%] w-1.5 h-1.5 bg-orange-400 rounded-full" />

                    {/* Draggable/clickable active customer target delivery cursor pin */}
                    <div 
                      className="absolute transition-all duration-300"
                      style={{ 
                        left: `${Math.max(0, Math.min(((selectedMapPoint.lng - 50.1505) / 0.08) * 100, 100))}%`, 
                        top: `${Math.max(0, Math.min((1 - ((selectedMapPoint.lat - 53.2006) / 0.05)) * 100, 100))}%`,
                        transform: 'translate(-50%, -100%)'
                      }}
                    >
                      <div className="flex flex-col items-center animate-bounce">
                        <MapPin className="w-7 h-7 text-red-500 stroke-1 fill-red-500" />
                        <div className="w-2 h-2 bg-red-500/50 rounded-full -mt-1 scale-x-50 blur-[1px]" />
                      </div>
                    </div>
                  </div>

                  {/* Watermark map info representing regional map schema */}
                  <div className="absolute bottom-3 left-3 bg-slate-950/70 backdrop-blur-sm p-2 rounded-lg text-[9px] font-mono text-slate-300 space-y-0.5 pointer-events-none">
                    <div>Интерактивная карта разгрузочных зон</div>
                    <div>Масштаб: 1 : 24,000</div>
                    <div>Регион Самара-Опт</div>
                  </div>
                </div>

                {/* Show active coordinate info on change */}
                <div className={`p-4 rounded-xl border space-y-2 ${t.cardHighlightClass} ${t.borderClass}`}>
                  <div className="flex items-center gap-2 text-xs">
                    <Compass className="w-4 h-4 text-emerald-500" />
                    <div>
                      <span className={`font-bold ${t.textClass}`}>Установленный пункт доставки:</span>
                      <div className={`mt-0.5 font-bold ${t.accentLightTextClass}`}>{selectedMapPoint.label}</div>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-[10.5px] font-mono opacity-80 pt-1.5 border-t border-black/5">
                    <div>Широта: <span className="font-bold">{selectedMapPoint.lat.toFixed(6)}°N</span></div>
                    <div>Долгота: <span className="font-bold">{selectedMapPoint.lng.toFixed(6)}°E</span></div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => { SoundEngine.playTick(); setIsMapModalOpen(false); }}
                    className="w-full py-3 rounded-2xl border text-xs font-bold uppercase tracking-wider text-gray-500 hover:bg-gray-50 cursor-pointer"
                  >
                    Отмена
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      SoundEngine.playSuccess();
                      const addressString = `Центральный склад, ${selectedMapPoint.label} (Координаты: ${selectedMapPoint.lat.toFixed(5)}°N, ${selectedMapPoint.lng.toFixed(5)}°E)`;
                      setCustomerInfo(prev => ({ ...prev, address: addressString }));
                      setGpsCoords({ lat: selectedMapPoint.lat, lng: selectedMapPoint.lng });
                      setIsMapModalOpen(false);
                      
                      const timestamp = new Date().toLocaleTimeString('ru-RU');
                      setSystemLogs(prev => [
                        ...prev
                      ]);
                    }}
                    className={`w-full py-3 rounded-2xl text-xs font-black uppercase tracking-wider text-white ${t.accentBgClass} ${t.accentHoverBgClass} cursor-pointer`}
                  >
                    Сохранить адрес
                  </button>
                </div>
              </motion.div>
            </div>
          )}
          
          <div>
            <label className={`block text-[10px] font-black uppercase tracking-wider mb-2 ${t.mutedTextClass}`}>Добавочный комментарий</label>
            <textarea rows={2} value={customerInfo.comment} onChange={e => setCustomerInfo({...customerInfo, comment: e.target.value})} className={`w-full px-4 py-3.5 rounded-2xl border-none outline-none font-medium text-sm transition-all resize-none focus:ring-2 ${t.ringClass} ${t.inputBgClass} ${t.textClass}`} placeholder="Особые условия, время разгрузки..." />
          </div>

          {/* Payment Method Selector */}
          <div className="space-y-3 pt-2">
            <label className={`block text-[10px] font-black uppercase tracking-wider ${t.mutedTextClass}`}>
              Способ оплаты
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* Option 1: Cash */}
              <button
                type="button"
                onClick={() => { SoundEngine.playTick(); setPaymentMethod('CASH'); }}
                className={`p-4 rounded-2xl border text-left transition-all active:scale-[0.98] outline-none flex flex-col justify-between h-[100px] cursor-pointer ${
                  paymentMethod === 'CASH'
                    ? `${t.accentBgClass} ${t.accentTextClass} border-transparent shadow-lg shadow-indigo-500/10`
                    : `${t.cardClass} ${t.id === 'dark' ? 'border-slate-800' : 'border-gray-200'} hover:bg-gray-50/50`
                }`}
              >
                <div className="flex justify-between items-start w-full">
                  <div className={`p-2 rounded-xl ${paymentMethod === 'CASH' ? 'bg-white/20' : 'bg-gray-100 dark:bg-slate-800'}`}>
                    <Store className={`w-4 h-4 ${paymentMethod === 'CASH' ? 'text-white' : 'text-gray-600 dark:text-gray-400'}`} />
                  </div>
                  {paymentMethod === 'CASH' && (
                    <div className="w-2 h-2 rounded-full bg-white animate-pulse" />
                  )}
                </div>
                <div>
                  <span className="font-extrabold text-xs block leading-none">Наличные</span>
                  <span className="text-[10px] opacity-75 mt-1 block">При получении</span>
                </div>
              </button>

              {/* Option 2: Card */}
              <button
                type="button"
                onClick={() => { SoundEngine.playTick(); setPaymentMethod('CARD'); }}
                className={`p-4 rounded-2xl border text-left transition-all active:scale-[0.98] outline-none flex flex-col justify-between h-[100px] cursor-pointer ${
                  paymentMethod === 'CARD'
                    ? `${t.accentBgClass} ${t.accentTextClass} border-transparent shadow-lg shadow-indigo-500/10`
                    : `${t.cardClass} ${t.id === 'dark' ? 'border-slate-800' : 'border-gray-200'} hover:bg-gray-50/50`
                }`}
              >
                <div className="flex justify-between items-start w-full">
                  <div className={`p-2 rounded-xl ${paymentMethod === 'CARD' ? 'bg-white/20' : 'bg-gray-100 dark:bg-slate-800'}`}>
                    <CreditCard className={`w-4 h-4 ${paymentMethod === 'CARD' ? 'text-white' : 'text-gray-600 dark:text-gray-400'}`} />
                  </div>
                  {paymentMethod === 'CARD' && (
                    <div className="w-2 h-2 rounded-full bg-white animate-pulse" />
                  )}
                </div>
                <div>
                  <span className="font-extrabold text-xs block leading-none">Карта</span>
                  <span className="text-[10px] opacity-75 mt-1 block">Онлайн / через СБП</span>
                </div>
              </button>

              {/* Option 3: Debt (Only if client has creditLimit > 0) */}
              <button
                type="button"
                disabled={!(currentUser && currentUser.creditLimit > 0)}
                onClick={() => { 
                  if (currentUser && currentUser.creditLimit > 0) {
                    SoundEngine.playTick(); 
                    setPaymentMethod('DEBT'); 
                  }
                }}
                className={`p-4 rounded-2xl border text-left transition-all active:scale-[0.98] outline-none flex flex-col justify-between h-[100px] relative ${
                  !(currentUser && currentUser.creditLimit > 0)
                    ? 'opacity-40 cursor-not-allowed border-gray-200/50 bg-gray-50/20'
                    : paymentMethod === 'DEBT'
                      ? `${t.accentBgClass} ${t.accentTextClass} border-transparent shadow-lg shadow-indigo-500/10`
                      : `${t.cardClass} ${t.id === 'dark' ? 'border-slate-800' : 'border-gray-200'} hover:bg-gray-50/50`
                }`}
              >
                <div className="flex justify-between items-start w-full">
                  <div className={`p-2 rounded-xl ${paymentMethod === 'DEBT' ? 'bg-white/20' : 'bg-gray-100'}`}>
                    <ShieldCheck className={`w-4 h-4 ${paymentMethod === 'DEBT' ? 'text-white' : 'text-gray-600 dark:text-gray-400'}`} />
                  </div>
                  {paymentMethod === 'DEBT' && (
                    <div className="w-2 h-2 rounded-full bg-white animate-pulse" />
                  )}
                  {!(currentUser && currentUser.creditLimit > 0) && (
                    <span className="text-[8px] bg-red-100 text-red-700 font-bold px-1.5 py-0.5 rounded uppercase tracking-wider absolute top-4 right-4">Недоступно</span>
                  )}
                </div>
                <div>
                  <span className="font-extrabold text-xs block leading-none">В долг (Насия)</span>
                  <span className="text-[10px] opacity-75 mt-1 block">
                    {currentUser && currentUser.creditLimit > 0 
                      ? `Лимит: ${currentUser.creditLimit} р.` 
                      : 'Без кредита'}
                  </span>
                </div>
              </button>
            </div>
          </div>
        </div>

        <div className={`p-6 rounded-3xl shadow-lg mt-6 text-white ${t.id === 'dark' ? 'bg-[#1e293b] border border-slate-700' : 'bg-gray-900'}`}>
          <div className="flex justify-between items-center mb-6">
            <span className="text-gray-300 font-medium">К оплате (со скидкой)</span>
            <span className="text-2xl font-black tracking-tight text-white">{formatPrice(cartTotal * (1 - (currentUser?.discountPercentage || 0) / 100))}</span>
          </div>
          <button type="submit" className={`w-full font-black text-xs uppercase tracking-widest rounded-2xl py-4 flex items-center justify-center gap-2 transition-all active:scale-[0.98] outline-none cursor-pointer bg-white text-gray-900 hover:bg-gray-100`}>
            Подтвердить заказ
            <CheckCircle2 className="w-4 h-4 ml-1" />
          </button>
        </div>
      </form>
    </div>
  );

  const renderSuccess = () => (
    <div className="px-4 py-16 flex flex-col items-center text-center space-y-6 max-w-md mx-auto">
      <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", bounce: 0.5 }}>
        <div className={`w-24 h-24 rounded-full flex items-center justify-center ring-8 ${t.accentLightBgClass}`}>
          <CheckCircle className={`w-11 h-11 ${t.id === 'dark' ? 'text-violet-400' : 'text-green-600'}`} />
        </div>
      </motion.div>
      <div>
        <h2 className={`text-3xl font-black tracking-tight mb-3 ${t.textClass}`}>Заявка принята!</h2>
        <p className={`font-semibold text-sm leading-relaxed ${t.mutedTextClass}`}>
          Ваш заказ успешно отправлен на склад комплектации. Отслеживание доступно в личном кабинете.
        </p>
      </div>
      <div className={`rounded-3xl w-full p-6 shadow-sm border ${t.cardClass}`}>
        <div className={`text-xs font-black uppercase tracking-widest mb-2 ${t.mutedTextClass}`}>Номер заявки</div>
        <div className={`text-3xl font-black tracking-widest font-mono ${t.textClass}`}>{orderNumber}</div>
      </div>
      <button 
        onClick={() => { SoundEngine.playTick(); setActiveTab('history'); setOrderType('delivery'); }}
        className={`font-black text-xs uppercase tracking-widest px-8 py-4 rounded-full transition-all w-full active:scale-95 text-white ${t.accentBgClass} ${t.accentHoverBgClass}`}
      >
        Перейти к моим заказам
      </button>
    </div>
  );

  const renderNotifications = () => (
    <AnimatePresence>
      {isNotificationsOpen && (
        <div className="fixed inset-0 z-[150] pointer-events-none">
          <div 
             className="fixed inset-0 bg-black/40 backdrop-blur-sm sm:bg-transparent pointer-events-auto" 
             onClick={() => setIsNotificationsOpen(false)} 
          />
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            className={`absolute top-20 right-4 left-4 sm:left-auto sm:right-6 sm:w-80 max-h-[70vh] overflow-hidden flex flex-col rounded-3xl border shadow-2xl z-50 pointer-events-auto ${t.cardClass}`}
          >
            <div className="p-4 border-b border-black/5 flex items-center justify-between">
              <h3 className={`text-sm font-black uppercase tracking-wider ${t.textClass}`}>Уведомления</h3>
              <button 
                onClick={() => {
                  setNotifications([]);
                  localStorage.setItem('welcome_notification_dismissed', 'true');
                }}
                className={`text-[10px] font-bold uppercase tracking-widest opacity-50 hover:opacity-100 ${t.textClass}`}
              >
                Очистить
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-1">
              {notifications.length === 0 ? (
                <div className="py-12 flex flex-col items-center justify-center opacity-40">
                  <Bell className="w-8 h-8 mb-2" />
                  <p className="text-xs font-bold uppercase tracking-widest text-center">Нет новых<br/>уведомлений</p>
                </div>
              ) : (
                notifications.map((notif) => (
                  <div key={notif.id} className="p-3 rounded-2xl hover:bg-black/5 dark:hover:bg-white/5 transition-colors border border-transparent hover:border-black/5 relative group">
                    <div className="flex gap-3">
                      <div className={`w-8 h-8 rounded-lg shrink-0 flex items-center justify-center ${notif.type === 'success' ? 'bg-green-500/10 text-green-500' : 'bg-sky-500/10 text-sky-500'}`}>
                        {notif.type === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <Bell className="w-4 h-4" />}
                      </div>
                      <div className="flex-1 min-w-0 pr-6">
                        <p className={`text-xs font-bold leading-tight line-clamp-2 ${t.textClass}`}>{notif.message}</p>
                        {notif.orderId && <p className={`text-[9px] font-mono mt-1 opacity-50 ${t.mutedTextClass}`}>ID: {notif.orderId}</p>}
                      </div>
                    </div>
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        SoundEngine.playTick();
                        if (notif.id === 'welcome') {
                          localStorage.setItem('welcome_notification_dismissed', 'true');
                        }
                        setNotifications(prev => prev.filter(n => n.id !== notif.id));
                      }}
                      className="absolute right-2 top-2 p-1 rounded-full opacity-0 group-hover:opacity-100 hover:bg-black/10 dark:hover:bg-white/10 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-opacity"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))
              )}
            </div>
            <div className="p-3 border-t border-black/5 text-center">
               <button 
                 onClick={() => setIsNotificationsOpen(false)}
                 className={`text-[10px] font-black uppercase tracking-widest ${t.mutedTextClass}`}
               >
                 Закрыть
               </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );

  const renderToasts = () => (
    <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[200] flex flex-col items-center gap-3 w-full max-w-[90vw] sm:max-w-md pointer-events-none">
      <AnimatePresence>
        {toasts.map(toast => (
          <motion.div
            key={toast.id}
            initial={{ opacity: 0, y: -20, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.2 } }}
            className={`w-full pointer-events-auto p-4 rounded-2xl border shadow-xl flex items-center gap-3 ${t.cardClass} border-sky-500/20`}
          >
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${toast.type === 'success' ? 'bg-green-500/20 text-green-500' : 'bg-sky-500/20 text-sky-500'}`}>
              {toast.type === 'success' ? <CheckCircle2 className="w-6 h-6" /> : <Bell className="w-6 h-6" />}
            </div>
            <div className="flex-1 min-w-0">
              <p className={`text-sm font-bold leading-tight ${t.textClass}`}>{toast.message}</p>
              {toast.orderId && <p className={`text-[10px] font-mono mt-1 opacity-60 ${t.mutedTextClass}`}>ID: {toast.orderId}</p>}
            </div>
            <button 
              onClick={(e) => { e.stopPropagation(); setToasts(prev => prev.filter(t => t.id !== toast.id)); }}
              className={`p-1 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 ${t.mutedTextClass}`}
            >
              <X className="w-4 h-4" />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );

  if (!currentUser) {
    return renderAuthGate();
  }

  return (
    <div className={`flex h-[100dvh] overflow-hidden selection:bg-gray-900 selection:text-white transition-colors duration-200 relative ${t.bodyClass}`}>
      
      {renderToasts()}
      {renderNotifications()}

      {/* Quick View Modal UI */}
      <AnimatePresence>
        {quickViewProduct && (
          <div className="fixed top-0 left-0 right-0 bottom-[70px] sm:bottom-0 bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center z-[100] sm:p-4" onClick={() => setQuickViewProduct(null)}>
            <motion.div 
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", bounce: 0, duration: 0.4 }}
              onClick={e => e.stopPropagation()}
              className={`w-full max-w-lg h-full sm:h-[85vh] flex flex-col overflow-hidden rounded-none sm:rounded-3xl shadow-2xl ${t.cardClass}`}
            >
              <div className="w-12 h-1 bg-gray-300 dark:bg-gray-600 rounded-full mx-auto my-2.5 shrink-0 sm:hidden" />
              {/* Scrollable Content */}
              <div className="flex-1 overflow-y-auto">
                <div className="relative aspect-[4/3] w-full bg-gray-100 flex-shrink-0">
                  <img 
                    src={quickViewProduct.image} 
                    alt={quickViewProduct.name} 
                    className="w-full h-full aspect-video" 
                  />
                  <button
                    onClick={() => setQuickViewProduct(null)}
                    className="absolute top-4 right-4 w-9 h-9 sm:w-8 sm:h-8 rounded-full bg-black/30 backdrop-blur-md flex items-center justify-center text-white hover:bg-black/50 transition-all cursor-pointer shadow-sm z-10"
                  >
                    <X className="w-5 h-5 sm:w-4 sm:h-4" />
                  </button>
                  {quickViewProduct.article && (
                    <div className="absolute top-4 left-4 bg-white/95 backdrop-blur-sm px-3 py-1.5 rounded-xl text-xs font-mono font-bold tracking-tight text-gray-900 shadow-sm z-10">
                      Арт: {quickViewProduct.article}
                    </div>
                  )}
                </div>
                <div className="p-5 sm:p-6 space-y-4">
                  <div className="flex items-center gap-2 mb-1">
                    <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
                    <span className={`text-xs font-bold ${t.textClass}`}>{quickViewProduct.rating || 4.8} / 5</span>
                    <span className={`text-xs opacity-60 ${t.mutedTextClass}`}>({quickViewProduct.ratingCount || Math.floor(Math.random() * 50) + 10} отзывов)</span>
                  </div>
                  <h2 className={`text-xl sm:text-2xl font-black tracking-tight leading-tight ${t.textClass}`}>
                    {quickViewProduct.name}
                  </h2>
                  
                  {quickViewProduct.description ? (
                     <p className={`text-sm leading-relaxed ${t.textClass} opacity-90`}>{quickViewProduct.description}</p>
                  ) : (
                     <p className={`text-sm leading-relaxed ${t.textClass} opacity-80`}>Подробное описание товара временно отсутствует. Вы можете задать вопросы нашим менеджерам в Telegram или по телефону.</p>
                  )}
                  
                  {/* Reviews Section */}
                  <div className="pt-4 border-t border-black/5 mt-4 space-y-4">
                    <h3 className={`text-sm font-black uppercase tracking-wider ${t.textClass}`}>Отзывы покупателей</h3>
                    
                    {/* Reviews List */}
                    <div className="space-y-3">
                      {Array.isArray(activeReviews) && activeReviews.map((review) => (
                        <motion.div 
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          key={review.id} 
                          className="bg-black/5 dark:bg-white/5 rounded-2xl p-4 border border-black/5"
                        >
                          <div className="flex items-center justify-between mb-2">
                            <span className={`text-xs font-bold w-full ${t.textClass}`}>{review.customerName}</span>
                            <span className={`text-[10px] ${t.mutedTextClass} mr-2 whitespace-nowrap`}>
                              {new Date(review.timestamp).toLocaleDateString('ru-RU')}
                            </span>
                            <div className="flex items-center gap-0.5 shrink-0">
                              {[...Array(5)].map((_, i) => (
                                 <Star key={i} className={`w-3.5 h-3.5 ${i < review.rating ? 'text-yellow-500 fill-yellow-500' : 'text-gray-300 dark:text-gray-600'}`} />
                              ))}
                            </div>
                          </div>
                          <p className={`text-xs leading-relaxed ${t.textClass} opacity-90`}>{review.text}</p>
                        </motion.div>
                      ))}
                      {(!Array.isArray(activeReviews) || activeReviews.length === 0) && (
                        <p className={`text-xs italic ${t.mutedTextClass} text-center py-4`}>
                          Отзывов об этом товаре пока нет. Станьте первым!
                        </p>
                      )}
                    </div>
  
                    {/* Add Review Form */}
                    <div className="bg-black/5 dark:bg-black/40 rounded-3xl p-4 border border-black/5 space-y-3 mt-4">
                      <span className={`text-xs font-bold leading-none block ${t.textClass}`}>Оставить свой отзыв</span>
                      <div className="flex items-center gap-1 cursor-pointer w-max">
                         {[...Array(5)].map((_, i) => (
                           <Star 
                             key={i} 
                             onMouseOver={() => setReviewHoverRating(i + 1)}
                             onMouseLeave={() => setReviewHoverRating(0)}
                             onClick={() => setReviewRating(i + 1)}
                             className={`w-6 h-6 transition-colors ${
                                (reviewHoverRating || reviewRating) > i 
                                  ? 'text-yellow-500 fill-yellow-500' 
                                  : 'text-gray-300 dark:text-gray-600'
                             }`} 
                           />
                         ))}
                      </div>
                      <textarea 
                        placeholder="Напишите ваш отзыв здесь..." 
                        value={reviewText}
                        onChange={(e) => setReviewText(e.target.value)}
                        className={`w-full bg-white dark:bg-[#1a1f2e] text-gray-900 dark:text-white border border-black/10 dark:border-white/5 rounded-2xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/50 transition-colors resize-none h-20 placeholder:text-gray-400 dark:placeholder:text-gray-500`}
                      />
                      <button 
                        onClick={() => quickViewProduct && handleAddReview(quickViewProduct.id)}
                        disabled={reviewRating === 0 || !reviewText.trim()}
                        className={`w-full py-3 rounded-xl font-bold text-xs uppercase tracking-wider text-white shadow-sm transition-transform active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100 ${t.accentBgClass} ${t.accentHoverBgClass}`}
                      >
                        Отправить отзыв
                      </button>
                    </div>
                  </div>
                </div>
              </div>
              
            {/* Sticky Footer for Add to Cart */}
              <div className={`p-4 sm:p-5 border-t shadow-[0_-10px_30px_rgba(0,0,0,0.06)] border-black/5 flex items-center justify-between pb-safe z-20 shrink-0 ${t.cardClass}`}>
                <div>
                  {quickViewProduct.isPromo && quickViewProduct.originalPrice && (
                    <div className="text-xs sm:text-sm text-rose-500 font-bold line-through mb-1">
                      {formatPrice(quickViewProduct.originalPrice)}
                    </div>
                  )}
                  <div className={`font-black text-2xl sm:text-3xl leading-none ${t.textClass}`}>
                    {formatPrice(quickViewProduct.price)}
                  </div>
                  {quickViewProduct.unit && (
                    <div className={`text-xs font-semibold mt-1 opacity-70 ${t.mutedTextClass}`}>
                      цена за {quickViewProduct.unit}
                    </div>
                  )}
                </div>
                
                <div className="flex-1 flex justify-end">
                  <button 
                    onClick={() => {
                      addToCart(quickViewProduct);
                      SoundEngine.playSuccess();
                      setQuickViewProduct(null);
                      setActiveTab('cart');
                    }}
                    className={`px-6 sm:px-8 py-3.5 sm:py-4 rounded-xl flex items-center gap-2 transition-all active:scale-[0.98] shadow-md hover:shadow-lg font-black text-sm uppercase tracking-wider text-white ${t.accentBgClass} ${t.accentHoverBgClass}`}
                  >
                    <ShoppingCart className="w-4 sm:w-5 h-4 sm:h-5 shrink-0" />
                    В корзину
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Desktop Sidebar */}
      <aside className={`hidden md:flex flex-col w-64 border-r shrink-0 z-40 ${t.headerClass}`}>
        {/* Brand Header */}
        <div className="p-6 border-b border-black/5 flex items-center justify-between">
          <div className={`font-black text-xl tracking-tight flex items-center gap-2 ${t.textClass}`}>
            <Sparkles className="w-5 h-5 text-emerald-500 fill-emerald-500 animate-pulse" /> 1000 Мелочей
          </div>
        </div>

        {/* Sidebar Navigation */}
        <nav className="flex-1 px-4 py-6 space-y-1.5 overflow-y-auto scrollbar-none">
          {navItems.map(item => {
            const Icon = item.icon;
            const isActive = activeTab === item.id || (activeTab === 'checkout' && item.id === 'cart') || (activeTab === 'success' && item.id === 'cart');
            return (
              <button
                key={item.id}
                onClick={() => handleTabSwitch(item.id as any)}
                className={`w-full flex items-center justify-between px-4 py-3.5 rounded-2xl font-black text-xs uppercase tracking-widest transition-all outline-none relative cursor-pointer active:scale-98 ${
                  isActive 
                    ? `${t.accentBgClass} ${t.accentTextClass} shadow-md` 
                    : `${t.mutedTextClass} hover:bg-black/5 dark:hover:bg-white/5`
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon className="w-5 h-5" />
                  <span>{item.label}</span>
                </div>
                {item.id === 'cart' && cartItemsCount > 0 && (
                  <span className={`px-2 py-0.5 rounded-lg text-[9px] font-black leading-none ${
                    isActive ? 'bg-white text-emerald-600' : 'bg-red-500 text-white'
                  }`}>
                    {cartItemsCount}
                  </span>
                )}
              </button>
            )
          })}
        </nav>

        {/* Dynamic theme swapper mini rail in footer */}
        <div className="px-6 py-4 border-t border-black/5 flex items-center justify-between">
          <span className={`text-[11px] font-bold ${t.mutedTextClass}`}>Звук</span>
          <button 
            onClick={handleToggleSound}
            className={`p-2 rounded-xl border flex items-center justify-center active:scale-95 transition-all ${t.cardClass}`}
          >
            {soundEnabled ? <Volume2 className="w-4 h-4 text-emerald-500" /> : <VolumeX className="w-4 h-4 text-gray-400" />}
          </button>
        </div>

        {/* Profile Info Card at Bottom */}
        <div className="p-6">
          <div className={`rounded-2xl p-4 border flex items-center gap-3.5 ${t.cardHighlightClass} ${t.borderClass}`}>
            <div className="w-9 h-9 bg-white shadow-sm border rounded-full flex items-center justify-center text-gray-400 shrink-0">
              <User className="w-4 h-4" />
            </div>
            <div className="min-w-0 flex-1">
              <div className={`text-[9px] font-black uppercase tracking-wider opacity-80 ${t.mutedTextClass}`}>Профиль</div>
              <div className={`text-xs font-bold truncate ${t.textClass}`}>{currentUser ? currentUser.name : 'Иван Иванов'}</div>
            </div>
          </div>
        </div>
      </aside>

      {/* --- MAIN CONTENT AREA --- */}
      <main className="flex-1 h-full overflow-y-auto relative z-10 pb-36 md:pb-8 scroll-smooth">
        
        {/* Mobile Header */}
        <header className={`md:hidden sticky top-0 z-40 backdrop-blur-md border-b shadow-[0_2px_12px_rgba(0,0,0,0.02)] pt-safe ${t.headerClass}`}>
          <div className="px-4 h-14 flex items-center justify-between">
            <div className={`font-black text-lg tracking-tight flex items-center gap-2 ${t.textClass}`}>
              <Sparkles className="w-4 h-4 text-emerald-500 fill-emerald-500" /> 1000 Мелочей
            </div>
            {(currentUser?.debt || 0) > 0 && (
               <div className="bg-red-50 text-red-600 border border-red-100 px-3 py-1 rounded-full text-xs font-bold">
                 Долг: {formatPrice(currentUser?.debt || 0)}
               </div>
            )}
          </div>
        </header>

        <div className="py-6 min-h-full">
          {activeTab === 'catalog' && renderCatalog()}
          {activeTab === 'favorites' && renderFavorites()}
          {activeTab === 'cart' && renderCart()}
          {activeTab === 'checkout' && renderCheckout()}
          {activeTab === 'success' && renderSuccess()}
          {activeTab === 'history' && renderHistory()}
          {activeTab === 'profile' && renderProfile()}
        </div>
      </main>

      {/* --- MOBILE BOTTOM NAVIGATIONBAR --- */}
      <div className={`md:hidden fixed bottom-0 left-0 right-0 border-t pb-safe z-[110] shadow-[0_-10px_40px_rgba(0,0,0,0.06)] ${t.headerClass}`}>
        <div className="flex items-center justify-between px-2 pt-2 pb-1.5">
          {navItems.map(item => {
            const Icon = item.icon;
            const isActive = activeTab === item.id || (activeTab === 'checkout' && item.id === 'cart') || (activeTab === 'success' && item.id === 'cart');
            return (
              <button 
                key={item.id} 
                onClick={() => handleTabSwitch(item.id as any)}
                className="relative flex-1 flex flex-col items-center justify-center h-[68px] outline-none cursor-pointer select-none"
              >
                {isActive && (
                  <motion.div 
                     layoutId="bottom-nav-indicator" 
                     className={`absolute top-0 w-10 h-1 rounded-full ${t.accentBgClass}`} 
                     transition={{ type: "spring", stiffness: 450, damping: 30 }}
                  />
                )}
                <div className="relative mt-1">
                  <Icon className={`w-6 h-6 mb-1.5 transition-colors ${isActive ? t.textClass : 'text-slate-400'}`} />
                  {item.id === 'cart' && cartItemsCount > 0 && (
                    <span className="absolute -top-2 -right-3.5 bg-red-500 text-white text-[10px] font-black w-5 h-5 flex items-center justify-center rounded-full z-20 shadow-md ring-2 ring-white">
                      {cartItemsCount}
                    </span>
                  )}
                </div>
                <span className={`text-[10px] whitespace-nowrap uppercase tracking-widest font-black transition-colors leading-none mt-0.5 ${isActive ? t.textClass : 'text-slate-400'}`}>
                  {item.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Telegram Link Handshake Modal UI */}
      {isTgModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <motion.div 
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className={`w-full max-w-md rounded-3xl p-6 border shadow-2xl space-y-5 ${t.cardClass}`}
          >
            <div className="flex justify-between items-start">
              <div className="flex items-center gap-2">
                <MessageCircle className="w-6 h-6 text-sky-500 fill-sky-500" />
                <h3 className={`text-lg font-black tracking-tight ${t.textClass}`}>Привязка Telegram-контроля</h3>
              </div>
              <button 
                onClick={() => { SoundEngine.playTick(); setIsTgModalOpen(false); }}
                className={`p-1.5 rounded-full hover:bg-gray-100 ${t.mutedTextClass}`}
              >
                ✕
              </button>
            </div>
            
            <p className={`text-sm leading-relaxed ${t.mutedTextClass}`}>
              Отправлен запрос на привязку к Telegram-боту <strong>@melochey_control_bot</strong>. Если окно не открылось, пожалуйста, перейдите в Telegram вручную.
            </p>
            <p className={`text-xs border-l-2 border-sky-400 pl-3 ${t.mutedTextClass}`}>
              После нажатия кнопки «Связать с ботом» — откроется Telegram. Нажмите START в боте. Ваш аккаунт будет привязан автоматически.
            </p>
            <button
              onClick={() => { SoundEngine.playTick(); setIsTgModalOpen(false); }}
              className={`w-full py-3.5 rounded-2xl font-black text-xs uppercase tracking-widest text-white ${t.accentBgClass} ${t.accentHoverBgClass}`}
            >
              Понятно
            </button>
          </motion.div>
        </div>
      )}

      {/* Reconciliation Overlay Modal */}
      <AnimatePresence>
        {isReconciliationOpen && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-[150] p-4" onClick={() => setIsReconciliationOpen(false)}>
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={e => e.stopPropagation()}
              className={`w-full max-w-2xl rounded-3xl p-6 border shadow-2xl space-y-5 overflow-hidden flex flex-col max-h-[85vh] ${t.cardClass}`}
            >
              <div className="flex justify-between items-start shrink-0">
                <div>
                  <h3 className={`text-lg font-black tracking-tight ${t.textClass}`}>Акт сверки взаимных расчетов</h3>
                  <p className={`text-xs ${t.mutedTextClass}`}>Детализированная выписка по вашим заказам и платежам</p>
                </div>
                <button 
                  type="button" 
                  onClick={() => { SoundEngine.playTick(); setIsReconciliationOpen(false); }}
                  className={`p-1.5 rounded-full hover:bg-gray-100 dark:hover:bg-white/10 ${t.mutedTextClass}`}
                >
                  ✕
                </button>
              </div>

              <div className="flex-1 overflow-y-auto pr-1">
                {isReconciliationLoading ? (
                  <div className="text-center py-10">
                    <span className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin inline-block"></span>
                    <p className={`text-xs mt-2 ${t.mutedTextClass}`}>Загрузка данных взаиморасчетов...</p>
                  </div>
                ) : !Array.isArray(reconciliationData) || reconciliationData.length === 0 ? (
                  <div className="text-center py-10">
                    <Receipt className="w-12 h-12 mx-auto text-gray-400 opacity-60 mb-2" />
                    <p className={`text-sm font-semibold ${t.textClass}`}>Нет записей</p>
                    <p className={`text-xs mt-1 ${t.mutedTextClass}`}>Транзакции по вашему аккаунту отсутствуют.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* Summary Cards */}
                    <div className="grid grid-cols-3 gap-3 text-center shrink-0">
                      <div className={`p-3 rounded-2xl border bg-black/5 dark:bg-white/5 ${t.borderClass}`}>
                        <span className={`text-[10px] uppercase font-black tracking-wider ${t.mutedTextClass}`}>Всего Покупок</span>
                        <div className={`text-sm sm:text-base font-black ${t.textClass} mt-1`}>
                          {formatPrice(Array.isArray(reconciliationData) ? reconciliationData.reduce((sum, item) => sum + item.debit, 0) : 0)}
                        </div>
                      </div>
                      <div className={`p-3 rounded-2xl border bg-black/5 dark:bg-white/5 ${t.borderClass}`}>
                        <span className={`text-[10px] uppercase font-black tracking-wider ${t.mutedTextClass}`}>Всего Оплачено</span>
                        <div className={`text-sm sm:text-base font-black text-emerald-600 dark:text-emerald-450 mt-1`}>
                          {formatPrice(Array.isArray(reconciliationData) ? reconciliationData.reduce((sum, item) => sum + item.credit, 0) : 0)}
                        </div>
                      </div>
                      <div className={`p-3 rounded-2xl border bg-black/5 dark:bg-white/5 ${t.borderClass}`}>
                        <span className={`text-[10px] uppercase font-black tracking-wider ${t.mutedTextClass}`}>Текущий Долг</span>
                        <div className={`text-sm sm:text-base font-black text-red-600 dark:text-red-400 mt-1`}>
                          {formatPrice(currentUser?.debt || 0)}
                        </div>
                      </div>
                    </div>

                    {/* Transactions Table */}
                    <div className={`border rounded-2xl overflow-hidden ${t.borderClass}`}>
                      <table className="w-full text-left border-collapse text-xs">
                        <thead>
                          <tr className="bg-black/5 dark:bg-white/5 border-b border-black/5 dark:border-white/5 font-black uppercase tracking-wider text-[10px] text-gray-500">
                            <th className="p-3">Дата</th>
                            <th className="p-3">Операция</th>
                            <th className="p-3 text-right">Дебет (₽)</th>
                            <th className="p-3 text-right">Кредит (₽)</th>
                          </tr>
                        </thead>
                        <tbody>
                          {Array.isArray(reconciliationData) && reconciliationData.map((item, idx) => (
                            <tr key={idx} className="border-b border-black/5 dark:border-white/5 hover:bg-black/2">
                              <td className="p-3 opacity-80 whitespace-nowrap font-medium">
                                {new Date(item.timestamp).toLocaleString('ru-RU', {
                                  year: 'numeric',
                                  month: '2-digit',
                                  day: '2-digit',
                                  hour: '2-digit',
                                  minute: '2-digit'
                                })}
                              </td>
                              <td className={`p-3 font-semibold ${t.textClass}`}>
                                {item.description}
                              </td>
                              <td className="p-3 text-right font-bold text-gray-900 dark:text-white">
                                {item.debit > 0 ? formatPrice(item.debit) : '—'}
                              </td>
                              <td className="p-3 text-right font-bold text-emerald-600 dark:text-emerald-400">
                                {item.credit > 0 ? formatPrice(item.credit) : '—'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 gap-3 shrink-0 pt-2 border-t border-black/5">
                <button
                  type="button"
                  onClick={() => { SoundEngine.playTick(); setIsReconciliationOpen(false); }}
                  className={`w-full py-3 rounded-2xl text-xs font-black uppercase tracking-wider text-white ${t.accentBgClass} ${t.accentHoverBgClass} cursor-pointer`}
                >
                  Закрыть выписку
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <style>{`
        .scrollbar-none::-webkit-scrollbar { display: none; }
        .scrollbar-none { -ms-overflow-style: none; scrollbar-width: none; }
        @supports (padding-bottom: env(safe-area-inset-bottom)) {
          .pb-safe { padding-bottom: env(safe-area-inset-bottom); }
          .pt-safe { padding-top: env(safe-area-inset-top); }
        }
      `}</style>
    </div>
  );
}
