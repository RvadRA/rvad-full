/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef } from 'react';
import { Customer, Supplier, Product, Category, SaleTransaction, DebtPayment, BusinessExpense, StockCorrectionLog } from '../types';
import { Users, Truck, Plus, Phone, Search, Building, UserPlus, ShoppingBag, FolderSync, CheckCircle2, ChevronDown, ChevronUp, FileSpreadsheet, Sparkles, UploadCloud, Check, Package, Layers, Info, Trash2, Edit3, Coins, ArrowDownLeft, ArrowUpRight } from 'lucide-react';
import { api } from '../utils/api';
import { useQueryClient } from '@tanstack/react-query';

interface CRMProps {
  customers: Customer[];
  suppliers: Supplier[];
  products: Product[];
  sales: SaleTransaction[];
  debtPayments: DebtPayment[];
  expenses: BusinessExpense[];
  correctionLogs: StockCorrectionLog[];
  onAddCustomer: (customer: Omit<Customer, 'id' | 'debt'>) => void;
  onUpdateCustomer?: (customer: Customer) => void;
  onDeleteCustomer?: (id: string) => void;
  onAddSupplier: (supplier: Omit<Supplier, 'id' | 'debt'>) => void;
  onUpdateSupplier?: (supplier: Supplier) => void;
  onDeleteSupplier?: (id: string) => void;
  onRestockFromSupplier: (productId: string, quantity: number, priceBuy: number, supplierId: string, isCredit?: boolean) => void | Promise<any>;
  onAddProduct: (product: Omit<Product, 'id'> & { id?: string }) => void | Promise<any>;
  categories: Category[];
  onAddCategory: (name: string, skuPrefix?: string) => Category | null | Promise<Category | null>;
  onUpdateProduct?: (product: Product) => void | Promise<any>;
}

export default function CRM({
  customers,
  suppliers,
  products,
  sales,
  debtPayments,
  expenses,
  correctionLogs,
  onAddCustomer,
  onUpdateCustomer,
  onDeleteCustomer,
  onAddSupplier,
  onUpdateSupplier,
  onDeleteSupplier,
  onRestockFromSupplier,
  onAddProduct,
  categories,
  onAddCategory,
  onUpdateProduct
}: CRMProps) {
  const queryClient = useQueryClient();
  const [activeSubTab, setActiveSubTab] = useState<'customers' | 'suppliers' | 'procurement'>('customers');
  
  // Search state
  const [custSearch, setCustSearch] = useState('');
  const [supSearch, setSupSearch] = useState('');
  const [expandedCustomerId, setExpandedCustomerId] = useState<string>('');
  const [expandedSupplierId, setExpandedSupplierId] = useState<string>('');

  // Repayment modal state
  const [showRepayModal, setShowRepayModal] = useState(false);
  const [repaySupplier, setRepaySupplier] = useState<Supplier | null>(null);
  const [repayAmount, setRepayAmount] = useState<string>('');

  // Customer form
  const [showCustModal, setShowCustModal] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [custName, setCustName] = useState('');
  const [custPhone, setCustPhone] = useState('');
  const [custTgChatId, setCustTgChatId] = useState('');
  const [custPassword, setCustPassword] = useState('');
  const [custLimit, setCustLimit] = useState(5000);
  const [custDisc, setCustDisc] = useState(0);
  const [custNotes, setCustNotes] = useState('');

  // Supplier form
  const [showSupModal, setShowSupModal] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [supName, setSupName] = useState('');
  const [supCompany, setSupCompany] = useState('');
  const [supPhone, setSupPhone] = useState('');

  // Procurement order form states
  const [procureProductId, setProcureProductId] = useState<string>(products[0]?.id || '');
  const [procureQty, setProcureQty] = useState<number>(50);
  const [procurePriceBuy, setProcurePriceBuy] = useState<number>(products[0]?.priceBuy || 100);
  const [procureSupplierId, setProcureSupplierId] = useState<string>(suppliers[0]?.id || 'sup-1');
  const [procureIsCredit, setProcureIsCredit] = useState<boolean>(true);

  // Batch Invoice Importer States
  const [selectedTemplate, setSelectedTemplate] = useState<'NONE' | 'REMSNAB' | 'KABELTECH'>('NONE');
  const [draftItems, setDraftItems] = useState<Array<{ name: string; barcode: string; qty: number; priceBuy: number; priceSell: number; isNew: boolean; category: string }>>([]);
  const [batchIsCredit, setBatchIsCredit] = useState<boolean>(true);
  const [importFeedback, setImportFeedback] = useState<string>('');
  
  // Real File Upload Parser States
  const [isParsing, setIsParsing] = useState<boolean>(false);
  const [dragActive, setDragActive] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleLoadTemplateInvoice = (type: 'REMSNAB' | 'KABELTECH') => {
    setSelectedTemplate(type);
    if (type === 'REMSNAB') {
      const items = [
        { name: 'Лампа светодиодная 12W 4000K', barcode: '4601234567890', qty: 15, priceBuy: 95, priceSell: Math.round(95 * 1.35), isNew: !products.some(p => p.barcode === '4601234567890'), category: 'Электрика и Свет' },
        { name: 'Набор отверток СИБРТЕХ 6 шт.', barcode: '4609876543210', qty: 5, priceBuy: 220, priceSell: Math.round(220 * 1.35), isNew: !products.some(p => p.barcode === '4609876543210'), category: 'Инструменты' },
        { name: 'Изолента ПВХ синяя СибРтех 20м', barcode: '4605556667778', qty: 50, priceBuy: 35, priceSell: Math.round(35 * 1.35), isNew: !products.some(p => p.barcode === '4605556667778'), category: 'Расходные материалы' }
      ];
      setDraftItems(items);
      setImportFeedback('Инвойс РемСнаб_Опт_9410.xlsx успешно импортирован во временный буфер!');
    } else {
      const items = [
        { name: 'Кабель медный ВВГнг-LS 3x2.5 ГОСТ', barcode: '4600129381290', qty: 4, priceBuy: 1800, priceSell: Math.round(1800 * 1.35), isNew: !products.some(p => p.barcode === '4600129381290'), category: 'Электрика и Свет' },
        { name: 'Розетка влагозащищенная Werkel IP44', barcode: '4600293129329', qty: 25, priceBuy: 260, priceSell: Math.round(260 * 1.35), isNew: !products.some(p => p.barcode === '4600293129329'), category: 'Электрика и Свет' }
      ];
      setDraftItems(items);
      setImportFeedback('PDF Спецификация_КабельОпт_092.pdf успешно распознана скан-модулем OCR!');
    }
    setTimeout(() => setImportFeedback(''), 4000);
  };

  // Bulk state actions & helpers
  const [bulkCategory, setBulkCategory] = useState<string>('');
  const [bulkMarkup, setBulkMarkup] = useState<string>('');
  
  // Mobile soft keyboard helper actions
  const [focusedItemIndex, setFocusedItemIndex] = useState<number | null>(null);
  const [focusedField, setFocusedField] = useState<'name' | 'barcode' | 'category' | 'qty' | 'priceBuy' | 'priceSell' | null>(null);

  const handleApplyBulkCategory = () => {
    if (!bulkCategory) return;
    setDraftItems(prev => prev.map(item => ({ ...item, category: bulkCategory })));
    setImportFeedback(`✅ Группа "${bulkCategory}" назначена всем позициям в накладной!`);
    setTimeout(() => setImportFeedback(''), 4000);
  };

  const handleApplyBulkMarkup = () => {
    const markupPercent = parseFloat(bulkMarkup);
    if (isNaN(markupPercent)) return;
    setDraftItems(prev => prev.map(item => ({
      ...item,
      priceSell: Math.round(item.priceBuy * (1 + markupPercent / 100))
    })));
    setImportFeedback(`✅ Наценка +${markupPercent}% успешно посчитана для всей накладной!`);
    setTimeout(() => setImportFeedback(''), 4000);
  };

  const handleGenerateMissingBarcodes = () => {
    let count = 0;
    setDraftItems(prev => prev.map(item => {
      if (!item.barcode || item.barcode.trim() === '') {
        count++;
        const localCode = `200${Math.floor(1000000000 + Math.random() * 9000000000)}`;
        return {
          ...item,
          barcode: localCode,
          isNew: !products.some(p => p.barcode === localCode)
        };
      }
      return item;
    }));
    setImportFeedback(`✅ Сгенерировано ${count} уникальных штрих-кодов для недостающих позиций!`);
    setTimeout(() => setImportFeedback(''), 4000);
  };

  const handleUpdateDraftItem = (index: number, fields: Partial<typeof draftItems[0]>) => {
    setDraftItems(prev => {
      const copy = [...prev];
      if (copy[index]) {
        const itemCopy = { ...copy[index], ...fields };
        if (fields.barcode !== undefined) {
          const checkBk = fields.barcode.trim();
          itemCopy.isNew = !products.some(p => p.barcode === checkBk);
        }
        copy[index] = itemCopy;
      }
      return copy;
    });
  };

  const handleGenerateSingleBarcode = (idx: number) => {
    const localCode = `200${Math.floor(1000000000 + Math.random() * 9000000000)}`;
    handleUpdateDraftItem(idx, {
      barcode: localCode,
      isNew: !products.some(p => p.barcode === localCode)
    });
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const processFile = async (file: File) => {
    setIsParsing(true);
    setImportFeedback(`Загрузка файла "${file.name}"...`);
    
    try {
      const reader = new FileReader();
      const fileDataPromise = new Promise<string>((resolve, reject) => {
        reader.onload = () => {
          const result = reader.result as string;
          const base64Data = result.split(',')[1] || result;
          resolve(base64Data);
        };
        reader.onerror = () => reject(new Error("Не удалось прочитать файл"));
        reader.readAsDataURL(file);
      });

      const fileData = await fileDataPromise;
      setImportFeedback(`Распознавание накладной через ИИ (Gemini)... Пожалуйста, подождите 5-10 сек.`);

      // Send existing product catalog context to Gemini for smart matching
      const existingProductsPayload = products.map(p => ({
        name: p.name,
        barcode: p.barcode,
        category: p.category,
        priceBuy: p.priceBuy
      }));

      const parsedData = await api.ai.parseInvoice(
        file.name,
        file.type || 'application/octet-stream',
        fileData,
        existingProductsPayload
      );
      if (parsedData && parsedData.items && parsedData.items.length > 0) {
        // Double check existences again vs latest state
        const itemsWithExits = parsedData.items.map((item: any) => ({
          ...item,
          isNew: !products.some(p => p.barcode === item.barcode),
          priceSell: item.priceSell || Math.round((item.priceBuy || 100) * 1.35)
        }));
        setDraftItems(itemsWithExits);
        setImportFeedback(`✅ Файл "${file.name}" успешно распознан ИИ! Загружено позиций: ${parsedData.items.length}`);
      } else {
        setImportFeedback(`⚠️ ИИ-обработка завершилась без результатов. Убедитесь, что таблица товаров видна на снимке.`);
      }
    } catch (err: any) {
      console.error("Invoice parsing client error:", err);
      setImportFeedback(`❌ Ошибка ИИ-импорта: ${err.message}`);
    } finally {
      setIsParsing(false);
      setTimeout(() => setImportFeedback(''), 8000);
    }
  };

  const handleCommitBatchInvoice = async () => {
    if (draftItems.length === 0) return;
    if (!procureSupplierId) {
      alert('Пожалуйста, выберите поставщика для проведения данной накладной!');
      return;
    }

    setIsParsing(true);
    setImportFeedback('Импорт товаров и проведение накладной в системе...');

    let itemsProcessedCount = 0;
    let newProductsRegistered = 0;
    let totalValue = 0;

    const localCategories = [...categories];

    try {
      for (const item of draftItems) {
        const barcodeToUse = item.barcode?.trim() || '';

        // 1. Automatically register category first if it is a suggested category that doesn't exist yet!
        if (item.category) {
          const catClean = item.category.trim();
          const catLower = catClean.toLowerCase();
          const categoryExistsInDb = localCategories.some(cat => cat.name.trim().toLowerCase() === catLower);
          if (!categoryExistsInDb) {
            console.log(`Auto-creating missing category: "${catClean}" suggested by Invoice Parser`);
            const result = onAddCategory(catClean);
            let newCat: Category | null = null;
            if (result && typeof (result as any).then === 'function') {
              newCat = await result;
            } else {
              newCat = result as Category | null;
            }
            if (newCat) {
              localCategories.push(newCat);
            }
          }
        }

        const matched = barcodeToUse ? products.find(p => p.barcode === barcodeToUse) : null;
        const itemCost = item.qty * item.priceBuy;
        totalValue += itemCost;

        if (matched) {
          // Existing item - restock
          await onRestockFromSupplier(matched.id, item.qty, item.priceBuy, procureSupplierId, batchIsCredit);
          
          // Update product details inline if they changed
          if (onUpdateProduct) {
            await onUpdateProduct({
              ...matched,
              name: item.name,
              category: item.category,
              priceBuy: item.priceBuy,
              priceSell: item.priceSell || matched.priceSell
            });
          }
          itemsProcessedCount++;
        } else {
          // New item - register first, then restock inside App state
          const generatedProductId = `prod-${Math.floor(1000 + Math.random() * 9000)}`;
          
          let prefix = 'UN';
          if (item.category) {
            const catClean = item.category.trim();
            const catLower = catClean.toLowerCase();
            const catObj = localCategories.find(c => c.name.trim().toLowerCase() === catLower);
            prefix = catObj?.skuPrefix || catClean.slice(0, 2).toUpperCase().replace(/[^A-ZА-Я0-9]/g, '') || 'UN';
          }
          
          const prefixProducts = products.filter(p => p.sku && p.sku.startsWith(`${prefix}-`));
          let maxNum = 0;
          prefixProducts.forEach(p => {
            const parts = p.sku.split('-');
            if (parts.length > 1) {
              const num = parseInt(parts[1], 10);
              if (!isNaN(num) && num > maxNum) {
                maxNum = num;
              }
            }
          });
          const nextNum = maxNum + 1;
          const zeroPadded = String(nextNum).padStart(3, '0');
          const generatedSku = `${prefix}-${zeroPadded}`;

          // Add new product with 0 stock initially to register it
          await onAddProduct({
            id: generatedProductId,
            name: item.name,
            barcode: barcodeToUse,
            sku: generatedSku,
            category: item.category,
            priceBuy: item.priceBuy,
            priceSell: item.priceSell || Math.round(item.priceBuy * 1.35), // Default 35% margin markup
            priceWholesale: Math.round(item.priceBuy * 1.25),
            stock: 0,
            unit: 'шт.',
            minStock: 5,
            supplierId: procureSupplierId
          } as any);

          // Now trigger restock for this product (increments inventory stock AND updates supplier debt in credit)
          await onRestockFromSupplier(generatedProductId, item.qty, item.priceBuy, procureSupplierId, batchIsCredit);
          
          newProductsRegistered++;
          itemsProcessedCount++;
        }
      }

      alert(`УСПЕШНО ИМПОРТИРОВАНО!\n\nПроведено позиций: ${itemsProcessedCount}\nВнесено новых товаров в базу: ${newProductsRegistered}\nОбщая сумма поставки: ${totalValue} руб.\nФорма оплаты: ${batchIsCredit ? 'В РАССРОЧКУ (Зарегистрировано в долгах поставщика)' : 'Оплата наличными при отгрузке'}`);
      
      // Clear draft
      setDraftItems([]);
      setSelectedTemplate('NONE');
    } catch (err: any) {
      console.error("Batch import error:", err);
      alert(`Ошибка при импорте партии: ${err.message || err}`);
    } finally {
      setIsParsing(false);
      setImportFeedback('');
    }
  };

  // Sync selected product priceBuy inside procurement form
  const handleProductChange = (prodId: string) => {
    setProcureProductId(prodId);
    const matched = products.find(p => p.id === prodId);
    if (matched) {
      setProcurePriceBuy(matched.priceBuy);
    }
  };

  const fireAddCustomer = (e: React.FormEvent) => {
    e.preventDefault();
    if (!custName || !custPhone) return;
    
    const finalPassword = custPassword === '••••••••' ? undefined : custPassword;
    
    if (editingCustomer && onUpdateCustomer) {
      onUpdateCustomer({
        ...editingCustomer,
        name: custName,
        phone: custPhone,
        telegramChatId: custTgChatId || undefined,
        debtLimit: Number(custLimit),
        discountPercent: Number(custDisc),
        notes: custNotes,
        password: finalPassword
      });
    } else {
      onAddCustomer({
        name: custName,
        phone: custPhone,
        telegramChatId: custTgChatId || undefined,
        debtLimit: Number(custLimit),
        discountPercent: Number(custDisc),
        notes: custNotes,
        password: finalPassword
      });
    }
    setCustName('');
    setCustPhone('');
    setCustTgChatId('');
    setCustNotes('');
    setCustPassword('');
    setEditingCustomer(null);
    setShowCustModal(false);
  };

  const fireAddSupplier = (e: React.FormEvent) => {
    e.preventDefault();
    if (!supName || !supPhone) return;
    
    if (editingSupplier && onUpdateSupplier) {
      onUpdateSupplier({
        ...editingSupplier,
        name: supName,
        company: supCompany,
        phone: supPhone
      });
    } else {
      onAddSupplier({
        name: supName,
        company: supCompany,
        phone: supPhone
      });
    }
    setSupName('');
    setSupCompany('');
    setSupPhone('');
    setEditingSupplier(null);
    setShowSupModal(false);
  };

  const handleRepaySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!repaySupplier) return;
    const cleanAmount = repayAmount.replace(',', '.');
    const parsedAmount = parseFloat(cleanAmount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      alert("Пожалуйста, введите корректную сумму погашения!");
      return;
    }

    const maxAllowed = repaySupplier.debt;
    if (parsedAmount > maxAllowed) {
      alert(`Сумма погашения не может превышать сумму долга (${maxAllowed} руб.)!`);
      return;
    }

    const roundedAmount = Math.round(parsedAmount);

    try {
      // 1. Update supplier debt in database
      const newDebt = Math.max(0, repaySupplier.debt - roundedAmount);
      if (onUpdateSupplier) {
        await onUpdateSupplier({
          ...repaySupplier,
          debt: newDebt
        });
      }

      // 2. Create business expense to track this cash outflow
      await api.expenses.create({
        category: 'Закупка товара',
        amount: roundedAmount,
        date: new Date().toISOString().split('T')[0],
        notes: `Погашение кредитной задолженности перед поставщиком ${repaySupplier.company} (${repaySupplier.name})`
      });

      // 3. Invalidate React Query caches
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      queryClient.invalidateQueries({ queryKey: ['suppliers'] });
      queryClient.invalidateQueries({ queryKey: ['auditLogs'] });

      alert(`Успешно погашен долг перед поставщиком "${repaySupplier.company}" на сумму ${roundedAmount} руб. Текущий остаток долга: ${newDebt} руб.`);
      
      // Close modal & reset state
      setShowRepayModal(false);
      setRepaySupplier(null);
      setRepayAmount('');
    } catch (err: any) {
      console.error("Supplier repayment error:", err);
      alert(`Ошибка при погашении долга: ${err.message || err}`);
    }
  };

  const handleProcureSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!procureProductId || procureQty <= 0) return;
    onRestockFromSupplier(procureProductId, procureQty, procurePriceBuy, procureSupplierId, procureIsCredit);
    
    // Alert cashier/manager about restocking invoice being generated/resolved
    const statusMsg = procureIsCredit 
      ? "Долг перед поставщиком обновлен!" 
      : "Оплачено наличными непосредственно из кассы.";
    alert(`ПРИХОД АКТИВИРОВАН: Товар '${products.find(p => p.id === procureProductId)?.name}' успешно пополнен на ${procureQty} шт. ${statusMsg}`);
    setProcureQty(50);
  };

  const filteredCustomers = customers.filter(c => 
    c.name.toLowerCase().includes(custSearch.toLowerCase()) || 
    c.phone.includes(custSearch)
  );

  const filteredSuppliers = suppliers.filter(s => 
    s.name.toLowerCase().includes(supSearch.toLowerCase()) || 
    s.company.toLowerCase().includes(supSearch.toLowerCase()) || 
    s.phone.includes(supSearch)
  );

  return (
    <div className="space-y-6">
      {/* Tab Switcher inside module */}
      <div className="flex border-b border-slate-800">
        <button
          onClick={() => setActiveSubTab('customers')}
          className={`px-4 py-2.5 text-xs font-bold border-b-2 transition-all cursor-pointer ${
            activeSubTab === 'customers'
              ? 'border-blue-500 text-blue-400 font-mono font-extrabold'
              : 'border-transparent text-slate-500 hover:text-slate-300 font-mono'
          }`}
        >
          Клиентская база (CRM)
        </button>
        <button
          onClick={() => setActiveSubTab('suppliers')}
          className={`px-4 py-2.5 text-xs font-bold border-b-2 transition-all cursor-pointer ${
            activeSubTab === 'suppliers'
              ? 'border-blue-500 text-blue-400 font-mono font-extrabold'
              : 'border-transparent text-slate-500 hover:text-slate-300 font-mono'
          }`}
        >
          Поставщики (База закупа)
        </button>
        <button
          onClick={() => setActiveSubTab('procurement')}
          className={`px-4 py-2.5 text-xs font-bold border-b-2 transition-all cursor-pointer ${
            activeSubTab === 'procurement'
              ? 'border-blue-500 text-blue-400 font-mono font-extrabold'
              : 'border-transparent text-slate-500 hover:text-slate-300 font-mono'
          }`}
        >
          Поставки и Закупки
        </button>
      </div>

      {activeSubTab === 'customers' && (
        <div className="bg-[#161920] p-5 rounded-2xl border border-slate-800/80 shadow-2xl space-y-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
              <Users className="w-4 h-4 text-emerald-450" /> Клиентские аккаунты розничной сети
            </h3>
            
            <button
              onClick={() => {
                setEditingCustomer(null);
                setCustName('');
                setCustPhone('');
                setCustTgChatId('');
                setCustPassword('');
                setCustLimit(5000);
                setCustDisc(0);
                setCustNotes('');
                setShowCustModal(true);
              }}
              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold flex items-center gap-1 cursor-pointer transition"
            >
              <UserPlus className="w-3.5 h-3.5" /> Добавить Клиента
            </button>
          </div>

          <div className="relative">
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
            <input
              type="text"
              placeholder="Введите Фамилию, Имя клиента или телефон..."
              value={custSearch}
              onChange={(e) => setCustSearch(e.target.value)}
              className="w-full bg-[#1C1E26] border border-slate-800 pl-9 pr-3 py-1.5 rounded-xl text-xs text-slate-205 text-slate-200 focus:ring-1 focus:ring-blue-500"
            />
          </div>

          {/* Responsive Card list container with independent scroll */}
          <div className="space-y-4 pr-2 scrollbar-thin scrollbar-thumb-slate-800" style={{ height: 'calc(100vh - 180px)', overflowY: 'auto' }}>
            {filteredCustomers.length === 0 ? (
              <div className="text-center py-10 bg-[#1C1E26]/50 rounded-2xl border border-slate-800 text-slate-500">
                <Users className="w-10 h-10 mx-auto mb-2 opacity-55" />
                <p className="text-xs font-semibold text-slate-400">Клиенты не найдены</p>
                <p className="text-[10px] text-slate-650 text-slate-500">Попробуйте ввести другой поисковый запрос</p>
              </div>
            ) : (
              filteredCustomers.map((c) => {
                const isExpanded = expandedCustomerId === c.id;
                const clientSales = sales.filter((s) => s.customerId === c.id);
                const clientPayments = debtPayments.filter((dp) => dp.customerId === c.id);
                const hasHistory = clientSales.length > 0 || clientPayments.length > 0;
                const hasDebt = c.debt > 0;

                return (
                  <div 
                    key={c.id} 
                    className={`bg-[#1C1E26] rounded-2xl border transition-all duration-300 overflow-hidden ${
                      isExpanded 
                        ? 'border-blue-500 shadow-xl ring-2 ring-blue-500/10' 
                        : 'border-slate-850 hover:border-slate-800 hover:bg-[#1E2129]'
                    }`}
                  >
                    {/* Interactive Header Card */}
                    <div 
                      onClick={() => setExpandedCustomerId(isExpanded ? '' : c.id)}
                      className="p-4 flex flex-col xl:flex-row xl:items-center justify-between gap-4 cursor-pointer select-none"
                    >
                      {/* Avatar Initials + Name + Info Notes */}
                      <div className="flex items-center gap-3.5 min-w-0 flex-1">
                        <div className={`w-11 h-11 rounded-full flex items-center justify-center font-bold text-sm shrink-0 border transition-all ${
                          hasDebt 
                            ? 'bg-rose-500/10 text-rose-400 border-rose-500/20 shadow-[0_0_10px_rgba(244,63,94,0.1)]'
                            : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                        }`}>
                          {c.name.substring(0, 1).toUpperCase()}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-extrabold text-slate-200 text-sm sm:text-base leading-snug truncate block">{c.name}</span>
                            <span className="text-[9px] font-mono text-slate-500 bg-[#161920] px-1.5 py-0.5 rounded border border-slate-800 font-bold shrink-0">#{c.id.slice(-4).toUpperCase()}</span>
                          </div>
                          {c.notes ? (
                            <p className="text-[11px] text-slate-400 mt-1 max-w-xl break-words leading-relaxed whitespace-normal">{c.notes}</p>
                          ) : (
                            <p className="text-[11px] text-slate-500 mt-0.5 italic">Заметки отсутствуют</p>
                          )}
                        </div>
                      </div>

                      {/* Phone, Badges, and Financial states cleanly wrapped */}
                      <div className="flex flex-wrap items-center gap-4 shrink-0 border-t border-slate-800/50 xl:border-0 pt-3 xl:pt-0">
                        {/* Mobile Phone layout */}
                        <div className="flex items-center gap-2 bg-[#161920] px-3 py-1.5 rounded-xl border border-slate-850 font-mono text-xs text-slate-300">
                          <Phone className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                          <span>{c.phone}</span>
                        </div>

                        {/* CRM Badges */}
                        <div className="flex items-center gap-2 font-mono">
                          <div className="bg-emerald-500/10 text-emerald-400 px-2.5 py-1.5 rounded-xl text-[10px] font-black border border-emerald-500/20 tracking-wider">
                            СКИДКА {c.discountPercent}%
                          </div>
                        </div>

                        {/* Balance, Limits and Actions */}
                        <div className="flex items-center gap-3 w-full sm:w-auto mt-2 sm:mt-0 justify-between sm:justify-end">
                          <div className={`px-4 py-1.5 rounded-xl text-right border ${
                            hasDebt 
                              ? 'bg-rose-500/5 text-rose-450 text-rose-400 border-rose-500/15' 
                              : 'bg-emerald-500/5 text-emerald-450 text-emerald-400 border-emerald-500/15'
                          } min-w-[110px]`}>
                            <span className="text-[9px] uppercase tracking-wider font-extrabold text-slate-500 block mb-0.5">Долг (Nasiya):</span>
                            <span className="font-extrabold font-mono text-xs sm:text-sm">{c.debt.toLocaleString()} руб.</span>
                          </div>
                          
                          <div className="px-3 py-1.5 rounded-xl text-right border border-slate-850 bg-[#161920] min-w-[95px]">
                            <span className="text-[9px] uppercase tracking-wider font-extrabold text-slate-500 block mb-0.5 font-mono">Лимит долга:</span>
                            <span className="font-mono text-xs text-slate-300">{c.debtLimit.toLocaleString()} р.</span>
                          </div>

                          <div className="text-slate-500 hover:text-slate-200 transition shrink-0 pl-1">
                            {isExpanded ? (
                              <ChevronUp className="w-5 h-5 text-blue-400 animate-bounce" />
                            ) : (
                              <ChevronDown className="w-5 h-5" />
                            )}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Expandable History layout with internal independent scrolls */}
                    {isExpanded && (
                      <div className="bg-[#121419] p-4 border-t border-slate-800 animate-in slide-in-from-top-3 duration-250">
                        <div className="space-y-4 text-xs">
                          <div className="flex justify-between items-center border-b border-slate-800/80 pb-2">
                            <span className="text-slate-100 font-extrabold flex items-center gap-2 font-mono uppercase tracking-wider text-xs">
                              <FileSpreadsheet className="w-4 h-4 text-blue-400" /> История Финансовых Операций Клиента
                            </span>
                            <div className="flex items-center gap-3">
                              <span className="text-[10px] font-mono text-slate-500 font-bold">код: {c.id}</span>
                              <div className="flex gap-1.5 ml-2">
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setEditingCustomer(c);
                                    setCustName(c.name);
                                    setCustPhone(c.phone);
                                    setCustTgChatId(c.telegramChatId || '');
                                    setCustLimit(c.debtLimit);
                                    setCustDisc(c.discountPercent);
                                    setCustNotes(c.notes || '');
                                    setCustPassword(c.passwordHash ? '••••••••' : '');
                                    setShowCustModal(true);
                                  }}
                                  className="flex items-center gap-1 text-[10px] px-2 py-1 bg-blue-600/10 hover:bg-blue-600/20 text-blue-400 border border-blue-500/20 rounded font-bold transition"
                                >
                                  <Edit3 className="w-3 h-3" />
                                  Редактировать
                                </button>
                                {onDeleteCustomer && (
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      if (confirm(`Вы уверены, что хотите удалить клиента ${c.name}?`)) {
                                        onDeleteCustomer(c.id);
                                      }
                                    }}
                                    className="text-[10px] px-2 py-1 bg-rose-600/10 hover:bg-rose-600/20 text-rose-400 border border-rose-500/20 rounded font-bold transition"
                                  >
                                    Удалить
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>

                          {!hasHistory ? (
                            <div className="text-center py-8 text-slate-500 flex flex-col items-center justify-center bg-black/10 rounded-2xl border border-slate-850">
                              <Info className="w-8 h-8 text-slate-700 mb-1.5" />
                              <p className="text-[11px] font-extrabold">История за сессию отсутствует</p>
                              <p className="text-[10px] text-slate-600 max-w-sm mt-0.5">Клиент не оформлял рассрочек и не гасил долгов за сегодняшний рабочий день.</p>
                            </div>
                          ) : (
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                              {/* Purchases list */}
                              <div className="space-y-2">
                                <span className="text-[10px] font-black text-blue-450 text-blue-400 uppercase font-mono tracking-wider flex items-center gap-1">
                                  🛒 Чек-листы и Приобретенные товары
                                </span>
                                <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1 border border-slate-850 p-2.5 rounded-2xl bg-black/20">
                                  {clientSales.map((sale) => (
                                    <div key={sale.id} className="bg-[#1A1D24] border border-slate-805 border-slate-800/70 p-3 rounded-xl space-y-1.5">
                                      <div className="flex justify-between font-mono text-[9.5px] text-slate-400">
                                        <span>{new Date(sale.timestamp).toLocaleString('ru-RU')}</span>
                                        <span className="font-extrabold text-white uppercase bg-blue-500/10 px-1.5 py-0.5 rounded border border-blue-500/20">#{sale.id.slice(-5).toUpperCase()}</span>
                                      </div>
                                      
                                      <div className="space-y-1 font-sans text-slate-300 text-[11px]">
                                        {sale.items.map((it, idx) => (
                                          <div key={idx} className="flex justify-between gap-3 border-b border-slate-800/30 pb-1 last:border-none last:pb-0">
                                            <span className="text-slate-300 truncate font-bold" title={it.productName}>{it.productName}</span>
                                            <span className="font-mono text-slate-400 shrink-0">{it.quantity} х {it.priceSell} р.</span>
                                          </div>
                                        ))}
                                      </div>
                                      
                                      <div className="flex justify-between items-baseline pt-2 border-t border-slate-800/60 text-[11px] font-mono">
                                        <span className="text-slate-500 text-[9px] uppercase font-bold">Оплата: {sale.paymentMethod === 'DEBT' ? 'В долг (Nasiya)' : 'Касса'}</span>
                                        <span className="font-bold text-emerald-400">{sale.finalPrice} руб.</span>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>

                              {/* Repayments list */}
                              <div className="space-y-2">
                                <span className="text-[10px] font-black text-emerald-450 text-emerald-400 uppercase font-mono tracking-wider flex items-center gap-1">
                                  💰 Погашения задолженностей ({clientPayments.length})
                                </span>
                                <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1 border border-slate-850 p-2.5 rounded-2xl bg-black/20">
                                  {clientPayments.map((p) => (
                                    <div key={p.id} className="bg-[#1A1D24] border border-slate-800/85 p-3 rounded-xl flex justify-between items-center gap-3">
                                      <div>
                                        <span className="font-black text-emerald-400 block font-mono text-xs">+{p.amount.toLocaleString()} р.</span>
                                        <span className="text-[9.5px] text-slate-500 font-mono block mt-0.5">{new Date(p.timestamp).toLocaleString('ru-RU')}</span>
                                      </div>
                                      <div>
                                        <span className="bg-emerald-500/10 text-emerald-300 border border-emerald-500/15 text-[10px] px-3 py-1 rounded-full font-bold">
                                          {p.paymentMethod === 'CASH' ? 'Наличные' : 'Карта'}
                                        </span>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {activeSubTab === 'suppliers' && (
        <div className="bg-[#161920] p-5 rounded-2xl border border-slate-800/80 shadow-2xl space-y-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
              <Truck className="w-4 h-4 text-blue-400" /> Реестр оптовых дистрибьюторов (Партнеры)
            </h3>
            
            <button
              onClick={() => setShowSupModal(true)}
              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold flex items-center gap-1 cursor-pointer transition animate-none"
            >
              <Plus className="w-3.5 h-3.5" /> Добавить Поставщика
            </button>
          </div>

          <div className="relative">
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
            <input
              type="text"
              placeholder="Поиск по компании, имени или телефону поставщика..."
              value={supSearch}
              onChange={(e) => setSupSearch(e.target.value)}
              className="w-full bg-[#1C1E26] border border-slate-800 pl-9 pr-3 py-1.5 rounded-xl text-xs text-slate-200 focus:ring-1 focus:ring-blue-505"
            />
          </div>

          {/* Responsive list of Suppliers with independent vertical scroll */}
          <div className="space-y-4 pr-2 scrollbar-thin scrollbar-thumb-slate-800" style={{ height: 'calc(100vh - 180px)', overflowY: 'auto' }}>
            {filteredSuppliers.length === 0 ? (
              <div className="text-center py-10 bg-[#1C1E26]/50 rounded-2xl border border-slate-800 text-slate-500">
                <Truck className="w-10 h-10 mx-auto mb-2 opacity-55" />
                <p className="text-xs font-semibold text-slate-400 font-sans">Поставщики не найдены</p>
                <p className="text-[10px] text-slate-550 text-slate-500">Попробуйте ввести другой поисковый запрос</p>
              </div>
            ) : (
              filteredSuppliers.map((s) => {
                const isExpanded = expandedSupplierId === s.id;
                
                // 1. Gather product IDs and restocks for this supplier
                const supplierProductIds = products.filter(p => p.supplierId === s.id).map(p => p.id);
                const supplierRestocks = correctionLogs.filter(log => log.type === 'RESTOCK' && supplierProductIds.includes(log.productId));
                
                // 2. Gather payments (expenses) matching notes
                const supplierPayments = expenses.filter(e => 
                  e.category === 'Закупка товара' && 
                  e.notes && 
                  (e.notes.toLowerCase().includes(s.company.toLowerCase()) || 
                   e.notes.toLowerCase().includes(s.name.toLowerCase()))
                );

                // 3. Map to common history event schema
                const restockEvents = supplierRestocks.map(log => {
                  const qty = log.newStock - log.oldStock;
                  const prod = products.find(p => p.id === log.productId);
                  const price = prod?.priceBuy || 0;
                  const total = qty * price;
                  return {
                    id: log.id,
                    date: new Date(log.timestamp).toISOString(),
                    type: 'SUPPLY',
                    title: 'Поставка товара',
                    description: `${log.productName} (${qty} шт.)`,
                    amount: total
                  };
                });

                const paymentEvents = supplierPayments.map(e => {
                  const isDebtRepay = e.notes?.includes('Погашение');
                  return {
                    id: e.id,
                    date: new Date(e.timestamp).toISOString(),
                    type: 'PAYMENT',
                    title: isDebtRepay ? 'Погашение долга' : 'Оплата закупа (наличные)',
                    description: e.notes || 'Выплата поставщику',
                    amount: e.amount
                  };
                });

                const history = [...restockEvents, ...paymentEvents].sort((a, b) => b.date.localeCompare(a.date));

                return (
                  <div 
                    key={s.id}
                    className={`bg-[#1C1E26] rounded-2xl border transition-all duration-300 overflow-hidden ${
                      isExpanded 
                        ? 'border-blue-500 shadow-xl ring-2 ring-blue-500/10' 
                        : 'border-slate-850 hover:border-slate-800 hover:bg-[#1E2129]'
                    }`}
                  >
                    {/* Header: Clickable to expand */}
                    <div 
                      onClick={() => setExpandedSupplierId(isExpanded ? '' : s.id)}
                      className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 cursor-pointer select-none"
                    >
                      {/* Left segment: Supplier Avatar & Company Name & Representative Contact Person */}
                      <div className="flex items-center gap-3.5 min-w-0 flex-1">
                        <div className="w-11 h-11 rounded-full bg-[#161920] border border-slate-800/80 flex items-center justify-center shrink-0">
                          <Building className="w-5 h-5 text-blue-400" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <span className="font-extrabold text-slate-100 text-base block leading-snug truncate">{s.company}</span>
                          <div className="flex items-center gap-1.5 mt-1">
                            <span className="text-[10px] bg-blue-500/10 text-blue-400 font-extrabold px-1.5 py-0.5 rounded uppercase font-mono tracking-wider">Представитель:</span>
                            <span className="text-xs text-slate-300 font-semibold">{s.name}</span>
                          </div>
                        </div>
                      </div>

                      {/* Right segment: Contact mobile + Financial balance indicator + Actions */}
                      <div className="flex flex-wrap sm:flex-nowrap items-center gap-3 md:gap-3.5 justify-between md:justify-end shrink-0 pt-3 md:pt-0 border-t border-slate-800/50 md:border-0">
                        <div className="flex items-center gap-2 bg-[#161920] px-3 py-1.5 rounded-xl border border-slate-850 font-mono text-xs text-slate-300">
                          <Phone className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                          <span>{s.phone}</span>
                        </div>

                        <div className={`px-4 py-1.5 rounded-xl text-right border ${
                          s.debt > 0 
                            ? 'bg-amber-500/5 text-amber-450 text-amber-400 border-amber-500/15 shadow-[0_0_10px_rgba(245,158,11,0.05)]' 
                            : 'bg-slate-800/30 text-slate-500 border-slate-800/50'
                        } min-w-[140px]`}>
                          <span className="text-[9px] uppercase tracking-wider font-extrabold text-slate-500 block mb-0.5">Кредит (Наш долг):</span>
                          <span className="font-extrabold font-mono text-xs sm:text-sm">{s.debt.toLocaleString()} руб.</span>
                        </div>

                        <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                          {s.debt > 0 && (
                            <button
                              type="button"
                              onClick={() => {
                                setRepaySupplier(s);
                                setRepayAmount(String(s.debt));
                                setShowRepayModal(true);
                              }}
                              className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs flex items-center gap-1 cursor-pointer transition shadow-lg shadow-emerald-950/20"
                              title="Погасить долг"
                            >
                              <Coins className="w-3.5 h-3.5" />
                              <span>Погасить</span>
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => {
                              setEditingSupplier(s);
                              setSupName(s.name);
                              setSupCompany(s.company);
                              setSupPhone(s.phone);
                              setShowSupModal(true);
                            }}
                            className="p-2 bg-blue-600/10 hover:bg-blue-600/20 text-blue-400 border border-blue-500/20 rounded-xl transition"
                            title="Редактировать"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                          
                          {onDeleteSupplier && (
                            <button
                              type="button"
                              onClick={() => {
                                if (confirm(`Вы уверены, что хотите удалить поставщика ${s.company}?`)) {
                                  onDeleteSupplier(s.id);
                                }
                              }}
                              className="p-2 bg-rose-600/10 hover:bg-rose-600/20 text-rose-400 border border-rose-500/20 rounded-xl transition"
                              title="Удалить"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}

                          {isExpanded ? (
                            <ChevronUp className="w-4 h-4 text-slate-500 ml-1 shrink-0" />
                          ) : (
                            <ChevronDown className="w-4 h-4 text-slate-500 ml-1 shrink-0" />
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Expandable Body: History of mutual settlements & shipments */}
                    {isExpanded && (
                      <div className="border-t border-slate-850 bg-[#161920]/40 p-4 space-y-3">
                        <div className="flex justify-between items-center border-b border-slate-850 pb-2">
                          <h4 className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                            <Coins className="w-3.5 h-3.5 text-blue-400" />
                            <span>История Взаиморасчётов и Поставок</span>
                          </h4>
                          <span className="text-[9px] text-slate-500 font-mono">
                            Всего записей: {history.length}
                          </span>
                        </div>

                        {history.length === 0 ? (
                          <div className="text-center py-6 text-slate-500 italic text-[10px]">
                            История операций по данному поставщику пуста.
                          </div>
                        ) : (
                          <div className="overflow-x-auto scrollbar-thin scrollbar-thumb-slate-800">
                            <table className="w-full text-left border-collapse text-[10px]">
                              <thead>
                                <tr className="border-b border-slate-800 text-slate-500 font-bold uppercase tracking-wider">
                                  <th className="py-2 px-1">Дата</th>
                                  <th className="py-2 px-1">Операция</th>
                                  <th className="py-2 px-1">Детали / Примечания</th>
                                  <th className="py-2 px-1 text-right">Сумма</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-850 text-slate-300 font-mono">
                                {history.map((h) => (
                                  <tr key={h.id} className="hover:bg-[#1C1E26]/40 transition">
                                    <td className="py-2 px-1 text-slate-500 whitespace-nowrap">
                                      {new Date(h.date).toLocaleDateString('ru-RU', {
                                        day: '2-digit',
                                        month: '2-digit',
                                        year: 'numeric',
                                        hour: '2-digit',
                                        minute: '2-digit'
                                      })}
                                    </td>
                                    <td className="py-2 px-1 whitespace-nowrap">
                                      <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold ${
                                        h.type === 'SUPPLY' 
                                          ? 'bg-blue-500/10 text-blue-400' 
                                          : 'bg-emerald-500/10 text-emerald-450 text-emerald-400'
                                      }`}>
                                        {h.type === 'SUPPLY' ? (
                                          <ArrowUpRight className="w-3 h-3 text-blue-400" />
                                        ) : (
                                          <ArrowDownLeft className="w-3 h-3 text-emerald-450 text-emerald-400" />
                                        )}
                                        {h.title}
                                      </span>
                                    </td>
                                    <td className="py-2 px-1 max-w-[240px] truncate text-slate-400 font-sans" title={h.description}>
                                      {h.description}
                                    </td>
                                    <td className={`py-2 px-1 text-right font-black ${
                                      h.type === 'SUPPLY' ? 'text-slate-300' : 'text-emerald-400'
                                    }`}>
                                      {h.type === 'SUPPLY' ? `+` : `-`}{h.amount.toLocaleString()} руб.
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {activeSubTab === 'procurement' && (
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
          {/* Restocking order card */}
          <div className="md:col-span-4 bg-[#161920] p-5 rounded-2xl border border-slate-800/80 shadow-2xl space-y-4">
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-500 font-mono">Входящие закупки</span>
              <h3 className="text-sm font-bold text-white flex items-center gap-1 mt-0.5">
                <ShoppingBag className="w-4 h-4 text-emerald-400" /> Сформировать Поставку
              </h3>
            </div>

            <form onSubmit={handleProcureSubmit} className="space-y-4 text-xs">
              <div className="space-y-1">
                <label className="block text-slate-400 font-semibold">Выбрать товар для закупа:</label>
                <select
                  value={procureProductId}
                  onChange={(e) => handleProductChange(e.target.value)}
                  className="w-full bg-[#1C1E26] border border-slate-800 p-2 rounded-xl text-slate-200"
                >
                  {products.map(p => (
                    <option key={p.id} value={p.id} className="bg-[#1C1E26] text-slate-200">
                      {p.name} (Ост: {p.stock} шт)
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="block text-slate-400 font-semibold">Выберите Поставщика:</label>
                <select
                  value={procureSupplierId}
                  onChange={(e) => setProcureSupplierId(e.target.value)}
                  className="w-full bg-[#1C1E26] border border-slate-800 p-2 rounded-xl text-slate-200"
                >
                  {suppliers.map(s => (
                    <option key={s.id} value={s.id} className="bg-[#1C1E26] text-slate-200">{s.company} — {s.name}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3 text-slate-200">
                <div className="space-y-1">
                  <label className="block text-slate-400 font-semibold">Количество (для прихода):</label>
                  <input
                    type="number"
                    value={procureQty}
                    onChange={(e) => setProcureQty(Number(e.target.value))}
                    className="w-full bg-[#1C1E26] border border-slate-800 p-2 rounded-xl text-white font-mono"
                  />
                </div>
                <div className="space-y-1">
                  <label className="block text-slate-400 font-semibold">Цена закупки шт. (руб.):</label>
                  <input
                    type="number"
                    value={procurePriceBuy}
                    onChange={(e) => setProcurePriceBuy(Number(e.target.value))}
                    className="w-full bg-[#1C1E26] border border-slate-800 p-2 rounded-xl text-white font-mono"
                  />
                </div>
              </div>

              {/* Installment configuration toggle */}
              <div className="bg-[#1C1E26] border border-slate-800/80 p-2.5 rounded-xl space-y-1.5 flex items-center justify-between col-span-2">
                <div>
                  <span className="font-bold text-white block">Поставка под реализацию</span>
                  <span className="text-[10px] text-slate-500 block leading-tight">Оформить накладную в рассрочку (кредит)</span>
                </div>
                <input
                  type="checkbox"
                  checked={procureIsCredit}
                  onChange={(e) => setProcureIsCredit(e.target.checked)}
                  className="w-4 h-4 cursor-pointer accent-blue-500"
                />
              </div>

              <div className="pt-2 border-t border-slate-800 text-slate-400 text-[11px] space-y-1 font-mono">
                <div className="flex justify-between">
                  <span>Общая сумма накладной:</span>
                  <span className="font-extrabold text-white text-xs">{(procureQty * procurePriceBuy)} руб.</span>
                </div>
                <p className="text-[10px] leading-relaxed italic text-blue-400 font-sans mt-1">
                  * Поступление автоматически увеличит складской баланс. {procureIsCredit ? 'Сумма накладной запишется в Кредитный Долг магазина перед выбранным поставщиком.' : 'Сумма накладной оплачена наличными непосредственно из кассы.'}
                </p>
              </div>

              <button
                type="submit"
                className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-xl cursor-pointer"
              >
                <FolderSync className="w-3.5 h-3.5" />
                Оформить накладную доставки
              </button>
            </form>
          </div>

          {/* RIGHT SIDE: Excel/PDF Batch parser playgrond */}
          <div className="md:col-span-8 bg-[#161920] p-5 rounded-2xl border border-slate-800/80 shadow-2xl space-y-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 border-b border-slate-800 pb-3">
              <div>
                <span className="text-[10px] uppercase font-bold text-blue-400 font-mono tracking-wider">Модуль парсинга накладных</span>
                <h3 className="text-sm font-bold text-white flex items-center gap-1.5 mt-0.5">
                  <FileSpreadsheet className="w-4 h-4 text-blue-400" /> Импорт накладных поставщика (Excel / PDF)
                </h3>
              </div>
              <span className="text-[9.5px] bg-blue-500/10 text-blue-300 font-bold px-2 py-0.5 rounded-md border border-blue-500/15 font-mono">
                Sandbox Mode v1.0
              </span>
            </div>

            {/* Real File Upload & Visual Drag and Drop Area */}
            <div className="space-y-3">
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                accept=".png,.jpg,.jpeg,.pdf,.xlsx,.xls"
                className="hidden"
                id="invoice-file-upload-input"
              />
              
              <div
                onDragEnter={handleDrag}
                onDragOver={handleDrag}
                onDragLeave={handleDrag}
                onDrop={handleDrop}
                onClick={() => {
                  if (!isParsing) fileInputRef.current?.click();
                }}
                className={`border-2 border-dashed rounded-2xl p-6 text-center space-y-3 cursor-pointer transition-all duration-200 ${
                  dragActive
                    ? 'border-blue-500 bg-blue-500/10'
                    : 'border-slate-800 hover:border-blue-500/50 bg-[#1C1E26]/30 hover:bg-[#1C1E26]/70'
                } ${isParsing ? 'pointer-events-none opacity-60' : ''}`}
                id="invoice-dragzone"
              >
                {isParsing ? (
                  <Sparkles className="w-10 h-10 text-blue-400 mx-auto animate-spin" />
                ) : (
                  <UploadCloud className={`w-10 h-10 mx-auto transition-transform ${dragActive ? 'scale-110 text-blue-400' : 'text-slate-500'}`} />
                )}
                
                <div className="space-y-1">
                  <p className="font-bold text-slate-200 text-xs sm:text-sm">
                    {isParsing ? 'ИИ распознает накладную...' : 'Перетащите сюда фото накладной, PDF или Excel'}
                  </p>
                  <p className="text-[10px] text-slate-400 font-medium">
                    Сфотографируйте бумажную накладную/чеки или прикрепите готовый файл.
                  </p>
                  <p className="text-[9.5px] text-slate-500 font-mono">
                    Поддерживаются форматы: JPG, PNG, PDF, XLSX, XLS
                  </p>
                </div>
                
                {!isParsing && (
                  <span className="text-[10px] text-blue-400 font-bold bg-blue-500/10 border border-blue-500/15 px-3 py-1 rounded-lg inline-block hover:bg-blue-500/20 active:scale-95 transition">
                    Выбрать файл на устройстве
                  </span>
                )}
              </div>
            </div>

            {/* Quick Demo Simulators Row */}
            <div className="bg-[#1C1E26]/20 p-3 rounded-xl border border-slate-900 space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-[10.5px] uppercase font-bold text-slate-500 tracking-wider font-mono">Демо-шаблоны для быстрой проверки:</span>
                <span className="text-[9.5px] text-slate-400 italic">Имитируют успешную загрузку файлов без выбора с диска</span>
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button 
                  type="button"
                  disabled={isParsing}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleLoadTemplateInvoice('REMSNAB');
                  }}
                  className="flex items-center gap-2 bg-[#1C1E26] hover:bg-slate-800 text-left p-2.5 rounded-lg border border-slate-800 text-xs text-slate-200 transition cursor-pointer disabled:opacity-50"
                  id="demo-invoice-remsnab"
                >
                  <FileSpreadsheet className="w-4 h-4 text-blue-500 shrink-0" />
                  <div>
                    <span className="font-bold text-slate-200 block text-[11px]">РемСнаб_Опт_9410.xlsx</span>
                    <span className="text-[9.5px] text-slate-500 block font-mono">Excel-инвойс на 3 товара</span>
                  </div>
                </button>

                <button 
                  type="button"
                  disabled={isParsing}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleLoadTemplateInvoice('KABELTECH');
                  }}
                  className="flex items-center gap-2 bg-[#1C1E26] hover:bg-slate-800 text-left p-2.5 rounded-lg border border-slate-800 text-xs text-slate-200 transition cursor-pointer disabled:opacity-50"
                  id="demo-invoice-kabeltech"
                >
                  <FileSpreadsheet className="w-4 h-4 text-emerald-500 shrink-0" />
                  <div>
                    <span className="font-bold text-slate-200 block text-[11px]">Спецификация_Кабель_092.pdf</span>
                    <span className="text-[9.5px] text-slate-500 block font-mono">PDF-фактура на 2 товара</span>
                  </div>
                </button>
              </div>
            </div>

            {importFeedback && (
              <div className="bg-blue-900/20 border border-blue-800/80 p-3 rounded-xl flex items-center gap-2 text-blue-300 text-xs font-semibold">
                <Sparkles className="w-4 h-4 shrink-0 text-blue-400 animate-pulse" />
                <span>{importFeedback}</span>
              </div>
            )}

            {/* Draft list parsed table view with inline editing and bulk tools */}
            {draftItems.length > 0 ? (
              <div className="space-y-4 animate-in fade-in duration-200">
                
                {/* BULK ACTIONS CONTROL PANEL */}
                <div className="bg-[#161920]/90 border border-slate-800/80 p-4 rounded-2xl space-y-3 shadow-md">
                  <div className="flex items-center gap-2 text-indigo-400 font-bold text-xs uppercase tracking-wider font-mono">
                    <Sparkles className="w-4 h-4 text-indigo-400" />
                    <span>Панель массовых изменений накладной</span>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 text-xs">
                    {/* 1. Category Bulk Set */}
                    <div className="space-y-1.5 bg-[#1C1E26]/50 p-2.5 rounded-xl border border-slate-800/50">
                      <label className="text-slate-400 font-semibold block">Массовая группа / категория:</label>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          list="bulk-cats-list"
                          placeholder="Примените ко всем..."
                          value={bulkCategory}
                          onChange={(e) => setBulkCategory(e.target.value)}
                          className="w-full bg-[#161920] border border-slate-800 text-xs p-1.5 rounded-lg text-slate-200 focus:outline-none focus:border-indigo-500 font-sans"
                        />
                        <button
                          type="button"
                          onClick={handleApplyBulkCategory}
                          className="px-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-[10.5px] font-bold transition whitespace-nowrap active:scale-95 cursor-pointer"
                        >
                          Применить
                        </button>
                      </div>
                    </div>

                    {/* 2. Bulk Markup Percent Settings */}
                    <div className="space-y-1.5 bg-[#1C1E26]/50 p-2.5 rounded-xl border border-slate-800/50">
                      <label className="text-slate-400 font-semibold block">Рассчитать цену продаж (% наценки):</label>
                      <div className="flex gap-2">
                        <select
                          value={bulkMarkup}
                          onChange={(e) => setBulkMarkup(e.target.value)}
                          className="w-full bg-[#161920] border border-slate-800 text-xs p-1.5 rounded-lg text-slate-200 focus:outline-none focus:border-indigo-500"
                        >
                          <option value="">Выберите % наценки...</option>
                          <option value="15">+15% прибавка</option>
                          <option value="25">+25% прибавка</option>
                          <option value="35">+35% прибавка (стандарт)</option>
                          <option value="50">+50% маржа</option>
                          <option value="100">+100% (2x цена)</option>
                        </select>
                        <button
                          type="button"
                          onClick={handleApplyBulkMarkup}
                          disabled={!bulkMarkup}
                          className="px-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 disabled:opacity-50 text-white rounded-lg text-[10.5px] font-bold transition whitespace-nowrap active:scale-95 cursor-pointer"
                        >
                          Применить
                        </button>
                      </div>
                    </div>

                    {/* 3. Barcode Batch Repair */}
                    <div className="space-y-1.5 bg-[#1C1E26]/50 p-2.5 rounded-xl border border-slate-800/50 flex flex-col justify-between">
                      <label className="text-slate-400 font-semibold block">Утерянные или пустые Штрих-коды:</label>
                      <button
                        type="button"
                        onClick={handleGenerateMissingBarcodes}
                        className="w-full bg-slate-800 hover:bg-slate-700 hover:text-white text-slate-200 border border-slate-700 py-1.5 rounded-lg transition text-[10.5px] font-bold flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <FolderSync className="w-3.5 h-3.5 text-amber-500" />
                        Сгенерировать пустые ШК
                      </button>
                    </div>
                  </div>
                </div>

                <div className="flex justify-between items-baseline">
                  <span className="text-[10.5px] font-bold text-indigo-400 font-mono">ПРЕДВАРИТЕЛЬНЫЙ СПИСОК (ВСЕ ПОЛЯ РЕДАКТИРУЮТСЯ ПОШТУЧНО):</span>
                  <span className="text-[11px] text-white font-bold font-mono">Итог закупки: {draftItems.reduce((acc, c) => acc + (c.qty * c.priceBuy), 0).toLocaleString()} руб.</span>
                </div>

                {/* Datalists for categories */}
                <datalist id="cats-list">
                  {categories.map((c, idx) => (
                    <option key={idx} value={c.name} />
                  ))}
                </datalist>
                <datalist id="bulk-cats-list">
                  {categories.map((c, idx) => (
                    <option key={idx} value={c.name} />
                  ))}
                </datalist>

                {/* DESKTOP TABLE VIEW (HIDDEN ON MOBILE SUBTAB) */}
                <div className="hidden md:block overflow-x-auto border border-slate-800/80 rounded-xl">
                  <table className="w-full text-left text-[11px] min-w-[700px]">
                    <thead className="bg-[#1C1E26] text-slate-400 font-mono">
                      <tr className="border-b border-slate-800/80">
                        <th className="p-2.5 w-[33%]">Товар / Код</th>
                        <th className="p-2.5 w-[22%]">Группа / Категория</th>
                        <th className="p-2.5 text-center w-[12%]">Кол-во</th>
                        <th className="p-2.5 text-center w-[15%]">Закуп (шт.)</th>
                        <th className="p-2.5 text-center w-[15%]">Продажа (шт.)</th>
                        <th className="p-2.5 text-center w-[8%]">Маркер</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/50 text-slate-300">
                      {draftItems.map((item, idx) => {
                        const markup = item.priceSell && item.priceBuy ? Math.round(((item.priceSell - item.priceBuy) / item.priceBuy) * 100) : 0;
                        return (
                          <tr key={idx} className="hover:bg-slate-900/20 bg-[#161920]">
                            {/* Product Name & Barcodes Inline Editing */}
                            <td className="p-2.5 space-y-1">
                              <input
                                type="text"
                                value={item.name || ''}
                                onChange={(e) => handleUpdateDraftItem(idx, { name: e.target.value })}
                                className="w-full bg-[#1C1E26] border border-slate-850 focus:border-indigo-500 rounded p-1 text-white font-sans text-[11px] focus:outline-none"
                              />
                              <div className="flex gap-1.5 items-center">
                                <span className="text-[9px] text-slate-500 font-mono">ШК:</span>
                                <input
                                  type="text"
                                  placeholder="Нет кода"
                                  value={item.barcode || ''}
                                  onChange={(e) => handleUpdateDraftItem(idx, { barcode: e.target.value })}
                                  className={`grow bg-[#1C1E26] border ${!item.barcode ? 'border-amber-500/50 text-amber-500' : 'border-slate-850 text-indigo-300'} rounded p-0.5 px-1 font-mono text-[10px] focus:outline-none focus:border-indigo-500`}
                                />
                                {!item.barcode && (
                                  <button
                                    type="button"
                                    onClick={() => handleGenerateSingleBarcode(idx)}
                                    className="bg-amber-500/10 hover:bg-amber-500/20 text-amber-500 px-1 py-0.5 rounded border border-amber-500/20 text-[9px] font-bold cursor-pointer transition"
                                  >
                                    + ШК
                                  </button>
                                )}
                              </div>
                            </td>

                            {/* Editable category autocomplete via datalist */}
                            <td className="p-2.5">
                              <input
                                list="cats-list"
                                value={item.category || ''}
                                placeholder="Выберите группу"
                                onChange={(e) => handleUpdateDraftItem(idx, { category: e.target.value })}
                                className="w-full bg-[#1C1E26] border border-slate-850 rounded p-1 text-[11px] text-indigo-350 focus:outline-none focus:border-indigo-500 font-bold"
                              />
                            </td>

                            {/* Qty Inline */}
                            <td className="p-2.5 text-center">
                              <input
                                type="number"
                                min="1"
                                value={item.qty || 0}
                                onChange={(e) => handleUpdateDraftItem(idx, { qty: Math.max(1, parseInt(e.target.value) || 1) })}
                                className="w-14 bg-[#1C1E26] border border-slate-850 rounded p-1 text-center font-mono font-bold text-white focus:outline-none focus:border-indigo-500"
                              />
                            </td>

                            {/* Price Buy Inline */}
                            <td className="p-2.5 text-center">
                              <input
                                type="number"
                                min="0"
                                value={item.priceBuy || 0}
                                onChange={(e) => handleUpdateDraftItem(idx, { priceBuy: Math.max(0, parseInt(e.target.value) || 0) })}
                                className="w-16 bg-[#1C1E26] border border-slate-850 rounded p-1 text-center font-mono text-slate-300 focus:outline-none focus:border-indigo-500"
                              />
                            </td>

                            {/* Price Sell Inline with Margin Preview */}
                            <td className="p-2.5 text-center space-y-0.5">
                              <input
                                type="number"
                                min="0"
                                value={item.priceSell || 0}
                                onChange={(e) => handleUpdateDraftItem(idx, { priceSell: Math.max(0, parseInt(e.target.value) || 0) })}
                                className="w-16 bg-[#1C1E26] border border-purple-900/30 focus:border-emerald-500 rounded p-1 text-center font-mono font-black text-emerald-400 focus:outline-none"
                              />
                              <span className={`text-[8.5px] block font-mono font-extrabold ${markup >= 35 ? 'text-emerald-500' : markup >= 15 ? 'text-blue-400' : 'text-slate-500'}`}>
                                Наценка: +{markup}%
                              </span>
                            </td>

                            {/* New label or existing match label */}
                            <td className="p-2.5 text-center">
                              {item.isNew ? (
                                <span className="bg-amber-500/10 text-amber-500 border border-amber-500/15 px-1.5 py-0.5 rounded text-[9px] font-bold block text-center">
                                  Новый
                                </span>
                              ) : (
                                <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/15 px-1.5 py-0.5 rounded text-[9px] font-bold block text-center">
                                  В базе
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* MOBILE SCREEN CARDS VIEW (SHOWN ONLY ON MOBILE VIEWPORTS) */}
                <div className="block md:hidden space-y-4">
                  {draftItems.map((item, idx) => {
                    const markup = item.priceSell && item.priceBuy ? Math.round(((item.priceSell - item.priceBuy) / item.priceBuy) * 100) : 0;
                    const isCardFocused = focusedItemIndex === idx;
                    
                    return (
                      <div
                        key={idx}
                        id={`draft-card-${idx}`}
                        className={`p-4 rounded-2xl border transition-all duration-300 ${isCardFocused ? 'bg-[#1e2330] border-indigo-500 ring-1 ring-indigo-500/20 shadow-xl' : 'bg-[#161920] border-slate-800/80 shadow-md'}`}
                      >
                        {/* Header with name input and delete button */}
                        <div className="flex justify-between items-start gap-3 mb-3">
                          <div className="bg-slate-900/40 p-2 rounded-xl border border-slate-800/60 grow">
                            <label className="block text-[9px] font-mono text-slate-500 font-bold uppercase tracking-wider mb-0.5">Название товара</label>
                            <input
                              type="text"
                              value={item.name}
                              onFocus={() => {
                                setFocusedItemIndex(idx);
                                setFocusedField('name');
                                setTimeout(() => {
                                  document.getElementById(`draft-card-${idx}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                }, 300);
                              }}
                              onChange={(e) => handleUpdateDraftItem(idx, { name: e.target.value })}
                              className="w-full bg-transparent border-none text-white font-extrabold text-[13px] focus:outline-none focus:ring-0 p-0"
                            />
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              const updated = draftItems.filter((_, i) => i !== idx);
                              setDraftItems(updated);
                              if (focusedItemIndex === idx) {
                                setFocusedItemIndex(null);
                                setFocusedField(null);
                              }
                            }}
                            className="bg-rose-500/10 hover:bg-rose-500/20 active:scale-90 text-rose-400 p-3 rounded-xl border border-rose-500/15 cursor-pointer transition shrink-0"
                            title="Исключить товар"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>

                        {/* Status tag */}
                        <div className="flex gap-2 mb-4">
                          {item.isNew ? (
                            <span className="bg-amber-500/10 text-amber-500 border border-amber-500/15 px-2.5 py-0.5 rounded-lg text-[9px] font-mono font-bold">
                              🆕 Новый товар
                            </span>
                          ) : (
                            <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/15 px-2.5 py-0.5 rounded-lg text-[9px] font-mono font-bold">
                              ✅ Есть в базе
                            </span>
                          )}
                          <span className="bg-slate-800 text-slate-400 px-2 py-0.5 rounded-lg text-[9px] font-mono font-bold">
                            Позиция {idx + 1}
                          </span>
                        </div>

                        {/* Large Touch-friendly inputs */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                          {/* 1. Barcode field */}
                          <div className="space-y-1 bg-[#1C1E26]/60 p-2.5 rounded-xl border border-slate-800/60">
                            <label className="text-slate-400 font-bold text-[10px] uppercase font-mono tracking-wider flex justify-between items-center">
                              <span>Штрих-код (крупное поле):</span>
                              {!item.barcode && <span className="text-amber-500 animate-pulse">Требуется ШК</span>}
                            </label>
                            <div className="flex gap-1.5 items-center">
                              <input
                                type="text"
                                placeholder="Нет штрих-кода"
                                value={item.barcode}
                                onFocus={() => {
                                  setFocusedItemIndex(idx);
                                  setFocusedField('barcode');
                                  setTimeout(() => {
                                    document.getElementById(`draft-card-${idx}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                  }, 300);
                                }}
                                onChange={(e) => handleUpdateDraftItem(idx, { barcode: e.target.value })}
                                className={`grow w-full bg-[#161920] border ${!item.barcode ? 'border-amber-500/40 text-amber-500' : 'border-slate-800 text-indigo-350'} rounded-lg p-3 font-mono font-bold text-xs focus:outline-none focus:border-indigo-500`}
                              />
                              <button
                                type="button"
                                onClick={() => handleGenerateSingleBarcode(idx)}
                                className="bg-amber-500/15 hover:bg-amber-500/25 active:scale-95 text-amber-400 font-extrabold px-3 py-3 rounded-lg border border-amber-500/15 transition text-xs shrink-0 cursor-pointer"
                                title="Сгенерировать ШК"
                              >
                                + ШК
                              </button>
                            </div>
                          </div>

                          {/* 2. Category selection */}
                          <div className="space-y-1 bg-[#1C1E26]/60 p-2.5 rounded-xl border border-slate-800/60">
                            <label className="block text-slate-400 font-bold text-[10px] uppercase font-mono tracking-wider">Категория (крупное поле):</label>
                            <input
                              list="cats-list"
                              value={item.category}
                              placeholder="Нажмите для выбора"
                              onFocus={() => {
                                setFocusedItemIndex(idx);
                                setFocusedField('category');
                                setTimeout(() => {
                                  document.getElementById(`draft-card-${idx}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                }, 300);
                              }}
                              onChange={(e) => handleUpdateDraftItem(idx, { category: e.target.value })}
                              className="w-full bg-[#161920] border border-slate-800 rounded-lg p-3 text-indigo-300 font-bold text-xs focus:outline-none focus:border-indigo-500"
                            />
                          </div>

                          {/* Qty, Buy, Sell settings row */}
                          <div className="grid grid-cols-3 gap-2 col-span-1 sm:col-span-2">
                            {/* Qty */}
                            <div className="space-y-1 bg-[#1C1E26]/60 p-2.5 rounded-xl border border-slate-800/60">
                              <label className="block text-slate-400 font-bold text-[9px] uppercase font-mono tracking-wider text-center">Кол-во:</label>
                              <input
                                type="number"
                                min="1"
                                value={item.qty}
                                onFocus={() => {
                                  setFocusedItemIndex(idx);
                                  setFocusedField('qty');
                                  setTimeout(() => {
                                    document.getElementById(`draft-card-${idx}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                  }, 300);
                                }}
                                onChange={(e) => handleUpdateDraftItem(idx, { qty: Math.max(1, parseInt(e.target.value) || 1) })}
                                className="w-full bg-[#161920] border border-slate-800 rounded-lg p-2.5 text-center font-mono font-bold text-white focus:outline-none focus:border-indigo-500 text-xs"
                              />
                            </div>

                            {/* Buy price */}
                            <div className="space-y-1 bg-[#1C1E26]/60 p-2.5 rounded-xl border border-slate-800/60">
                              <label className="block text-slate-400 font-bold text-[9px] uppercase font-mono tracking-wider text-center">Закуп. руб:</label>
                              <input
                                type="number"
                                min="0"
                                value={item.priceBuy}
                                onFocus={() => {
                                  setFocusedItemIndex(idx);
                                  setFocusedField('priceBuy');
                                  setTimeout(() => {
                                    document.getElementById(`draft-card-${idx}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                  }, 300);
                                }}
                                onChange={(e) => handleUpdateDraftItem(idx, { priceBuy: Math.max(0, parseInt(e.target.value) || 0) })}
                                className="w-full bg-[#161920] border border-slate-800 rounded-lg p-2.5 text-center font-mono font-bold text-slate-305 text-slate-300 focus:outline-none focus:border-indigo-500 text-xs"
                              />
                            </div>

                            {/* Sell price */}
                            <div className="space-y-1 bg-[#1C1E26]/60 p-2.5 rounded-xl border border-slate-800/60">
                              <label className="block text-emerald-400 font-bold text-[9px] uppercase font-mono tracking-wider text-center">Цена продажи:</label>
                              <input
                                type="number"
                                min="0"
                                value={item.priceSell || 0}
                                onFocus={() => {
                                  setFocusedItemIndex(idx);
                                  setFocusedField('priceSell');
                                  setTimeout(() => {
                                    document.getElementById(`draft-card-${idx}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                  }, 300);
                                }}
                                onChange={(e) => handleUpdateDraftItem(idx, { priceSell: Math.max(0, parseInt(e.target.value) || 0) })}
                                className="w-full bg-[#161920] border border-purple-900/30 focus:border-emerald-500 rounded-lg p-2.5 text-center font-mono font-black text-emerald-400 focus:outline-none text-xs"
                              />
                              <span className={`text-[8px] text-center block font-mono font-extrabold ${markup >= 35 ? 'text-emerald-500' : markup >= 15 ? 'text-blue-400' : 'text-slate-500'}`}>
                                +{markup}%
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* FLOATING QUICK ACTIONS ACCESSORY BAR FOR MOBILE KEYBOARD */}
                {focusedItemIndex !== null && (
                  <div className="fixed bottom-0 left-0 right-0 bg-[#0A0C10]/95 backdrop-blur-md border-t border-slate-800/90 p-3 z-50 animate-in slide-in-from-bottom duration-200 block md:hidden shadow-2xl">
                    <div className="max-w-md mx-auto flex items-center justify-between gap-2 text-xs">
                      {/* Left: Active field descriptor */}
                      <div className="space-y-0.5 shrink-0">
                        <span className="text-[9px] uppercase font-mono font-bold text-slate-500">Активное поле:</span>
                        <div className="text-white font-extrabold flex items-center gap-1">
                          <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-ping" />
                          {focusedField === 'name' && 'Название товара'}
                          {focusedField === 'barcode' && 'Штрих-код'}
                          {focusedField === 'category' && 'Группа / Категория'}
                          {focusedField === 'qty' && 'Количество'}
                          {focusedField === 'priceBuy' && 'Цена закупки'}
                          {focusedField === 'priceSell' && 'Розница (продажа)'}
                        </div>
                      </div>

                      {/* Right: Actions strip */}
                      <div className="flex items-center gap-1.5 overflow-x-auto py-1">
                        {focusedField === 'priceSell' && (
                          <button
                            type="button"
                            onClick={() => {
                              const item = draftItems[focusedItemIndex];
                              if (item && item.priceBuy) {
                                const suggested = Math.round(item.priceBuy * 1.35);
                                handleUpdateDraftItem(focusedItemIndex, { priceSell: suggested });
                              }
                            }}
                            className="bg-emerald-500/10 hover:bg-emerald-500/20 active:scale-95 text-emerald-400 font-bold border border-emerald-500/20 px-2.5 py-1.5 rounded-xl transition text-[10.5px] cursor-pointer whitespace-nowrap"
                          >
                            ⚡ Наценка +35%
                          </button>
                        )}
                        
                        {focusedField === 'barcode' && (
                          <button
                            type="button"
                            onClick={() => handleGenerateSingleBarcode(focusedItemIndex)}
                            className="bg-amber-500/10 hover:bg-amber-500/20 active:scale-95 text-amber-500 font-bold border border-amber-500/20 px-2.5 py-1.5 rounded-xl transition text-[10.5px] cursor-pointer whitespace-nowrap"
                          >
                            🔑 Спец. Штрихкод
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => {
                            const updated = draftItems.filter((_, i) => i !== focusedItemIndex);
                            setDraftItems(updated);
                            setFocusedItemIndex(null);
                            setFocusedField(null);
                          }}
                          className="bg-rose-500/15 hover:bg-rose-500/25 active:scale-95 text-rose-400 font-bold border border-rose-500/15 px-2.5 py-1.5 rounded-xl transition text-[10.5px] cursor-pointer"
                        >
                          ❌ Исключить
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            if (document.activeElement instanceof HTMLElement) {
                              document.activeElement.blur();
                            }
                            setFocusedItemIndex(null);
                            setFocusedField(null);
                          }}
                          className="bg-slate-800 hover:bg-slate-700 active:scale-95 text-slate-200 font-extrabold px-3 py-1.5 rounded-xl transition text-[10.5px] cursor-pointer"
                        >
                          Готово ✓
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Submitting controls inside importer */}
                <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between bg-[#1C1E26]/50 p-4 rounded-xl border border-slate-800/60">
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      id="optCredit"
                      checked={batchIsCredit}
                      onChange={(e) => setBatchIsCredit(e.target.checked)}
                      className="w-4 h-4 accent-blue-500 shrink-0 cursor-pointer"
                    />
                    <label htmlFor="optCredit" className="text-slate-350 select-none cursor-pointer">
                      <span className="font-bold text-white block">Оформить накладную в рассрочку (кредит)</span>
                      <span className="text-[10px] text-slate-500 block">Занесет сумму {draftItems.reduce((acc, c) => acc + (c.qty * c.priceBuy), 0).toLocaleString()} руб. в кредиторский долг поставщика</span>
                    </label>
                  </div>

                  <button
                    onClick={handleCommitBatchInvoice}
                    className="py-2 px-5 bg-blue-600 hover:bg-blue-500 hover:scale-[1.02] text-white font-extrabold rounded-xl transition text-xs shadow-lg flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Check className="w-4 h-4 text-white" /> Внести всю накладную на склад
                  </button>
                </div>
              </div>
            ) : (
              <div className="p-6 bg-[#161920]/60 border border-dashed border-slate-800 rounded-xl text-center space-y-2 py-12">
                <FileSpreadsheet className="w-10 h-10 text-slate-600 mx-auto" />
                <div className="text-xs text-slate-400 space-y-1">
                  <p className="font-bold text-white">Вы не выбрали инвойс для парсинга</p>
                  <p>Пожалуйста, нажмите на один из двух демонстрационных файлов выше для симуляции импорта.</p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* RENDER ADD CUSTOMER MODAL */}
      {showCustModal && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <form
            onSubmit={fireAddCustomer}
            className="bg-[#0A0C10] rounded-3xl p-6 w-full max-w-sm border border-slate-800 shadow-2xl space-y-4 text-slate-200 animate-in fade-in zoom-in-95 duration-205"
          >
            <h3 className="font-extrabold text-white text-sm">{editingCustomer ? 'Редактировать Профиль Клиента' : 'Создание Профиля Клиента'}</h3>
            
            <div className="space-y-3 text-xs">
              <div className="space-y-1">
                <label className="block text-slate-400 font-semibold">Фамилия, Имя клиента:</label>
                <input
                  type="text"
                  required
                  placeholder="Например: Асад Рузиев"
                  value={custName}
                  onChange={(e) => setCustName(e.target.value)}
                  className="w-full bg-[#1C1E26] border border-slate-800 p-2 rounded-xl text-slate-200"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-slate-400 font-semibold font-mono">Номер телефона:</label>
                <input
                  type="text"
                  required
                  placeholder="+7 (999) 000-00-00"
                  value={custPhone}
                  onChange={(e) => setCustPhone(e.target.value)}
                  className="w-full bg-[#1C1E26] border border-slate-800 p-2 rounded-xl text-slate-200 font-mono"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-slate-400 font-semibold font-mono">Пароль (для личного кабинета):</label>
                <input
                  type="password"
                  placeholder={
                    editingCustomer 
                      ? (editingCustomer.passwordHash ? "•••••••• (пароль установлен, введите для изменения)" : "Задайте пароль (не установлен)") 
                      : "Задайте пароль клиента"
                  }
                  value={custPassword}
                  onChange={(e) => setCustPassword(e.target.value)}
                  className="w-full bg-[#1C1E26] border border-slate-800 p-2 rounded-xl text-slate-200"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-[10px] text-sky-400 font-bold uppercase tracking-widest">Telegram Chat ID (необязательно):</label>
                <input
                  type="text"
                  placeholder="ID чата для бота"
                  value={custTgChatId}
                  onChange={(e) => setCustTgChatId(e.target.value)}
                  className="w-full bg-[#1C1E26] border border-slate-800 p-2 rounded-xl text-sky-400 font-mono"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="block text-slate-400 font-semibold">Лимит долга (руб.):</label>
                  <input
                    type="number"
                    placeholder="5000"
                    value={custLimit}
                    onChange={(e) => setCustLimit(Number(e.target.value))}
                    className="w-full bg-[#1C1E26] border border-slate-800 p-2 rounded-xl text-slate-200 font-mono"
                  />
                </div>
                <div className="space-y-1">
                  <label className="block text-slate-400 font-semibold">Скидка гостя %:</label>
                  <input
                    type="number"
                    max={15}
                    placeholder="0"
                    value={custDisc}
                    onChange={(e) => setCustDisc(Number(e.target.value))}
                    className="w-full bg-[#1C1E26] border border-slate-800 p-2 rounded-xl text-slate-200 font-mono"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="block text-slate-400 font-semibold">Служебные заметки:</label>
                <textarea
                  rows={2}
                  placeholder="Работает на рынке, павильон хозтоваров..."
                  value={custNotes}
                  onChange={(e) => setCustNotes(e.target.value)}
                  className="w-full bg-[#1C1E26] border border-slate-800 p-2 rounded-xl text-slate-200 focus:ring-1 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="flex gap-2 pt-4 border-t border-slate-800">
              <button
                type="submit"
                className="flex-1 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl text-xs cursor-pointer"
              >
                {editingCustomer ? 'Сохранить изменения' : 'Сохранить профиль'}
              </button>
              <button
                type="button"
                onClick={() => setShowCustModal(false)}
                className="py-2 px-3 border border-slate-800 bg-[#1C1E26] text-slate-300 rounded-xl hover:bg-slate-800 text-xs font-semibold cursor-pointer"
              >
                Отмена
              </button>
            </div>
          </form>
        </div>
      )}

      {/* RENDER ADD SUPPLIER MODAL */}
      {showSupModal && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <form
            onSubmit={fireAddSupplier}
            className="bg-[#0A0C10] rounded-3xl p-6 w-full max-w-sm border border-slate-800 shadow-2xl space-y-4 text-slate-200 animate-in fade-in zoom-in-95 duration-205"
          >
            <h3 className="font-extrabold text-white text-sm">{editingSupplier ? 'Редактировать Поставщика' : 'Включение Нового Поставщика'}</h3>
            
            <div className="space-y-3 text-xs">
              <div className="space-y-1">
                <label className="block text-slate-400 font-semibold">ФИО представителя:</label>
                <input
                  type="text"
                  required
                  placeholder="ИП Смирнов О.Л."
                  value={supName}
                  onChange={(e) => setSupName(e.target.value)}
                  className="w-full bg-[#1C1E26] border border-slate-800 p-2 rounded-xl text-slate-200"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-slate-400 font-semibold">Название дистрибьютора:</label>
                <input
                  type="text"
                  placeholder="РосЭлектроХимСнаб"
                  value={supCompany}
                  onChange={(e) => setSupCompany(e.target.value)}
                  className="w-full bg-[#1C1E26] border border-slate-800 p-2 rounded-xl text-slate-200"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-slate-400 font-semibold">Контактный телефон:</label>
                <input
                  type="text"
                  required
                  placeholder="+7 (999) 011-22-33"
                  value={supPhone}
                  onChange={(e) => setSupPhone(e.target.value)}
                  className="w-full bg-[#1C1E26] border border-slate-800 p-2 rounded-xl text-slate-200 font-mono"
                />
              </div>
            </div>

            <div className="flex gap-2 pt-4 border-t border-slate-800">
              <button
                type="submit"
                className="flex-1 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl text-xs cursor-pointer"
              >
                {editingSupplier ? 'Сохранить изменения' : 'Внести дистрибьютора'}
              </button>
              <button
                type="button"
                onClick={() => setShowSupModal(false)}
                className="py-2 px-3 border border-slate-800 bg-[#1C1E26] text-slate-300 rounded-xl hover:bg-[#161920] text-xs font-semibold cursor-pointer"
              >
                Отмена
              </button>
            </div>
          </form>
        </div>
      )}
      {/* RENDER REPAY DEBT MODAL */}
      {showRepayModal && repaySupplier && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <form
            onSubmit={handleRepaySubmit}
            className="bg-[#0A0C10] rounded-3xl p-6 w-full max-w-sm border border-slate-800 shadow-2xl space-y-4 text-slate-200 animate-in fade-in zoom-in-95 duration-200"
          >
            <div className="flex items-center gap-2 text-emerald-400">
              <Coins className="w-5 h-5" />
              <h3 className="font-extrabold text-white text-sm">Погашение долга поставщику</h3>
            </div>

            <div className="bg-[#161920]/60 p-3.5 rounded-2xl border border-slate-850 space-y-1.5 text-xs text-slate-300">
              <div>
                <span className="text-[10px] text-slate-550 text-slate-500 uppercase tracking-wider font-extrabold block">Поставщик:</span>
                <span className="font-bold text-white text-sm">{repaySupplier.company}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-550 text-slate-500 uppercase tracking-wider font-extrabold block">Представитель:</span>
                <span className="font-medium">{repaySupplier.name}</span>
              </div>
              <div className="pt-2 border-t border-slate-800 flex justify-between items-center">
                <span className="text-[10px] text-slate-550 text-slate-400 font-bold uppercase tracking-wider">Текущий долг:</span>
                <span className="font-black text-rose-400 font-mono text-sm">{repaySupplier.debt.toLocaleString()} руб.</span>
              </div>
            </div>

            <div className="space-y-1.5 text-xs">
              <label className="block text-slate-400 font-semibold">Сумма выплаты (руб.):</label>
              <input
                type="text"
                required
                placeholder={`Введите сумму до ${repaySupplier.debt}`}
                value={repayAmount}
                onChange={(e) => {
                  const valStr = e.target.value;
                  // Replace comma with dot
                  const cleanStr = valStr.replace(',', '.');
                  const numericVal = parseFloat(cleanStr);
                  if (!isNaN(numericVal)) {
                    // Cap at maximum debt amount
                    if (numericVal > repaySupplier.debt) {
                      setRepayAmount(String(repaySupplier.debt));
                    } else {
                      setRepayAmount(valStr);
                    }
                  } else {
                    setRepayAmount(valStr);
                  }
                }}
                className="w-full bg-[#1C1E26] border border-slate-800 p-2.5 rounded-xl text-slate-200 font-mono focus:ring-1 focus:ring-emerald-500 text-sm"
              />
              <span className="text-[9px] text-slate-500 font-mono block">
                * Оплата наличными из кассы будет записана в общие бизнес-расходы («Закупка товара»).
              </span>
            </div>

            <div className="flex gap-2 pt-4 border-t border-slate-800">
              <button
                type="submit"
                className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs cursor-pointer shadow-lg shadow-emerald-950/20"
              >
                Подтвердить платеж
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowRepayModal(false);
                  setRepaySupplier(null);
                  setRepayAmount('');
                }}
                className="py-2 px-3 border border-slate-800 bg-[#1C1E26] text-slate-300 rounded-xl hover:bg-slate-800 text-xs font-semibold cursor-pointer"
              >
                Отмена
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
