/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef } from 'react';
import { SaleTransaction, Product, BusinessExpense, Employee } from '../types';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, PieChart, Pie, Cell, Legend } from 'recharts';
import { TrendingUp, Award, Slash, Landmark, Download, ChevronDown, ChevronUp, Receipt, Sparkles } from 'lucide-react';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { api } from '../utils/api';

// Helper to convert oklch and oklab colors to standard rgb/rgba so html2canvas doesn't fail on "unsupported color function"
function replaceOklchInString(str: string): string {
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
}

interface AnalyticsProps {
  sales: SaleTransaction[];
  products: Product[];
  expenses: BusinessExpense[];
  employees: Employee[];
  onAddExpense: (
    category: BusinessExpense['category'],
    amount: number,
    notes?: string
  ) => void;
}

export default function Analytics({ sales, products, expenses, employees, onAddExpense }: AnalyticsProps) {
  const [dateRange, setDateRange] = useState<'DAY' | 'MONTH' | 'YEAR' | 'CUSTOM'>('MONTH');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [showAllTop, setShowAllTop] = useState(false);
  const [showAllUnsold, setShowAllUnsold] = useState(false);
  const [isGeneratingForecast, setIsGeneratingForecast] = useState(false);
  const [aiForecast, setAiForecast] = useState<{ forecast: string; recommendedItems: any[] } | null>(null);

  const handleGenerateForecast = async () => {
    setIsGeneratingForecast(true);
    setAiForecast(null);
    try {
      const owners = employees.filter(e => e.role === 'OWNER' && e.telegramChatId);
      const ownerChatId = owners[0]?.telegramChatId; 

      const data = await api.ai.forecast(filteredSales, products, ownerChatId);
      if (data.success) {
        setAiForecast(data);
        // Also notify via alert for confirmation
        alert("AI Прогноз сформирован и отправлен владельцу в Telegram!");
      } else {
        alert("Ошибка AI: " + (data.error || "Неизвестная ошибка"));
      }
    } catch (e: any) {
      console.error(e);
      alert("Ошибка AI: " + (e.message || "Ошибка при связи с сервером"));
    } finally {
      setIsGeneratingForecast(false);
    }
  };
  
  const reportRef = useRef<HTMLDivElement>(null);

  // Filter sales based on period
  const getFilteredSales = () => {
    const now = new Date();
    return sales.filter(s => {
      const saleDate = new Date(s.timestamp);
      if (dateRange === 'DAY') {
        return saleDate.toDateString() === now.toDateString();
      } else if (dateRange === 'MONTH') {
        return saleDate.getMonth() === now.getMonth() && saleDate.getFullYear() === now.getFullYear();
      } else if (dateRange === 'YEAR') {
        return saleDate.getFullYear() === now.getFullYear();
      } else if (dateRange === 'CUSTOM') {
        if (!startDate && !endDate) return true;
        const start = startDate ? new Date(startDate) : null;
        if (start) start.setHours(0, 0, 0, 0);

        const end = endDate ? new Date(endDate) : null;
        if (end) end.setHours(23, 59, 59, 999);

        if (start && saleDate < start) return false;
        if (end && saleDate > end) return false;
        return true;
      }
      return true;
    });
  };

  const filteredSales = getFilteredSales();

  // Filter expenses based on selected period
  const getFilteredExpenses = () => {
    const now = new Date();
    return expenses.filter(exp => {
      // Use chosen date, fallback to timestamp
      const expDate = exp.date ? new Date(exp.date) : new Date(exp.timestamp);
      if (dateRange === 'DAY') {
        return expDate.toDateString() === now.toDateString();
      } else if (dateRange === 'MONTH') {
        return expDate.getMonth() === now.getMonth() && expDate.getFullYear() === now.getFullYear();
      } else if (dateRange === 'YEAR') {
        return expDate.getFullYear() === now.getFullYear();
      } else if (dateRange === 'CUSTOM') {
        if (!startDate && !endDate) return true;
        const start = startDate ? new Date(startDate) : null;
        if (start) start.setHours(0, 0, 0, 0);

        const end = endDate ? new Date(endDate) : null;
        if (end) end.setHours(23, 59, 59, 999);

        if (start && expDate < start) return false;
        if (end && expDate > end) return false;
        return true;
      }
      return true;
    });
  };

  const filteredExpenses = getFilteredExpenses();
  const totalExpensesAmount = Math.round(filteredExpenses.reduce((sum, e) => sum + e.amount, 0));

  // Category mapping colors
  const EXPENSE_COLORS: Record<string, string> = {
    'Зарплата': '#6366f1',          // Indigo 500
    'Аренда': '#f59e0b',            // Amber 500
    'Закупка товара': '#3b82f6',    // Blue 500
    'Маркетинг': '#a855f7',         // Purple 500
    'Коммунальные услуги': '#06b6d4',// Cyan 500
    'Питание': '#f97316',           // Orange 500
    'Прочее': '#64748b'             // Slate 500
  };

  // Group expenses by category for Pie Chart
  const expenseSummary = Object.entries(
    filteredExpenses.reduce((acc, exp) => {
      acc[exp.category] = (acc[exp.category] || 0) + exp.amount;
      return acc;
    }, {} as Record<string, number>)
  ).map(([name, value]) => ({
    name,
    value,
    percentage: totalExpensesAmount > 0 ? Math.round((value / totalExpensesAmount) * 100) : 0,
    color: EXPENSE_COLORS[name] || '#64748b'
  })).sort((a, b) => b.value - a.value);

  // Metrics
  const totalRevenue = Math.round(filteredSales.reduce((sum, s) => sum + s.finalPrice, 0));
  const totalCostOfSalesBuy = Math.round(filteredSales.reduce((sum, s) => sum + s.totalPriceBuy, 0));
  const totalProfit = Math.max(0, totalRevenue - totalCostOfSalesBuy);
  const averageTicket = filteredSales.length > 0 ? Math.round(totalRevenue / filteredSales.length) : 0;
  
  // Sales item frequency
  const productFrequency: { [name: string]: { qty: number; revenue: number } } = {};
  filteredSales.forEach(sale => {
    sale.items.forEach(item => {
      if (!productFrequency[item.productName]) {
        productFrequency[item.productName] = { qty: 0, revenue: 0 };
      }
      productFrequency[item.productName].qty += item.quantity;
      productFrequency[item.productName].revenue += (item.priceSell * item.quantity);
    });
  });

  const allTopProducts = Object.entries(productFrequency)
    .map(([name, stats]) => ({
      name,
      'Продано (шт)': stats.qty,
      'Выручка (руб)': stats.revenue
    }))
    .sort((a, b) => b['Продано (шт)'] - a['Продано (шт)']);

  const topProductsDisplay = showAllTop ? allTopProducts : allTopProducts.slice(0, 5);

  // Unsold products (in inventory but not in sales for current filtered period)
  const allUnsoldProducts = products.filter(p => !productFrequency[p.name]);
  const unsoldProductsDisplay = showAllUnsold ? allUnsoldProducts : allUnsoldProducts.slice(0, 5);

  // Cashier Stats
  const cashierAggregate: { [name: string]: { total: number; count: number; role?: string } } = {};
  employees.forEach(emp => {
    cashierAggregate[emp.name] = { total: 0, count: 0, role: emp.role };
  });

  filteredSales.forEach(s => {
    if (!cashierAggregate[s.cashierName]) {
      cashierAggregate[s.cashierName] = { total: 0, count: 0 };
    }
    cashierAggregate[s.cashierName].total += s.finalPrice;
    cashierAggregate[s.cashierName].count += 1;
  });

  const handleExportPDF = async () => {
    if (!reportRef.current) return;
    
    // Simple visual notification
    const btn = document.getElementById('pdf-export-btn');
    if (btn) btn.innerText = 'Генерация...';

    // 1. Save original prototypes/functions safely to restore them afterwards
    const originalGetComputedStyle = window.getComputedStyle;
    const originalStyleSheetRules = Object.getOwnPropertyDescriptor(CSSStyleSheet.prototype, 'cssRules');
    let originalGroupingRules: any = null;
    if (typeof CSSGroupingRule !== 'undefined') {
      originalGroupingRules = Object.getOwnPropertyDescriptor(CSSGroupingRule.prototype, 'cssRules');
    }

    // 2. Helpers for recursive rule proxying
    const wrapCSSRules = (rules: any): any => {
      if (!rules) return rules;
      try {
        return new Proxy(rules, {
          get(target, prop) {
            if (prop === 'length') return target.length;
            if (prop === 'item') {
              return (idx: number) => target[idx];
            }
            const index = Number(prop as string);
            if (!isNaN(index)) {
              const rule = target[index];
              if (!rule) return rule;
              
              return new Proxy(rule, {
                get(ruleTarget, ruleProp) {
                  if (ruleProp === 'cssText') {
                    try {
                      return replaceOklchInString(ruleTarget.cssText);
                    } catch {
                      return ruleTarget.cssText;
                    }
                  }
                  if (ruleProp === 'cssRules' && (ruleTarget as any).cssRules) {
                    return wrapCSSRules((ruleTarget as any).cssRules);
                  }
                  const val = (ruleTarget as any)[ruleProp];
                  return typeof val === 'function' ? val.bind(ruleTarget) : val;
                }
              });
            }
            const val = (target as any)[prop];
            return typeof val === 'function' ? val.bind(target) : val;
          }
        });
      } catch {
        return rules;
      }
    };

    // 3. Apply active intercepts/overrides
    try {
      window.getComputedStyle = function (el, pseudo) {
        const style = originalGetComputedStyle.call(this, el, pseudo);
        return new Proxy(style, {
          get(target, prop) {
            const val = (target as any)[prop];
            if (typeof val === 'string' && (val.includes('oklch') || val.includes('oklab'))) {
              return replaceOklchInString(val);
            }
            if (typeof val === 'function') {
              return val.bind(target);
            }
            return val;
          }
        });
      };

      if (originalStyleSheetRules) {
        Object.defineProperty(CSSStyleSheet.prototype, 'cssRules', {
          configurable: true,
          enumerable: true,
          get() {
            try {
              const rules = originalStyleSheetRules.get ? originalStyleSheetRules.get.call(this) : null;
              return wrapCSSRules(rules);
            } catch {
              return null; // Suppress cross-origin stylesheet security errors in iframe context
            }
          }
        });
      }

      if (typeof CSSGroupingRule !== 'undefined' && originalGroupingRules) {
        Object.defineProperty(CSSGroupingRule.prototype, 'cssRules', {
          configurable: true,
          enumerable: true,
          get() {
            try {
              const rules = originalGroupingRules.get ? originalGroupingRules.get.call(this) : null;
              return wrapCSSRules(rules);
            } catch {
              return null;
            }
          }
        });
      }

      // 4. Trigger Canvas rendering
      const canvas = await html2canvas(reportRef.current, {
        scale: 2,
        useCORS: true,
        allowTaint: false,
        backgroundColor: '#0F1115',
        logging: false,
        onclone: (clonedDoc) => {
          // Replace oklch/oklab colors in cloned element styles directly
          const styles = clonedDoc.querySelectorAll('style');
          styles.forEach((styleTag) => {
            if (styleTag.textContent) {
              styleTag.textContent = replaceOklchInString(styleTag.textContent);
            }
          });

          const allElements = clonedDoc.querySelectorAll('*');
          allElements.forEach((el) => {
            const htmlEl = el as any;
            if (htmlEl && htmlEl.style && htmlEl.style.cssText) {
              htmlEl.style.cssText = replaceOklchInString(htmlEl.style.cssText);
            }
            // Check SVG fill and stroke attributes
            const fill = el.getAttribute('fill');
            if (fill && (fill.includes('oklch') || fill.includes('oklab'))) {
              el.setAttribute('fill', replaceOklchInString(fill));
            }
            const stroke = el.getAttribute('stroke');
            if (stroke && (stroke.includes('oklch') || stroke.includes('oklab'))) {
              el.setAttribute('stroke', replaceOklchInString(stroke));
            }
          });
        }
      });

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      
      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      pdf.save('Analytics_Report.pdf');
    } catch (e) {
      console.error('PDF export failed', e);
      alert('Ошибка при генерации PDF. Пожалуйста, попробуйте еще раз.');
    } finally {
      // 5. Always restore the overridden prototypes / globals safely
      window.getComputedStyle = originalGetComputedStyle;
      if (originalStyleSheetRules) {
        Object.defineProperty(CSSStyleSheet.prototype, 'cssRules', originalStyleSheetRules);
      }
      if (typeof CSSGroupingRule !== 'undefined' && originalGroupingRules) {
        Object.defineProperty(CSSGroupingRule.prototype, 'cssRules', originalGroupingRules);
      }
    }
    
    if (btn) btn.innerHTML = '<svg class="w-3.5 h-3.5 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg> Экспорт PDF';
  };

  // Time Series Chart Mocking
  const chartTimelineData = [
    { date: '16.05', 'Выручка': 8400, 'Прибыль': 3100 },
    { date: '17.05', 'Выручка': 11200, 'Прибыль': 4200 },
    { date: '18.05', 'Выручка': 9600, 'Прибыль': 3800 },
    { date: '19.05', 'Выручка': 14800, 'Прибыль': 5900 },
    { date: '20.05', 'Выручка': 12100, 'Прибыль': 4800 },
    { date: '21.05', 'Выручка': 18500, 'Прибыль': 7400 },
    { date: 'Текущ.', 'Выручка': totalRevenue, 'Прибыль': totalProfit }
  ];

  return (
    <div className="space-y-6">
      {/* 1. Header / Controls */}
      <div className="flex flex-col gap-4 bg-[#161920] p-4 rounded-2xl border border-slate-800/80 shadow-2xl">
        <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4">
          <div>
            <span className="text-[10px] uppercase font-bold text-slate-500 font-mono">Детальная статистика продаж</span>
            <h2 className="text-base font-extrabold text-white flex items-center gap-1.5 mt-0.5">
              <TrendingUp className="text-blue-400 w-4 h-4" /> Аналитика
            </h2>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center gap-3 w-full xl:w-auto">
            <div className="flex bg-[#1C1E26] p-1 rounded-xl items-center border border-slate-800 text-xs w-full sm:w-auto justify-between sm:justify-start">
              <button
                type="button"
                onClick={() => setDateRange('DAY')}
                className={`flex-1 sm:flex-initial px-3 py-1 rounded-lg transition font-medium cursor-pointer ${
                  dateRange === 'DAY' 
                    ? 'bg-[#161920] border border-slate-800 font-extrabold text-white shadow-xl' 
                    : 'text-slate-500 hover:text-slate-350'
                }`}
              >
                День
              </button>
              <button
                type="button"
                onClick={() => setDateRange('MONTH')}
                className={`flex-1 sm:flex-initial px-3 py-1 rounded-lg transition font-medium cursor-pointer ${
                  dateRange === 'MONTH' 
                    ? 'bg-[#161920] border border-slate-800 font-extrabold text-white shadow-xl' 
                    : 'text-slate-500 hover:text-slate-350'
                }`}
              >
                Месяц
              </button>
              <button
                type="button"
                onClick={() => setDateRange('YEAR')}
                className={`flex-1 sm:flex-initial px-3 py-1 rounded-lg transition font-medium cursor-pointer ${
                  dateRange === 'YEAR' 
                    ? 'bg-[#161920] border border-slate-800 font-extrabold text-white shadow-xl' 
                    : 'text-slate-500 hover:text-slate-350'
                }`}
              >
                Год
              </button>
              <button
                type="button"
                onClick={() => setDateRange('CUSTOM')}
                className={`flex-1 sm:flex-initial px-3 py-1 rounded-lg transition font-medium cursor-pointer ${
                  dateRange === 'CUSTOM' 
                    ? 'bg-[#161920] border border-slate-800 font-extrabold text-white shadow-xl' 
                    : 'text-slate-500 hover:text-slate-350'
                }`}
              >
                Период
              </button>
            </div>

            <button
              id="pdf-export-btn"
              onClick={handleExportPDF}
              className="px-3 py-1.5 border border-slate-800 bg-[#1C1E26] hover:bg-slate-800 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 text-slate-300 transition cursor-pointer w-full sm:w-auto"
            >
              <Download className="w-3.5 h-3.5 text-slate-400" />
              Экспорт PDF
            </button>
          </div>
        </div>

        {/* Custom date boundaries inputs - animates when CUSTOM is chosen */}
        {dateRange === 'CUSTOM' && (
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 bg-[#1C1E26]/80 p-3 rounded-xl border border-slate-800/60 animate-in slide-in-from-top-1 px-4 duration-200">
            <div className="flex items-center gap-2 flex-1">
              <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wider font-mono">С:</span>
              <input 
                type="date" 
                value={startDate} 
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full bg-[#161920] border border-slate-800 text-slate-200 p-2 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono text-xs"
              />
            </div>
            <div className="flex items-center gap-2 flex-1">
              <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wider font-mono">По:</span>
              <input 
                type="date" 
                value={endDate} 
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full bg-[#161920] border border-slate-800 text-slate-200 p-2 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono text-xs"
              />
            </div>
            {(startDate || endDate) && (
              <button
                type="button"
                onClick={() => {
                  setStartDate('');
                  setEndDate('');
                }}
                className="py-2 px-3 bg-slate-800/80 hover:bg-slate-800 border border-slate-850 rounded-lg text-[10px] text-slate-400 uppercase font-bold tracking-wider cursor-pointer active:scale-95 duration-100"
              >
                Очистить
              </button>
            )}
          </div>
        )}
      </div>

      <div ref={reportRef} className="space-y-6">
        {/* AI Strategy Banner */}
        <div className="bg-gradient-to-br from-indigo-900/40 to-slate-900 p-6 rounded-3xl border border-indigo-500/30 shadow-2xl flex flex-col gap-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="bg-indigo-500/20 p-3 rounded-2xl border border-indigo-500/30">
                <Sparkles className="w-8 h-8 text-indigo-400" />
              </div>
              <div>
                <h2 className="text-xl font-black text-white tracking-tight">AI Инвентарная Стратегия</h2>
                <p className="text-indigo-300/60 text-[10px] font-mono mt-1 uppercase tracking-widest">Velocity & Seasonality Analysis</p>
              </div>
            </div>
            <button 
              onClick={handleGenerateForecast}
              disabled={isGeneratingForecast}
              className="bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-700 text-white px-6 py-3 rounded-2xl font-black text-xs transition-all active:scale-95 shadow-lg shadow-indigo-900/20 flex items-center gap-2 cursor-pointer"
            >
              {isGeneratingForecast ? 'Анализ данных...' : 'Сформировать закупку (AI)'}
              {!isGeneratingForecast && <TrendingUp className="w-3.5 h-3.5" />}
            </button>
          </div>

          {/* AI Output Display */}
          {aiForecast && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-in fade-in slide-in-from-top-4 duration-500">
              <div className="bg-[#1C1E26]/50 border border-indigo-500/20 p-5 rounded-2xl">
                <h3 className="text-[10px] uppercase font-bold text-indigo-400 font-mono tracking-widest mb-3">Рекомендация</h3>
                <p className="text-sm text-slate-200 leading-relaxed font-medium">
                  {aiForecast.forecast}
                </p>
              </div>
              <div className="bg-[#1C1E26]/50 border border-indigo-500/20 p-5 rounded-2xl">
                <h3 className="text-[10px] uppercase font-bold text-indigo-400 font-mono tracking-widest mb-3">План закупок</h3>
                <div className="space-y-2">
                  {aiForecast.recommendedItems.map((item: any, idx: number) => (
                    <div key={idx} className="flex items-center justify-between text-xs bg-slate-900/50 p-2 rounded-lg border border-slate-800/50">
                      <span className="font-bold text-slate-300">{item.name}</span>
                      <div className="flex items-center gap-3">
                        <span className="text-indigo-400 font-black">{item.suggestedQty} шт</span>
                        <span className="text-[10px] text-slate-500 uppercase font-bold">{item.provider}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* 2. Top Metric Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-[#161920] border p-4 rounded-2xl border-slate-800/80 shadow-2xl">
            <span className="text-[10px] uppercase font-bold text-slate-500 font-mono">Выручка ({dateRange})</span>
            <p className="text-2xl font-black text-blue-400 mt-1 font-mono">{totalRevenue.toLocaleString()} руб.</p>
          </div>
          <div className="bg-[#161920] border p-4 rounded-2xl border-slate-800/80 shadow-2xl">
            <span className="text-[10px] uppercase font-bold text-slate-500 font-mono">Прибыль ({dateRange})</span>
            <p className="text-2xl font-black text-emerald-400 mt-1 font-mono">{totalProfit.toLocaleString()} руб.</p>
          </div>
          <div className="bg-[#161920] border p-4 rounded-2xl border-slate-800/80 shadow-2xl">
            <span className="text-[10px] uppercase font-bold text-slate-500 font-mono">Средний чек</span>
            <p className="text-2xl font-black text-slate-200 mt-1 font-mono">{averageTicket.toLocaleString()} руб.</p>
          </div>
          <div className="bg-[#161920] border p-4 rounded-2xl border-slate-800/80 shadow-2xl">
            <span className="text-[10px] uppercase font-bold text-slate-500 font-mono">ROI</span>
            <p className="text-2xl font-black text-purple-400 mt-1 font-mono">
              {totalCostOfSalesBuy > 0 ? Math.round((totalProfit / totalCostOfSalesBuy) * 100) : 0}%
            </p>
          </div>
        </div>

        {/* 3. Recharts Visualizations */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Timeline card */}
          <div className="lg:col-span-2 bg-[#161920] p-5 rounded-2xl border border-slate-800/80 shadow-2xl space-y-3">
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1 font-mono">
              <Landmark className="w-3.5 h-3.5 text-blue-450 text-blue-450" /> Динамика показателей
            </h3>
            <div className="h-64 w-full text-xs">
              <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                <AreaChart data={chartTimelineData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.25}/>
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#1C1E26" />
                  <XAxis dataKey="date" stroke="#475569" fontSize={10} tickLine={false} />
                  <YAxis stroke="#475569" fontSize={10} tickLine={false} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#0F1115', borderColor: '#334155', color: '#fff', borderRadius: '8px' }}
                    formatter={(v) => [`${v} руб.`]} 
                  />
                  <Area type="monotone" dataKey="Выручка" stroke="#3b82f6" strokeWidth={2.5} fillOpacity={1} fill="url(#colorRev)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Expenses Pie Chart */}
          <div className="lg:col-span-1 bg-[#161920] p-5 rounded-2xl border border-slate-800/80 shadow-2xl flex flex-col justify-between">
            <div className="space-y-3.5">
              <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5 font-mono">
                <Receipt className="w-3.5 h-3.5 text-rose-400" /> Структура расходов
              </h3>
              
              {expenseSummary.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center h-52">
                  <div className="w-10 h-10 bg-[#1C1E26] text-slate-500 rounded-xl flex items-center justify-center border border-slate-800 mb-2">
                    <Receipt className="w-5 h-5" />
                  </div>
                  <p className="text-[11px] font-bold text-slate-400">Нет данных по расходам за этот период</p>
                  <p className="text-[10px] text-slate-500 mt-0.5 max-w-[200px]">Добавьте новые операции в модуле «Учет расходов».</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Pie chart itself */}
                  <div className="h-44 w-full flex items-center justify-center text-xs relative">
                    <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                      <PieChart>
                        <Pie
                          data={expenseSummary}
                          cx="50%"
                          cy="50%"
                          innerRadius={45}
                          outerRadius={65}
                          paddingAngle={3}
                          dataKey="value"
                        >
                          {expenseSummary.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip
                          contentStyle={{ backgroundColor: '#0F1115', borderColor: '#334155', color: '#fff', borderRadius: '8px', fontSize: '11px' }}
                          formatter={(value, name, props) => {
                            const payload = props.payload as any;
                            return [`${value.toLocaleString()} руб. (${payload.percentage}%)`, name];
                          }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                    {/* Centered Total inside Donut */}
                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                      <span className="text-[9px] uppercase font-bold text-slate-500 font-mono tracking-wider">Всего</span>
                      <span className="text-xs font-black text-rose-450 text-rose-400 font-mono">-{totalExpensesAmount.toLocaleString()} ₽</span>
                    </div>
                  </div>

                  {/* Custom List Legend with percentages and absolute values */}
                  <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                    {expenseSummary.map((entry, index) => (
                      <div key={index} className="flex items-center justify-between text-[11px] border-b border-slate-800/10 pb-1.5 last:border-none last:pb-0">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: entry.color }} />
                          <span className="font-semibold text-slate-300 truncate" title={entry.name}>{entry.name}</span>
                        </div>
                        <div className="text-right font-mono text-slate-400 whitespace-nowrap">
                          <span className="font-bold text-slate-200">{entry.percentage}%</span>
                          <span className="text-[10px] text-slate-500 ml-1.5">({entry.value.toLocaleString()} ₽)</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-[#161920] p-5 rounded-2xl border border-slate-800/80 shadow-2xl space-y-4">
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5 font-mono">
              <Award className="w-4 h-4 text-emerald-400" /> Топ продукты
            </h3>
            <div className="space-y-3">
              {topProductsDisplay.length === 0 ? (
                <p className="text-slate-500 italic text-[11px] py-4 text-center">Нет данных за этот период.</p>
              ) : (
                topProductsDisplay.map((item, index) => (
                  <div key={index} className="flex flex-col sm:flex-row justify-between sm:items-center text-xs text-slate-300 border-b border-slate-800/40 pb-2.5 gap-2 last:border-none">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="w-5 h-5 rounded bg-blue-500/15 text-blue-450 text-blue-400 text-[10px] font-black flex items-center justify-center shrink-0">
                        {index + 1}
                      </span>
                      <span className="font-extrabold text-slate-200 block break-words leading-tight max-w-sm" style={{ wordBreak: 'break-word' }}>
                        {item.name}
                      </span>
                    </div>
                    <div className="flex items-center justify-between sm:justify-end gap-3 font-mono text-[11px] shrink-0 bg-[#1C1E26]/50 sm:bg-transparent p-2 sm:p-0 rounded-lg sm:rounded-none w-full sm:w-auto">
                      <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500 sm:hidden block pl-1">Конверсия:</span>
                      <div className="flex items-center gap-1.5 font-mono">
                        <span className="bg-blue-500/10 text-blue-400 text-[10px] px-2 py-0.5 rounded border border-blue-500/15 font-black uppercase tracking-wide">
                          {item['Продано (шт)']} шт
                        </span>
                        <span className="text-emerald-400 font-extrabold pr-1">
                          {item['Выручка (руб)'].toLocaleString()} руб.
                        </span>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
            {allTopProducts.length > 5 && (
              <button 
                onClick={() => setShowAllTop(!showAllTop)}
                className="w-full h-11 flex items-center justify-center gap-1 mt-2 text-xs font-bold text-slate-400 hover:text-white border border-slate-800/60 rounded-xl hover:bg-slate-800/30 transition-all cursor-pointer"
              >
                {showAllTop ? <><ChevronUp className="w-3.5 h-3.5" /> Скрыть</> : <><ChevronDown className="w-3.5 h-3.5" /> Показать все ({allTopProducts.length})</>}
              </button>
            )}
          </div>

          <div className="bg-[#161920] p-5 rounded-2xl border border-slate-800/80 shadow-2xl space-y-4">
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5 font-mono">
              <Slash className="w-4 h-4 text-rose-400" /> Нереализованные товары
            </h3>
            <div className="space-y-3">
              {unsoldProductsDisplay.length === 0 ? (
                <p className="text-slate-500 italic text-[11px] py-4 text-center font-mono">Все товары были проданы хотя бы 1 раз.</p>
              ) : (
                unsoldProductsDisplay.map((p, index) => (
                  <div key={index} className="flex flex-col sm:flex-row justify-between sm:items-center text-xs text-slate-300 border-b border-slate-800/40 pb-2.5 gap-2 last:border-none">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="w-1.5 h-1.5 rounded-full bg-rose-500 shrink-0" />
                      <span className="font-bold text-slate-300 break-words leading-tight" style={{ wordBreak: 'break-word' }}>{p.name}</span>
                    </div>
                    <div className="flex justify-between sm:justify-end items-center font-mono text-[11px] shrink-0 bg-[#1C1E26]/50 sm:bg-transparent p-2 sm:p-0 rounded-lg sm:rounded-none w-full sm:w-auto">
                      <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500 sm:hidden block pl-1">Склад:</span>
                      <span className="text-rose-455 text-rose-400 font-extrabold bg-rose-500/10 border border-rose-500/15 px-2 py-0.5 rounded text-[10px] uppercase tracking-wide mr-1 font-mono">
                        {p.stock} {p.unit}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
            {allUnsoldProducts.length > 5 && (
              <button 
                onClick={() => setShowAllUnsold(!showAllUnsold)}
                className="w-full h-11 flex items-center justify-center gap-1 mt-2 text-xs font-bold text-slate-400 hover:text-white border border-slate-800/60 rounded-xl hover:bg-slate-800/30 transition-all cursor-pointer"
              >
                {showAllUnsold ? <><ChevronUp className="w-3.5 h-3.5" /> Скрыть</> : <><ChevronDown className="w-3.5 h-3.5" /> Показать все ({allUnsoldProducts.length})</>}
              </button>
            )}
          </div>
        </div>

        <div className="bg-[#161920] p-5 rounded-2xl border border-slate-800/80 shadow-2xl space-y-4">
          <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider font-mono">Показатели смен (Выручка по операторам)</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs text-slate-450">
            {Object.entries(cashierAggregate).map(([name, stats]) => (
              <div key={name} className="border border-slate-800/75 p-4 rounded-xl space-y-1 bg-[#1C1E26]">
                <div className="flex justify-between items-start mb-1">
                  <span className="font-black text-white text-sm block">{name}</span>
                </div>
                <p className="font-black text-blue-400 text-lg font-mono">{stats.total.toLocaleString()} руб.</p>
                <div className="flex justify-between text-[11px] text-slate-500 pt-1.5 border-t border-slate-800/60 mt-2">
                  <span>Оформлено чеков:</span>
                  <span className="font-mono text-slate-300">{stats.count} шт.</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
