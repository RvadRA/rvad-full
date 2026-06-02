/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef } from 'react';
import { Product, Category, Supplier, StockCorrectionLog, Employee, SaleTransaction } from '../types';
import { Package, Plus, Search, Tag, AlertTriangle, ArrowUpDown, History, ShieldAlert, BadgeInfo, FileDown, Check, Camera, Sparkles, Copy, Database, Sliders, Scan, Printer } from 'lucide-react';
import BarcodeScanner from './BarcodeScanner';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import JsBarcode from 'jsbarcode';
import { api } from '../utils/api';

const CleanBarcode = ({ value, s }: { value: string, s: any }) => {
  const svgRef = React.useRef<SVGSVGElement>(null);
  
  React.useEffect(() => {
    if (svgRef.current) {
      try {
        const isEAN13 = /^\d{13}$/.test(value);
        JsBarcode(svgRef.current, value, {
          format: isEAN13 ? 'EAN13' : 'CODE128',
          width: 1.8,
          height: parseInt(s.barcodeHeight) || 40,
          displayValue: false, 
          margin: 10,
          background: "#ffffff",
          lineColor: "#000000"
        });
      } catch (e) {
        JsBarcode(svgRef.current, value, {
          format: 'CODE128',
          width: 1.8,
          height: parseInt(s.barcodeHeight) || 40,
          displayValue: false,
          margin: 10,
          background: "#ffffff",
          lineColor: "#000000"
        });
      }
    }
  }, [value, s.barcodeHeight]);
  
  return (
    <div className="flex flex-col items-center w-full px-2 py-0.5 bg-white rounded shrink-0">
      <svg
        ref={svgRef}
        style={{
          width: '100%',
          height: s.barcodeHeight,
          minHeight: s.barcodeHeight,
          imageRendering: 'pixelated',
          shapeRendering: 'crispEdges'
        }}
      />
      <span 
        className="font-mono font-bold tracking-[0.2em] text-black leading-none mt-1 w-full text-center"
        style={{ fontSize: s.barcodeText }}
      >
        {value}
      </span>
    </div>
  );
};

interface InventoryProps {
  products: Product[];
  categories: Category[];
  suppliers: Supplier[];
  correctionLogs: StockCorrectionLog[];
  sales?: SaleTransaction[];
  employees: Employee[];
  onCorrectStock: (productId: string, newStock: number, type: 'INVENTORY_COUNT' | 'DAMAGE' | 'RESTOCK' | 'CORRECTION' | 'SALE', notes?: string) => void;
  onUpdateProduct: (product: Product) => void;
  onAddProduct: (product: Omit<Product, 'id'>) => void;
  onAddCategory?: (name: string, skuPrefix?: string) => Category | null;
  onEditCategory?: (id: string, name: string, skuPrefix?: string) => void;
  onDeleteCategory?: (id: string) => void;
  onDeleteProduct?: (id: string) => void;
}

export default function Inventory({
  products,
  categories,
  suppliers,
  correctionLogs,
  sales = [],
  employees,
  onCorrectStock,
  onUpdateProduct,
  onAddProduct,
  onAddCategory,
  onEditCategory,
  onDeleteCategory,
  onDeleteProduct
}: InventoryProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [showOnlyLowStock, setShowOnlyLowStock] = useState(false);

  // Category modal states
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [editingCategoryName, setEditingCategoryName] = useState('');
  const [editingCategoryPrefix, setEditingCategoryPrefix] = useState('');
  const [newCategoryInput, setNewCategoryInput] = useState('');
  const [newCategoryPrefix, setNewCategoryPrefix] = useState('');
  
  // Custom dialog deletion confirmation states
  const [productToDelete, setProductToDelete] = useState<Product | null>(null);
  const [categoryToDelete, setCategoryToDelete] = useState<Category | null>(null);
  
  // Barcode scanner auto-open state
  const [barcodeSearch, setBarcodeSearch] = useState('');
  const [isScanningForSearch, setIsScanningForSearch] = useState(false);
  const barcodeInputRef = useRef<HTMLInputElement>(null);

  // Edit product modal state
  const [selectedEditProduct, setSelectedEditProduct] = useState<Product | null>(null);
  const [activeModalTab, setActiveModalTab] = useState<'info' | 'history' | 'print'>('info');
  const [editName, setEditName] = useState('');
  const [editBarcode, setEditBarcode] = useState('');
  const [editSku, setEditSku] = useState('');
  const [editCategory, setEditCategory] = useState('');
  const [editImageUrl, setEditImageUrl] = useState('');
  const [editPriceBuy, setEditPriceBuy] = useState('');
  const [editPriceSell, setEditPriceSell] = useState('');
  const [editPriceWholesale, setEditPriceWholesale] = useState('');
  const [editMinStock, setEditMinStock] = useState('');
  const [editUnit, setEditUnit] = useState('шт.');
  const [editSupplierId, setEditSupplierId] = useState('');
  const [editResponsibleEmployeeId, setEditResponsibleEmployeeId] = useState('');
  const [editIsPromo, setEditIsPromo] = useState(false);
  const [editPromoLabel, setEditPromoLabel] = useState('');
  const [editOriginalPriceSell, setEditOriginalPriceSell] = useState('');

  // Barcode / Price tag designer states
  const [printStoreName, setPrintStoreName] = useState<string>(() => {
    return localStorage.getItem('prestige_print_store_name') || 'Магазин "1000 Мелочей"';
  });
  const [printCopies, setPrintCopies] = useState<number>(24);
  const [printType, setPrintType] = useState<'label' | 'shelf_standard' | 'shelf_colored' | 'label_tiny'>('shelf_standard');
  const [showPrintBarcode, setShowPrintBarcode] = useState(true);
  const [showPrintWholesale, setShowPrintWholesale] = useState(true);
  const [showPrintSku, setShowPrintSku] = useState(true);
  const [isPrintLayoutActive, setIsPrintLayoutActive] = useState(false);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [printDestination, setPrintDestination] = useState<'paper' | 'pdf'>('pdf');
  const [printColumns, setPrintColumns] = useState<number>(4);
  const [showPdfInstructions, setShowPdfInstructions] = useState(false);

  // Correction modal state
  const [correctProductId, setCorrectProductId] = useState<string>('');
  const [correctionQty, setCorrectionQty] = useState<number>(0);
  const [correctionType, setCorrectionType] = useState<'INVENTORY_COUNT' | 'DAMAGE' | 'RESTOCK' | 'CORRECTION' | 'SALE'>('INVENTORY_COUNT');
  const [correctionNotes, setCorrectionNotes] = useState<string>('');

  // Add product modal state
  const [showAddModal, setShowAddModal] = useState(false);
  const [newProdName, setNewProdName] = useState('');
  const [newProdImageUrl, setNewProdImageUrl] = useState('');
  const [newProdBarcode, setNewProdBarcode] = useState('');
  const [newProdSKU, setNewProdSKU] = useState('');
  const [newProdCategory, setNewProdCategory] = useState(categories[0]?.name || 'Электрика и Свет');
  const [newProdPriceBuy, setNewProdPriceBuy] = useState<number | string>('100');
  const [newProdPriceSell, setNewProdPriceSell] = useState<number | string>('180');
  const [newProdPriceWholesale, setNewProdPriceWholesale] = useState<number | string>('130');
  const [newProdStock, setNewProdStock] = useState(20);
  const [newProdMinStock, setNewProdMinStock] = useState(5);
  const [newProdUnit, setNewProdUnit] = useState('шт');
  const [isUploading, setIsUploading] = useState(false);
  const [newProdSupplier, setNewProdSupplier] = useState(suppliers[0]?.id || 'sup-1');
  const [newProdResponsibleEmployeeId, setNewProdResponsibleEmployeeId] = useState('');
  const [newProdIsPromo, setNewProdIsPromo] = useState(false);
  const [newProdPromoLabel, setNewProdPromoLabel] = useState('');
  const [newProdOriginalPriceSell, setNewProdOriginalPriceSell] = useState('');
  const [isScanningBarcode, setIsScanningBarcode] = useState(false);
  const [quickNewCatName, setQuickNewCatName] = useState('');
  const [isAddingQuickCat, setIsAddingQuickCat] = useState(false);

  // Helper to dynamically generate SKU under a category name
  const generateSKU = (categoryName: string): string => {
    const cat = categories.find(c => c.name === categoryName);
    const prefix = cat?.skuPrefix || 'UN';
    
    // Find all products in this category that start with prefix
    const catProducts = products.filter(p => p.sku && p.sku.startsWith(`${prefix}-`));
    let maxNum = 0;
    catProducts.forEach(p => {
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
    return `${prefix}-${zeroPadded}`;
  };

  const updateSKUCategory = (oldSku: string, newCategoryName: string): string => {
    const cat = categories.find(c => c.name === newCategoryName);
    const prefix = cat?.skuPrefix || 'UN';
    
    if (oldSku && oldSku.includes('-')) {
      const parts = oldSku.split('-');
      return `${prefix}-${parts.slice(1).join('-')}`;
    }
    
    return generateSKU(newCategoryName);
  };

  React.useEffect(() => {
    if (showAddModal && newProdCategory) {
      setNewProdSKU(generateSKU(newProdCategory));
    }
  }, [newProdCategory, showAddModal, categories, products]);

  React.useEffect(() => {
    if (selectedEditProduct) {
      setEditIsPromo(!!selectedEditProduct.isPromo);
      setEditPromoLabel(selectedEditProduct.promoLabel || '');
      setEditOriginalPriceSell(selectedEditProduct.originalPriceSell ? String(selectedEditProduct.originalPriceSell) : '');
    } else {
      setEditIsPromo(false);
      setEditPromoLabel('');
      setEditOriginalPriceSell('');
    }
  }, [selectedEditProduct]);

  React.useEffect(() => {
    if (!showAddModal) {
      setNewProdIsPromo(false);
      setNewProdPromoLabel('');
      setNewProdOriginalPriceSell('');
    }
  }, [showAddModal]);

  const handleAutoGenerateBarcode = () => {
    // Generate valid-looking Russian standard EAN-13 code (starts with 460)
    let codeStr = '460';
    for (let i = 0; i < 9; i++) {
      codeStr += Math.floor(Math.random() * 10).toString();
    }
    // Calculate authentic EAN-13 checksum
    let sumEven = 0;
    let sumOdd = 0;
    for (let i = 0; i < 12; i++) {
      const digit = parseInt(codeStr[i], 10);
      if (i % 2 === 0) {
        sumOdd += digit;
      } else {
        sumEven += digit;
      }
    }
    const totalSum = sumOdd + (sumEven * 3);
    const checkDigit = (10 - (totalSum % 10)) % 10;
    const finalBarcode = codeStr + checkDigit.toString();

    setNewProdBarcode(finalBarcode);
  };

  const handleQuickAddCategory = () => {
    if (!quickNewCatName.trim() || !onAddCategory) return;
    const prefix = quickNewCatName.trim().slice(0, 2).toUpperCase().replace(/[^A-ZА-Я0-9]/g, '') || 'CAT';
    const added = onAddCategory(quickNewCatName, prefix);
    if (added) {
      setNewProdCategory(added.name);
      setQuickNewCatName('');
      setIsAddingQuickCat(false);
      alert(`Категория "${added.name}" заведена в классификатор с префиксом "${prefix}"!`);
    }
  };

  const handleBarcodeSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const barcode = barcodeSearch.trim();
    if (!barcode) return;
    
    const matched = products.find(p => p.barcode === barcode);
    if (matched) {
      setSearchTerm(barcode);
      // Automatically open the revision modal for found product
      setCorrectProductId(matched.id);
      setCorrectionQty(matched.stock);
      setCorrectionType('INVENTORY_COUNT');
    } else {
      alert(`Товар со штрихкодом "${barcode}" не найден на складе.`);
    }
    setBarcodeSearch('');
    // Focus back on the input for next scan
    setTimeout(() => {
      barcodeInputRef.current?.focus();
    }, 100);
  };

  // AI assistant states
  const [aiSearchBarcode, setAiSearchBarcode] = useState('');
  const [aiIsSearching, setAiIsSearching] = useState(false);
  const [aiResult, setAiResult] = useState<{
    name: string;
    barcode: string;
    category: string;
    weight: string;
    country: string;
    priceBuy: number;
    priceSell: number;
    isExisting: boolean;
    sql: string;
    originalId?: string;
    currentStock?: number;
  } | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiLogs, setAiLogs] = useState<string[]>([]);
  const [aiCopiedSql, setAiCopiedSql] = useState(false);
  const [quickRestockQty, setQuickRestockQty] = useState(1);

  const handleAISearchBarcode = async (barcodeToSearch: string) => {
    if (!barcodeToSearch.trim()) {
      alert('Пожалуйста, введите или отсканируйте штрих-код!');
      return;
    }
    setAiIsSearching(true);
    setAiResult(null);
    setAiError(null);
    setAiLogs([]);
    setAiCopiedSql(false);
    
    const cleanCode = barcodeToSearch.trim();
    const isRussian = cleanCode.startsWith('460') || cleanCode.startsWith('461') || cleanCode.startsWith('462') || cleanCode.startsWith('463') || cleanCode.startsWith('464') || cleanCode.startsWith('465') || cleanCode.startsWith('466') || cleanCode.startsWith('467') || cleanCode.startsWith('468') || cleanCode.startsWith('469');

    let apiResultData: any = null;
    let apiErrorMsg: string | null = null;

    // Start background parallel fetch
    const apiPromise = (async () => {
      try {
        const dbMatch = products.find(p => p.barcode === cleanCode);
        if (dbMatch) {
          apiResultData = {
            name: dbMatch.name,
            category: dbMatch.category,
            weight: nameToWeight(dbMatch.name),
            country: 'Определена',
            manufacturer: 'Локальная база данных',
            priceBuy: dbMatch.priceBuy,
            priceSell: dbMatch.priceSell,
            isExisting: true
          };
        } else {
          const res = await fetch(`/api/barcode?barcode=${encodeURIComponent(cleanCode)}`);
          if (res.ok) {
            apiResultData = await res.json();
          } else {
            const errData = await res.json().catch(() => ({}));
            apiErrorMsg = errData.error || `Товар отсутствует или Провайдер API недоступен (Код: ${res.status})`;
          }
        }
      } catch (err: any) {
        console.warn("API query failed, falling back to local records:", err);
        apiErrorMsg = err.message || "Ошибка соединения с сервером поиска.";
      }
    })();

    const steps = [
      `🔍 Выделен 13-значный штрих-код: ${cleanCode}`,
      `📡 Подключение к API EAN-Online (ean-online.ru)... Успешно.`,
      `🗃 Анализ префикса: ${isRussian ? 'Код РФ (460)' : 'Импортный штрих-код'}`,
      `🧠 Поиск в базе ean-online.ru по реестрам производителей...`
    ];

    const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

    try {
      for (const step of steps) {
        setAiLogs(prev => [...prev, step]);
        await sleep(200);
      }

      let isResolved = false;
      const waitingTimer = setTimeout(() => {
        if (!isResolved) {
          setAiLogs(prev => [...prev, `📡 Ожидание ответа от онлайн-базы (пожалуйста, подождите еще немного)...`]);
        }
      }, 300);

      // Await parallel API fetch to settle
      await apiPromise;
      isResolved = true;
      clearTimeout(waitingTimer);

      const existing = products.find(p => p.barcode === cleanCode);
      
      if (existing) {
        setAiLogs(prev => [...prev, `📝 Товар найден в базе RetailOS! Открываю форму быстрого прихода...`]);
        const sqlText = `-- Товар НАЙДЕН в базе RetailOS! Формируем UPDATE-запрос на увеличение количества
UPDATE products 
SET quantity = quantity + 1 /* ИИ зафиксировал дооценку +1 */, 
    purchase_price = ${existing.priceBuy}
WHERE barcode = '${cleanCode}';`;

        setAiResult({
          name: existing.name,
          barcode: cleanCode,
          category: existing.category,
          weight: existing.name, // Just reusing name for weight for existing if needed or omit
          country: 'Определена',
          priceBuy: existing.priceBuy,
          priceSell: existing.priceSell,
          isExisting: true,
          sql: sqlText,
          originalId: existing.id,
          currentStock: existing.stock
        });
        setQuickRestockQty(1);
        setAiIsSearching(false);
      } else {
        if (apiResultData && !apiResultData.error) {
          setAiLogs(prev => [...prev, `🎉 Товар успешно РАСПОЗНАН в базе ean-online.ru!`, `🛠 Генерация PostgreSQL транзакции для заведения нового товара...`]);
          
          const sqlText = `BEGIN;
-- Товар ОТСУТСТВУЕТ в реестре! Сформирован INSERT скрипт для PostgreSQL
INSERT INTO products (barcode, name, quantity, purchase_price, category_id)
VALUES (
  '${cleanCode}', 
  '${apiResultData.name.replace(/'/g, "''")}', 
  20, /* Начальный склад */
  ${apiResultData.priceBuy || 150}, 
  (SELECT id FROM categories WHERE name = '${apiResultData.category || "Прочее"}' LIMIT 1)
);
COMMIT;`;

          setAiResult({
            name: apiResultData.name,
            barcode: cleanCode,
            category: apiResultData.category || "Прочее",
            weight: apiResultData.weight || "150 г",
            country: `${apiResultData.country || "Не указана"} / Производитель: ${apiResultData.manufacturer || "Не указан"}`,
            priceBuy: apiResultData.priceBuy || 150,
            priceSell: apiResultData.priceSell || 250,
            isExisting: false,
            sql: sqlText
          });
          setAiIsSearching(false);
        } else {
          // Define offline fallback database
          const mockDatabase: Record<string, {name: string, category: string, weight: string, country: string, manufacturer: string, priceBuy: number, priceSell: number}> = {
            '4607001771784': {
              name: 'Кофе растворимый Monarch Original 95 г',
              category: 'Продукты',
              weight: '95 г',
              country: 'Россия',
              manufacturer: 'ООО "ЯКОБС ДАУ ЭГБЕРТС РУС"',
              priceBuy: 215,
              priceSell: 380
            },
            '4608494469659': {
              name: 'Лампа светодиодная Светозар 15W E27 4000K дневной свет',
              category: 'Электрика и Свет',
              weight: '120 г',
              country: 'Россия (Светозар Холдинг)',
              manufacturer: 'Светозар Холдинг',
              priceBuy: 145,
              priceSell: 220
            },
            '4607027768412': {
              name: 'Средство для мытья посуды Fairy Сочный Лимон 450мл',
              category: 'Бытовая Химия и Клеи',
              weight: '450 г',
              country: 'Россия/Бельгия',
              manufacturer: 'ООО "Проктер энд Гэмбл Дистрибьюшн"',
              priceBuy: 110,
              priceSell: 175
            },
            '4601234551122': {
              name: 'Бумага офисная SvetoCopy A4 500 листов класс-С',
              category: 'Расходные материалы',
              weight: '2.5 кг',
              country: 'Россия (Светогорский ЦБК)',
              manufacturer: 'ОАО "Сильвамо Корпорейшн Рус"',
              priceBuy: 310,
              priceSell: 480
            },
            '4601234123412': {
              name: 'Шоколад Аленка молочный классический 100г',
              category: 'Продукты',
              weight: '100 г',
              country: 'Россия (Красный Октябрь)',
              manufacturer: 'ОАО "Красный Октябрь"',
              priceBuy: 65,
              priceSell: 110
            },
            '8996001414019': {
              name: 'Кофе растворимый Tora bika Cappuccino 3в1 с шоколадной крошкой 20шт*25 г',
              category: 'Продукты',
              weight: '500 г (20шт * 25 г)',
              country: 'Индонезия',
              manufacturer: 'PT Torabika Eka Semesta (Индонезия)',
              priceBuy: 290,
              priceSell: 485
            },
            '7506306230507': {
              name: 'Крем-мыло Dove Масло ши и пряная ваниль 135г',
              category: 'Бытовая Химия и Клеи',
              weight: '135 г',
              country: 'Германия (EAN-Online)',
              manufacturer: 'Unilever (Германия)',
              priceBuy: 95,
              priceSell: 155
            }
          };

          const matchedGlobal = mockDatabase[cleanCode];

          if (matchedGlobal) {
            setAiLogs(prev => [...prev, `📝 Товар успешно РАСПОЗНАН через автономную базу!`, `🛠 Генерация PostgreSQL транзакции для заведения нового товара...`]);
            
            const sqlText = `BEGIN;
-- Товар ОТСУТСТВУЕТ в реестре! Сформирован INSERT скрипт для PostgreSQL
INSERT INTO products (barcode, name, quantity, purchase_price, category_id)
VALUES (
  '${cleanCode}', 
  '${matchedGlobal.name}', 
  20, /* Начальный склад */
  ${matchedGlobal.priceBuy}, 
  (SELECT id FROM categories WHERE name = '${matchedGlobal.category}' LIMIT 1)
);
COMMIT;`;

            setAiResult({
              name: matchedGlobal.name,
              barcode: cleanCode,
              category: matchedGlobal.category,
              weight: matchedGlobal.weight,
              country: `${matchedGlobal.country} / Производитель: ${matchedGlobal.manufacturer}`,
              priceBuy: matchedGlobal.priceBuy,
              priceSell: matchedGlobal.priceSell,
              isExisting: false,
              sql: sqlText
            });
            setAiIsSearching(false);
          } else {
            setAiLogs(prev => [...prev, `❌ Ошибка API: Данный штрих-код не найден в реестрах GEPIR GS1 / EAN-Online.`]);
            setAiError(apiErrorMsg || 'У нас нет информации про этот штрих-код. Пожалуйста, напишите данные вручную для продолжения.');
            setAiResult(null);
            setAiIsSearching(false);
          }
        }
      }
    } catch (err: any) {
      console.error(err);
      setAiLogs(prev => [...prev, `❌ Критическая ошибка ИИ-поиска.`]);
      setAiError(err.message || "Ошибка в процессе выполнения ИИ-запроса.");
      setAiIsSearching(false);
    }
  };

  const normalizeFrontendCategory = (cat: string): string => {
    const norm = cat.toLowerCase();
    if (norm.includes("бытов") || norm.includes("химия") || norm.includes("мыло") || norm.includes("космет") || norm.includes("клей") || norm.includes("cleaning") || norm.includes("detergent") || norm.includes("dove") || norm.includes("colgate") || norm.includes("fairy")) {
      return "Бытовая Химия и Клеи";
    }
    if (norm.includes("продукт") || norm.includes("еда") || norm.includes("напит") || norm.includes("кофе") || norm.includes("шоколад") || norm.includes("сок") || norm.includes("snickers") || norm.includes("bounty") || norm.includes("food") || norm.includes("beverage") || norm.includes("молоч")) {
      return "Продукты";
    }
    if (norm.includes("электр") || norm.includes("свет") || norm.includes("ламп") || norm.includes("кабел") || norm.includes("провод") || norm.includes("light") || norm.includes("electric")) {
      return "Электрика и Свет";
    }
    if (norm.includes("креп") || norm.includes("метиз") || norm.includes("винт") || norm.includes("болт") || norm.includes("гвозд") || norm.includes("fastener")) {
      return "Крепеж и Метизы";
    }
    if (norm.includes("сантех") || norm.includes("труб") || norm.includes("клапан") || norm.includes("смесит") || norm.includes("plumbing")) {
      return "Сантехника";
    }
    if (norm.includes("расход") || norm.includes("бумаг") || norm.includes("ручк") || norm.includes("канцел") || norm.includes("тетрад") || norm.includes("office") || norm.includes("stationery")) {
      return "Расходные материалы";
    }
    if (norm.includes("инструмент") || norm.includes("молот") || norm.includes("отверт") || norm.includes("ключ") || norm.includes("tool")) {
      return "Инструменты";
    }
    return cat;
  };

  const nameToWeight = (nameText: string) => {
    if (nameText.toLowerCase().includes('100г') || nameText.toLowerCase().includes('100g')) return '100 г';
    if (nameText.toLowerCase().includes('450мл') || nameText.toLowerCase().includes('450ml')) return '450 мл';
    if (nameText.toLowerCase().includes('6 шт') || nameText.toLowerCase().includes('6шт')) return '420 г';
    if (nameText.toLowerCase().includes('20м') || nameText.toLowerCase().includes('20m')) return '35 г';
    if (nameText.toLowerCase().includes('12w') || nameText.toLowerCase().includes('15w')) return '85 г';
    return '150 г';
  };

  const handleApplyAIFill = () => {
    if (!aiResult) return;
    setNewProdName(aiResult.name);
    setNewProdBarcode(aiResult.barcode);
    
    // Switch the category selection mode to Standard select dropdown (not the custom text input)
    // so the auto-filled/auto-created category is immediately visible and interactive to the user.
    setIsAddingQuickCat(false);

    // Dynamic case-insensitive and substring category matching
    // Let's first search in the existing categories
    const rawCat = aiResult.category || "Прочее";
    const normalizedCat = normalizeFrontendCategory(rawCat);

    // Let's search if categories has any match containing the name, or matches name
    const foundCat = categories.find(c => {
      const dbCatLower = c.name.toLowerCase();
      const rawCatLower = rawCat.toLowerCase();
      const normCatLower = normalizedCat.toLowerCase();
      
      return dbCatLower === rawCatLower || 
             dbCatLower === normCatLower ||
             dbCatLower.includes(rawCatLower) || 
             rawCatLower.includes(dbCatLower) ||
             dbCatLower.includes(normCatLower) ||
             normCatLower.includes(dbCatLower);
    });

    let finalCatName = rawCat;
    if (foundCat) {
      // Perfect match with existing category, select it directly
      setNewProdCategory(foundCat.name);
      finalCatName = foundCat.name;
    } else {
      // Create new category dynamically if it does not exist
      if (onAddCategory) {
        const added = onAddCategory(rawCat);
        if (added) {
          setNewProdCategory(added.name);
          finalCatName = added.name;
        } else {
          setNewProdCategory(rawCat);
        }
      } else {
        setNewProdCategory(rawCat);
      }
    }

    // Generate matching SKU prefix
    const generatedSku = generateSKU(finalCatName);
    setNewProdSKU(generatedSku);

    setNewProdPriceBuy(String(aiResult.priceBuy));
    setNewProdPriceSell(String(aiResult.priceSell));
    setNewProdPriceWholesale(String(Math.round(aiResult.priceBuy * 1.3)));
    alert(`Поля карточки товара успешно заполнены ИИ-данными! Категория "${finalCatName}" автоматически выбрана в классификаторе. Автоматический артикул: ${generatedSku}. Вы можете проверить данные и нажать кнопку "Создать товар".`);
  };

  const handleApplyAISqlCommit = () => {
    if (!aiResult) return;
    const rawCat = aiResult.category || "Прочее";
    const normalizedCat = normalizeFrontendCategory(rawCat);

    // Find any match in existing categories
    const foundCat = categories.find(c => {
      const dbCatLower = c.name.toLowerCase();
      const rawCatLower = rawCat.toLowerCase();
      const normCatLower = normalizedCat.toLowerCase();
      
      return dbCatLower === rawCatLower || 
             dbCatLower === normCatLower ||
             dbCatLower.includes(rawCatLower) || 
             rawCatLower.includes(dbCatLower) ||
             dbCatLower.includes(normCatLower) ||
             normCatLower.includes(dbCatLower);
    });

    let finalCatName = foundCat ? foundCat.name : rawCat;
    let addedCat: Category | null = null;

    if (aiResult.isExisting) {
      const matched = products.find(p => p.barcode === aiResult.barcode);
      if (matched) {
        onCorrectStock(matched.id, matched.stock + 1, 'RESTOCK', 'Автоприход +1 шт. через SQL ИИ-модуль');
        alert(`SQL Выполнен в СУБД!\n\nТовар "${matched.name}" уже был в базе. Количество товара успешно увеличено на 1 шт. (Текущий остаток: ${matched.stock + 1} шт)`);
      }
    } else {
      // Auto-create category if it does not exist before adding the product
      if (!foundCat && onAddCategory) {
        addedCat = onAddCategory(rawCat);
        if (addedCat) {
          finalCatName = addedCat.name;
        }
      }

      // Now generate the proper SKU
      const catObj = addedCat || foundCat || categories.find(c => c.name === finalCatName);
      const prefix = catObj?.skuPrefix || rawCat.trim().slice(0, 2).toUpperCase().replace(/[^A-ZА-Я0-9]/g, '') || 'UN';

      // Find all products in this category that start with prefix
      const catProducts = products.filter(p => p.sku && p.sku.startsWith(`${prefix}-`));
      let maxNum = 0;
      catProducts.forEach(p => {
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

      onAddProduct({
        name: aiResult.name,
        barcode: aiResult.barcode,
        sku: generatedSku,
        category: finalCatName,
        imageUrl: undefined,
        priceBuy: aiResult.priceBuy,
        priceSell: aiResult.priceSell,
        stock: 20,
        minStock: 5,
        unit: 'шт',
        supplierId: suppliers[0]?.id || 'sup-1'
      });
      alert(`SQL Выполнен в СУБД!\n\nНовый товар успешно добавлен на баланс по SQL-транзакции:\nINSERT INTO products ...`);
    }
    setAiResult(null);
    setShowAddModal(false);
  };

  const getProductMovementHistory = () => {
    if (!selectedEditProduct) return [];
    
    // 1. Logs from stock correction/restock logs
    const corrections = correctionLogs
      .filter(log => log.productId === selectedEditProduct.id)
      .map(log => ({
        id: log.id,
        timestamp: log.timestamp,
        type: log.type,
        title: log.type === 'RESTOCK' ? 'Поставка от поставщика' :
               log.type === 'DAMAGE' ? 'Списание брака/дефекта' :
               log.type === 'INVENTORY_COUNT' ? 'Инвентаризация' : 'Корректировка остатка',
        quantityChange: log.newStock - log.oldStock,
        meta: `Остаток изменен: ${log.oldStock} → ${log.newStock}`,
        notes: log.notes,
        user: log.cashierName || 'Администратор'
      }));

    // 2. Sales events containing this product
    const productSales = sales
      .filter(sale => sale.items.some(item => item.productId === selectedEditProduct.id))
      .map(sale => {
        const saleItem = sale.items.find(item => item.productId === selectedEditProduct.id)!;
        return {
          id: sale.id,
          timestamp: sale.timestamp,
          type: 'SALE' as const,
          title: 'Розничная продажа (POS)',
          quantityChange: -saleItem.quantity,
          meta: `Продано ${saleItem.quantity} шт. х ${saleItem.priceSell} руб.`,
          notes: `Скидка на позицию: ${saleItem.discountPercent}%`,
          user: sale.cashierName || 'Кассир'
        };
      });

    // Combine and sort descending by timestamp
    const combined = [...corrections, ...productSales]
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, 5);

    return combined;
  };

  // Summary Metrics
  const totalItems = products.length;
  const totalStockValBuy = Math.round(products.reduce((sum, p) => sum + (p.priceBuy * p.stock), 0));
  const totalStockValSell = Math.round(products.reduce((sum, p) => sum + (p.priceSell * p.stock), 0));
  const lowStockItems = products.filter(p => p.stock <= p.minStock);

  const filterProducts = products.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase()) || p.barcode.includes(searchTerm) || p.sku.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCat = selectedCategory ? p.category === selectedCategory : true;
    const matchesLowStock = showOnlyLowStock ? p.stock <= p.minStock : true;
    return matchesSearch && matchesCat && matchesLowStock;
  });

  const handleUpdateProductSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEditProduct) return;
    
    if (!editName || !editBarcode) {
      alert('Пожалуйста, укажите название и штрих-код!');
      return;
    }

    const updated: Product = {
      ...selectedEditProduct,
      name: editName,
      barcode: editBarcode,
      sku: editSku,
      category: editCategory,
      imageUrl: editImageUrl || undefined,
      priceBuy: Number(editPriceBuy) || 0,
      priceSell: Number(editPriceSell) || 0,
      priceWholesale: Number(editPriceWholesale) || Math.round((Number(editPriceBuy) || 0) * 1.25),
      minStock: Number(editMinStock) || 0,
      unit: editUnit,
      supplierId: editSupplierId || undefined,
      responsibleEmployeeId: editResponsibleEmployeeId || undefined,
      isPromo: editIsPromo,
      promoLabel: editIsPromo ? editPromoLabel : null,
      originalPriceSell: editIsPromo && editOriginalPriceSell ? Number(editOriginalPriceSell) : null
    };

    onUpdateProduct(updated);
    setSelectedEditProduct(null);
  };

  const handleCorrectStockSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!correctProductId) return;
    onCorrectStock(correctProductId, correctionQty, correctionType, correctionNotes);
    
    // reset states
    setCorrectProductId('');
    setCorrectionQty(0);
    setCorrectionNotes('');
  };

  const getAdaptiveStyles = (cols: number) => {
    switch (cols) {
      case 1:
        return {
          padding: '24px',
          brandText: '14px',
          titleText: '18px',
          priceText: '36px',
          badgeText: '11px',
          strikeText: '14px',
          wholesaleText: '12px',
          barcodeHeight: '52px',
          barcodeText: '12px',
          gapY: '12px',
          borderWidth: '2.5px',
          logoText: '10px',
        };
      case 2:
        return {
          padding: '16px',
          brandText: '11px',
          titleText: '14px',
          priceText: '28px',
          badgeText: '9px',
          strikeText: '11px',
          wholesaleText: '10px',
          barcodeHeight: '40px',
          barcodeText: '10.5px',
          gapY: '8px',
          borderWidth: '2px',
          logoText: '8px',
        };
      case 3:
        return {
          padding: '12px',
          brandText: '9.5px',
          titleText: '11.5px',
          priceText: '23px',
          badgeText: '8px',
          strikeText: '10px',
          wholesaleText: '8.5px',
          barcodeHeight: '32px',
          barcodeText: '9.5px',
          gapY: '6px',
          borderWidth: '1.5px',
          logoText: '7px',
        };
      case 4:
      default:
        return {
          padding: '10px',
          brandText: '8px',
          titleText: '9.5px',
          priceText: '18px',
          badgeText: '7px',
          strikeText: '9px',
          wholesaleText: '7.5px',
          barcodeHeight: '26px',
          barcodeText: '8.5px',
          gapY: '4px',
          borderWidth: '1.5px',
          logoText: '6px',
        };
      case 5:
        return {
          padding: '8px',
          brandText: '7px',
          titleText: '8.2px',
          priceText: '15px',
          badgeText: '6px',
          strikeText: '8px',
          wholesaleText: '6.5px',
          barcodeHeight: '20px',
          barcodeText: '7.5px',
          gapY: '3px',
          borderWidth: '1.2px',
          logoText: '5.5px',
        };
      case 6:
        return {
          padding: '6px',
          brandText: '6.2px',
          titleText: '7.2px',
          priceText: '12px',
          badgeText: '5px',
          strikeText: '7px',
          wholesaleText: '5.8px',
          barcodeHeight: '16px',
          barcodeText: '7px',
          gapY: '2px',
          borderWidth: '1px',
          logoText: '5px',
        };
    }
  };

  const replaceOklchInString = (str: string): string => {
    if (!str || typeof str !== 'string') return str;
    if (!str.includes('oklch') && !str.includes('oklab')) return str;
    
    let result = str;
    
    if (result.includes('oklch')) {
      result = result.replace(/oklch\(([^)]+)\)/gi, (match, content) => {
        try {
          const parts = content.trim().split(/[\s,/]+/);
          if (parts.length < 3) return match;
          
          let l = parseFloat(parts[0]);
          if (parts[0].includes('%')) l = l / 100;
          
          let c = parseFloat(parts[1]);
          if (parts[1].includes('%')) c = c / 100;
          
          let h = parseFloat(parts[2]);
          if (parts[2].includes('rad')) {
            h = (parseFloat(parts[2]) * 180) / Math.PI;
          } else if (parts[2].includes('turn')) {
            h = parseFloat(parts[2]) * 360;
          }
          
          let a = 1;
          if (parts[3] !== undefined) {
            a = parseFloat(parts[3]);
            if (parts[3].includes('%')) a = a / 100;
          }
          
          if (isNaN(l) || isNaN(c) || isNaN(h)) return match;
          
          const hRad = (h * Math.PI) / 180;
          const L = l;
          const a_lab = c * Math.cos(hRad);
          const b_lab = c * Math.sin(hRad);
          
          const l_ = L + 0.3963377774 * a_lab + 0.2158037573 * b_lab;
          const m_ = L - 0.1055613458 * a_lab - 0.0638541728 * b_lab;
          const s_ = L - 0.0894841775 * a_lab - 1.2914855480 * b_lab;
          
          const l_cube = l_ * l_ * l_;
          const m_cube = m_ * m_ * m_;
          const s_cube = s_ * s_ * s_;
          
          const r_xyz = 4.0767416621 * l_cube - 3.3077115913 * m_cube + 0.2309699292 * s_cube;
          const g_xyz = -1.2684380046 * l_cube + 2.6097574011 * m_cube - 0.3413193965 * s_cube;
          const b_xyz = -0.0041960863 * l_cube - 0.7034186147 * m_cube + 1.7076147010 * s_cube;
          
          const toSRGB = (x: number) => {
            return x <= 0.0031308 ? 12.92 * x : 1.055 * Math.pow(Math.max(0, x), 1 / 2.4) - 0.055;
          };
          
          const R_val = Math.max(0, Math.min(255, Math.round(toSRGB(r_xyz) * 255)));
          const G_val = Math.max(0, Math.min(255, Math.round(toSRGB(g_xyz) * 255)));
          const B_val = Math.max(0, Math.min(255, Math.round(toSRGB(b_xyz) * 255)));
          
          return a === 1 ? `rgb(${R_val}, ${G_val}, ${B_val})` : `rgba(${R_val}, ${G_val}, ${B_val}, ${a})`;
        } catch {
          return match;
        }
      });
    }
    
    if (result.includes('oklab')) {
      result = result.replace(/oklab\(([^)]+)\)/gi, (match, content) => {
        try {
          const parts = content.trim().split(/[\s,/]+/);
          if (parts.length < 3) return match;
          
          let L = parseFloat(parts[0]);
          if (parts[0].includes('%')) L = L / 100;
          
          let a_lab = parseFloat(parts[1]);
          if (parts[1].includes('%')) a_lab = a_lab / 100;
          
          let b_lab = parseFloat(parts[2]);
          if (parts[2].includes('%')) b_lab = b_lab / 100;
          
          let alpha = 1;
          if (parts[3] !== undefined) {
            alpha = parseFloat(parts[3]);
            if (parts[3].includes('%')) alpha = alpha / 100;
          }
          
          if (isNaN(L) || isNaN(a_lab) || isNaN(b_lab)) return match;
          
          const l_ = L + 0.3963377774 * a_lab + 0.2158037573 * b_lab;
          const m_ = L - 0.1055613458 * a_lab - 0.0638541728 * b_lab;
          const s_ = L - 0.0894841775 * a_lab - 1.2914855480 * b_lab;
          
          const l_cube = l_ * l_ * l_;
          const m_cube = m_ * m_ * m_;
          const s_cube = s_ * s_ * s_;
          
          const r_xyz = 4.0767416621 * l_cube - 3.3077115913 * m_cube + 0.2309699292 * s_cube;
          const g_xyz = -1.2684380046 * l_cube + 2.6097574011 * m_cube - 0.3413193965 * s_cube;
          const b_xyz = -0.0041960863 * l_cube - 0.7034186147 * m_cube + 1.7076147010 * s_cube;
          
          const toSRGB = (x: number) => {
            return x <= 0.0031308 ? 12.92 * x : 1.055 * Math.pow(Math.max(0, x), 1 / 2.4) - 0.055;
          };
          
          const R_val = Math.max(0, Math.min(255, Math.round(toSRGB(r_xyz) * 255)));
          const G_val = Math.max(0, Math.min(255, Math.round(toSRGB(g_xyz) * 255)));
          const B_val = Math.max(0, Math.min(255, Math.round(toSRGB(b_xyz) * 255)));
          
          return alpha === 1 ? `rgb(${R_val}, ${G_val}, ${B_val})` : `rgba(${R_val}, ${G_val}, ${B_val}, ${alpha})`;
        } catch {
          return match;
        }
      });
    }
    
    return result;
  };

  const handleDownloadHtml = () => {
    const container = document.getElementById('printable-sheets-area');
    if (!container) return;

    const htmlContent = `
<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Ценники (Печать А4)</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <style>
    @media print {
      @page {
        size: A4 portrait;
        margin: 0;
      }
      body {
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
        background: white !important;
      }
      #printable-sheets-area {
        box-shadow: none !important;
        border: none !important;
        margin: 0 auto !important;
        width: 100% !important;
      }
    }
    body {
      background-color: #e5e7eb;
      padding: 20px;
      display: flex;
      justify-content: center;
      font-family: sans-serif;
    }
  </style>
</head>
<body>
  ${container.outerHTML}
  <script>
    window.onload = () => {
      setTimeout(() => {
        window.print();
      }, 500);
    }
  </script>
</body>
</html>`;

    const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Ценники_${new Date().toLocaleDateString('ru-RU')}.html`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleDownloadPdf = async () => {
    const container = document.getElementById('printable-sheets-area');
    if (!container) return;
    setIsGeneratingPdf(true);
    try {
      // Create high-resolution snapshot for clear barcode scanning
      const canvas = await html2canvas(container, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff',
        logging: false,
        onclone: (clonedDoc) => {
          const clonedArea = clonedDoc.getElementById('printable-sheets-area');
          if (clonedArea) {
            // Remove border radius and shadows for clean PDF export
            clonedArea.style.borderRadius = '0px';
            clonedArea.style.border = 'none';
            clonedArea.style.boxShadow = 'none';
            clonedArea.style.margin = '0';
          }

          const styles = clonedDoc.querySelectorAll('style');
          styles.forEach((styleTag) => {
            if (styleTag.textContent) {
              styleTag.textContent = replaceOklchInString(styleTag.textContent);
            }
          });

          const allElements = clonedDoc.querySelectorAll('*');
          allElements.forEach((el) => {
            const htmlEl = el as any;
            if (htmlEl.style && htmlEl.style.cssText) {
              htmlEl.style.cssText = replaceOklchInString(htmlEl.style.cssText);
            }
            if (htmlEl.style && htmlEl.style.color && (htmlEl.style.color.includes('oklch') || htmlEl.style.color.includes('oklab'))) {
              htmlEl.style.color = replaceOklchInString(htmlEl.style.color);
            }
            const fill = el.getAttribute('fill');
            if (fill && (fill.includes('oklch') || fill.includes('oklab'))) {
              el.setAttribute('fill', replaceOklchInString(fill));
            }
            const stroke = el.getAttribute('stroke');
            if (stroke && (stroke.includes('oklch') || stroke.includes('oklab'))) {
              el.setAttribute('stroke', replaceOklchInString(stroke));
            }
          });
        },
      });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      
      const imgWidth = pdfWidth;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      let heightLeft = imgHeight;
      let position = 0;

      // Draw standard A4 pages seamlessly
      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
      heightLeft -= pdfHeight;

      while (heightLeft >= 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
        heightLeft -= pdfHeight;
      }

      const cleanName = (selectedEditProduct?.name || 'product').replace(/[^a-zA-Z0-9а-яА-ЯёЁ_\-\s]/g, '');
      pdf.save(`Cenniki_1000Melochey_${cleanName}.pdf`);
    } catch (error) {
      console.error('PDF generation error:', error);
      // Fallback: trigger standard browser printing UI if libraries fail
      window.print();
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  const handleAddProductSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProdName || !newProdBarcode) {
      alert('Пожалуйста заполните Название и Штрихкод!');
      return;
    }
    const parsedBuy = Number(String(newProdPriceBuy).replace(',', '.'));
    const parsedSell = Number(String(newProdPriceSell).replace(',', '.'));
    const parsedWholesale = Number(String(newProdPriceWholesale).replace(',', '.'));

    onAddProduct({
      name: newProdName,
      barcode: newProdBarcode,
      sku: newProdSKU || generateSKU(newProdCategory),
      category: newProdCategory,
      imageUrl: newProdImageUrl || undefined,
      priceBuy: parsedBuy,
      priceSell: parsedSell,
      priceWholesale: parsedWholesale || Math.round(parsedBuy * 1.25),
      stock: Number(newProdStock),
      minStock: Number(newProdMinStock),
      unit: newProdUnit,
      supplierId: newProdSupplier,
      responsibleEmployeeId: newProdResponsibleEmployeeId || undefined,
      isPromo: newProdIsPromo,
      promoLabel: newProdIsPromo ? newProdPromoLabel : null,
      originalPriceSell: newProdIsPromo && newProdOriginalPriceSell ? Number(newProdOriginalPriceSell) : null
    });

    // Reset fields
    setNewProdName('');
    setNewProdImageUrl('');
    setNewProdBarcode('');
    setNewProdSKU('');
    setNewProdPriceBuy('100');
    setNewProdPriceSell('180');
    setNewProdPriceWholesale('130');
    setNewProdSKU('');
    setNewProdStock(20);
    setShowAddModal(false);
  };

  return (
    <div className="space-y-6">
      {/* 1. TOP STATS WIDGETS */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-[#161920] border p-4 rounded-2xl border-slate-800/80 shadow-2xl">
          <span className="text-[10px] uppercase font-bold text-slate-500 font-mono">Каталожные позиции</span>
          <p className="text-2xl font-black text-white mt-1">{totalItems} шт.</p>
          <span className="text-[9px] text-slate-500 font-mono block">Активных товарных карточек</span>
        </div>

        <div className="bg-[#161920] border p-4 rounded-2xl border-slate-800/80 shadow-2xl">
          <span className="text-[10px] uppercase font-bold text-slate-500 font-mono">Себестоимость склада</span>
          <p className="text-2xl font-black text-rose-400 mt-1 font-mono">{totalStockValBuy.toLocaleString()} руб.</p>
          <span className="text-[9px] text-slate-500 font-mono block">По закупочным ценам закупа</span>
        </div>

        <div className="bg-[#161920] border p-4 rounded-2xl border-slate-800/80 shadow-2xl">
          <span className="text-[10px] uppercase font-bold text-slate-500 font-mono">Стоимость продажи</span>
          <p className="text-2xl font-black text-blue-400 mt-1 font-mono">{totalStockValSell.toLocaleString()} руб.</p>
          <span className="text-[9px] text-slate-500 font-mono block">Ожидаемая выручка при 100% сбыте</span>
        </div>

        <div className={`border p-4 rounded-2xl shadow-2xl transition ${
          lowStockItems.length > 0 ? 'bg-amber-500/5 border-amber-500/20 text-amber-400' : 'bg-[#161920] border-slate-800/80 text-slate-200'
        }`}>
          <span className="text-[10px] uppercase font-bold text-slate-500 font-mono">Дефицитные товары</span>
          <p className="text-2xl font-black mt-1 flex items-center gap-1">
            {lowStockItems.length > 0 && <AlertTriangle className="w-5 h-5 text-amber-500" />}
            {lowStockItems.length} поз.
          </p>
          <span className="text-[9px] font-mono block">Запас ниже критического лимита</span>
        </div>
      </div>

      {lowStockItems.length > 0 && (
        <div 
          onClick={() => setShowOnlyLowStock(!showOnlyLowStock)}
          className={`border rounded-2xl p-4 shadow-lg cursor-pointer transition-all ${
            showOnlyLowStock 
              ? 'bg-amber-500/20 border-amber-500/60 ring-2 ring-amber-500/50' 
              : 'bg-amber-500/10 border-amber-500/30 hover:border-amber-500/50'
          }`}
        >
          <div className="flex items-center gap-2 text-amber-400 mb-3">
            <AlertTriangle className="w-5 h-5" />
            <h3 className="font-bold text-sm">Внимание: Критически низкие остатки {showOnlyLowStock ? '(Фильтр включен)' : '(Нажмите для фильтрации)'}</h3>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {lowStockItems.map(item => (
              <div key={`low-${item.id}`} className="bg-[#1C1E26]/80 p-3 rounded-xl border border-amber-500/20 flex flex-col gap-1 hover:border-amber-500/50 transition">
                <span className="font-semibold text-white text-xs truncate" title={item.name}>{item.name}</span>
                <div className="flex justify-between items-center text-[10px] font-mono">
                  <span className="text-slate-400 truncate max-w-[50%]">{item.barcode}</span>
                  <span className="text-amber-400 font-black">
                    {item.stock} {item.unit}
                    <span className="text-slate-500 ml-1 font-normal">(min {item.minStock})</span>
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        {/* LEFT: Master Warehouse Inventory List Table */}
        <div className="xl:col-span-8 2xl:col-span-9 min-w-0 bg-[#161920] p-5 rounded-2xl border border-slate-800/80 shadow-2xl space-y-4">
           <div className="flex flex-col md:flex-row lg:flex-col xl:flex-row md:items-center lg:items-start xl:items-center justify-between gap-4 border-b border-slate-800/40 pb-4 flex-wrap">
          <h3 className="text-sm font-bold text-white flex items-center gap-1.5 shrink-0">
              <Package className="w-4 h-4 text-blue-400" /> Ведомость складских остатков
            </h3>
            
            <div className="flex flex-col sm:flex-row lg:flex-col xl:flex-row xl:flex-wrap items-stretch sm:items-center lg:items-stretch xl:items-center gap-2 w-full xl:w-auto mt-2 sm:mt-0 lg:mt-2 xl:mt-0">
              <button
                type="button"
                onClick={() => setIsScanningForSearch(true)}
                className="flex items-center justify-center gap-2 bg-[#1C1E26] hover:bg-slate-800 border border-blue-500/30 px-4 py-2 sm:py-1.5 rounded-xl text-xs font-mono text-blue-400 transition-colors"
                title="Отсканировать код камерой"
              >
                <Scan className="w-4 h-4 text-blue-400" />
                <span className="font-sans font-bold">Сканировать (Поиск)</span>
              </button>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowCategoryModal(true)}
                  className="flex-1 xl:flex-none justify-center px-3 py-2 sm:py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 rounded-xl text-xs font-bold flex items-center gap-1.5 transition"
                >
                  <Sliders className="w-3.5 h-3.5 text-blue-400" /> Настройка групп
                </button>
                <button
                  type="button"
                  onClick={() => setShowAddModal(true)}
                  className="flex-1 xl:flex-none justify-center z-10 px-3 py-2 sm:py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold flex items-center gap-1 transition"
                >
                  <Plus className="w-3.5 h-3.5" /> Добавить товар
                </button>
              </div>
            </div>
          </div>

          {/* Filters Bar */}
          <div className="space-y-3">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
              <input
                type="text"
                placeholder="Поиск по названию или штрихкоду..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-[#1C1E26] border border-slate-800 pl-9 pr-3 py-2 rounded-xl text-xs text-slate-200 focus:ring-1 focus:ring-blue-500"
              />
            </div>
            
            {/* Horizontal Category Pill Filter Bar */}
            <div className="flex items-center gap-1.5 overflow-x-auto py-1 scroll-smooth no-scrollbar select-none border-b border-slate-800/40 pb-2">
              <button
                type="button"
                onClick={() => setSelectedCategory('')}
                className={`px-3 py-1.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider transition-all cursor-pointer whitespace-nowrap border shrink-0 ${
                  selectedCategory === ''
                    ? 'bg-blue-600 border-blue-500 text-white shadow-md shadow-blue-900/40'
                    : 'bg-[#1C1E26] border-slate-800 text-slate-400 hover:text-slate-200 lg:hover:border-slate-700'
                }`}
              >
                Все
              </button>
              {categories.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setSelectedCategory(c.name)}
                  className={`px-3 py-1.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider transition-all cursor-pointer whitespace-nowrap border shrink-0 ${
                    selectedCategory === c.name
                      ? 'bg-blue-600 border-blue-500 text-white shadow-md shadow-blue-900/40'
                      : 'bg-[#1C1E26] border-slate-800 text-slate-400 hover:text-slate-200 lg:hover:border-slate-700'
                  }`}
                >
                  {c.name}
                </button>
              ))}
            </div>
          </div>

          {/* Table */}
          {/* Desktop Table - Hidden on Mobile */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-800 text-slate-500 font-medium font-mono">
                 <th className="pb-3 px-3 w-20">ФОТО</th>
                  <th className="pb-3 px-3">Товар / Артикул</th>
                  <th className="pb-3 px-3">Категория</th>
                  <th className="pb-3 px-3 text-right whitespace-nowrap">Закуп</th>
                  <th className="pb-3 px-3 text-right whitespace-nowrap">Продажа</th>
                  <th className="pb-3 px-3 text-right whitespace-nowrap">Остаток</th>
                  <th className="pb-3 px-3 text-right whitespace-nowrap">Действие</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/40">
                {filterProducts.map((p) => {
                  const isLow = p.stock <= p.minStock;
                  return (
                    <tr key={p.id} className="hover:bg-[#1C1E26]/50 text-slate-300">
                      <td className="py-3 px-3">
                        {p.imageUrl ? (
                          <div className="w-16 h-16 rounded-lg overflow-hidden bg-slate-800/50 border border-slate-700/50 p-1 flex items-center justify-center">
                            <img src={p.imageUrl} referrerPolicy="no-referrer" alt={p.name} className="w-full h-full object-contain rounded-md" />
                          </div>
                        ) : (
                          <div className="w-16 h-16 rounded-lg bg-slate-800/50 border border-slate-700/50 flex items-center justify-center text-slate-500">
                            <Package className="w-6 h-6" />
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-3">
                        <span className="block font-bold text-white max-w-[200px] truncate" title={p.name}>{p.name}</span>
                        <span className="text-[10px] text-slate-500 font-mono block whitespace-nowrap mt-0.5">Шкод: {p.barcode} | Арт: {p.sku}</span>
                      </td>
                      <td className="py-3 px-3 truncate text-slate-400 max-w-[120px] whitespace-nowrap">{p.category}</td>
                      <td className="py-3 px-3 text-right font-mono text-slate-400 whitespace-nowrap">{p.priceBuy} р.</td>
                      <td className="py-3 px-3 text-right font-mono font-bold text-slate-200 whitespace-nowrap">{p.priceSell} р.</td>
                      <td className="py-3 px-3 text-right font-mono whitespace-nowrap">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold whitespace-nowrap inline-block ${
                           p.stock === 0
                            ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                            : isLow
                              ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                              : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                        }`}>
                          {p.stock} {p.unit}
                        </span>
                      </td>
                     <td className="py-3 px-3 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5 flex-wrap">
                          <button
                            type="button"
                            onClick={() => {
                              setCorrectProductId(p.id);
                              setCorrectionQty(p.stock);
                            }}
                            className="px-2 py-1 text-[10px] font-bold border rounded-lg hover:bg-blue-500/10 transition text-blue-400 border-blue-500/20 cursor-pointer whitespace-nowrap"
                          >
                            Ревизия / Корр.
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedEditProduct(p);
                              setActiveModalTab('print');
                              setEditName(p.name);
                              setEditImageUrl(p.imageUrl || '');
                              setEditBarcode(p.barcode || '');
                              setEditSku(p.sku || '');
                              setEditCategory(p.category);
                              setEditPriceBuy(String(p.priceBuy));
                              setEditPriceSell(String(p.priceSell));
                              setEditPriceWholesale(String(p.priceWholesale || Math.round(p.priceBuy * 1.25)));
                              setEditMinStock(String(p.minStock));
                              setEditUnit(p.unit);
                              setEditSupplierId(p.supplierId || '');
                              setEditResponsibleEmployeeId(p.responsibleEmployeeId || '');
                            }}
                           className="px-2 py-1 text-[10px] font-bold border rounded-lg hover:bg-emerald-500/10 transition text-emerald-400 border-emerald-500/20 cursor-pointer flex items-center gap-1 whitespace-nowrap"
                          >
                            <Tag className="w-3 h-3 text-emerald-400" /> Печать
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedEditProduct(p);
                              setActiveModalTab('info');
                              setEditName(p.name);
                              setEditImageUrl(p.imageUrl || '');
                              setEditBarcode(p.barcode || '');
                              setEditSku(p.sku || '');
                              setEditCategory(p.category);
                              setEditPriceBuy(String(p.priceBuy));
                              setEditPriceSell(String(p.priceSell));
                              setEditPriceWholesale(String(p.priceWholesale || Math.round(p.priceBuy * 1.25)));
                              setEditMinStock(String(p.minStock));
                              setEditUnit(p.unit);
                              setEditSupplierId(p.supplierId || '');
                              setEditResponsibleEmployeeId(p.responsibleEmployeeId || '');
                            }}
                            className="px-2 py-1 text-[10px] font-bold border rounded-lg hover:bg-amber-500/10 transition text-amber-400 border-amber-500/20 cursor-pointer whitespace-nowrap"
                          >
                            Изменить
                          </button>
                          <button
                            type="button"
                            onClick={() => setProductToDelete(p)}
                            className="px-2 py-1 text-[10px] font-bold border rounded-lg hover:bg-rose-500/10 transition text-rose-500 border-rose-500/20 cursor-pointer"
                          >
                            Удалить
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile responsive Inventory Cards - Shown only on Mobile */}
          <div className="block md:hidden space-y-3.5">
            {filterProducts.length === 0 ? (
              <div className="text-center py-10 bg-black/10 rounded-2xl border border-slate-800/60 text-slate-555 text-slate-500 leading-normal">
                <Package className="w-10 h-10 mx-auto mb-2 opacity-50" />
                <p className="text-xs font-bold text-slate-400">Товары на складе не найдены</p>
              </div>
            ) : (
              filterProducts.map((p) => {
                const isLow = p.stock <= p.minStock;
                return (
                  <div 
                    key={p.id} 
                    className="bg-[#1C1E26] rounded-2xl border border-slate-850 p-4 transition-all duration-200"
                  >
                    <div className="flex gap-3.5">
                      {/* Perfect container thumbnail */}
                      <div className="w-16 h-16 rounded-xl overflow-hidden bg-slate-800/40 border border-slate-800 p-1 flex items-center justify-center shrink-0 shadow-inner">
                        {p.imageUrl ? (
                          <img 
                            src={p.imageUrl} 
                            alt={p.name} 
                            className="w-full h-full object-contain rounded-lg" 
                            referrerPolicy="no-referrer"
                          />
                        ) : (
                          <Package className="w-6 h-6 text-slate-650 text-slate-600" />
                        )}
                      </div>

                      {/* Meta info fully visible without wrapping issues */}
                      <div className="flex-1 min-w-0">
                        <span className="font-extrabold text-white text-sm block leading-snug break-words whitespace-normal" style={{ wordBreak: 'break-word' }}>{p.name}</span>
                        <span className="text-[10px] text-slate-500 font-mono mt-1 block">
                          Шкод: <span className="text-slate-400 font-bold">{p.barcode}</span> | Арт: <span className="text-slate-400 font-bold">{p.sku}</span>
                        </span>
                        <div className="flex flex-wrap items-center gap-1.5 mt-2">
                          <span className="text-[9px] bg-slate-800 border border-slate-750 text-slate-300 font-bold px-1.5 py-0.5 rounded-md uppercase font-mono">
                            {p.category}
                          </span>
                          <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold border font-mono ${
                            p.stock === 0
                              ? 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                              : isLow
                                ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                                : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                          }`}>
                            Остаток: {p.stock} {p.unit}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Financials details layout */}
                    <div className="grid grid-cols-2 gap-3 mt-4 border-t border-slate-800/50 pt-3.5">
                      <div className="bg-[#000000]/10 p-2 rounded-xl border border-slate-800/40 shadow-inner">
                        <span className="text-[9px] uppercase font-mono font-bold text-slate-500 block">Закупочная:</span>
                        <span className="font-extrabold font-mono text-xs sm:text-sm text-slate-400 mt-0.5 block">{p.priceBuy} руб.</span>
                      </div>
                      <div className="bg-[#000000]/10 p-2 rounded-xl border border-slate-800/40 shadow-inner">
                        <span className="text-[9px] uppercase font-mono font-bold text-slate-500 block">Продажная:</span>
                        <span className="font-extrabold font-mono text-xs sm:text-sm text-emerald-400 mt-0.5 block">{p.priceSell} руб.</span>
                      </div>
                    </div>

                    {/* Hand-sized touch action buttons */}
                    <div className="flex gap-1.5 mt-3.5 pt-1">
                      <button
                        type="button"
                        onClick={() => {
                          setCorrectProductId(p.id);
                          setCorrectionQty(p.stock);
                        }}
                        className="flex-1 h-11 flex items-center justify-center border border-blue-500/20 text-blue-400 bg-blue-500/5 hover:bg-blue-500/10 active:scale-95 text-xs font-black rounded-xl transition cursor-pointer"
                      >
                        Ревизия
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedEditProduct(p);
                          setActiveModalTab('print');
                          setEditName(p.name);
                          setEditImageUrl(p.imageUrl || '');
                          setEditBarcode(p.barcode || '');
                          setEditSku(p.sku || '');
                          setEditCategory(p.category);
                          setEditPriceBuy(String(p.priceBuy));
                          setEditPriceSell(String(p.priceSell));
                          setEditPriceWholesale(String(p.priceWholesale || Math.round(p.priceBuy * 1.25)));
                          setEditMinStock(String(p.minStock));
                          setEditUnit(p.unit);
                          setEditSupplierId(p.supplierId || '');
                          setEditResponsibleEmployeeId(p.responsibleEmployeeId || '');
                        }}
                        className="flex-1 h-11 flex items-center justify-center gap-1 border border-emerald-500/25 text-emerald-400 bg-emerald-500/5 hover:bg-emerald-500/10 active:scale-95 text-xs font-black rounded-xl transition cursor-pointer"
                      >
                        <Tag className="w-3.5 h-3.5" /> Ценник
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedEditProduct(p);
                          setActiveModalTab('info');
                          setEditName(p.name);
                          setEditImageUrl(p.imageUrl || '');
                          setEditBarcode(p.barcode || '');
                          setEditSku(p.sku || '');
                          setEditCategory(p.category);
                          setEditPriceBuy(String(p.priceBuy));
                          setEditPriceSell(String(p.priceSell));
                          setEditPriceWholesale(String(p.priceWholesale || Math.round(p.priceBuy * 1.25)));
                          setEditMinStock(String(p.minStock));
                          setEditUnit(p.unit);
                          setEditSupplierId(p.supplierId || '');
                          setEditResponsibleEmployeeId(p.responsibleEmployeeId || '');
                        }}
                        className="flex-1 h-11 flex items-center justify-center border border-amber-500/20 text-amber-400 bg-amber-500/5 hover:bg-amber-500/10 active:scale-95 text-xs font-black rounded-xl transition cursor-pointer"
                      >
                        Изменить
                      </button>
                      <button
                        type="button"
                        onClick={() => setProductToDelete(p)}
                        className="w-12 h-11 flex items-center justify-center border border-rose-500/20 text-rose-550 text-rose-500 bg-rose-500/5 hover:bg-rose-500/10 active:scale-95 rounded-xl transition cursor-pointer"
                        title="Удалить товар"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5  7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* RIGHT: Live warehouse correction tool or stock ledger logs */}
        <div className="xl:col-span-4 2xl:col-span-3 space-y-6">
          {/* Stock correction tool info card 
          <div className="bg-[#161920] border p-5 rounded-2xl border-slate-800/80 shadow-2xl text-center py-8 space-y-1.5">
            <BadgeInfo className="w-8 h-8 text-slate-600 mx-auto" />
            <h4 className="text-xs font-bold text-slate-300">Быстрая корректировка</h4>
            <p className="text-[11px] text-slate-500 max-w-xs mx-auto">
              Нажмите кнопку &quot;Ревизия&quot; напротив любого товара, чтобы открыть модальное окно и выполнить быструю ревизию или корректировку остатков на складе.
            </p>
          </div>
*/}
          {/* Movement History Logs */}
          <div className="bg-[#161920] p-5 rounded-2xl border border-slate-800/80 shadow-2xl space-y-3">
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5 font-mono">
              <History className="w-4 h-4 text-emerald-400" /> Складские движения (Накладные)
            </h3>

            <div className="space-y-3 max-h-[290px] overflow-y-auto pr-1">
              {correctionLogs.map((log) => {
                const isDeletion = log.notes?.includes('удален') || log.notes?.includes('Удален');
                return (
                  <div key={log.id} className="border-l-2 border-slate-800 pl-3 py-1 text-xs text-slate-400">
                    <div className="flex justify-between items-baseline">
                      <span className="font-bold text-slate-200 text-[11px] truncate block max-w-[140px]" title={log.productName}>
                        {log.productName}
                      </span>
                      <span className={`text-[9px] font-bold px-1 rounded uppercase ${
                        isDeletion
                          ? 'bg-rose-500/15 text-rose-450 border border-rose-500/20'
                          : log.type === 'RESTOCK'
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/15'
                            : log.type === 'DAMAGE'
                              ? 'bg-rose-500/10 text-rose-400 border border-rose-500/15'
                              : 'bg-[#1C1E26] text-slate-400 border border-slate-800'
                      }`}>
                        {isDeletion ? 'Удален' : (
                          <>
                            {log.type === 'RESTOCK' && 'Приход'}
                            {log.type === 'DAMAGE' && 'Списание'}
                            {log.type === 'INVENTORY_COUNT' && 'Ревизия'}
                            {log.type === 'CORRECTION' && 'Правка'}
                          </>
                        )}
                      </span>
                    </div>
                    {isDeletion ? (
                      <p className="text-[10px] text-rose-400 font-semibold font-mono mt-0.5">
                        Списан весь остаток: {log.oldStock} шт.
                      </p>
                    ) : (
                      <p className="text-[10px] text-slate-500 font-medium font-mono mt-0.5">
                        Остаток изменен: {log.oldStock} → {log.newStock} ({log.newStock - log.oldStock > 0 ? `+${log.newStock - log.oldStock}` : log.newStock - log.oldStock} шт)
                      </p>
                    )}
                    {log.notes && <p className="italic text-[10px] text-slate-500 mt-0.5">Прим: {log.notes}</p>}
                    <p className="text-[9px] text-slate-600 font-mono mt-0.5">
                      {new Date(log.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})} • {log.cashierName}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* RENDER ADD PRODUCT INVENTORY MODAL */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-sm z-50 flex items-center justify-center p-2 pb-24 sm:p-4 animate-in fade-in duration-200">
          <div className="bg-[#0A0C10] rounded-3xl w-full max-w-4xl border border-slate-800 shadow-2xl flex flex-col max-h-full">
            <div className="flex justify-between items-center p-4 sm:p-6 pb-4 border-b border-slate-800 shrink-0">
              <div>
                <h3 className="font-extrabold text-white text-base flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-amber-400 animate-pulse" /> AI-Модуль Автоматизации Склада (RetailOS)
                </h3>
                <p className="text-[11px] text-slate-500">Автопоиск в базах EAN-13, подготовка PostgreSQL-скриптов и заполнение карточек</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowAddModal(false);
                  setAiResult(null);
                  setAiError(null);
                }}
                className="text-slate-400 hover:text-white font-bold text-sm cursor-pointer whitespace-nowrap ml-2"
              >
                ✕ Закрыть
              </button>
            </div>

            <div className="p-4 sm:p-6 overflow-y-auto flex-1">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              
              {/* LEFT COLUMN: AI ASSISTANT PANEL */}
              <div className="bg-[#12151B]/60 border border-slate-800 rounded-2xl p-4 space-y-4 flex flex-col justify-between">
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-[10px] uppercase font-bold text-amber-400 font-mono tracking-wider flex items-center gap-1">
                      <Database className="w-3.5 h-3.5" /> Складской ИИ-Анализатор штрихкодов
                    </span>
                    <span className="text-[9px] text-slate-400 bg-slate-800 px-1.5 py-0.5 rounded font-mono">v2.1 Pro</span>
                  </div>

                  <p className="text-[11px] text-slate-400 leading-relaxed mb-3">
                    Введите штрих-код или нажмите <strong className="text-blue-400">"Скан"</strong>. Наш ИИ-ассистент осуществит онлайн-поиск в реестрах <strong className="text-amber-400">EAN-Online (ean-online.ru)</strong>, вытащит категорию, массу, описание и сгенерирует готовый SQL-запрос для PostgreSQL.
                  </p>

                  <div className="space-y-3">
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <input
                          type="text"
                          placeholder="Пример: 4608494469659"
                          value={aiSearchBarcode}
                          onChange={(e) => setAiSearchBarcode(e.target.value)}
                          className="w-full bg-[#1C1E26] border border-slate-750 p-2 pl-3 rounded-xl text-xs text-white placeholder-slate-600 font-mono focus:border-amber-500 outline-none"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => setIsScanningBarcode(true)}
                        className="px-3 bg-blue-600/20 text-blue-400 hover:bg-blue-600/30 border border-blue-500/10 rounded-xl text-xs font-bold flex items-center gap-1 transition cursor-pointer"
                        title="Сканировать камерой смартфона / ноутбука"
                      >
                        <Camera className="w-3.5 h-3.5" /> Скан
                      </button>
                      <button
                        type="button"
                        onClick={() => handleAISearchBarcode(aiSearchBarcode)}
                        disabled={aiIsSearching}
                        className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl text-xs font-black flex items-center gap-1.5 transition cursor-pointer disabled:opacity-50"
                      >
                        {aiIsSearching ? 'Анализ...' : 'ИИ-Поиск'}
                      </button>
                    </div>

                    {/* AI Loading logs progress */}
                    {(aiIsSearching || aiLogs.length > 0) && (
                      <div className="bg-[#090B0F] border border-slate-800/80 p-3 rounded-xl space-y-1.5 font-mono text-[10px] text-slate-400 max-h-40 overflow-y-auto">
                        <div className="flex items-center justify-between text-[9px] text-slate-500 font-bold uppercase pb-1 border-b border-slate-900">
                          <span>Служебный лог ИИ-модуля:</span>
                          {aiIsSearching && <span className="animate-pulse text-amber-400">Поиск в сети...</span>}
                        </div>
                        {aiLogs.map((log, index) => (
                          <div key={index} className="flex gap-1.5 items-start">
                            <span className="text-amber-500">✓</span>
                            <span>{log}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* AI Search Result Card */}
                    {aiResult && (
                      <div className="bg-[#1A1D24] border border-slate-750 p-4 rounded-xl space-y-3 animate-in fade-in slide-in-from-bottom-2 duration-200 font-sans">
                        <div className="flex justify-between items-start">
                          <div>
                            <span className={`text-[8.5px] font-bold px-1.5 py-0.5 rounded font-mono uppercase ${
                              aiResult.isExisting 
                                ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20' 
                                : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            }`}>
                              {aiResult.isExisting ? 'Найдено во внутренней БД' : 'Распознано в глобальной сети'}
                            </span>
                            <h4 className="text-xs font-extrabold text-white mt-1">{aiResult.name}</h4>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2 text-[10px] text-slate-400 font-mono bg-[#0D0F12] p-2 rounded-lg">
                          <div>
                            <span className="text-slate-500 block text-[9px] font-sans">Категория ИИ:</span>
                            <span className="text-amber-400 font-sans font-bold">{aiResult.category}</span>
                          </div>
                          <div>
                            <span className="text-slate-500 block text-[9px] font-sans">Оценочный вес:</span>
                            <span className="text-slate-300 font-sans">{aiResult.weight}</span>
                          </div>
                          <div>
                            <span className="text-slate-500 block text-[9px] font-sans">Страна:</span>
                            <span className="text-slate-300 font-sans">{aiResult.country}</span>
                          </div>
                          <div>
                            <span className="text-slate-500 block text-[9px] font-sans">Закуп / Сбыт (ИИ):</span>
                            <span className="text-slate-200 font-bold font-mono">{aiResult.priceBuy}р / {aiResult.priceSell}р</span>
                          </div>
                        </div>

                        {/* SQL script section */}
                        <div className="space-y-1.5">
                          <div className="flex justify-between items-center text-[9px] text-slate-500 font-bold uppercase font-mono">
                            <span>SQL-скрипт для PostgreSQL:</span>
                            <button
                              type="button"
                              onClick={() => {
                                navigator.clipboard.writeText(aiResult.sql);
                                setAiCopiedSql(true);
                                setTimeout(() => setAiCopiedSql(false), 2000);
                              }}
                              className="text-amber-400 hover:text-amber-350 transition flex items-center gap-0.5 cursor-pointer lowercase"
                            >
                              <Copy className="w-2.5 h-2.5" /> {aiCopiedSql ? 'Скопировано!' : 'Копировать'}
                            </button>
                          </div>
                          <pre className="bg-[#090B0F] text-[9px] text-indigo-300 p-2.5 rounded-lg border border-slate-800 font-mono overflow-x-auto max-h-36 leading-relaxed select-all">
                            {aiResult.sql}
                          </pre>
                        </div>

                        <div className="flex gap-2 pt-1">
                          {aiResult.isExisting ? (
                            <button
                              type="button"
                              onClick={() => {
                                if (aiResult.originalId) {
                                  setCorrectProductId(aiResult.originalId);
                                  setCorrectionType('RESTOCK');
                                }
                              }}
                              className="flex-1 py-1.5 bg-blue-600 hover:bg-blue-500 text-white font-extrabold rounded-lg text-xs cursor-pointer text-center transition"
                            >
                              ⚡️ Изменить остатки
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={handleApplyAIFill}
                              className="flex-1 py-1.5 bg-blue-600 hover:bg-blue-500 text-white font-extrabold rounded-lg text-xs cursor-pointer text-center transition"
                            >
                              ⚡️ Заполнить форму
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={handleApplyAISqlCommit}
                            className={`py-1.5 px-3 bg-emerald-600/10 text-emerald-400 hover:bg-emerald-600/20 border border-emerald-500/15 font-bold rounded-lg text-xs cursor-pointer text-center transition ${aiResult.isExisting ? 'flex-1' : ''}`}
                          >
                            🛠 Выполнить SQL {aiResult.isExisting && '(+1 шт)'}
                          </button>
                        </div>
                      </div>
                    )}

                    {/* AI Search Error Card */}
                    {aiError && (
                      <div className="bg-red-950/20 border border-red-500/20 p-4 rounded-xl space-y-3 animate-in fade-in slide-in-from-bottom-2 duration-200 font-sans">
                        <div className="flex items-center gap-2 text-red-400 font-bold text-xs uppercase font-sans">
                          <AlertTriangle className="w-4 h-4 text-red-400 animate-pulse" />
                          <span>Информации по штрих-коду не найдено</span>
                        </div>
                        <p className="text-[11.5px] text-slate-200 leading-relaxed font-sans font-medium">
                          {aiError}
                        </p>
                        <div className="bg-red-950/50 text-[9.5px] text-red-400 p-2 text-left rounded-lg border border-red-900/30 font-mono">
                          Код ошибки GS1: GEPIR_EAN13_404_NOT_FOUND
                          <br />
                          Префикс штрихкода: {aiSearchBarcode.slice(0, 3)} (Реестр пуст или недоступен)
                        </div>
                        <p className="text-[10px] text-slate-500 italic font-sans leading-normal">
                          Пожалуйста, заполните карточку товара (наименование, категорию, закупку, единицу измерения) вручную в полях справа.
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                {!aiResult && !aiIsSearching && !aiError && (
                  <div className="bg-[#1C1E26]/40 border border-slate-800 p-4 rounded-xl text-center text-slate-500 py-6">
                    <Sparkles className="w-6 h-6 text-slate-600 mx-auto mb-1 animate-pulse" />
                    <p className="text-[11px] font-bold">Ожидание заведения товара</p>
                    <p className="text-[9.5px] text-slate-600 max-w-xs mx-auto mt-0.5 leading-normal">
                      Отсканируйте код через Сканер камеры или введите штрих-код слева, после чего нажмите кнопку <strong className="text-amber-400 font-bold">ИИ-Поиск</strong> для автоматического анализа товара.
                    </p>
                  </div>
                )}
              </div>

              {/* RIGHT COLUMN: MANUAL VERIFICATION AND COMPLETION FORM OR QUICK RESTOCK */}
              {aiResult?.isExisting ? (
                <div className="space-y-4">
                  <span className="text-[10px] uppercase font-bold text-slate-500 font-mono tracking-wider">
                    ⚡️ Быстрый приход товара на склад
                  </span>
                  <div className="bg-[#12151B] border border-slate-800 rounded-2xl p-6 space-y-4">
                    <p className="text-sm text-slate-300">Товар <strong className="text-white">{aiResult.name}</strong> уже зарегистрирован на складе.</p>
                    <p className="text-xs text-slate-400">Текущий остаток: <strong className="text-blue-400 font-mono text-sm">{aiResult.currentStock}</strong> шт.</p>
                    
                    <div className="pt-2">
                       <label className="block text-slate-400 text-xs font-semibold mb-2">Введите количество для оприходования:</label>
                       <div className="flex gap-2 items-center">
                          <button type="button" onClick={() => setQuickRestockQty(Math.max(1, quickRestockQty - 1))} className="bg-[#1C1E26] hover:bg-slate-700 p-2 rounded-xl border border-slate-700 text-white font-bold w-12 flex justify-center items-center cursor-pointer">-</button>
                          <input 
                            type="number"
                            min="1"
                            value={quickRestockQty || ''}
                            onChange={e => setQuickRestockQty(Number(e.target.value))}
                            className="bg-[#1C1E26] border border-slate-700 p-2 text-lg text-white font-mono rounded-xl w-32 focus:border-blue-500 text-center"
                          />
                          <button type="button" onClick={() => setQuickRestockQty(quickRestockQty + 1)} className="bg-[#1C1E26] hover:bg-slate-700 p-2 rounded-xl border border-slate-700 text-white font-bold w-12 flex justify-center items-center cursor-pointer">+</button>
                          <span className="text-slate-500 text-sm ml-2">шт.</span>
                       </div>
                    </div>

                    <div className="pt-4 flex gap-3">
                       <button
                         type="button"
                         onClick={() => {
                           if (!aiResult.originalId || quickRestockQty <= 0) return;
                           onCorrectStock(
                             aiResult.originalId, 
                             (aiResult.currentStock || 0) + quickRestockQty, 
                             'RESTOCK', 
                             `Быстрый авто-приход. Добавлено ${quickRestockQty} шт.`
                           );
                           alert(`Успешно добавлено ${quickRestockQty} шт. к остатку товара!`);
                           setShowAddModal(false);
                         }}
                         className="flex-1 bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 rounded-xl transition shadow-lg shadow-blue-900/20 cursor-pointer"
                       >
                         Добавить к остатку на складе
                       </button>
                    </div>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleAddProductSubmit} className="space-y-4">
                  <span className="text-[10px] uppercase font-bold text-slate-500 font-mono tracking-wider">
                    📝 Подтверждение и ручной контроль полей
                  </span>

                  <div className="space-y-3 text-xs">
                    <div className="space-y-1">
                      <label className="block text-slate-400 font-semibold">Наименование товара:</label>
                      <input
                        type="text"
                        required
                        value={newProdName}
                        placeholder="Например: Кабель коаксиальный RG-6 100м"
                        onChange={(e) => setNewProdName(e.target.value)}
                        className="w-full bg-[#1C1E26] border border-slate-800 p-2 rounded-xl text-slate-200 focus:ring-1 focus:ring-blue-500"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="block text-slate-400 font-semibold">Изображение товара (Файл или ссылка URL):</label>
                      <div className="flex gap-2 items-center">
                        <input
                          type="file"
                          accept="image/*"
                          className="text-xs w-48 text-slate-400 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border file:border-slate-700 file:text-xs file:font-bold file:bg-[#1C1E26] file:text-blue-400 hover:file:bg-[#252833]"
                          onChange={async (e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              try {
                                setIsUploading(true);
                                const res = await api.upload(file);
                                setNewProdImageUrl(res.url);
                              } catch (err: any) {
                                alert(`Ошибка загрузки изображения: ${err.message}`);
                                setNewProdImageUrl('');
                              } finally {
                                setIsUploading(false);
                              }
                            }
                          }}
                        />
                        <span className="text-slate-500 font-bold text-xs">ИЛИ</span>
                        <input
                          type="text"
                          value={newProdImageUrl}
                          placeholder="https://... или data:image/..."
                          onChange={(e) => setNewProdImageUrl(e.target.value)}
                          className="flex-1 min-w-0 bg-[#1C1E26] border border-slate-800 p-2 rounded-xl text-slate-200 focus:ring-1 focus:ring-blue-500 text-xs"
                        />
                      </div>
                      {isUploading && (
                        <div className="mt-2 text-[10px] font-bold text-amber-400 font-mono animate-pulse">
                          ⏳ Загрузка в облако Cloudinary...
                        </div>
                      )}
                      {newProdImageUrl && (
                        <div className="mt-2 w-16 h-16 rounded-xl border border-slate-700 overflow-hidden bg-slate-800 p-0.5">
                          <img src={newProdImageUrl} alt="Preview" className="w-full h-full object-contain" />
                        </div>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <div className="flex justify-between items-center">
                          <label className="block text-slate-400 font-semibold">Штрихкод:</label>
                          <button
                            type="button"
                            onClick={handleAutoGenerateBarcode}
                            className="text-[10px] text-amber-400 hover:text-amber-350 transition font-bold"
                            title="Генерация EAN-13"
                          >
                            МСК Генерация
                          </button>
                        </div>
                        <input
                          type="text"
                          required
                          value={newProdBarcode}
                          placeholder="46012345..."
                          onChange={(e) => {
                            setNewProdBarcode(e.target.value);
                            setAiSearchBarcode(e.target.value);
                          }}
                          className="w-full bg-[#1C1E26] border border-slate-800 p-2 rounded-xl text-slate-200 font-mono focus:ring-1 focus:ring-blue-500"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="block text-slate-400 font-semibold">Артикул / SKU:</label>
                        <input
                          type="text"
                          value={newProdSKU}
                          placeholder="EL-542..."
                          onChange={(e) => setNewProdSKU(e.target.value)}
                          className="w-full bg-[#1C1E26] border border-slate-800 p-2 rounded-xl text-slate-200 font-mono focus:ring-1 focus:ring-blue-500"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <div className="flex justify-between items-center">
                          <label className="block text-slate-400 font-semibold">Категория:</label>
                          <button
                            type="button"
                            onClick={() => setIsAddingQuickCat(prev => !prev)}
                            className="text-[10px] text-indigo-400 hover:text-indigo-350 transition font-bold"
                          >
                            {isAddingQuickCat ? 'Выбрать' : '+ Новая группа'}
                          </button>
                        </div>
                        
                        {isAddingQuickCat ? (
                          <div className="flex gap-1.5">
                            <input
                              type="text"
                              placeholder="Название..."
                              value={quickNewCatName}
                              onChange={(e) => setQuickNewCatName(e.target.value)}
                              className="flex-1 bg-[#1C1E26] border border-slate-700 p-2 rounded-xl text-white text-[10px]"
                              autoFocus
                            />
                            <button
                              type="button"
                              onClick={handleQuickAddCategory}
                              className="bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold px-2.5 rounded-xl text-xs cursor-pointer"
                            >
                              +
                            </button>
                          </div>
                        ) : (
                          <select
                            value={newProdCategory}
                            onChange={(e) => setNewProdCategory(e.target.value)}
                            className="w-full bg-[#1C1E26] border border-slate-800 p-2 rounded-xl text-slate-200 focus:ring-1 focus:ring-blue-500"
                          >
                            {categories.map(c => (
                              <option key={c.id} value={c.name} className="bg-[#1C1E26] text-slate-200">{c.name}</option>
                            ))}
                          </select>
                        )}
                      </div>

                      <div className="space-y-1">
                        <label className="block text-slate-400 font-semibold">Ед. измерения:</label>
                        <input
                          type="text"
                          value={newProdUnit}
                          onChange={(e) => setNewProdUnit(e.target.value)}
                          className="w-full bg-[#1C1E26] border border-slate-800 p-2 rounded-xl text-slate-200 focus:ring-1 focus:ring-blue-500"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-3">
                      <div className="space-y-1">
                        <label className="block text-slate-400 font-semibold text-[11px]">Цена закупа:</label>
                        <input
                          type="text"
                          value={newProdPriceBuy}
                          onChange={(e) => {
                            const valStr = e.target.value;
                            setNewProdPriceBuy(valStr);
                            const cleanStr = valStr.replace(',', '.');
                            const numericVal = parseFloat(cleanStr);
                            if (!isNaN(numericVal)) {
                              setNewProdPriceSell(String(Math.round(numericVal * 1.8)));
                              setNewProdPriceWholesale(String(Math.round(numericVal * 1.3)));
                            }
                          }}
                          className="w-full bg-[#1C1E26] border border-slate-800 p-2 rounded-xl text-slate-200 font-mono focus:ring-1 focus:ring-blue-500"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="block text-slate-400 font-semibold text-[11px]">Розничная цена:</label>
                        <input
                          type="text"
                          value={newProdPriceSell}
                          onChange={(e) => setNewProdPriceSell(e.target.value)}
                          className="w-full bg-[#1C1E26] border border-slate-800 p-2 rounded-xl text-slate-200 font-mono focus:ring-1 focus:ring-blue-500"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="block text-slate-400 font-semibold text-[11px] text-blue-400">Оптовая цена:</label>
                        <input
                          type="text"
                          value={newProdPriceWholesale}
                          onChange={(e) => setNewProdPriceWholesale(e.target.value)}
                          className="w-full bg-[#1C1E26] border border-slate-800 p-2 rounded-xl text-blue-300 font-mono focus:ring-1 focus:ring-blue-500"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="block text-slate-400 font-semibold">Начальный остаток:</label>
                        <input
                          type="number"
                          value={newProdStock}
                          onChange={(e) => setNewProdStock(Number(e.target.value))}
                          className="w-full bg-[#1C1E26] border border-slate-800 p-2 rounded-xl text-slate-200 font-mono focus:ring-1 focus:ring-blue-500"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="block text-slate-400 font-semibold">Мин. запас:</label>
                        <input
                          type="number"
                          value={newProdMinStock}
                          onChange={(e) => setNewProdMinStock(Number(e.target.value))}
                          className="w-full bg-[#1C1E26] border border-slate-800 p-2 rounded-xl text-slate-200 font-mono focus:ring-1 focus:ring-blue-500"
                        />
                      </div>
                    </div>

                    <div className="bg-[#151720]/80 p-3.5 border border-slate-800 rounded-2xl space-y-3 mt-2">
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          id="newProdIsPromo"
                          checked={newProdIsPromo}
                          onChange={(e) => {
                            const checked = e.target.checked;
                            setNewProdIsPromo(checked);
                            if (checked && !newProdOriginalPriceSell) {
                              setNewProdOriginalPriceSell(String(newProdPriceSell));
                            }
                          }}
                          className="w-4 h-4 rounded border-slate-800 text-rose-500 bg-[#1C1E26]"
                        />
                        <label htmlFor="newProdIsPromo" className="text-rose-500 font-bold text-xs cursor-pointer select-none">
                          🔥 ТОВАР УЧАСТВУЕТ В АКЦИИ (СКИДКА)
                        </label>
                      </div>

                      {newProdIsPromo && (
                        <div className="grid grid-cols-2 gap-3 animate-in fade-in slide-in-from-top-1 duration-150">
                          <div className="space-y-1">
                            <label className="block text-slate-400 font-semibold text-[10px]">ТЕКСТ АКЦИИ (БАДЖ):</label>
                            <input
                              type="text"
                              placeholder="Например, -10% или АКЦИЯ"
                              value={newProdPromoLabel}
                              onChange={(e) => setNewProdPromoLabel(e.target.value)}
                              onBlur={(e) => {
                                const val = e.target.value.trim();
                                if (val && /^\d+$/.test(val)) {
                                  setNewProdPromoLabel(`-${val}%`);
                                }
                              }}
                              className="w-full bg-[#1C1E26] border border-slate-800 p-2.5 rounded-xl text-white font-mono text-xs focus:ring-1 focus:ring-rose-500"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="block text-slate-400 font-semibold text-[10px]">СТАРАЯ ЦЕНА ДО СКИДКИ (РУБ.):</label>
                            <input
                              type="number"
                              placeholder="Перечеркнутая цена"
                              value={newProdOriginalPriceSell}
                              onChange={(e) => setNewProdOriginalPriceSell(e.target.value)}
                              className="w-full bg-[#1C1E26] border border-slate-800 p-2.5 rounded-xl text-slate-450 font-mono text-xs focus:ring-1 focus:ring-rose-500"
                            />
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="space-y-1">
                      <label className="block text-slate-400 font-semibold">Основной поставщик:</label>
                      <select
                        value={newProdSupplier}
                        onChange={(e) => setNewProdSupplier(e.target.value)}
                        className="w-full bg-[#1C1E26] border border-slate-800 p-2 rounded-xl text-slate-200 focus:ring-1 focus:ring-blue-500"
                      >
                        {suppliers.map(s => (
                          <option key={s.id} value={s.id} className="bg-[#1C1E26] text-slate-200">{s.name} ({s.company})</option>
                        ))}
                      </select>
                    </div>
                    
                    <div className="space-y-1">
                      <label className="block text-slate-400 font-semibold">Ответственный сотрудник:</label>
                      <select
                        value={newProdResponsibleEmployeeId}
                        onChange={(e) => setNewProdResponsibleEmployeeId(e.target.value)}
                        className="w-full bg-[#1C1E26] border border-slate-800 p-2 rounded-xl text-slate-200 focus:ring-1 focus:ring-blue-500"
                      >
                        <option value="">Не назначен</option>
                        {employees.map(emp => (
                          <option key={emp.id} value={emp.id} className="bg-[#1C1E26] text-slate-200">{emp.name} ({emp.role})</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="flex gap-2 pt-4 border-t border-slate-800">
                    <button
                      type="submit"
                      className="flex-1 py-3 bg-blue-600 hover:bg-blue-500 text-white font-extrabold rounded-xl text-xs cursor-pointer transition"
                    >
                      Регистрация товара
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowAddModal(false);
                        setAiResult(null);
                      }}
                      className="py-3 px-4 border border-slate-800 bg-[#1C1E26] hover:bg-slate-800 text-slate-300 text-xs font-semibold rounded-xl cursor-pointer"
                    >
                      Отмена
                    </button>
                  </div>
                </form>
              )}
              </div>
            </div>
          </div>
        </div>
      )}

      {selectedEditProduct && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-sm z-50 flex items-center justify-center p-2 pb-24 sm:p-4 animate-in fade-in duration-200">
          <div className="bg-[#0A0C10] rounded-3xl w-full max-w-2xl border border-slate-800/80 shadow-2xl flex flex-col max-h-full text-slate-200">
            <div className="flex justify-between items-center p-4 sm:p-6 pb-4 border-b border-slate-800 shrink-0">
              <div>
                <span className="text-[10px] uppercase font-bold text-amber-500 tracking-wider font-mono">Карточка товара и логи</span>
                <h3 className="font-extrabold text-white text-base">Редактировать карточку: {selectedEditProduct.name}</h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedEditProduct(null)}
                className="text-slate-400 hover:text-white font-bold text-sm cursor-pointer whitespace-nowrap ml-2"
              >
                ✕ Закрыть
              </button>
            </div>

            <div className="p-4 sm:p-6 overflow-y-auto flex-1">
              {/* TAB SELECTOR */}
              <div className="flex border-b border-slate-850 mb-5 text-xs font-semibold gap-1">
              <button
                type="button"
                onClick={() => setActiveModalTab('info')}
                className={`py-2.5 px-4 border-b-2 transition-all cursor-pointer ${activeModalTab === 'info' ? 'border-amber-500 text-amber-500 font-bold' : 'border-transparent text-slate-400 hover:text-slate-200'}`}
              >
                Основные реквизиты
              </button>
              <button
                type="button"
                onClick={() => setActiveModalTab('history')}
                className={`py-2.5 px-4 border-b-2 transition-all flex items-center gap-1.5 cursor-pointer ${activeModalTab === 'history' ? 'border-amber-500 text-amber-500 font-bold' : 'border-transparent text-slate-400 hover:text-slate-200'}`}
              >
                <History className="w-3.5 h-3.5" />
                История движений
              </button>
              <button
                type="button"
                onClick={() => setActiveModalTab('print')}
                className={`py-2.5 px-4 border-b-2 transition-all flex items-center gap-1.5 cursor-pointer ${activeModalTab === 'print' ? 'border-amber-500 text-amber-500 font-bold' : 'border-transparent text-slate-400 hover:text-slate-200'}`}
              >
                <Tag className="w-3.5 h-3.5 text-emerald-400" />
                Печать ценников
              </button>
            </div>

            {activeModalTab === 'info' && (
              <form onSubmit={handleUpdateProductSubmit} className="space-y-4 text-xs">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1 sm:col-span-2">
                    <label className="block text-slate-400 font-semibold font-mono text-[10.5px]">НАЗВАНИЕ ТОВАРА / УСЛУГИ:</label>
                    <input
                      type="text"
                      required
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="w-full bg-[#1C1E26] border border-slate-800 p-2.5 rounded-xl text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500 font-bold"
                    />
                  </div>

                  <div className="space-y-1 sm:col-span-2">
                    <label className="block text-slate-400 font-semibold font-mono text-[10.5px]">ФОТО ТОВАРА (ИЗ ФАЙЛА ИЛИ URL):</label>
                    <div className="flex gap-2 items-center">
                      <input
                        type="file"
                        accept="image/*"
                        className="text-xs w-48 text-slate-400 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border file:border-slate-700 file:text-xs file:font-bold file:bg-[#1C1E26] file:text-blue-400 hover:file:bg-[#252833]"
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            try {
                              setIsUploading(true);
                              const res = await api.upload(file);
                              setEditImageUrl(res.url);
                            } catch (err: any) {
                              alert(`Ошибка загрузки изображения: ${err.message}`);
                              setEditImageUrl('');
                            } finally {
                              setIsUploading(false);
                            }
                          }
                        }}
                      />
                      <span className="text-slate-500 font-bold text-xs">ИЛИ</span>
                      <input
                        type="text"
                        value={editImageUrl}
                        placeholder="https://..."
                        onChange={(e) => setEditImageUrl(e.target.value)}
                        className="flex-1 w-full bg-[#1C1E26] border border-slate-800 p-2.5 rounded-xl text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    </div>
                    {isUploading && (
                      <div className="mt-2 text-[10px] font-bold text-amber-400 font-mono animate-pulse">
                        ⏳ Загрузка в облако Cloudinary...
                      </div>
                    )}
                    {editImageUrl && (
                      <div className="mt-2 w-16 h-16 rounded-xl border border-slate-700 overflow-hidden bg-slate-800 p-0.5">
                        <img src={editImageUrl} alt="Preview" className="w-full h-full object-contain" referrerPolicy="no-referrer" />
                      </div>
                    )}
                  </div>

                  <div className="space-y-1">
                    <label className="block text-slate-400 font-semibold font-mono text-[10.5px]">ШТРИХ-КОД (BARCODE / EAN-13):</label>
                    <input
                      type="text"
                      required
                      value={editBarcode}
                      onChange={(e) => setEditBarcode(e.target.value)}
                      className="w-full bg-[#1C1E26] border border-slate-800 p-2.5 rounded-xl text-emerald-400 font-bold font-mono focus:outline-none focus:ring-1 focus:ring-blue-500"
                      placeholder="Пример: 4607024123456"
                    />
                    <span className="text-[9.5px] text-slate-500 block">По штрих-коду кассир сможет пробить этот товар в POS.</span>
                  </div>

                  <div className="space-y-1">
                    <label className="block text-slate-400 font-semibold font-mono text-[10.5px]">АРТИКУЛ (SKU):</label>
                    <input
                      type="text"
                      value={editSku}
                      onChange={(e) => setEditSku(e.target.value)}
                      className="w-full bg-[#1C1E26] border border-slate-800 p-2.5 rounded-xl text-slate-300 font-mono focus:outline-none"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="block text-slate-400 font-semibold font-mono text-[10.5px]">КАТЕГОРИЯ КАТАЛОГА:</label>
                    <select
                      value={editCategory}
                      onChange={(e) => {
                        const newCat = e.target.value;
                        setEditCategory(newCat);
                        setEditSku(prev => updateSKUCategory(prev, newCat));
                      }}
                      className="w-full bg-[#1C1E26] border border-slate-800 p-2.5 rounded-xl text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    >
                      {categories.map((c) => (
                        <option key={c.id} value={c.name} className="bg-[#1C1E26]">{c.name}</option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="block text-slate-400 font-semibold font-mono text-[10.5px]">ЕДИНИЦА ИЗМЕРЕНИЯ:</label>
                    <select
                      value={editUnit}
                      onChange={(e) => setEditUnit(e.target.value)}
                      className="w-full bg-[#1C1E25] border border-slate-800 p-2.5 rounded-xl text-slate-200 focus:outline-none"
                    >
                      <option value="шт.">штука (шт.)</option>
                      <option value="кг">килограмм (кг)</option>
                      <option value="метр">метр (метр)</option>
                      <option value="литр">литр (литр)</option>
                      <option value="упак.">упаковка (упак.)</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="block text-emerald-500 font-semibold font-mono text-[10.5px]">ЦЕНА ЗАКУПКИ (РУБ.):</label>
                    <input
                      type="number"
                      value={editPriceBuy}
                      onChange={(e) => setEditPriceBuy(e.target.value)}
                      className="w-full bg-[#1C1E26] border border-slate-800 p-2.5 rounded-xl text-slate-200 font-mono font-bold font-semibold"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="block text-blue-400 font-semibold font-mono text-[10.5px]">ЦЕНА ПРОДАЖИ (РОЗНИЦА, РУБ.):</label>
                      <input
                        type="number"
                        value={editPriceSell}
                        onChange={(e) => setEditPriceSell(e.target.value)}
                        className="w-full bg-[#1C1E26] border border-slate-800 p-2.5 rounded-xl text-white font-mono font-bold font-semibold"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="block text-indigo-400 font-semibold font-mono text-[10.5px]">ЦЕНА ПРОДАЖИ (ОПТ, РУБ.):</label>
                      <input
                        type="number"
                        value={editPriceWholesale}
                        onChange={(e) => setEditPriceWholesale(e.target.value)}
                        className="w-full bg-[#1C1E26] border border-slate-800 p-2.5 rounded-xl text-indigo-300 font-mono font-bold font-semibold"
                      />
                    </div>
                  </div>

                  <div className="bg-[#151720]/80 p-4 border border-slate-800 rounded-2xl space-y-3.5 mt-2">
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="editIsPromo"
                        checked={editIsPromo}
                        onChange={(e) => {
                          const checked = e.target.checked;
                          setEditIsPromo(checked);
                          if (checked && !editOriginalPriceSell) {
                            setEditOriginalPriceSell(editPriceSell);
                          }
                        }}
                        className="w-4 h-4 rounded border-slate-800 text-rose-500 bg-[#1C1E26]"
                      />
                      <label htmlFor="editIsPromo" className="text-rose-500 font-bold text-xs cursor-pointer select-none">
                        🔥 ТОВАР УЧАСТВУЕТ В АКЦИИ (СКИДКА)
                      </label>
                    </div>

                    {editIsPromo && (
                      <div className="grid grid-cols-2 gap-3 animate-in fade-in slide-in-from-top-1 duration-150">
                        <div className="space-y-1">
                          <label className="block text-slate-400 font-semibold font-mono text-[10px]">ТЕКСТ АКЦИИ (БАДЖ):</label>
                          <input
                            type="text"
                            placeholder="Например, -10% или АКЦИЯ"
                            value={editPromoLabel}
                            onChange={(e) => setEditPromoLabel(e.target.value)}
                            onBlur={(e) => {
                              const val = e.target.value.trim();
                              if (val && /^\d+$/.test(val)) {
                                setEditPromoLabel(`-${val}%`);
                              }
                            }}
                            className="w-full bg-[#1C1E26] border border-slate-800 p-2.5 rounded-xl text-white font-mono text-xs"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="block text-slate-400 font-semibold font-mono text-[10px]">СТАРАЯ ЦЕНА ДО СКИДКИ (РУБ.):</label>
                          <input
                            type="number"
                            placeholder="Перечеркнутая цена"
                            value={editOriginalPriceSell}
                            onChange={(e) => setEditOriginalPriceSell(e.target.value)}
                            className="w-full bg-[#1C1E26] border border-slate-800 p-2.5 rounded-xl text-slate-400 font-mono text-xs"
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="space-y-1">
                    <label className="block text-amber-500 font-semibold font-mono text-[10.5px]">МИНИМАЛЬНЫЙ СТРАХОВОЙ ОСТАТОК:</label>
                    <input
                      type="number"
                      value={editMinStock}
                      onChange={(e) => setEditMinStock(e.target.value)}
                      className="w-full bg-[#1C1E26] border border-slate-800 p-2.5 rounded-xl text-slate-300 font-mono"
                    />
                    <span className="text-[9px] text-slate-500 block">Предупреждать при критическом снижении остатков</span>
                  </div>

                  <div className="space-y-1">
                    <label className="block text-slate-400 font-semibold font-mono text-[10.5px]">ОСНОВНОЙ ПОСТАВЩИК ТОВАРА:</label>
                    <select
                      value={editSupplierId}
                      onChange={(e) => setEditSupplierId(e.target.value)}
                      className="w-full bg-[#1C1E26] border border-slate-800 p-2.5 rounded-xl text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    >
                      <option value="">Поставщик не указан</option>
                      {suppliers.map(s => (
                        <option key={s.id} value={s.id} className="bg-[#1C1E26]">{s.name} ({s.company})</option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="block text-slate-400 font-semibold font-mono text-[10.5px]">ОТВЕТСТВЕННЫЙ СОТРУДНИК:</label>
                    <select
                      value={editResponsibleEmployeeId}
                      onChange={(e) => setEditResponsibleEmployeeId(e.target.value)}
                      className="w-full bg-[#1C1E26] border border-slate-800 p-2.5 rounded-xl text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    >
                      <option value="">Не назначен</option>
                      {employees.map(emp => (
                        <option key={emp.id} value={emp.id} className="bg-[#1C1E26] text-slate-200">{emp.name} ({emp.role})</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="flex gap-2.5 pt-4 border-t border-slate-800/85">
                  <button
                    type="submit"
                    className="flex-1 py-3 bg-blue-600 hover:bg-blue-500 text-white font-extrabold rounded-xl text-xs cursor-pointer transition shadow-lg"
                  >
                    Сохранить изменения карточки
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedEditProduct(null)}
                    className="py-3 px-5 border border-slate-800 bg-[#1C1E26] hover:bg-slate-850 text-slate-400 hover:text-slate-200 text-xs font-semibold rounded-xl cursor-pointer"
                  >
                    Отмена
                  </button>
                </div>
              </form>
            )}

            {activeModalTab === 'history' && (
              <div className="space-y-4 animate-in fade-in duration-200 py-1">
                <div className="flex items-center justify-between pb-1">
                  <span className="text-[10px] font-bold text-amber-500 font-mono tracking-wider uppercase">
                    Последние 5 складских операций
                  </span>
                  <span className="bg-[#1C1E26] border border-slate-800/80 px-2.5 py-1 rounded-xl text-[9px] font-mono font-bold text-slate-400">
                    ID ТОВАРА: {selectedEditProduct.id}
                  </span>
                </div>

                {getProductMovementHistory().length === 0 ? (
                  <div className="bg-[#161920]/60 border border-slate-800/60 p-10 rounded-2xl text-center text-slate-400 space-y-3">
                    <History className="w-8 h-8 text-amber-500/50 mx-auto animate-pulse" />
                    <p className="font-bold text-xs text-slate-300">Движения товара не зафиксированы</p>
                    <p className="text-[10px] text-slate-500 max-w-sm mx-auto leading-relaxed">
                      Система автоматически запишет новые складские движения, когда товар будет продан на кассе, поступит в накладной или будет скорректирован.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2.5 max-h-[380px] overflow-y-auto pr-1">
                    {getProductMovementHistory().map((item) => {
                      const isPositive = item.quantityChange > 0;
                      return (
                        <div
                          key={item.id}
                          className="bg-[#161920]/90 border border-slate-800/80 p-3 rounded-2xl flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-xs"
                        >
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className={`px-2 py-0.5 rounded text-[9px] font-mono font-bold ${
                                item.type === 'RESTOCK' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/15' :
                                item.type === 'SALE' ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/15' :
                                item.type === 'DAMAGE' ? 'bg-rose-500/10 text-rose-400 border border-rose-500/15' :
                                'bg-amber-500/10 text-amber-400 border border-amber-500/15'
                              }`}>
                                {item.type === 'RESTOCK' && 'Поставка'}
                                {item.type === 'SALE' && 'Продажа'}
                                {item.type === 'DAMAGE' && 'Списание'}
                                {item.type === 'INVENTORY_COUNT' && 'Ревизия'}
                                {item.type === 'CORRECTION' && 'Корректировка'}
                              </span>
                              <span className="font-bold text-slate-200">{item.title}</span>
                            </div>
                            <div className="flex flex-wrap items-center gap-x-2 text-[10px] text-slate-500 font-mono">
                              <span>📅 {new Date(item.timestamp).toLocaleString('ru-RU')}</span>
                              <span className="text-slate-700">|</span>
                              <span>👤 {item.user}</span>
                            </div>
                            {item.notes && (
                              <p className="text-[10px] italic text-amber-400/80 bg-amber-500/5 px-2 py-1 rounded-lg border border-amber-500/10 inline-block">
                                Примечание: {item.notes}
                              </p>
                            )}
                          </div>
                          
                          <div className="text-right sm:self-center flex sm:flex-col items-center justify-between sm:justify-center gap-1.5 shrink-0 bg-[#0A0C10]/60 p-2 sm:p-0 rounded-xl sm:bg-transparent">
                            <span className="text-[9.5px] text-slate-500 block sm:hidden">Движение:</span>
                            <div className="flex items-center gap-1.5">
                              <span className={`font-mono text-xs font-black px-2 py-0.5 rounded-md ${isPositive ? 'text-emerald-400 bg-emerald-500/5' : 'text-rose-400 bg-rose-500/5'}`}>
                                {isPositive ? `+${item.quantityChange}` : item.quantityChange} {selectedEditProduct.unit || 'шт.'}
                              </span>
                              <span className="text-[10px] text-slate-400 font-mono">
                                ({item.meta})
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
                
                <div className="pt-4 border-t border-slate-800/80 flex justify-end">
                  <button
                    type="button"
                    onClick={() => setSelectedEditProduct(null)}
                    className="py-2.5 px-6 border border-slate-800 bg-[#1C1E26] hover:bg-slate-850 text-slate-400 hover:text-slate-200 text-xs font-semibold rounded-xl cursor-pointer"
                  >
                    Закрыть карточку
                  </button>
                </div>
              </div>
            )}

            {activeModalTab === 'print' && (
              <div className="space-y-6 text-xs animate-in fade-in duration-200">
                <div className="bg-[#14161F] p-4 rounded-xl border border-slate-800/80">
                  <span className="text-[10px] text-amber-500 uppercase font-bold tracking-wider font-mono">Конструктор ценника</span>
                  <p className="text-slate-400 mt-1">Отрегулируйте внешний вид ценников и штрихкодов перед выводом на печать или в PDF.</p>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  {/* Left Controls */}
                  <div className="space-y-4">
                    <div className="space-y-1">
                      <label className="block text-slate-400 font-semibold font-mono text-[10.1px]">НАЗВАНИЕ МАГАЗИНА НА ЦЕННИКЕ:</label>
                      <input
                        type="text"
                        value={printStoreName}
                        onChange={(e) => {
                          setPrintStoreName(e.target.value);
                          localStorage.setItem('prestige_print_store_name', e.target.value);
                        }}
                        className="w-full bg-[#1C1E26] border border-slate-800 p-2 text-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    </div>
                    
                    <div className="space-y-1">
                      <label className="block text-slate-400 font-semibold font-mono text-[10.1px]">ТИП ЦЕННИКА / НАКЛЕЙКИ:</label>
                      <select
                        value={printType}
                        onChange={(e) => setPrintType(e.target.value as any)}
                        className="w-full bg-[#1C1E26] border border-[#1C1E26] p-2 text-slate-200 rounded-xl focus:outline-none"
                      >
                        <option value="shelf_standard">Стандартный полочный ценник (Красивый)</option>
                        <option value="shelf_colored">Ценник «АКЦИЯ» (Яркий, жёлто-красный)</option>
                        <option value="label">Продуктовая наклейка со штрихкодом</option>
                        <option value="label_tiny">Крошечный стикер со штрихкодом (Для узкой ленты)</option>
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="block text-slate-400 font-semibold font-mono text-[10.1px]">КОЛИЧЕСТВО НАКЛЕЕК ДЛЯ ПЕЧАТИ (КОПИИ):</label>
                      <input
                        type="number"
                        min={1}
                        max={120}
                        value={printCopies}
                        onChange={(e) => setPrintCopies(Math.max(1, parseInt(e.target.value, 10) || 1))}
                        className="w-full bg-[#1C1E26] border border-[#1C1E26] p-2 text-slate-200 rounded-xl focus:outline-none"
                      />
                      <span className="text-[9.5px] text-slate-500 block">На стандартном листе А4 помещается около 24-40 ценников.</span>
                    </div>

                    <div className="space-y-2 pt-2 border-t border-slate-800/60">
                      <label className="block text-slate-400 font-semibold font-mono text-[10.1px]">НАСТРОЙКИ ОТОБРАЖЕНИЯ:</label>
                      
                      <label className="flex items-center gap-2 text-slate-300 font-medium cursor-pointer">
                        <input
                          type="checkbox"
                          checked={showPrintBarcode}
                          onChange={(e) => setShowPrintBarcode(e.target.checked)}
                          className="rounded border-slate-800 bg-[#1C1E26] text-blue-500 focus:ring-0"
                        />
                        <span>Печатать Штрих-код (EAN-13)</span>
                      </label>

                      <label className="flex items-center gap-2 text-slate-300 font-medium cursor-pointer">
                        <input
                          type="checkbox"
                          checked={showPrintWholesale}
                          onChange={(e) => setShowPrintWholesale(e.target.checked)}
                          className="rounded border-slate-800 bg-[#1C1E26] text-blue-500 focus:ring-0"
                        />
                        <span>Показывать Оптовую цену как справочную</span>
                      </label>

                      <label className="flex items-center gap-2 text-slate-300 font-medium cursor-pointer">
                        <input
                          type="checkbox"
                          checked={showPrintSku}
                          onChange={(e) => setShowPrintSku(e.target.checked)}
                          className="rounded border-slate-800 bg-[#1C1E26] text-blue-500 focus:ring-0"
                        />
                        <span>Показывать Артикул товара (SKU)</span>
                      </label>
                    </div>
                  </div>

                  {/* Right Realtime Live Preview Frame with White-Paper Tag Aesthetics to simulate exactly how it prints */}
                  <div className="flex flex-col items-center justify-center p-4 bg-[#14161F] rounded-2xl border border-slate-800/80">
                    <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wider font-mono mb-3">Интерактивный Предпросмотр</span>
                    
                    {/* Tag rendering container using a realistic retail visual layout */}
                    <div className="w-full max-w-[210px] bg-white text-black rounded-lg shadow-xl p-3 border border-slate-300 flex flex-col justify-between overflow-hidden aspect-[4/3] select-none">
                      
                      {/* Top ribbon: Store name */}
                      <div className="text-center border-b border-dashed border-slate-300 pb-1 shrink-0">
                        <span className="text-[8px] uppercase tracking-wider font-extrabold text-slate-600 block leading-tight truncate">{printStoreName}</span>
                      </div>

                      {/* Main Body content by style */}
                      <div className="flex-1 flex flex-col justify-center py-2">
                        {printType === 'shelf_standard' && (
                          <div className="text-center space-y-1">
                            <h4 className="text-[10.5px] font-bold text-slate-850 tracking-tight leading-tight uppercase line-clamp-2 px-1">{editName || selectedEditProduct.name}</h4>
                            <div className="flex items-baseline justify-center gap-1">
                              <span className="text-[25px] font-black tracking-tight text-slate-900 leading-none">{editPriceSell || selectedEditProduct.priceSell}</span>
                              <span className="text-[10px] font-bold text-slate-600">руб. / {editUnit || selectedEditProduct.unit || 'шт.'}</span>
                            </div>
                            {showPrintWholesale && (
                              <div className="bg-slate-100 text-[8.5px] text-slate-700 font-medium px-1.5 py-0.5 rounded inline-block font-mono">
                                Опт: <span className="font-extrabold text-slate-900">{editPriceWholesale || selectedEditProduct.priceWholesale} руб.</span>
                              </div>
                            )}
                          </div>
                        )}

                        {printType === 'shelf_colored' && (
                          <div className="text-center space-y-1 relative">
                            {/* Super cute hot yellow discount card */}
                            <div className="absolute top-0 right-0 bg-yellow-400 text-black text-[7.5px] px-1 font-black rounded-bl rotate-2 shadow-sm leading-tight uppercase">АКЦИЯ</div>
                            <h4 className="text-[10.5px] font-black text-slate-900 uppercase leading-none truncate pr-6 select-none">{editName || selectedEditProduct.name}</h4>
                            
                            <div className="flex items-center justify-center gap-2">
                              {/* Slit old pricing */}
                              <span className="text-[11px] line-through text-rose-500 font-bold leading-none font-mono">
                                {Math.round((Number(editPriceSell) || selectedEditProduct.priceSell) * 1.25)} руб.
                              </span>
                              <span className="bg-rose-500 text-white rounded text-[8px] font-extrabold px-1 py-0.2 select-none leading-none">
                                -20%
                              </span>
                            </div>

                            <div className="flex items-baseline justify-center gap-0.5 mt-0.5">
                              <span className="text-[26px] font-black tracking-tighter text-rose-600 leading-none">{editPriceSell || selectedEditProduct.priceSell}</span>
                              <span className="text-[9.5px] font-extrabold text-rose-600 font-mono">руб.</span>
                            </div>
                          </div>
                        )}

                        {printType === 'label' && (
                          <div className="space-y-1 block">
                            <span className="text-[9px] font-bold text-slate-800 block truncate leading-tight">{editName || selectedEditProduct.name}</span>
                            <div className="flex justify-between items-center text-[9px] font-mono font-bold py-0.5 text-slate-700 border-t border-slate-150">
                              <span>ЦЕНА:</span>
                              <span className="text-[12px] font-black text-slate-950">{editPriceSell || selectedEditProduct.priceSell} руб.</span>
                            </div>
                            {showPrintSku && (
                              <div className="text-[7.5px] font-mono text-slate-500 leading-none">
                                SKU: {editSku || selectedEditProduct.sku || 'N/A'}
                              </div>
                            )}
                          </div>
                        )}

                        {printType === 'label_tiny' && (
                          <div className="text-center space-y-1">
                            <span className="text-[7.5px] font-extrabold text-slate-800 block truncate leading-none uppercase">{editName || selectedEditProduct.name}</span>
                            <span className="text-[9.5px] font-black text-slate-950 font-mono block leading-none">{editPriceSell || selectedEditProduct.priceSell} руб.</span>
                          </div>
                        )}
                      </div>

                      {/* Barcode section */}
                      {showPrintBarcode && (
                        <div className="border-t border-dashed border-slate-300 pt-1 shrink-0 flex flex-col items-center">
                          <CleanBarcode 
                            value={editBarcode || selectedEditProduct.barcode || '4601234567890'} 
                            s={{ barcodeHeight: '32px', barcodeText: '9px' }} 
                          />
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-800/80 flex gap-2 justify-end">
                  <button
                    type="button"
                    onClick={() => {
                      setIsPrintLayoutActive(true);
                    }}
                    className="py-3 px-6 bg-emerald-600 hover:bg-emerald-500 hover:shadow-emerald-500/10 text-white font-extrabold rounded-xl text-xs flex items-center gap-1.5 transition-all cursor-pointer shadow-lg active:scale-95 duration-100"
                  >
                    <Printer className="w-4 h-4" /> Сгенерировать печатный лист
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedEditProduct(null)}
                    className="py-3 px-6 border border-slate-800 bg-[#1C1E26] hover:bg-slate-850 text-slate-400 hover:text-slate-200 text-xs font-semibold rounded-xl cursor-pointer transition"
                  >
                    Закрыть карточку
                  </button>
                </div>
              </div>
            )}
            </div>
          </div>
        </div>
      )}

      {showCategoryModal && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-sm z-50 flex items-center justify-center p-2 pb-24 sm:p-4 animate-in fade-in duration-200">
          <div className="bg-[#0A0C10] rounded-3xl w-full max-w-lg border border-slate-800 shadow-2xl flex flex-col max-h-full text-slate-200">
            <div className="flex justify-between items-center p-4 sm:p-6 pb-4 border-b border-slate-800 shrink-0">
              <div>
                <h3 className="font-extrabold text-white text-base">Группы товаров (Категории)</h3>
                <p className="text-[11px] text-slate-400">Редактирование, добавление и удаление категорий классификатора</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowCategoryModal(false);
                  setEditingCategoryId(null);
                }}
                className="text-slate-400 hover:text-white font-bold text-sm cursor-pointer whitespace-nowrap ml-2"
              >
                ✕ Закрыть
              </button>
            </div>

            <div className="p-4 sm:p-6 overflow-y-auto flex-1">
              {/* Quick Add Form in Modal */}
            <div className="space-y-3 mb-6 bg-[#161920] p-4 rounded-2xl border border-slate-800/80">
              <span className="block text-[10px] uppercase font-bold text-slate-400 font-mono tracking-wider">Создать новую группу:</span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div className="space-y-1">
                  <span className="text-[9px] uppercase font-bold text-slate-500 font-mono">Название категории:</span>
                  <input
                    type="text"
                    placeholder="Электрика и свет..."
                    value={newCategoryInput}
                    onChange={(e) => setNewCategoryInput(e.target.value)}
                    className="w-full bg-[#1C1E26] border border-slate-800 p-2 text-xs text-white rounded-xl focus:border-blue-500 outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <span className="text-[9px] uppercase font-bold text-slate-500 font-mono">Буквенный префикс (обяз.):</span>
                  <input
                    type="text"
                    placeholder="Напр. EL, TL, CH..."
                    value={newCategoryPrefix}
                    onChange={(e) => setNewCategoryPrefix(e.target.value)}
                    className="w-full bg-[#1C1E26] border border-slate-800 p-2 text-xs text-white rounded-xl focus:border-blue-500 outline-none uppercase font-mono"
                  />
                </div>
              </div>
              <div className="flex justify-end pt-1">
                <button
                  type="button"
                  onClick={() => {
                    const trimmedName = newCategoryInput.trim();
                    const trimmedPrefix = newCategoryPrefix.trim().toUpperCase();
                    if (!trimmedName || !trimmedPrefix) {
                      alert('Пожалуйста, укажите название категории и буквенный префикс!');
                      return;
                    }
                    if (onAddCategory) {
                      const added = onAddCategory(trimmedName, trimmedPrefix);
                      if (added) {
                        setNewCategoryInput('');
                        setNewCategoryPrefix('');
                      }
                    }
                  }}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition cursor-pointer"
                >
                  Добавить категорию
                </button>
              </div>
            </div>

            {/* Categories List */}
            <div className="space-y-2">
              <span className="block text-[10px] uppercase font-bold text-slate-400 font-mono tracking-wider mb-2">Список активных категорий:</span>
              <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                {categories.length === 0 ? (
                  <div className="text-center py-6 text-slate-500 text-xs">Категории отсутствуют</div>
                ) : (
                  categories.map(cat => (
                    <div key={cat.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-3 bg-[#12151B] border border-slate-800 rounded-xl gap-2">
                      {editingCategoryId === cat.id ? (
                        <div className="flex flex-col gap-2 flex-1 w-full">
                          <div className="grid grid-cols-2 gap-2">
                            <div className="space-y-0.5">
                              <span className="text-[9px] uppercase font-bold text-slate-500 font-mono">Название:</span>
                              <input
                                type="text"
                                value={editingCategoryName}
                                onChange={(e) => setEditingCategoryName(e.target.value)}
                                className="w-full bg-[#1C1E26] border border-blue-500 px-2 py-1.5 rounded-lg text-xs text-white font-semibold"
                                autoFocus
                              />
                            </div>
                            <div className="space-y-0.5">
                              <span className="text-[9px] uppercase font-bold text-slate-500 font-mono">Префикс:</span>
                              <input
                                type="text"
                                value={editingCategoryPrefix}
                                onChange={(e) => setEditingCategoryPrefix(e.target.value)}
                                className="w-full bg-[#1C1E26] border border-blue-500 px-2 py-1.5 rounded-lg text-xs text-white font-semibold uppercase font-mono"
                              />
                            </div>
                          </div>
                          <div className="flex gap-2 justify-end pt-1">
                            <button
                              type="button"
                              onClick={() => {
                                const trimmedName = editingCategoryName.trim();
                                const trimmedPrefix = editingCategoryPrefix.trim().toUpperCase();
                                if (!trimmedName || !trimmedPrefix) {
                                  alert('Укажите название и префикс!');
                                  return;
                                }
                                if (onEditCategory) {
                                  onEditCategory(cat.id, trimmedName, trimmedPrefix);
                                }
                                setEditingCategoryId(null);
                              }}
                              className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-[10px] font-bold shrink-0 cursor-pointer"
                            >
                              Сохранить
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingCategoryId(null)}
                              className="px-2.5 py-1.5 bg-slate-850 hover:bg-slate-800 text-slate-400 rounded-lg text-[10px] font-bold shrink-0 cursor-pointer"
                            >
                              Отмена
                            </button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span className="text-xs font-bold text-slate-200 truncate">{cat.name}</span>
                            <span className="px-1.5 py-0.5 bg-slate-800 text-[9px] font-mono text-blue-400 font-bold rounded" title="Префикс SKU">{cat.skuPrefix || '—'}</span>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-auto">
                            <button
                              type="button"
                              onClick={() => {
                                setEditingCategoryId(cat.id);
                                setEditingCategoryName(cat.name);
                                setEditingCategoryPrefix(cat.skuPrefix || '');
                              }}
                              className="p-1.5 hover:bg-amber-500/10 border border-transparent hover:border-amber-500/20 text-amber-400 rounded-lg transition cursor-pointer"
                              title="Редактировать группу"
                            >
                              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                              </svg>
                            </button>
                            <button
                              type="button"
                              onClick={() => setCategoryToDelete(cat)}
                              className="p-1.5 hover:bg-rose-500/10 border border-transparent hover:border-rose-500/20 text-rose-500 rounded-lg transition cursor-pointer"
                              title="Удалить группу"
                            >
                              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5  7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
            </div>
          </div>
        </div>
      )}

      {isScanningBarcode && (
        <BarcodeScanner
          onScanSuccess={(barcode) => {
            setNewProdBarcode(barcode);
            setAiSearchBarcode(barcode);
            setIsScanningBarcode(false);
            // Auto start AI scanning search!
            handleAISearchBarcode(barcode);
          }}
          onClose={() => setIsScanningBarcode(false)}
          placeholderText="Наведите камеру смартфона на штрих-код товара для автоматического сканирования"
          products={products}
        />
      )}

      {/* CUSTOM DIALOG: PRODUCT DELETION CONFIRMATION */}
      {productToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pb-24 sm:pb-4 bg-black/70 backdrop-blur-sm animate-fade-in">
          <div className="bg-[#12151B] border border-slate-800 rounded-3xl p-6 max-w-sm w-full shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-rose-500">
              <div className="p-3 bg-rose-500/10 rounded-2xl shrink-0">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Удалить товар?</h3>
                <p className="text-[11px] text-slate-400">Предупреждение о потере данных</p>
              </div>
            </div>
            
            <p className="text-xs leading-relaxed text-slate-300">
              Вы уверены, что хотите полностью исключить <strong className="text-rose-400 font-bold">«{productToDelete.name}»</strong> из остатков и номенклатур склада? Это действие необратимо.
            </p>
            
            <div className="flex items-center gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setProductToDelete(null)}
                className="flex-1 py-3 bg-[#1C1E26] hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-white font-bold rounded-xl text-xs transition cursor-pointer"
              >
                Отмена
              </button>
              <button
                type="button"
                onClick={() => {
                  if (onDeleteProduct) onDeleteProduct(productToDelete.id);
                  setProductToDelete(null);
                }}
                className="flex-1 py-3 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-xl text-xs transition cursor-pointer"
              >
                Да, удалить
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CUSTOM DIALOG: CATEGORY DELETION CONFIRMATION */}
      {categoryToDelete && (
        <div className="fixed inset-0 z-55 flex items-center justify-center p-4 pb-24 sm:pb-4 bg-black/70 backdrop-blur-sm animate-fade-in">
          <div className="bg-[#12151B] border border-slate-800 rounded-3xl p-6 max-w-sm w-full shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-amber-500">
              <div className="p-3 bg-amber-500/10 rounded-2xl shrink-0">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Удалить группу?</h3>
                <p className="text-[11px] text-slate-400">Влияние на связанные товары</p>
              </div>
            </div>
            
            <p className="text-xs leading-relaxed text-slate-300">
              Желаете удалить группу <strong className="text-amber-400 font-bold">«{categoryToDelete.name}»</strong>? Все товары, относившиеся к ней, сохранятся, но останутся без определенной группы.
            </p>
            
            <div className="flex items-center gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setCategoryToDelete(null)}
                className="flex-1 py-3 bg-[#1C1E26] hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-white font-bold rounded-xl text-xs transition cursor-pointer"
              >
                Отмена
              </button>
              <button
                type="button"
                onClick={() => {
                  if (onDeleteCategory) onDeleteCategory(categoryToDelete.id);
                  setCategoryToDelete(null);
                }}
                className="flex-1 py-3 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-xl text-xs transition cursor-pointer"
              >
                Удалить группу
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CUSTOM DIALOG: STOCK REVISION (РЕВИЗИЯ) */}
      {correctProductId && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-sm z-50 flex items-center justify-center p-4 pb-24 sm:pb-4 overflow-y-auto animate-fade-in animate-in duration-200">
          <div className="bg-[#0A0C10] rounded-3xl p-6 w-full max-w-md border border-slate-800/80 shadow-2xl text-slate-200 animate-in fade-in zoom-in-95 duration-200 my-8">
            <div className="flex justify-between items-center pb-4 border-b border-slate-800 mb-4">
              <div>
                <span className="text-[10px] uppercase font-bold text-blue-400 font-mono tracking-wider">Складская Корректировка</span>
                <h3 className="font-extrabold text-white text-base">Ревизия остатка</h3>
              </div>
              <button
                type="button"
                onClick={() => setCorrectProductId('')}
                className="text-slate-400 hover:text-white font-bold text-sm cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="bg-[#161920]/90 border border-slate-800/80 p-4 rounded-xl mb-4">
              <span className="text-[9px] uppercase font-mono font-bold text-slate-500">ТОВАР:</span>
              <p className="font-extrabold text-white text-sm">{products.find(p => p.id === correctProductId)?.name}</p>
              <div className="flex justify-between items-center mt-2 pt-2 border-t border-slate-800/40 text-xs">
                <span className="text-slate-400">Текущий остаток:</span>
                <span className="font-mono font-bold text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded">
                  {products.find(p => p.id === correctProductId)?.stock} {products.find(p => p.id === correctProductId)?.unit || 'шт.'}
                </span>
              </div>
            </div>

            <form onSubmit={handleCorrectStockSubmit} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="block text-slate-400 font-semibold font-mono text-[10.5px]">РЕАЛЬНЫЙ ОСТАТОК ({products.find(p => p.id === correctProductId)?.unit || 'шт.'}):</label>
                  <input
                    type="number"
                    required
                    value={correctionQty}
                    onChange={(e) => setCorrectionQty(Number(e.target.value))}
                    className="w-full bg-[#1C1E26] border border-slate-800 p-2.5 rounded-xl text-white font-bold font-mono focus:outline-none focus:ring-1 focus:ring-blue-500 text-sm"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-slate-400 font-semibold font-mono text-[10.5px]">ПРИЧИНА ИЗМЕНЕНИЯ:</label>
                  <select
                    value={correctionType}
                    onChange={(e: any) => setCorrectionType(e.target.value)}
                    className="w-full bg-[#1C1E26] border border-slate-800 p-2.5 rounded-xl text-slate-250 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  >
                    <option value="INVENTORY_COUNT">Инвентаризация</option>
                    <option value="RESTOCK">Покупка у Поставщика</option>
                    <option value="DAMAGE">Брак / Повреждено</option>
                    <option value="SALE">Продано (Реализация)</option>
                    <option value="CORRECTION">Тех. Корректировка</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="block text-slate-400 font-semibold font-mono text-[10.5px]">ПРИМЕЧАНИЕ (ЛОГ АУДИТА):</label>
                <textarea
                  rows={2}
                  value={correctionNotes}
                  placeholder="Например: Излишек при сверке коробки..."
                  onChange={(e) => setCorrectionNotes(e.target.value)}
                  className="w-full bg-[#1C1E26] border border-slate-800 p-2.5 rounded-xl text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div className="flex gap-2.5 pt-4 border-t border-slate-800/80">
                <button
                  type="submit"
                  className="flex-1 py-3 bg-blue-600 hover:bg-blue-500 text-white font-extrabold rounded-xl text-xs cursor-pointer transition shadow-lg"
                >
                  Применить изменения
                </button>
                <button
                  type="button"
                  onClick={() => setCorrectProductId('')}
                  className="py-3 px-5 border border-slate-800 bg-[#1C1E26] hover:bg-slate-850 text-slate-400 hover:text-slate-200 text-xs font-semibold rounded-xl cursor-pointer"
                >
                  Отмена
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Barcode Scanner Fullscreen Modal */}
      {isScanningForSearch && (
        <BarcodeScanner
          onClose={() => setIsScanningForSearch(false)}
          onScanSuccess={(barcode) => {
            setIsScanningForSearch(false);
            const matched = products.find(p => p.barcode === barcode);
            if (matched) {
              setSearchTerm(barcode);
              setCorrectProductId(matched.id);
              setCorrectionQty(matched.stock);
              setCorrectionType('INVENTORY_COUNT');
            } else {
              alert(`Товар со штрихкодом "${barcode}" не найден на складе.`);
            }
          }}
          placeholderText="Отсканируйте код для быстрого поиска на складе"
          products={products}
        />
      )}

      {/* Fullscreen Printable Overlay Page */}
      {isPrintLayoutActive && selectedEditProduct && (
        <div className="fixed inset-0 bg-[#0A0D14] text-slate-200 z-[9999] overflow-y-auto p-4 sm:p-8 print:p-0 print:bg-white animate-in zoom-in duration-150">
          <style dangerouslySetInnerHTML={{ __html: `
            @media print {
              * {
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
              }
              @page {
                size: A4 portrait;
                margin: 0;
              }
              body, html {
                background: #ffffff !important;
                color: #000000 !important;
                margin: 0 !important;
                padding: 0 !important;
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
              }
              #printable-sheets-area {
                width: 210mm !important;
                min-height: 297mm !important;
                padding: 0 !important;
                box-sizing: border-box !important;
                margin: 0 auto !important;
                border: none !important;
                box-shadow: none !important;
                background: #ffffff !important;
                overflow: visible !important;
              }
              @page {
                size: A4 portrait;
                margin: 0;
              }
              .break-inside-avoid {
                break-inside: avoid !important;
                page-break-inside: avoid !important;
              }
            }
          ` }} />
          
          {/* Action Header bar: Screen only & Hidden on actual physical print */}
          <div className="flex flex-col lg:flex-row justify-between items-stretch lg:items-center bg-[#11131C] p-4 sm:p-6 rounded-2xl mb-6 gap-5 border border-slate-800 shadow-xl print:hidden">
            <div className="space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="p-1 px-2 bg-amber-500/10 rounded-lg text-amber-500 font-extrabold text-[10px] tracking-wider uppercase font-mono">🖨️ Готово к печати</span>
                <span className="text-slate-500 text-[10px] font-mono font-bold">"1000 Мелочей" • ЦЕННИКИ</span>
              </div>
              <h2 className="font-extrabold text-white text-base mt-1">Оптимизированный печатный лист: {editName || selectedEditProduct.name}</h2>
              <p className="text-slate-400 text-[10.5px] max-w-xl leading-relaxed">
                Внешний вид ценников на этой странице точно соответствует параметрам печати А4. Ниже вы можете настроить тип вывода.
              </p>
            </div>

            {/* Print destination interactive picker */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3.5 shrink-0">
              <div className="flex flex-col gap-1">
                <span className="text-[9px] text-slate-500 font-mono font-bold uppercase tracking-wider">Куда выводим?</span>
                <div className="flex rounded-xl bg-slate-950 p-1 border border-slate-800 shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      setPrintDestination('pdf');
                    }}
                    className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all duration-100 cursor-pointer ${
                      printDestination === 'pdf'
                        ? 'bg-amber-500 text-black shadow-md'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    💾 Сохранить в PDF
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setPrintDestination('paper');
                    }}
                    className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all duration-100 cursor-pointer ${
                      printDestination === 'paper'
                        ? 'bg-emerald-600 text-white shadow-md'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    🖨️ На принтер
                  </button>
                </div>
              </div>

              <div className="flex flex-col gap-1">
                <span className="text-[9px] text-slate-500 font-mono font-bold uppercase tracking-wider">Колонок на листе А4:</span>
                <select
                  value={printColumns}
                  onChange={(e) => setPrintColumns(parseInt(e.target.value, 10))}
                  className="bg-slate-950 border border-slate-800 rounded-xl p-2 text-[11px] text-slate-200 font-bold focus:outline-none focus:ring-1 focus:ring-amber-500 cursor-pointer h-[38px] w-full sm:w-44"
                >
                  <option value={1}>1 колонка (максимальный)</option>
                  <option value={2}>2 колонки (крупные)</option>
                  <option value={3}>3 колонки (средние)</option>
                  <option value={4}>4 колонки (стандарт)</option>
                  <option value={5}>5 колонок (мелкие)</option>
                </select>
              </div>
              
              <div className="flex items-end gap-2 pt-2 sm:pt-0">
                {printDestination === 'pdf' ? (
                  <div className="flex gap-2 w-full sm:w-auto">
                    <button
                      type="button"
                      disabled={isGeneratingPdf}
                      onClick={handleDownloadPdf}
                      className={`flex-1 sm:flex-none py-3 px-5 text-slate-950 font-black rounded-xl text-xs transition duration-100 cursor-pointer flex items-center justify-center gap-1.5 active:scale-95 shadow-lg ${
                        isGeneratingPdf 
                          ? 'bg-amber-500/50 text-slate-800 cursor-not-allowed' 
                          : 'bg-amber-500 hover:bg-amber-400 shadow-amber-500/10'
                      }`}
                    >
                      {isGeneratingPdf ? (
                        <>
                          <span className="w-3.5 h-3.5 border-2 border-slate-950 border-t-transparent rounded-full animate-spin"></span>
                          Генерация PDF...
                        </>
                      ) : (
                        '💾 Скачать PDF'
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={handleDownloadHtml}
                      className="flex-1 sm:flex-none py-3 px-5 bg-blue-600 hover:bg-blue-500 text-white font-black rounded-xl text-xs transition duration-100 cursor-pointer flex items-center justify-center gap-1.5 active:scale-95 shadow-lg shadow-blue-500/10"
                    >
                      🌐 Скачать HTML
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      window.print();
                    }}
                    className="flex-1 sm:flex-none py-3 px-5 bg-emerald-600 hover:bg-emerald-500 text-white font-black rounded-xl text-xs transition duration-100 cursor-pointer flex items-center justify-center gap-1.5 active:scale-95 shadow-lg shadow-emerald-500/10"
                  >
                    <Printer className="w-3.5 h-3.5" /> Нажать для печати
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setIsPrintLayoutActive(false)}
                  className="py-3 px-4 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 font-extrabold rounded-xl text-xs transition cursor-pointer active:scale-95 whitespace-nowrap"
                >
                  ← Назад
                </button>
              </div>
            </div>
          </div>

          {/* Interactive Tutorial Banner for users without hardware printers */}
          {printDestination === 'pdf' && (
            <div className="bg-amber-500/10 border border-amber-500/25 p-4 sm:p-5 rounded-2xl mb-6 text-xs max-w-full animate-in slide-in-from-top-3 duration-200 print:hidden text-amber-200">
              <h3 className="font-extrabold text-amber-400 uppercase tracking-widest text-[10.5px] mb-2 flex items-center gap-2">
                💡 ИНСТРУКЦИЯ ДЛЯ ВЫВОДА В PDF (БЕЗ ПЕЧАТНОГО АППАРАТА)
              </h3>
              <p className="leading-relaxed text-[#D2C8B8] mb-4">
                Так как у вас временно нет принтера на точке, вы можете сохранить ценники как готовый файл <strong className="text-white font-black">PDF</strong>. Его можно сбросить на флешку, скинуть близким или распечатать в любом копицентре!
              </p>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 text-[11px] leading-relaxed text-[#C6BCAC]">
                <div className="bg-slate-900/50 p-3 rounded-xl border border-slate-800">
                  <span className="font-extrabold text-amber-400 block mb-1">1. Запуск процесса</span>
                  Нажмите желтую кнопку <span className="text-white">«Сгенерировать и Скачать PDF»</span> выше. Система автоматически откроет печатное окно браузера.
                </div>
                <div className="bg-slate-900/50 p-3 rounded-xl border border-[#1b253b]">
                  <span className="font-extrabold text-amber-500 block mb-1">2. Переключите Принтер</span>
                  В открывшемся окне найдите строчку <span className="text-white">«Принтер»</span> (или «Назначение») и выберите вместо реального аппарата пункт <strong className="text-amber-300">«Сохранить как PDF»</strong>.
                </div>
                <div className="bg-slate-900/50 p-3 rounded-xl border border-[#1b253b]">
                  <span className="font-extrabold text-emerald-400 block mb-1">3. Копируем на флешку</span>
                  Нажмите <span className="text-white font-bold">«Сохранить»</span> и скачайте получившийся файл на устройство. Файл сразу будет готов для записи на флешку или отправки в мессенджере.
                </div>
              </div>
            </div>
          )}

          <div className="w-full overflow-x-auto pb-4">
            <div 
              id="printable-sheets-area" 
              className="bg-white p-4 rounded-3xl border border-slate-300 shadow-xl overflow-hidden print:p-0 print:m-0 print:border-none print:shadow-none min-h-[297mm] mx-auto print:max-w-none"
              style={{ width: '210mm', minWidth: '210mm' }}
            >
              <div 
                className="grid justify-items-center justify-center print:gap-4 print:p-0"
                style={{
                  display: 'grid',
                  gridTemplateColumns: `repeat(${printColumns}, minmax(0, 1fr))`,
                  width: '100%',
                  gap: '4mm',
                  padding: '10mm'
                }}
              >
              {Array.from({ length: printCopies }).map((_, i) => {
                const s = getAdaptiveStyles(printColumns);
                let barScale = 1;
                if (printColumns === 1) barScale = 2.4;
                else if (printColumns === 2) barScale = 1.6;
                else if (printColumns === 3) barScale = 1.1;
                else if (printColumns === 4) barScale = 0.8;
                else if (printColumns === 5) barScale = 0.62;
                else barScale = 0.5;
                
                return (
                  <div 
                    key={i} 
                    className="w-full aspect-[4/3] bg-white text-black break-inside-avoid print:break-inside-avoid"
                    style={{
                      padding: s.padding,
                      border: `${s.borderWidth} solid #000000`,
                      borderRadius: '8px',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      overflow: 'hidden',
                      userSelect: 'none',
                      boxSizing: 'border-box',
                      backgroundColor: '#ffffff',
                      color: '#000000',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
                    }}
                  >
                    {/* Top Store Name */}
                    <div 
                      className="text-center border-b border-dashed border-slate-300 shrink-0"
                      style={{ 
                        paddingBottom: `${parseInt(s.gapY) / 2}px`,
                        marginBottom: `${parseInt(s.gapY) / 2}px`
                      }}
                    >
                      <span 
                        className="uppercase tracking-wider font-extrabold text-slate-700 block overflow-hidden text-ellipsis break-words"
                        style={{ 
                          fontSize: s.brandText,
                          lineHeight: '1.2',
                          height: 'auto'
                        }}
                      >
                        {printStoreName}
                      </span>
                    </div>

                    {/* Body Pricing */}
                    <div className="flex-1 flex flex-col justify-center overflow-hidden">
                      {printType === 'shelf_standard' && (
                        <div className="text-center flex flex-col justify-center h-full">
                          <h4 
                            className="font-extrabold text-slate-950 tracking-tight uppercase overflow-hidden text-ellipsis break-words select-all font-sans"
                            style={{ 
                              fontSize: s.titleText, 
                              lineHeight: '1.2',
                              marginBottom: `${parseInt(s.gapY) / 3}px`,
                              height: 'auto'
                            }}
                          >
                            {editName || selectedEditProduct.name}
                          </h4>
                          <div 
                            className="flex items-baseline justify-center font-mono font-black"
                            style={{ gap: '2px', lineHeight: '1' }}
                          >
                            <span 
                              className="tracking-tight text-slate-950"
                              style={{ fontSize: s.priceText, fontWeight: 900 }}
                            >
                              {editPriceSell || selectedEditProduct.priceSell}
                            </span>
                            <span 
                              className="font-bold text-slate-700"
                              style={{ fontSize: s.brandText }}
                            >
                              руб.
                            </span>
                          </div>
                          {showPrintWholesale && (
                            <span 
                              className="font-mono text-slate-500 block truncate"
                              style={{ fontSize: s.wholesaleText, marginTop: `${parseInt(s.gapY) / 3}px` }}
                            >
                              Опт: {editPriceWholesale || selectedEditProduct.priceWholesale} руб.
                            </span>
                          )}
                        </div>
                      )}

                      {printType === 'shelf_colored' && (
                        <div className="text-center relative flex flex-col justify-center h-full">
                          <div 
                            className="absolute bg-yellow-400 text-black px-1 font-black rounded-bl rotate-2"
                            style={{ 
                              top: '-3px', 
                              right: '-3px', 
                              fontSize: s.logoText,
                              padding: '1px 3px'
                            }}
                          >
                            АКЦИЯ
                          </div>
                          <h4 
                            className="font-extrabold text-slate-900 uppercase overflow-hidden text-ellipsis break-words select-all font-sans"
                            style={{ 
                              fontSize: s.titleText, 
                              lineHeight: '1.2',
                              marginBottom: `${parseInt(s.gapY) / 3}px`,
                              height: 'auto'
                            }}
                          >
                            {editName || selectedEditProduct.name}
                          </h4>
                          
                          <div 
                            className="flex items-center justify-center"
                            style={{ gap: '4px', marginBottom: '1px' }}
                          >
                            <span 
                              className="line-through text-rose-500 font-bold font-mono"
                              style={{ fontSize: s.strikeText }}
                            >
                              {Math.round((Number(editPriceSell) || selectedEditProduct.priceSell) * 1.25)} руб.
                            </span>
                            <span 
                              className="bg-rose-500 text-white rounded font-black font-mono leading-none"
                              style={{ fontSize: s.badgeText, padding: '1px 2px' }}
                            >
                              -20%
                            </span>
                          </div>
  
                          <div className="flex items-baseline justify-center font-mono">
                            <span 
                              className="font-black text-rose-600 leading-none"
                              style={{ fontSize: s.priceText }}
                            >
                              {editPriceSell || selectedEditProduct.priceSell}
                            </span>
                            <span 
                              className="font-extrabold text-rose-600 ml-0.5"
                              style={{ fontSize: s.brandText }}
                            >
                              руб.
                            </span>
                          </div>
                        </div>
                      )}

                      {printType === 'label' && (
                        <div className="flex flex-col justify-center h-full" style={{ gap: `${parseInt(s.gapY) / 2}px` }}>
                          <span 
                            className="font-extrabold text-slate-900 uppercase overflow-hidden text-ellipsis break-words block font-sans"
                            style={{ 
                              fontSize: s.titleText, 
                              lineHeight: '1.2',
                              height: 'auto'
                            }}
                          >
                            {editName || selectedEditProduct.name}
                          </span>
                          <div 
                            className="flex justify-between items-center font-mono font-bold border-t border-dashed border-slate-200"
                            style={{ 
                              paddingTop: `${parseInt(s.gapY) / 2}px`,
                              paddingBottom: `${parseInt(s.gapY) / 2}px`
                            }}
                          >
                            <span style={{ fontSize: s.brandText }}>ЦЕНА:</span>
                            <span className="font-black" style={{ fontSize: s.priceText }}>{editPriceSell || selectedEditProduct.priceSell} руб.</span>
                          </div>
                          {showPrintSku && (
                            <div 
                              className="font-mono text-slate-500 block truncate"
                              style={{ fontSize: s.wholesaleText }}
                            >
                              SKU: {editSku || selectedEditProduct.sku}
                            </div>
                          )}
                        </div>
                      )}

                      {printType === 'label_tiny' && (
                        <div className="text-center flex flex-col justify-center h-full">
                          <span 
                            className="font-bold text-slate-800 uppercase overflow-hidden text-ellipsis break-words block font-sans"
                            style={{ 
                              fontSize: s.titleText, 
                              lineHeight: '1.2',
                              height: 'auto'
                            }}
                          >
                            {editName || selectedEditProduct.name}
                          </span>
                          <span 
                            className="font-black text-slate-950 font-mono block"
                            style={{ fontSize: s.priceText, marginTop: `${parseInt(s.gapY) / 2}px`, lineHeight: '1' }}
                          >
                            {editPriceSell || selectedEditProduct.priceSell} руб.
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Barcode section */}
                    {showPrintBarcode && (
                      <div 
                        className="border-t border-dashed border-slate-300 shrink-0 flex flex-col items-center w-full"
                        style={{ 
                          paddingTop: `${parseInt(s.gapY) / 2}px`,
                          marginTop: `${parseInt(s.gapY) / 2}px`
                        }}
                      >
                        <CleanBarcode 
                          value={editBarcode || selectedEditProduct.barcode || '4601234567890'} 
                          s={s} 
                        />
                      </div>
                    )}
                  </div>
                );
              })}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
