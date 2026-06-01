/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Product, CartItem, Customer, SaleTransaction } from '../types';
import { Search, Camera, Plus, Minus, Trash2, CreditCard, Banknote, UserCheck, AlertCircle, Sparkles, Printer, QrCode, ClipboardList, Info, FileDown, Calendar, Clock, Receipt, Check, Package, Volume2, VolumeX, Megaphone, ChevronLeft, ChevronRight } from 'lucide-react';
import BarcodeScanner from './BarcodeScanner';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { soundEngine } from '../utils/audio';
import { api } from '../utils/api';

interface POSProps {
  products: Product[];
  customers: Customer[];
  sales: SaleTransaction[];
  onAddTransaction: (cart: CartItem[], paymentMethod: 'CASH' | 'CARD' | 'DEBT' | 'SPLIT', paidCash: number, paidCard: number, paidDebt: number, customerId?: string) => any;
  cashierName: string;
}

export default function POS({ products, customers, sales, onAddTransaction, cashierName }: POSProps) {
  const [isSoundActive, setIsSoundActive] = useState(() => soundEngine.isSoundEnabled());
  const [isVoiceActive, setIsVoiceActive] = useState(() => soundEngine.isVoiceEnabled());
  const [activeSubTab, setActiveSubTab] = useState<'new-sale' | 'history'>('new-sale');
  const [historySearchTerm, setHistorySearchTerm] = useState('');
  const [isWholesale, setIsWholesale] = useState(false);
  const [selectedHistorySale, setSelectedHistorySale] = useState<SaleTransaction | null>(null);

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('Все');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'CARD' | 'DEBT' | 'SPLIT'>('CASH');

  // Split payment inputs
  const [cashAmountStr, setCashAmountStr] = useState<string>('');
  const [cardAmountStr, setCardAmountStr] = useState<string>('');

  const [clientSearch, setClientSearch] = useState<string>('');
  const [showClientDropdown, setShowClientDropdown] = useState<boolean>(false);

  // Barcode Camera Scan Simulation Mode
  const [isScanning, setIsScanning] = useState(false);
  const [scannerFeedback, setScannerFeedback] = useState<string>('');

  const [toastData, setToastData] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToastData({ message, type });
    setTimeout(() => setToastData(null), 3000);
  };
  const scanTimerRef = useRef<any>(null);
  const frequentScrollRef = useRef<HTMLDivElement>(null);

  const scrollFrequent = (direction: 'left' | 'right') => {
    if (frequentScrollRef.current) {
      const scrollAmount = direction === 'left' ? -200 : 200;
      frequentScrollRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
    }
  };

  // Print receipt show state
  const [receiptToShow, setReceiptToShow] = useState<any>(null);

  // Helper utility to convert numbers into Russian spelled text
  const numberToWordsRu = (n: number): string => {
    if (n === 0) return 'ноль';
    const units = ['', 'один', 'два', 'три', 'четыре', 'пять', 'шесть', 'семь', 'восемь', 'девять'];
    const unitsF = ['', 'одна', 'две', 'три', 'четыре', 'пять', 'шесть', 'семь', 'восемь', 'девять'];
    const teens = ['десять', 'одиннадцать', 'двенадцать', 'тринадцать', 'четырнадцать', 'пятнадцать', 'шестнадцать', 'семнадцать', 'восемнадцать', 'девятнадцать'];
    const tens = ['', '', 'двадцать', 'тридцать', 'сорок', 'пятьдесят', 'шестьдесят', 'семьдесят', 'восемьдесят', 'девяносто'];
    const hundreds = ['', 'сто', 'двести', 'триста', 'четыреста', 'пятьсот', 'шестьсот', 'семьсот', 'восемьсот', 'девятьсот'];

    const words: string[] = [];
    const getHundredsAndUnder = (num: number, feminine: boolean = false) => {
      let result = '';
      const h = Math.floor(num / 100);
      const t = Math.floor((num % 100) / 10);
      const u = num % 10;
      if (h > 0) result += hundreds[h] + ' ';
      if (t === 1) {
        result += teens[u] + ' ';
      } else {
        if (t > 1) result += tens[t] + ' ';
        if (u > 0) result += (feminine ? unitsF[u] : units[u]) + ' ';
      }
      return result.trim();
    };

    const millions = Math.floor(n / 1000000);
    const thousands = Math.floor((n % 1000000) / 1000);
    const remainder = Math.floor(n % 1000);

    if (millions > 0) {
      words.push(getHundredsAndUnder(millions) + ' ' + (millions === 1 ? 'миллион' : millions < 5 ? 'миллиона' : 'миллионов'));
    }
    if (thousands > 0) {
      words.push(getHundredsAndUnder(thousands, true) + ' ' + (thousands % 10 === 1 && thousands % 100 !== 11 ? 'тысяча' : (thousands % 10 >= 2 && thousands % 10 <= 4 && (thousands % 100 < 10 || thousands % 100 >= 20)) ? 'тысячи' : 'тысяч'));
    }
    if (remainder > 0) {
      words.push(getHundredsAndUnder(remainder));
    } else if (words.length === 0) {
      words.push('ноль');
    }
    return words.join(' ').trim();
  };

  // Build authentic A4 Russian "РАСХОДНАЯ НАКЛАДНАЯ" Delivery Invoice HTML
  const buildInvoiceHTML = (sale: any, customerName: string) => {
    const dateStr = new Date(sale.timestamp).toLocaleDateString('ru-RU');
    const timeStr = new Date(sale.timestamp).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
    const rows = sale.items.map((item: any, idx: number) => `
      <tr style="border-bottom: 1px solid #000;">
        <td style="padding: 6px; border: 1px solid #a1a1a1; text-align: center;">${idx + 1}</td>
        <td style="padding: 6px; border: 1px solid #a1a1a1; text-align: left; font-weight: bold;">${item.productName}</td>
        <td style="padding: 6px; border: 1px solid #a1a1a1; text-align: center;">${item.productId || ''}</td>
        <td style="padding: 6px; border: 1px solid #a1a1a1; text-align: center;">${item.quantity}</td>
        <td style="padding: 6px; border: 1px solid #a1a1a1; text-align: center;">шт.</td>
        <td style="padding: 6px; border: 1px solid #a1a1a1; text-align: right;">${item.priceSell.toFixed(2)}</td>
        <td style="padding: 6px; border: 1px solid #a1a1a1; text-align: right; font-weight: bold;">${(item.priceSell * item.quantity).toFixed(2)}</td>
      </tr>
    `).join('');

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Расходная Накладная № ${sale.id.split('-').pop()?.toUpperCase() || sale.id.toUpperCase()}</title>
        <style>
          body { font-family: Arial, sans-serif; font-size: 11px; line-height: 1.4; color: #000; background-color: #fff; margin: 40px; }
          .bold { font-weight: bold; }
          .title { font-size: 15px; font-weight: bold; text-align: center; margin: 25px 0 15px 0; border-bottom: 2px solid #000; padding-bottom: 5px; }
          .info-table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
          .info-table td { padding: 4px; vertical-align: top; }
          .goods-table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
          .goods-table th { background-color: #f2f2f2; padding: 6px; border: 1px solid #000; text-align: center; font-weight: bold; }
          .goods-table td { padding: 6px; border: 1px solid #050505; }
          .signatures { width: 100%; margin-top: 50px; }
          .signatures td { width: 50%; padding: 10px; }
          .line { border-bottom: 1px solid #000; display: inline-block; width: 180px; }
        </style>
      </head>
      <body>
        <div style="display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 1px solid #ccc; padding-bottom: 15px; margin-bottom: 20px;">
          <div>
            <span style="font-size: 16px; font-weight: bold; color: #111;">МАГАЗИН "1000 МЕЛОЧЕЙ"</span><br>
            <span style="font-size: 9px; color: #555;">Рынок "Караван", корпус 10, бокс 10.8 | Тел: +7 9088101002</span>
          </div>
          <div style="background-color: #f2f2f2; padding: 6px 12px; border-radius: 4px; text-align: right; border: 1px solid #DDD;">
            <small>Документ:</small><br><strong>Расходная Накладная</strong>
          </div>
        </div>

        <table class="info-table">
          <tr>
            <td style="width: 15%; font-weight: bold;">Поставщик:</td>
            <td>Магазин хозяйственных товаров "1000 Мелочей"</td>
          </tr>
          <tr>
            <td style="font-weight: bold;">Покупатель:</td>
            <td style="font-weight: bold; text-decoration: underline;">${customerName || 'Розничный покупатель (Частное лицо)'}</td>
          </tr>
          <tr>
            <td style="font-weight: bold;">Основание:</td>
            <td>Розничная закупка на кассе от ${dateStr} ${timeStr} (Кассир: ${sale.cashierName})</td>
          </tr>
        </table>

        <div class="title">РАСХОДНАЯ НАКЛАДНАЯ № ${sale.id.split('-').pop()?.toUpperCase() || sale.id.toUpperCase()} от ${dateStr} г.</div>

        <table class="goods-table">
          <thead>
            <tr>
              <th style="width: 5%;">№</th>
              <th style="width: 45%;">Товары и услуги</th>
              <th style="width: 10%;">Артикул</th>
              <th style="width: 8%;">Кол-во</th>
              <th style="width: 8%;">Ед.</th>
              <th style="width: 12%;">Цена (руб.)</th>
              <th style="width: 12%;">Сумма (руб.)</th>
            </tr>
          </thead>
          <tbody>
            ${rows}
          </tbody>
        </table>

        <div style="text-align: right; width: 100%; margin-bottom: 25px; font-size: 12px; font-weight: bold;">
          <p style="margin: 3px 0;">Всего наименований ${sale.items.length}, на сумму: ${sale.finalPrice.toFixed(2)} руб.</p>
          ${sale.totalDiscount > 0 ? `<p style="margin: 3px 0; color: green; font-size: 10px;">Скидка покупателя: -${sale.totalDiscount.toFixed(2)} руб. (включено в цену)</p>` : ''}
          <p style="margin: 3px 0; border-top: 2px solid #000; padding-top: 6px; font-size: 14px; font-weight: 900;">Сумма к оплате: ${sale.finalPrice.toFixed(2)} руб.</p>
          <p style="font-size: 9px; font-weight: normal; color: #666; margin-top: 3px;">НДС не облагается (Патентная система налогообложения)</p>
        </div>

        <div style="border: 2px solid #000; padding: 10px; margin-top: 20px; background-color: #fafafa;">
          <span class="bold">Всего к оплате прописью:</span> 
          <span style="text-transform: capitalize; font-weight: bold; font-style: italic;">
            ${numberToWordsRu(sale.finalPrice)} рублей 00 копеек.
          </span>
        </div>

        <table class="signatures">
          <tr>
            <td>Отпустил (Продавец): <span class="line"></span> / ${sale.cashierName} /</td>
            <td>Получил (Покупатель): <span class="line"></span> / ${customerName || 'Представитель'} /</td>
          </tr>
        </table>

        <div style="margin-top: 50px; text-align: center; color: #777; font-size: 9px; border-top: 1px solid #eee; padding-top: 15px;">
          Благодарим Вас за покупку! При возникновении вопросов звоните по номеру: +7 9088101002
        </div>
      </body>
      </html>
    `;
  };

  // Build 58mm Thermal Printer Receipt HTML
  const buildThermalReceiptHTML = (sale: any, currentCashier: string, customerName?: string) => {
    const dateStr = new Date(sale.timestamp).toLocaleString('ru-RU');
    const rows = sale.items.map((item: any) => `
      <tr style="border-bottom: 1px dashed #ccc;">
        <td style="padding: 5px 0; text-align: left; font-size: 10px;">
          <strong>${item.productName}</strong><br>
          <span style="font-size: 9px; color: #555;">${item.quantity} шт x ${item.priceSell} руб.</span>
        </td>
        <td style="padding: 5px 0; text-align: right; font-weight: bold; vertical-align: bottom; font-size: 10px;">
          ${(item.priceSell * item.quantity)} руб.
        </td>
      </tr>
    `).join('');

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Товарный Чек #${sale.id.split('-').pop()?.toUpperCase() || sale.id.toUpperCase()}</title>
        <style>
          body { font-family: 'Courier New', Courier, monospace; font-size: 11px; line-height: 1.4; color: #000; background-color: #fff; margin: 15px; max-width: 280px; }
          .center { text-align: center; }
          .right { text-align: right; }
          .divider { border-top: 1px dashed #000; margin: 10px 0; }
          table { width: 100%; border-collapse: collapse; }
        </style>
      </head>
      <body>
        <div class="center">
          <h3 style="margin: 0; font-size: 13px;">МАГАЗИН "1000 МЕЛОЧЕЙ"</h3>
          <p style="margin: 3px 0; font-size: 9px;">Рынок "Караван", корпус 10, бокс 10.8</p>
          <p style="margin: 3px 0; font-size: 9px;">Тел: +7 9088101002 </p>
        </div>

        <div class="divider"></div>

        <div>
          ЧЕК: #${sale.id.split('-').pop()?.toUpperCase() || sale.id.toUpperCase()}<br>
          ДАТА: ${dateStr}<br>
          КАССИР: ${currentCashier}<br>
          ${customerName ? `КЛИЕНТ CRM: ${customerName}<br>` : ''}
        </div>

        <div class="divider"></div>

        <table>
          <thead>
            <tr style="border-bottom: 1px solid #000;">
              <th style="text-align: left; font-size: 10px;">Товар</th>
              <th style="text-align: right; font-size: 10px;">Сумма</th>
            </tr>
          </thead>
          <tbody>
            ${rows}
          </tbody>
        </table>

        <div class="divider"></div>

        <table>
          <tr>
            <td>Итого до скидки:</td>
            <td class="right">${sale.totalBeforeDiscount} руб.</td>
          </tr>
          ${sale.totalDiscount > 0 ? `
          <tr>
            <td>Скидка покупателя:</td>
            <td class="right" style="color: green; font-weight: bold;">-${sale.totalDiscount} руб.</td>
          </tr>
          ` : ''}
          <tr style="font-weight: bold; font-size: 12px; border-top: 1px solid #000;">
            <td style="padding-top: 5px;">ИТОГО К ОПЛАТЕ:</td>
            <td class="right" style="padding-top: 5px;">${sale.finalPrice} руб.</td>
          </tr>
        </table>

        <div class="divider"></div>

        <div style="font-size: 9px;">
          Способ оплаты: ${sale.paymentMethod === 'SPLIT' ? 'Комбинированный' : sale.paymentMethod === 'CARD' ? 'Банковская карта' : sale.paymentMethod === 'DEBT' ? 'В рассрочку (Долг)' : 'Наличные средства'}<br>
          Наличные в кассу: ${sale.paymentMethod === 'CASH' || sale.paymentMethod === 'SPLIT' ? `${sale.paidCash} руб.` : '0 руб.'}<br>
          Карта безнал: ${sale.paymentMethod === 'CARD' || sale.paymentMethod === 'SPLIT' ? `${sale.paidCard} руб.` : '0 руб.'}<br>
          Кредитный долг: ${sale.paidDebt} руб.
        </div>

        <div class="divider"></div>

        <div class="center" style="font-size: 9px; line-height: 1.5;">
          ФП: 9942398402 | ФД: 10423<br>
          ОФД ПРОВЕДЕНО СИСТЕМОЙ RETAILOS<br>
          *** СПАСИБО ЗА ПОКУПКУ! ***
        </div>
      </body>
      </html>
    `;
  };

  // Helper to convert oklch and oklab colors to standard rgb/rgba so html2canvas doesn't fail on "unsupported color function"
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

  const [pdfGeneratingId, setPdfGeneratingId] = useState<string | null>(null);

  // Directly export html content to standard PDF
  const handleExportToPDF = async (htmlContent: string, isA4: boolean, filename: string, sale: SaleTransaction, customerName: string) => {
    const saleId = sale.id;
    setPdfGeneratingId(saleId + (isA4 ? '_a4' : '_check'));

    // Save original styles/computed properties to restore them
    const originalGetComputedStyle = window.getComputedStyle;
    const originalStyleSheetRules = Object.getOwnPropertyDescriptor(CSSStyleSheet.prototype, 'cssRules');
    let originalGroupingRules: any = null;
    if (typeof CSSGroupingRule !== 'undefined') {
      originalGroupingRules = Object.getOwnPropertyDescriptor(CSSGroupingRule.prototype, 'cssRules');
    }

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
              return null; // Suppress iframe/preview stylesheet access errors safely
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

      // Create offscreen container styled pristine with white background
      const container = document.createElement('div');
      container.style.position = 'absolute';
      container.style.top = '-99999px';
      container.style.left = '-99999px';
      container.style.width = isA4 ? '794px' : '380px';
      container.style.backgroundColor = '#ffffff';
      container.style.color = '#000000';
      container.style.padding = isA4 ? '40px' : '15px';
      container.innerHTML = htmlContent;
      document.body.appendChild(container);

      // Force inline font rendering and high visibility
      const elements = container.querySelectorAll('*');
      elements.forEach((el: any) => {
        if (el.style) {
          el.style.fontFamily = 'Arial, sans-serif';
          if (el.style.color && (el.style.color.includes('oklch') || el.style.color.includes('oklab'))) {
            el.style.color = replaceOklchInString(el.style.color);
          }
        }
      });

      await new Promise((resolve) => setTimeout(resolve, 150));

      const canvas = await html2canvas(container, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff',
        logging: false,
        onclone: (clonedDoc) => {
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

      if (document.body.contains(container)) {
        document.body.removeChild(container);
      }

      const imgData = canvas.toDataURL('image/png');

      if (isA4) {
        const pdf = new jsPDF('p', 'mm', 'a4');
        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = pdf.internal.pageSize.getHeight();
        const imgWidth = pdfWidth;
        const imgHeight = (canvas.height * imgWidth) / canvas.width;

        let heightLeft = imgHeight;
        let position = 0;

        pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
        heightLeft -= pdfHeight;

        while (heightLeft >= 0) {
          position = heightLeft - imgHeight;
          pdf.addPage();
          pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
          heightLeft -= pdfHeight;
        }

        pdf.save(filename);
      } else {
        const rollWidthMm = 72; // normal thermal roll diameter rendering width
        const rollHeightMm = (canvas.height * rollWidthMm) / canvas.width;

        const pdf = new jsPDF({
          orientation: 'portrait',
          unit: 'mm',
          format: [rollWidthMm, Math.max(80, rollHeightMm)]
        });

        pdf.addImage(imgData, 'PNG', 0, 0, rollWidthMm, rollHeightMm);
        pdf.save(filename);
      }
    } catch (e) {
      console.error('PDF export failed', e);
      // Fallback
      handleDownloadInvoiceFile(sale, customerName, isA4);
    } finally {
      setPdfGeneratingId(null);
      // Restore standard functions
      window.getComputedStyle = originalGetComputedStyle;
      if (originalStyleSheetRules) {
        Object.defineProperty(CSSStyleSheet.prototype, 'cssRules', originalStyleSheetRules);
      }
      if (typeof CSSGroupingRule !== 'undefined' && originalGroupingRules) {
        Object.defineProperty(CSSGroupingRule.prototype, 'cssRules', originalGroupingRules);
      }
    }
  };

  // Hidden Iframe Print trigger
  const handleIframePrint = (htmlContent: string) => {
    try {
      const printIframe = document.createElement('iframe');
      printIframe.style.position = 'absolute';
      printIframe.style.top = '-10000px';
      printIframe.style.left = '-10000px';
      document.body.appendChild(printIframe);

      const printScript = "<script>window.onload = function() { setTimeout(function() { window.print(); }, 200); }</script>";
      const finalHtml = htmlContent.replace("</body>", `${printScript}</body>`);

      printIframe.contentDocument?.open();
      printIframe.contentDocument?.write(finalHtml);
      printIframe.contentDocument?.close();

      setTimeout(() => {
        if (document.body.contains(printIframe)) {
          document.body.removeChild(printIframe);
        }
      }, 5000);
    } catch (e) {
      console.error("Print launcher error:", e);
      alert("Не удалось запустить принтер. Блокировщик окон может мешать.");
    }
  };

  // Download client-side printable document
  const handleDownloadInvoiceFile = (sale: SaleTransaction, customerName: string, isA4: boolean) => {
    const content = isA4
      ? buildInvoiceHTML(sale, customerName)
      : buildThermalReceiptHTML(sale, cashierName, customerName);

    const blob = new Blob([content], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = isA4
      ? `Накладная_Расходная_#${sale.id.split('-').pop()?.toUpperCase() || sale.id.toUpperCase()}.html`
      : `Кассовый_Чек_#${sale.id.split('-').pop()?.toUpperCase() || sale.id.toUpperCase()}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Dynamic TOP-4 frequently sold products
  const top4Products = useMemo(() => {
    const counts: Record<string, number> = {};
    sales.forEach(sale => {
      if (sale.items) {
        sale.items.forEach(item => {
          counts[item.productId] = (counts[item.productId] || 0) + item.quantity;
        });
      }
    });

    const sorted = [...products].sort((a, b) => {
      const gA = counts[a.id] || 0;
      const gB = counts[b.id] || 0;
      if (gB !== gA) return gB - gA;
      return a.name.localeCompare(b.name);
    });

    return sorted.slice(0, 4);
  }, [sales, products]);

  const selectedCustomer = customers.find(c => c.id === selectedCustomerId);

  const frequentCustomers = useMemo(() => {
    const counts: Record<string, number> = {};
    sales.forEach(s => {
      if (s.customerId) {
        counts[s.customerId] = (counts[s.customerId] || 0) + 1;
      }
    });
    const mapped = customers.map(c => ({
      ...c,
      purchaseCount: counts[c.id] || 0
    }));
    mapped.sort((a, b) => b.purchaseCount - a.purchaseCount);
    return mapped.slice(0, 10);
  }, [sales, customers]);
  const matchingCustomers = customers.filter(c =>
    clientSearch && (
      c.name.toLowerCase().includes(clientSearch.toLowerCase()) ||
      c.phone.includes(clientSearch) ||
      c.id.includes(clientSearch)
    )
  );

  // Cart math
  const totalBeforeDiscount = cart.reduce((sum, item) => sum + ((item.customPrice ?? item.product.priceSell) * item.quantity), 0);

  // Apply both client personal discount level (if set) and any temporary item level discounts
  const clientDiscountPercent = selectedCustomer ? selectedCustomer.discountPercent : 0;

  const totalDiscount = cart.reduce((sum, item) => {
    const currentPrice = item.customPrice ?? item.product.priceSell;
    const itemDiscount = (currentPrice * item.quantity) * (item.discountPercent / 100);
    const customerBonusDiscount = ((currentPrice * item.quantity) - itemDiscount) * (clientDiscountPercent / 100);
    return sum + itemDiscount + customerBonusDiscount;
  }, 0);

  const finalPrice = Math.max(0, Math.round(totalBeforeDiscount - totalDiscount));

  // Auto layout split cash / card on method updates
  useEffect(() => {
    if (paymentMethod === 'CASH') {
      setCashAmountStr(finalPrice.toString());
      setCardAmountStr('0');
    } else if (paymentMethod === 'CARD') {
      setCashAmountStr('0');
      setCardAmountStr(finalPrice.toString());
    } else if (paymentMethod === 'DEBT') {
      setCashAmountStr('0');
      setCardAmountStr('0');
    } else if (paymentMethod === 'SPLIT') {
      setCashAmountStr(Math.round(finalPrice / 2).toString());
      setCardAmountStr(Math.round(finalPrice / 2).toString());
    }
  }, [paymentMethod, finalPrice]);

  const handleToggleWholesale = (checked: boolean) => {
    if (cart.length > 0) {
      showToast("Нельзя изменить режим при заполненной корзине!", "error");
      return;
    }
    setIsWholesale(checked);
    setCart(prev => prev.map(item => ({ ...item, customPrice: undefined })));
    showToast(checked ? "Активирован ОПТОВЫЙ режим продаж" : "Активирован РОЗНИЧНЫЙ режим", "success");
  };

  const handleAddById = (productId: string) => {
    const p = products.find(prod => prod.id === productId);
    if (!p) return;

    // Check stock by looking at current cart
    const existing = cart.find(item => item.product.id === productId);
    const currentQty = existing ? existing.quantity : 0;

    if (currentQty >= p.stock) {
      showToast(`Ошибка: Товар ${p.name} закончился на складе!`, 'error');
      soundEngine.playError();
      soundEngine.speak(`Ошибка, товар ${p.name} закончился на складе`);
      return;
    }

    showToast(`${p.name} добавлен в чек`, 'success');
    soundEngine.playScanSuccess();
    soundEngine.speak(`${p.name}. Стоимость ${p.priceSell} рублей`);

    setCart(prev => {
      const alreadyInCart = prev.find(item => item.product.id === productId);
      if (alreadyInCart) {
        return prev.map(item =>
          item.product.id === productId
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      } else {
        return [...prev, { product: p, quantity: 1, discountPercent: 0, customPrice: undefined }];
      }
    });
  };

  const handleScanBarcode = (barcode: string) => {
    const matched = products.find(p => p.barcode === barcode);
    if (matched) {
      handleAddById(matched.id);
      setScannerFeedback(`УСПЕШНО: '${matched.name}' добавлен в чек`);
      setTimeout(() => setScannerFeedback(''), 2500);
    } else {
      setScannerFeedback(`ОШИБКА: Штрихкод ${barcode} не найден в базе`);
      soundEngine.playError();
      soundEngine.speak(`Штрихкод ${barcode} не найден`);
      setTimeout(() => setScannerFeedback(''), 3000);
    }
  };

  // Camera scanning is handled in real-time by the BarcodeScanner modal

  const updateQty = (productId: string, delta: number) => {
    soundEngine.playClick();
    setCart(prev => prev.map(item => {
      if (item.product.id === productId) {
        const newQty = item.quantity + delta;
        return newQty > 0 ? { ...item, quantity: newQty } : item;
      }
      return item;
    }).filter(Boolean));
  };

  const removeItem = (productId: string) => {
    soundEngine.playClick();
    setCart(prev => prev.filter(item => item.product.id !== productId));
  };

  const filterProducts = products.filter(p => {
    const matchesCategory = selectedCategory === 'Все' || p.category === selectedCategory;
    if (!matchesCategory) return false;

    if (!searchTerm) return true;
    return (
      p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.barcode.includes(searchTerm) ||
      p.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.sku.toLowerCase().includes(searchTerm.toLowerCase())
    );
  });

  const handleNumPadKeyPress = (value: string) => {
    if (paymentMethod !== 'CASH' && paymentMethod !== 'SPLIT') return;
    if (value === 'C') {
      setCashAmountStr('');
    } else {
      setCashAmountStr(prev => prev + value);
    }
  };

  const handleCheckout = async () => {
    if (cart.length === 0) return;

    const paidC = paymentMethod === 'CASH' ? Number(cashAmountStr) || finalPrice : paymentMethod === 'SPLIT' ? Number(cashAmountStr) || 0 : 0;
    const paidCard = paymentMethod === 'CARD' ? Number(cardAmountStr) || finalPrice : paymentMethod === 'SPLIT' ? Number(cardAmountStr) || 0 : 0;
    const paidD = paymentMethod === 'DEBT' ? finalPrice : 0;

    // Check if customer limits are valid for Debt payment
    if (paymentMethod === 'DEBT' && !selectedCustomerId) {
      alert('Ошибка: Для оформления продажи в КРЕДИТ необходимо выбрать клиента из списка CRM!');
      return;
    }

    if (paymentMethod === 'DEBT' && selectedCustomer) {
      const prospectiveDebt = selectedCustomer.debt + finalPrice;
      if (prospectiveDebt > selectedCustomer.debtLimit) {
        alert(`КРЕДИТ БЛОКИРОВАН!\n\nТекущий долг клиента: ${selectedCustomer.debt} руб.\nСумма покупки: ${finalPrice} руб.\nМаксимальный лимит доверия клиента: ${selectedCustomer.debtLimit} руб.\n\nПродажа заблокирована. Пожалуйста, примите оплату наличными или картой, либо внесите зачет старого долга в модуле "Касса и Долги".`);
        return;
      }
    }

    try {
      // Submit transaction
      const newSale = await onAddTransaction(cart, paymentMethod, paidC, paidCard, paidD, selectedCustomerId || undefined);

      if (!newSale) {
        throw new Error("Транзакция вернула пустой результат");
      }

      // Play payment dzin checkout success chime!
      soundEngine.playCheckoutSuccess();
      soundEngine.speak(`Продажа успешно совершена. К оплате ${finalPrice} рублей.`);

      // Automatically send receipt to customer in Telegram if linked
      if (selectedCustomer?.telegramChatId) {
        const receiptMessage = `🧾 <b>НАКЛАДНАЯ (Покупка)</b>\n` +
          `Магазин: "1000 Мелочей"\n` +
          `Дата: ${new Date(newSale.timestamp).toLocaleDateString('ru-RU')} ${new Date(newSale.timestamp).toLocaleTimeString('ru-RU')}\n\n` +
          `<b>Товары:</b>\n` +
          newSale.items.map((it: any) => `• ${it.productName}: ${it.quantity} шт. x ${it.priceSell} руб. = ${it.quantity * it.priceSell} руб.`).join('\n') +
          `\n\n` +
          (newSale.totalDiscount > 0 ? `🎁 Скидка: ${newSale.totalDiscount} руб.\n` : '') +
          `💰 <b>Итого к оплате: ${newSale.finalPrice} руб.</b>\n` +
          `💳 Способ оплаты: ${newSale.paymentMethod === 'CASH' ? 'Наличные' : newSale.paymentMethod === 'CARD' ? 'Карта' : newSale.paymentMethod === 'SPLIT' ? 'Смешанная' : 'В долг'}\n\n` +
          `<i>Спасибо за покупку! Ждем вас снова!</i>`;

        api.telegram.send(selectedCustomer.telegramChatId, receiptMessage, 'client')
          .catch(err => console.error("Failed to send receipt to tg", err));
      }

      // Set for receipt preview modal
      setReceiptToShow({
        id: newSale.id,
        timestamp: newSale.timestamp,
        items: newSale.items,
        totalBeforeDiscount: newSale.totalBeforeDiscount,
        totalDiscount: newSale.totalDiscount,
        finalPrice: newSale.finalPrice,
        paymentMethod: newSale.paymentMethod,
        paidCash: newSale.paidCash,
        paidCard: newSale.paidCard,
        paidDebt: newSale.paidDebt,
        customer: selectedCustomer
      });

      // Reset checkout states
      setCart([]);
      setSelectedCustomerId('');
      setPaymentMethod('CASH');
    } catch (err: any) {
      console.error("Checkout transaction error:", err);
      alert(`Ошибка при сохранении продажи: ${err.message || err}`);
    }
  };

  const cashAmountNum = Number(cashAmountStr) || 0;
  const changeValue = Math.max(0, cashAmountNum - finalPrice);

  return (
    <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start h-full">

      {/* FIXED TOAST SYSTEM LAYER */}
      {toastData && (
        <div className="fixed top-20 right-4 md:right-8 z-50 animate-in fade-in slide-in-from-top-4 duration-300">
          <div className={`flex items-center gap-3 px-4 py-3 rounded-2xl shadow-2xl border ${toastData.type === 'success'
              ? 'bg-emerald-900/90 border-emerald-500/50 text-emerald-100 shadow-emerald-900/20'
              : 'bg-rose-900/90 border-rose-500/50 text-rose-100 shadow-rose-900/20'
            } backdrop-blur-md`}>
            {toastData.type === 'success' ? <Check className="w-5 h-5 text-emerald-400" /> : <AlertCircle className="w-5 h-5 text-rose-400" />}
            <span className="text-sm font-bold tracking-wide">{toastData.message}</span>
          </div>
        </div>
      )}

      {/* LEFT: Cart and Payment settings (Main focus on smartphones) */}
      <div className="xl:col-span-7 bg-[#161920] p-5 rounded-2xl border border-slate-800/80 shadow-2xl space-y-5">
  <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-3 border-b border-slate-800 pb-3">
          <div className="flex items-center gap-4 flex-wrap">
            <button
              onClick={() => setActiveSubTab('new-sale')}
              className={`pb-1 text-xs uppercase tracking-wider font-extrabold flex items-center gap-1.5 transition-all cursor-pointer ${activeSubTab === 'new-sale'
                  ? 'border-b-2 border-blue-500 text-white font-black'
                  : 'text-slate-500 hover:text-slate-300'
                }`}
            >
              <ClipboardList className="text-blue-400 w-3.5 h-3.5" /> Новый Чек
            </button>
            <button
              onClick={() => setActiveSubTab('history')}
              className={`pb-1 text-xs uppercase tracking-wider font-extrabold flex items-center gap-1.5 transition-all cursor-pointer ${activeSubTab === 'history'
                  ? 'border-b-2 border-blue-500 text-white font-black'
                  : 'text-slate-500 hover:text-slate-300'
                }`}
            >
              <Receipt className="text-emerald-400 w-3.5 h-3.5" /> История чеков & PDF
            </button>
          </div>
          <div className="flex flex-wrap items-center gap-2.5 text-xs w-full lg:w-auto lg:justify-end">
            {/* Sound FX Toggle Toggle Button */}
            <button
              onClick={() => {
                const updated = soundEngine.toggleSound();
                setIsSoundActive(updated);
                if (updated) {
                  soundEngine.playScanSuccess();
                }
              }}
              className={`p-1.5 rounded-xl border flex items-center justify-center gap-1.5 font-bold font-mono transition active:scale-95 cursor-pointer ${isSoundActive
                  ? 'bg-blue-900/40 border-blue-500/30 text-blue-400 hover:bg-blue-900/60'
                  : 'bg-slate-800 border-slate-700 text-slate-500 hover:text-slate-400'
                }`}
              title={isSoundActive ? "Голос / Звуки системы: Включены" : "Голос / Звуки системы: Выключены"}
            >
              {isSoundActive ? (
                <>
                  <Volume2 className="w-3.5 h-3.5 animate-pulse text-blue-400" />
                  <span className="text-[10px] uppercase tracking-wider text-blue-300">Звук</span>
                </>
              ) : (
                <>
                  <VolumeX className="w-3.5 h-3.5" />
                  <span className="text-[10px] uppercase tracking-wider">Тихо</span>
                </>
              )}
            </button>

            {/* Voice POS Assistant Toggle */}
            <button
              onClick={() => {
                const updated = soundEngine.toggleVoice();
                setIsVoiceActive(updated);
                if (updated) {
                  soundEngine.speak("Голосовой помощник кассира активирован");
                }
              }}
              className={`p-1.5 rounded-xl border flex items-center justify-center gap-1.5 font-bold font-mono transition active:scale-95 cursor-pointer ${isVoiceActive
                  ? 'bg-emerald-950/40 border-emerald-500/30 text-emerald-400 hover:bg-emerald-950/60'
                  : 'bg-slate-800 border-slate-700 text-slate-500 hover:text-slate-400'
                }`}
              title={isVoiceActive ? "Голосовой помощник: АКТИВЕН" : "Голосовой помощник: ОТКЛЮЧЕН"}
            >
              <Megaphone className={`w-3.5 h-3.5 ${isVoiceActive ? 'animate-pulse text-emerald-400' : 'text-slate-500'}`} />
              <span className="text-[10px] uppercase tracking-wider">{isVoiceActive ? 'Озвучка' : 'Без озвучки'}</span>
            </button>

           <div className="h-4 w-px bg-slate-800 hidden sm:block"></div>
            <span className="text-slate-500 text-[11px]">Оператор:</span>
            <span className="font-semibold text-slate-300 bg-[#1C1E26] border border-slate-800 px-2.5 py-1.5 rounded-lg font-mono truncate max-w-[150px] sm:max-w-[200px]" title={cashierName}>
              {cashierName}
            </span>
          </div>
        </div>

        {activeSubTab === 'history' ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between animate-fadeIn">
              <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider font-mono">Архив розничных продаж</span>
              <span className="text-[10px] text-blue-400 font-mono">Всего: {sales.length} чеков</span>
            </div>

            {/* Search filter for history */}
            <div className="relative animate-fadeIn">
              <Search className="w-4 h-4 text-slate-500 absolute left-3 top-3.5" />
              <input
                type="text"
                placeholder="Поиск по чеку #, клиенту или названию товара..."
                value={historySearchTerm}
                onChange={(e) => setHistorySearchTerm(e.target.value)}
                className="w-full bg-[#1C1E26] border border-slate-850 pl-9 pr-4 py-2.5 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-blue-500 font-mono placeholder-slate-600"
              />
            </div>

            {/* History Table/List */}
            <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1 animate-fadeIn">
              {sales
                .filter(sale => {
                  if (!historySearchTerm) return true;
                  const searchLower = historySearchTerm.toLowerCase();
                  const customerName = customers.find(c => c.id === sale.customerId)?.name.toLowerCase() || '';
                  const idMatch = sale.id.toLowerCase().includes(searchLower);
                  const clientMatch = customerName.includes(searchLower);
                  const itemsMatch = sale.items.some(it => it.productName.toLowerCase().includes(searchLower));
                  return idMatch || clientMatch || itemsMatch;
                })
                .map((sale) => {
                  const customerObj = customers.find(c => c.id === sale.customerId);
                  const customerName = customerObj?.name || '';
                  const dateFormated = new Date(sale.timestamp).toLocaleString('ru-RU');
                  const isExpanded = selectedHistorySale?.id === sale.id;

                  return (
                    <div
                      key={sale.id}
                      className={`border p-3.5 rounded-xl transition-all duration-200 ${isExpanded
                          ? 'border-blue-500 bg-[#1C1E26]/90 shadow-lg shadow-blue-950/20'
                          : 'border-slate-800 bg-[#1C1E26]/30 hover:bg-[#1C1E26]/60'
                        }`}
                    >
                      <div
                        className="flex justify-between items-start gap-2 cursor-pointer"
                        onClick={() => setSelectedHistorySale(isExpanded ? null : sale)}
                      >
                        <div className="space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-xs font-black text-slate-100 font-mono">#{sale.id.split('-').pop()?.toUpperCase() || sale.id.toUpperCase()}</span>
                            <span className="text-[9px] bg-[#161920] border border-slate-800 text-slate-400 font-bold px-1.5 py-0.5 rounded font-mono uppercase">
                              {sale.paymentMethod === 'CASH' ? 'Наличные' :
                               sale.paymentMethod === 'CARD' ? 'Карта' :
                               sale.paymentMethod === 'DEBT' ? 'В долг' :
                               sale.paymentMethod === 'SPLIT' ? 'Смешанный' : sale.paymentMethod}
                            </span>
                            {sale.customerId && (
                              <span className="text-[9px] bg-blue-500/10 text-blue-400 px-1.5 py-0.5 rounded font-bold font-mono">CRM: {customerName}</span>
                            )}
                          </div>
                          <div className="flex items-center gap-1.5 text-[9.5px] text-slate-500 font-mono">
                            <Calendar className="w-3.5 h-3.5 text-slate-600" />
                            <span>{dateFormated}</span>
                          </div>
                        </div>
                        <div className="text-right">
                          <span className="text-xs font-black text-blue-400 block font-mono">{sale.finalPrice} руб.</span>
                          <span className="text-[9px] text-slate-500 block font-mono">{sale.items.length} поз.</span>
                        </div>
                      </div>

                      {/* Expanded Record View */}
                      {isExpanded && (
                        <div className="mt-4 pt-3.5 border-t border-slate-800 space-y-4">
                          {/* Inner goods table */}
                          <div className="bg-[#161920]/60 rounded-xl p-3 border border-slate-900 space-y-2">
                            <span className="text-[9px] uppercase font-bold text-slate-500 tracking-wider font-mono block">Купленные товары:</span>
                            <div className="divide-y divide-slate-800/40 space-y-1 pt-1">
                              {sale.items.map((item, index) => (
                                <div key={index} className="flex justify-between text-xs py-1.5 font-mono">
                                  <div className="text-slate-200 flex flex-col">
                                    <span className="font-bold text-slate-200">{item.productName}</span>
                                    <span className="text-[10px] text-slate-500">{item.quantity} шт x {item.priceSell} руб.</span>
                                  </div>
                                  <span className="font-bold text-slate-300 self-end">{(item.priceSell * item.quantity)} руб.</span>
                                </div>
                              ))}
                            </div>
                            <div className="flex justify-between border-t border-slate-800 pt-2 text-[11px] font-mono text-slate-400">
                              <span>Дог. сумма до скидки:</span>
                              <span>{sale.totalBeforeDiscount} руб.</span>
                            </div>
                            {sale.totalDiscount > 0 && (
                              <div className="flex justify-between text-[11px] font-mono text-emerald-400">
                                <span>Предоставлена скидка:</span>
                                <span>-{sale.totalDiscount} руб.</span>
                              </div>
                            )}
                          </div>

                          {/* Quick Document PDF operations */}
                          <div className="bg-[#0A0C10] p-3 rounded-xl border border-slate-800/50 space-y-3">
                            <span className="text-[10.5px] uppercase font-extrabold text-slate-300 tracking-wider font-mono block">Печать & Отправка Клиенту (PDF):</span>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                              {/* 1. Standard Cash Check PDF generator */}
                              <button
                                type="button"
                                disabled={pdfGeneratingId !== null}
                                onClick={() => handleExportToPDF(
                                  buildThermalReceiptHTML(sale, sale.cashierName, customerName),
                                  false,
                                  `Кассовый_Чек_#${sale.id.split('-').pop()?.toUpperCase() || sale.id.toUpperCase()}.pdf`,
                                  sale,
                                  customerName
                                )}
                                className="flex items-center justify-center gap-1.5 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 disabled:opacity-50 text-white p-2.5 rounded-xl text-xs font-bold transition cursor-pointer shadow-md"
                              >
                                <Printer className="w-3.5 h-3.5" />
                                {pdfGeneratingId === sale.id + '_check' ? 'Генерация...' : 'Распечатать Чек (PDF)'}
                              </button>

                              {/* 2. Official A4 Delivery Note generator */}
                              <button
                                type="button"
                                disabled={pdfGeneratingId !== null}
                                onClick={() => handleExportToPDF(
                                  buildInvoiceHTML(sale, customerName),
                                  true,
                                  `Накладная_Расходная_#${sale.id.split('-').pop()?.toUpperCase() || sale.id.toUpperCase()}.pdf`,
                                  sale,
                                  customerName
                                )}
                                className="flex items-center justify-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:bg-emerald-800 disabled:opacity-50 text-white p-2.5 rounded-xl text-xs font-bold transition cursor-pointer shadow-md"
                              >
                                <FileDown className="w-3.5 h-3.5" />
                                {pdfGeneratingId === sale.id + '_a4' ? 'Генерация...' : 'Накладная товара (PDF)'}
                              </button>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 border-t border-slate-850 pt-2 text-[10px] text-slate-500">
                              <button
                                type="button"
                                onClick={() => handleDownloadInvoiceFile(sale, customerName, false)}
                                className="flex items-center justify-center gap-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 px-3 py-1.5 rounded-lg transition cursor-pointer"
                              >
                                <FileDown className="w-3 h-3 text-slate-500" />
                                Скачать файл чека (.html)
                              </button>

                              <button
                                type="button"
                                onClick={() => handleDownloadInvoiceFile(sale, customerName, true)}
                                className="flex items-center justify-center gap-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 px-3 py-1.5 rounded-lg transition cursor-pointer"
                              >
                                <FileDown className="w-3 h-3 text-emerald-500" />
                                Скачать накладную (.html)
                              </button>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}

              {sales.length === 0 && (
                <div className="text-center py-10 text-slate-500 bg-[#1C1E26]/20 rounded-2xl border border-slate-900">
                  <Receipt className="w-8 h-8 mx-auto mb-2 text-slate-600 animate-pulse" />
                  <p className="text-xs">В текущей сессии пока не было продаж.</p>
                </div>
              )}
            </div>
          </div>
        ) : (
          <>
            {/* REGIME SWITCHER: WHOLESALE OR RETAIL */}
            <div className="bg-[#1C1E26] border border-slate-800 p-3.5 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-3 shadow-md">
              <div className="flex items-center gap-2.5">
                <div className={`p-2.5 rounded-xl transition-all duration-300 ${isWholesale ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20' : 'bg-blue-500/10 text-blue-400 border border-blue-500/20'}`}>
                  <Sparkles className="w-4.5 h-4.5 animate-pulse" />
                </div>
                <div>
                  <h4 className="text-xs font-black text-slate-100 leading-tight uppercase font-mono tracking-wide">Режим обслуживания в POS-кассе</h4>
                  <p className="text-[10px] mt-1">
                    {cart.length > 0 ? (
                      <span className="text-amber-400 font-bold flex items-center gap-1">🔒 Очистите корзину для смены режима</span>
                    ) : (
                      <span className="text-slate-500">Переключение категорий и защита маржинальности</span>
                    )}
                  </p>
                </div>
              </div>

              <div className="relative inline-flex bg-[#12141C] border border-slate-850 p-1 rounded-xl w-full sm:w-auto self-stretch sm:self-auto select-none">
                <button
                  type="button"
                  id="retail-mode-button"
                  disabled={cart.length > 0}
                  onClick={() => handleToggleWholesale(false)}
                  className={`flex-1 sm:flex-initial text-center px-4 py-2 text-[10px] font-extrabold uppercase tracking-wider rounded-lg transition-all duration-250 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer ${!isWholesale
                      ? 'bg-blue-600 shadow-md text-white font-black scale-100'
                      : 'text-slate-400 hover:text-slate-350 hover:bg-slate-800/20'
                    }`}
                >
                  Розничная продажа
                </button>
                <button
                  type="button"
                  id="wholesale-mode-button"
                  disabled={cart.length > 0}
                  onClick={() => handleToggleWholesale(true)}
                  className={`flex-1 sm:flex-initial text-center px-4 py-2 text-[10px] font-extrabold uppercase tracking-wider rounded-lg transition-all duration-250 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer ${isWholesale
                      ? 'bg-indigo-600 shadow-md text-white font-black scale-100'
                      : 'text-slate-400 hover:text-slate-350 hover:bg-slate-800/20'
                    }`}
                >
                  Оптовая продажа
                </button>
              </div>
            </div>
            {/* Dynamic Best Sellers Quick Access Block */}
            <div className="bg-[#1C1E26]/50 border p-3 rounded-xl border-slate-800/80">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 mb-2">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wide flex items-center gap-1.5 font-mono">
                  <Sparkles className="w-3.5 h-3.5 text-amber-400" /> ТОП-4 часто продаваемых товаров (быстрый клик):
                </span>
                <button
                  onClick={() => setIsScanning(true)}
                  className="text-[11px] font-bold px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl transition flex items-center gap-1.5 cursor-pointer shadow-lg"
                  title="Открыть камеру телефона для сканирования штрих-кода"
                >
                  <Camera className="w-3.5 h-3.5" />
                  <span>Камера-сканер</span>
                </button>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {top4Products.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => handleAddById(p.id)}
                    className="bg-[#1C1E26] hover:bg-[#21242e] transition p-2 rounded-lg text-[11px] text-slate-300 text-left border border-slate-800 hover:border-blue-500/50 shadow-sm flex flex-col justify-between cursor-pointer min-h-[58px]"
                  >
                    <span className="font-semibold truncate w-full">{p.name}</span>
                    <div className="flex justify-between items-center w-full mt-1.5">
                      <span className="text-[9px] font-mono text-slate-500">{p.sku}</span>
                      <span className="text-[10px] font-mono font-bold text-blue-400">{p.priceSell} руб.</span>
                    </div>
                  </button>
                ))}
              </div>
              {scannerFeedback && (
                <div className={`mt-2 p-1.5 rounded text-center text-[10px] font-mono font-bold ${scannerFeedback.includes('ОШИБКА') ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20' : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                  }`}>
                  {scannerFeedback}
                </div>
              )}
            </div>

            {/* Cart Listing */}
            <div className="space-y-3 min-h-[160px]">
              {cart.length === 0 ? (
                <div className="border-2 border-dashed border-slate-800 rounded-2xl py-12 text-center text-slate-500 flex flex-col items-center justify-center bg-black/10">
                  <ClipboardList className="w-12 h-12 text-slate-600 mb-2 animate-pulse" />
                  <p className="text-xs font-extrabold text-slate-400">Ваша кассовая корзина пуста</p>
                  <p className="text-[10px] max-w-[240px] mt-1.5 leading-relaxed text-slate-500">
                    Добавьте товары кликом по списку справа, отсканируйте код или выберите популярные товары в ТОП-4 блоке.
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-slate-800/50 max-h-[420px] overflow-y-auto pr-1 space-y-1.5">
                  {cart.map((item) => {
                    const itemTotal = (item.customPrice ?? item.product.priceSell) * item.quantity;
                    const minAllowedPrice = item.product.priceWholesale ?? Math.round(item.product.priceBuy * 1.25);
                    const isUnderstock = item.product.stock < item.quantity;
                    const isBelowLimit = isWholesale && (item.customPrice ?? item.product.priceSell) < minAllowedPrice;

                    return (
                      <div
                        key={item.product.id}
                        className={`py-3 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 px-2.5 rounded-2xl transition-all duration-200 border ${isBelowLimit
                            ? 'bg-rose-955/10 border-rose-500/30 hover:bg-rose-955/20'
                            : 'bg-transparent border-transparent hover:bg-[rgba(255,255,255,0.02)] hover:border-slate-800/40'
                          }`}
                      >
                        <div className="flex items-center gap-3.5 flex-1 min-w-0 w-full">
                          {/* Perfect containment rounded thumbnail */}
                          <div className="w-12 h-12 rounded-xl bg-[#1C1E26] border border-slate-800 flex items-center justify-center shrink-0 overflow-hidden p-1 relative shadow-inner">
                            {item.product.imageUrl ? (
                              <img
                                src={item.product.imageUrl}
                                alt={item.product.name}
                                className="w-full h-full object-contain rounded-lg"
                                referrerPolicy="no-referrer"
                              />
                            ) : (
                              <Package className="w-5 h-5 text-slate-600 opacity-70" />
                            )}
                            {isUnderstock && (
                              <div className="absolute top-0 right-0 w-2 h-2 rounded-full bg-rose-500 animate-ping" />
                            )}
                          </div>

                          {/* Name parameters cleanly readable and with dynamic wrapper */}
                          <div className="flex-1 min-w-0">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span className="text-xs font-extrabold text-slate-200 leading-snug break-words whitespace-normal block" style={{ wordBreak: 'break-word' }}>
                                {item.product.name}
                              </span>
                              {isUnderstock && (
                                <span className="text-[9px] bg-rose-500/10 text-rose-455 text-rose-400 font-extrabold px-1.5 py-0.5 rounded-full border border-rose-500/20 flex items-center gap-0.5 shrink-0" title="Малый остаток на складе!">
                                  <AlertCircle className="w-2.5 h-2.5 text-rose-400" />
                                  {item.product.stock} {item.product.unit}
                                </span>
                              )}
                            </div>
                            <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                              Артикул: <span className="text-slate-400 font-bold">{item.product.sku}</span>
                            </div>

                            {isWholesale ? (
                              // WHOLESALE MODE CART ITEM CONTROLS (EDITABLE, HIDDEN THRESHOLD TEXT, RED WARNING IF BELOW LIMIT)
                              <div className="mt-2.5 flex flex-col sm:flex-row sm:items-center gap-4 w-full">
                                <div className="flex flex-col gap-1 w-full max-w-[210px] shrink-0">
                                  <span className="text-[9px] text-indigo-400 font-bold font-mono uppercase tracking-wide">
                                    Договорная цена продажи (Опт):
                                  </span>
                                  <div className="relative flex items-center">
                                    <input
                                      type="number"
                                      placeholder="Введите цену..."
                                      className={`w-full text-xs font-black font-mono px-2.5 py-1.5 rounded-xl text-white pr-9 focus:outline-none transition-all ${isBelowLimit
                                          ? 'border border-rose-500 bg-rose-950/20 text-rose-300 focus:ring-1 focus:ring-rose-500 shadow-md shadow-rose-950/20'
                                          : 'border border-slate-800 bg-[#12141C] focus:ring-1 focus:ring-blue-500 hover:border-slate-700'
                                        }`}
                                      value={item.customPrice !== undefined ? item.customPrice : item.product.priceSell}
                                      onChange={(e) => {
                                        const val = e.target.value === '' ? 0 : Number(e.target.value);
                                        setCart(prev => prev.map(c => c.product.id === item.product.id ? { ...c, customPrice: val } : c));
                                      }}
                                      onBlur={(e) => {
                                        const val = Number(e.target.value);
                                        if (isNaN(val) || val < 0) {
                                          setCart(prev => prev.map(c => c.product.id === item.product.id ? { ...c, customPrice: 0 } : c));
                                        }
                                      }}
                                    />
                                    <span className="absolute right-2.5 text-[8px] font-bold text-slate-500 font-mono tracking-tight cursor-default select-none">РУБ</span>
                                  </div>
                                  {isBelowLimit && (
                                    <span className="text-[9px] text-rose-400 font-bold font-mono block">
                                      ⚠️ Внимание: Цена ниже оптового порога! (Разрешено)
                                    </span>
                                  )}
                                </div>
                                <span className="text-[10px] text-slate-500 font-mono self-end pb-1 inline-block shrink-0">
                                  Базовая розница: {item.product.priceSell} руб | за {item.product.unit}
                                </span>
                              </div>
                            ) : (
                              // RETAIL MODE CART ITEM CONTROLS (FIXED PRICE, NO INPUT, HIDE COST PRICE AND CODE LIMITS)
                              <div className="mt-2.5 flex flex-wrap items-center gap-3 w-full text-[11px]">
                                <span className="font-bold text-slate-400">
                                  Цена продажи: <span className="text-blue-400 font-mono text-xs font-extrabold">{item.product.priceSell} руб.</span>
                                </span>
                                <span className="text-slate-700 font-mono">|</span>
                                <span className="text-slate-400 font-bold">
                                  За единицу: <span className="text-slate-300 font-mono">{item.product.unit}</span>
                                </span>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Numeric and deletion actions perfectly aligned */}
                        <div className="flex items-center justify-between sm:justify-end gap-3.5 w-full sm:w-auto shrink-0 border-t border-slate-800/40 sm:border-0 pt-2.5 sm:pt-0">
                          {/* Calculated price */}
                          <div className="text-left sm:text-right min-w-[75px]">
                            <span className="text-[9px] uppercase tracking-wider font-extrabold text-[#535C74] font-mono sm:hidden block">Сумма чека:</span>
                            <span className="text-sm font-black text-emerald-400 font-mono tracking-tight">{itemTotal.toLocaleString()} руб.</span>
                          </div>

                          <div className="flex items-center gap-2">
                            {/* Interactive counters */}
                            <div className="flex bg-[#1C1E26] p-1 rounded-xl items-center border border-slate-800 shadow-inner">
                              <button
                                type="button"
                                onClick={() => updateQty(item.product.id, -1)}
                                className="w-9 h-9 flex items-center justify-center hover:bg-[#161920] active:scale-90 rounded-lg transition-all text-slate-400 hover:text-white shrink-0 cursor-pointer"
                              >
                                <Minus className="w-4 h-4" />
                              </button>
                              <span className="text-xs font-black min-w-[26px] text-center text-slate-200 select-none font-mono">{item.quantity}</span>
                              <button
                                type="button"
                                onClick={() => {
                                  const p = products.find(prod => prod.id === item.product.id);
                                  if (p && item.quantity >= p.stock) {
                                    showToast(`Ошибка: Товар ${p.name} закончился на складе!`, 'error');
                                    return;
                                  }
                                  updateQty(item.product.id, 1);
                                }}
                                className="w-9 h-9 flex items-center justify-center hover:bg-[#161920] active:scale-90 rounded-lg transition-all text-slate-400 hover:text-white shrink-0 cursor-pointer"
                              >
                                <Plus className="w-4 h-4" />
                              </button>
                            </div>

                            {/* Interactive Trash button */}
                            <button
                              type="button"
                              onClick={() => removeItem(item.product.id)}
                              className="w-11 h-11 flex items-center justify-center bg-rose-500/5 hover:bg-rose-500/15 border border-rose-500/10 hover:border-rose-500/30 active:scale-90 rounded-xl text-rose-400 transition-all cursor-pointer shrink-0"
                              title="Удалить позицию"
                            >
                              <Trash2 className="w-4.5 h-4.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* ADVANCED CLIENT SELECTION MODULE */}
            <div className="bg-[#1C1E26]/40 p-4 rounded-xl border border-slate-800/80 space-y-3 relative">
              <div className="flex justify-between items-center text-xs">
                <span className="font-bold text-slate-300 flex items-center gap-1">
                  <UserCheck className="w-4 h-4 text-emerald-400" /> Быстрый поиск клиента (CRM):
                </span>
                {selectedCustomerId && (
                  <button
                    onClick={() => {
                      setSelectedCustomerId('');
                      setClientSearch('');
                    }}
                    className="text-rose-400 hover:text-rose-300 font-semibold px-2 py-1 bg-rose-500/10 rounded-lg transition"
                  >
                    Сбросить
                  </button>
                )}
              </div>

              {!selectedCustomerId ? (
                <div className="space-y-3">
                  <div className="relative">
                    <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-500" />
                    <input
                      type="text"
                      placeholder="Имя, телефон или ID карты..."
                      value={clientSearch}
                      onFocus={() => setShowClientDropdown(true)}
                      onChange={(e) => {
                        setClientSearch(e.target.value);
                        setShowClientDropdown(true);
                      }}
                      className="w-full bg-[#161920] border border-slate-700 pl-9 pr-4 py-2.5 rounded-xl text-xs text-slate-200 focus:ring-1 focus:ring-blue-500 transition shadow-inner"
                    />

                    {showClientDropdown && clientSearch && (
                      <div className="absolute top-full left-0 right-0 mt-1 bg-[#1C1E26] border border-slate-700 rounded-xl shadow-2xl z-50 max-h-48 overflow-y-auto">
                        {matchingCustomers.length > 0 ? (
                          matchingCustomers.map(c => (
                            <button
                              key={c.id}
                              onClick={() => {
                                setSelectedCustomerId(c.id);
                                setClientSearch('');
                                setShowClientDropdown(false);
                              }}
                              className="w-full text-left px-4 py-2.5 hover:bg-slate-800 border-b border-slate-800 text-xs flex justify-between items-center transition"
                            >
                              <span className="font-bold text-slate-200">{c.name}</span>
                              <span className="text-slate-500">{c.phone}</span>
                            </button>
                          ))
                        ) : (
                          <div className="px-4 py-3 text-xs text-slate-500 text-center">Клиенты не найдены</div>
                        )}
                      </div>
                    )}
                  </div>

                  {!clientSearch && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between pl-1">
                        <span className="text-[10px] text-slate-500 font-mono uppercase tracking-widest">Частые покупатели:</span>
                        {frequentCustomers.length > 0 && (
                          <div className="flex gap-1">
                            <button
                              type="button"
                              onClick={() => scrollFrequent('left')}
                              className="p-1 bg-[#161920] hover:bg-[#1f222e] border border-slate-800 rounded-lg text-slate-400 hover:text-slate-200 transition cursor-pointer"
                              title="Назад"
                            >
                              <ChevronLeft className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => scrollFrequent('right')}
                              className="p-1 bg-[#161920] hover:bg-[#1f222e] border border-slate-800 rounded-lg text-slate-400 hover:text-slate-200 transition cursor-pointer"
                              title="Вперед"
                            >
                              <ChevronRight className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                      </div>
                      <div
                        ref={frequentScrollRef}
                        className="flex gap-2 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-slate-800 scrollbar-track-slate-900/10 scrollbar-thumb-rounded-full scrollbar-track-rounded-full"
                      >
                        {frequentCustomers.map(c => (
                          <button
                            key={c.id}
                            type="button"
                            onClick={() => setSelectedCustomerId(c.id)}
                            className="flex items-center gap-2.5 bg-[#161920] border border-slate-850 hover:border-emerald-500/40 hover:bg-[#1e212b] rounded-2xl p-2 transition shrink-0 text-left min-w-[130px] cursor-pointer"
                          >
                            <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center font-bold text-xs shrink-0 border border-emerald-500/10">
                              {c.name.substring(0, 1).toUpperCase()}
                            </div>
                            <div className="flex flex-col min-w-0">
                              <span className="text-xs font-bold text-slate-200 truncate max-w-[85px]" title={c.name}>{c.name}</span>
                              <span className="inline-flex items-center bg-emerald-500/10 text-emerald-450 text-emerald-400 text-[8px] font-black font-mono px-1.5 py-0.5 rounded mt-0.5 w-max">
                                Покупок: {c.purchaseCount}
                              </span>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="bg-emerald-500/5 p-3 rounded-xl border border-emerald-500/20 flex flex-col gap-2">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold text-lg shrink-0 border border-emerald-500/30">
                      {selectedCustomer?.name.substring(0, 1).toUpperCase()}
                    </div>
                    <div>
                      <h4 className="font-bold text-emerald-400 text-sm tracking-tight">{selectedCustomer?.name}</h4>
                      <p className="text-[10px] font-mono text-emerald-500/70">{selectedCustomer?.phone}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-[10px] text-slate-300 bg-black/20 p-2 rounded-lg mt-1 border border-slate-800">
                    <div>
                      Скидка: <span className="font-bold text-emerald-400">{selectedCustomer?.discountPercent}%</span>
                    </div>
                    <div>
                      Лимит: <span className="font-bold text-slate-300 font-mono">{selectedCustomer?.debtLimit} руб.</span>
                    </div>
                    <div>
                      Долг: <span className="font-bold text-slate-300 font-mono">{selectedCustomer?.debt} руб.</span>
                    </div>
                  </div>
                </div>
              )}

              {!selectedCustomerId && (
                <div className="flex items-center gap-2 mt-2 pt-2 border-t border-slate-800/80 cursor-default opacity-60">
                  <div className="w-6 h-6 rounded-full bg-slate-800 text-slate-400 flex items-center justify-center font-bold text-[10px] shrink-0">
                    ?
                  </div>
                  <span className="text-xs font-bold text-slate-400">Анонимный / Быстрый клиент</span>
                </div>
              )}
            </div>

            {/* PAYMENT METHODS SELECTOR */}
            <div className="bg-[#1C1E26]/60 p-4 rounded-xl border border-slate-800 space-y-3">
              <span className="text-xs font-bold text-blue-400 uppercase tracking-wide block font-mono">Способ Произведения Расчета:</span>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                <button
                  onClick={() => setPaymentMethod('CASH')}
                  className={`p-2.5 rounded-xl border text-xs font-semibold flex flex-col items-center gap-1.5 transition ${paymentMethod === 'CASH'
                      ? 'bg-blue-600 border-blue-700 text-white shadow-lg shadow-blue-900/40 font-bold'
                      : 'bg-[#1C1E26] text-slate-400 hover:bg-[#21242e] border-slate-800 hover:text-slate-200'
                    }`}
                >
                  <Banknote className="w-5 h-5 animate-pulse" />
                  Наличные
                </button>
                <button
                  onClick={() => setPaymentMethod('CARD')}
                  className={`p-2.5 rounded-xl border text-xs font-semibold flex flex-col items-center gap-1.5 transition ${paymentMethod === 'CARD'
                      ? 'bg-blue-600 border-blue-700 text-white shadow-lg shadow-blue-900/40 font-bold'
                      : 'bg-[#1C1E26] text-slate-400 hover:bg-[#21242e] border-slate-800 hover:text-slate-200'
                    }`}
                >
                  <CreditCard className="w-5 h-5" />
                  Карта / Безнал
                </button>
                <button
                  onClick={() => setPaymentMethod('DEBT')}
                  className={`p-2.5 rounded-xl border text-xs font-semibold flex flex-col items-center gap-1.5 transition ${paymentMethod === 'DEBT'
                      ? 'bg-blue-600 border-blue-700 text-white shadow-lg shadow-blue-900/40 font-bold'
                      : 'bg-[#1C1E26] text-slate-400 hover:bg-[#21242e] border-slate-800 hover:text-slate-200'
                    }`}
                >
                  <UserCheck className="w-5 h-5" />
                  Записать в долг
                </button>
                <button
                  onClick={() => setPaymentMethod('SPLIT')}
                  className={`p-2.5 rounded-xl border text-xs font-semibold flex flex-col items-center gap-1.5 transition ${paymentMethod === 'SPLIT'
                      ? 'bg-blue-600 border-blue-700 text-white shadow-lg shadow-blue-900/40 font-bold'
                      : 'bg-[#1C1E26] text-slate-400 hover:bg-[#21242e] border-slate-800 hover:text-slate-200'
                    }`}
                >
                  <Sparkles className="w-5 h-5" />
                  Смешанный
                </button>
              </div>

              {paymentMethod === 'SPLIT' && (
                <div className="grid grid-cols-2 gap-3 pt-2">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 font-mono">Оплата наличными (руб.):</label>
                    <input
                      type="number"
                      value={cashAmountStr}
                      onChange={(e) => setCashAmountStr(e.target.value)}
                      className="w-full bg-[#1C1E26] border border-slate-800 p-2 rounded-lg text-xs font-semibold text-slate-200"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 font-mono">Оплата картой (руб.):</label>
                    <input
                      type="number"
                      value={cardAmountStr}
                      onChange={(e) => setCardAmountStr(e.target.value)}
                      className="w-full bg-[#1C1E26] border border-slate-800 p-2 rounded-lg text-xs font-semibold text-slate-200"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* CHECKOUT BOX */}
            <div className="border-t border-slate-800 pt-4 space-y-4">
              <div className="space-y-2 text-xs">
                <div className="flex justify-between text-slate-500">
                  <span>Сумма до скидки:</span>
                  <span className="font-semibold font-mono text-slate-300">{totalBeforeDiscount} руб.</span>
                </div>
                {totalDiscount > 0 && (
                  <div className="flex justify-between text-emerald-400 font-medium">
                    <span>Общая скидка торговой точки:</span>
                    <span className="font-mono">-{totalDiscount} руб.</span>
                  </div>
                )}
                <div className="flex justify-between text-sm font-extrabold text-slate-200 border-t border-slate-800 pt-2">
                  <span>ИТОГО К ОПЛАТЕ:</span>
                  <span className="text-lg text-blue-400 font-black font-semibold">{finalPrice} руб.</span>
                </div>
              </div>

              {/* Simple Cash-Back Calculator */}
              {paymentMethod === 'CASH' && (
                <div className="flex flex-col sm:flex-row shadow-lg bg-[#1C1E26] p-4 rounded-xl border border-slate-800 gap-4 items-center justify-between">
                  <div className="w-full sm:w-auto">
                    <span className="text-[10px] font-bold text-slate-500 block uppercase font-mono">Внесено клиентом (руб.):</span>
                    <input
                      type="text"
                      placeholder={`${finalPrice}...`}
                      value={cashAmountStr}
                      onChange={(e) => setCashAmountStr(e.target.value)}
                      className="bg-transparent text-white font-black text-lg focus:outline-none w-full font-mono"
                    />
                  </div>
                  <div className="text-right shrink-0">
                    <span className="text-[10px] font-bold text-slate-500 block uppercase font-mono">Сдача к выдаче:</span>
                    <span className="text-xl font-black text-emerald-400 font-mono">{changeValue} руб.</span>
                  </div>
                </div>
              )}

              {/* Checkout Button */}
              <button
                onClick={handleCheckout}
                disabled={cart.length === 0}
                className={`w-full py-3.5 rounded-2xl text-sm font-bold flex items-center justify-center gap-2 shadow-md transition-all ${cart.length === 0
                    ? 'bg-slate-800 text-slate-600 cursor-not-allowed'
                    : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-900/30'
                  }`}
              >
                <Printer className="w-4 h-4" />
                Пробить Чек (Выдать накладную)
              </button>
            </div>
          </>
        )}
      </div>

      {/* RIGHT: High speed search & Tap product grid for fast cashier work */}
      <div className="xl:col-span-5 bg-[#161920] md:p-5 rounded-2xl md:border border-slate-800/80 md:shadow-2xl flex flex-col h-auto xl:h-[calc(100vh-120px)] xl:overflow-hidden relative">
        <div className="sticky top-0 z-10 bg-[#161920] p-4 md:p-0 pb-3 border-b border-slate-800/80 md:border-b-0">
          <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 font-mono hidden md:block">Каталог товаров</h3>
          <div className="relative">
            <Search className="w-5 h-5 text-slate-500 absolute left-4 top-3" />
            <input
              type="text"
              placeholder="Штрихкод, артикул, название..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-[#1C1E26] border border-slate-700 pl-11 pr-4 py-3 min-h-[44px] rounded-xl text-sm text-slate-200 focus:ring-2 focus:ring-blue-500 shadow-inner appearance-none"
            />
          </div>

          {/* Scrolling Category Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto py-2.5 mt-2.5 -mx-4 px-4 md:mx-0 md:px-0 scroll-smooth no-scrollbar select-none">
            {['Все', ...Array.from(new Set(products.map(p => p.category)))].map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider transition-all cursor-pointer whitespace-nowrap border shrink-0 ${selectedCategory === cat
                    ? 'bg-blue-600 border-blue-500 text-white shadow-md shadow-blue-900/40'
                    : 'bg-[#1C1E26] border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-750'
                  }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Product Grid Panel (One Click add to cart) */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-2 gap-3 px-4 md:px-0 py-2 md:py-0 overflow-y-auto xl:flex-1 xl:min-h-0 pb-24 md:pb-0 content-start">
          {filterProducts.length === 0 ? (
            <div className="col-span-full py-16 text-center text-slate-500 bg-[#1C1E26]/20 rounded-2xl border border-dashed border-slate-800/60 m-4 flex flex-col items-center justify-center">
              <Package className="w-10 h-10 text-slate-600 mb-2.5 animate-pulse" />
              <p className="text-xs font-bold text-slate-400">Товары не найдены</p>
              <p className="text-[10px] text-slate-500 mt-1.5 max-w-[200px] leading-relaxed">
                Попробуйте изменить поисковый запрос или выбрать другую категорию.
              </p>
            </div>
          ) : (
            filterProducts.map((p) => {
              const isOutOfStock = p.stock <= 0;
              const stockLevel = p.stock > 10 ? 'high' : p.stock > 0 ? 'low' : 'out';
              const cartItem = cart.find(item => item.product.id === p.id);
              const isInCart = !!cartItem;

              return (
                <button
                  key={p.id}
                  onClick={() => handleAddById(p.id)}
                   className={`flex flex-col h-full min-h-[195px] xl:min-h-[250px] rounded-2xl border text-left active:scale-[0.98] hover:shadow-lg transition-all duration-200 relative select-none overflow-hidden group cursor-pointer ${isOutOfStock
                      ? 'bg-[#1C1E26] border-slate-800/50 opacity-60'
                      : isInCart
                        ? 'bg-blue-900/40 border-blue-500 ring-2 ring-blue-500/50 text-white shadow-[0_0_15px_rgba(59,130,246,0.2)]'
                        : 'bg-[#1C1E26] hover:bg-[#252836] border-slate-800 text-slate-200 shadow-sm'
                    }`}
                >
                  {/* Visual Thumbnail */}
                  <div className={`w-full aspect-video ${isInCart ? 'bg-blue-900/60' : 'bg-[#12151B]'} border-b ${isInCart ? 'border-blue-500/30' : 'border-slate-800/80'} flex items-center justify-center p-3 relative shrink-0 transition-colors`}>
                    {p.imageUrl ? (
                      <img src={p.imageUrl} alt={p.name} className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-300 drop-shadow-md" referrerPolicy="no-referrer" />
                    ) : (
                      <Package className={`w-8 h-8 opacity-40 ${isInCart ? 'text-blue-300' : 'text-slate-500 group-hover:scale-110 transition-transform'}`} />
                    )}
                    {isInCart && (
                      <div className="absolute top-2 right-2 bg-blue-500 text-white w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black shadow-md shadow-blue-900/50 z-10 border border-blue-400">
                        x{cartItem.quantity}
                      </div>
                    )}

                    {/* Color-Coded Stock Badge Overlay */}
                    <div className={`absolute bottom-2 left-2 flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[9px] font-black tracking-wide border shadow-sm backdrop-blur-md ${stockLevel === 'high' ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' :
                        stockLevel === 'low' ? 'bg-amber-500/20 text-amber-400 border-amber-500/30' :
                          'bg-rose-500/20 text-rose-400 border-rose-500/30'
                      }`}>
                      <div className={`w-1.5 h-1.5 rounded-full ${stockLevel === 'high' ? 'bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.8)]' :
                          stockLevel === 'low' ? 'bg-amber-400 shadow-[0_0_6px_rgba(251,191,36,0.8)]' :
                            'bg-rose-400 shadow-[0_0_6px_rgba(244,63,94,0.8)]'
                        }`} />
                      {isOutOfStock ? 'НЕТ ПРОД' : `В НАЛИЧИИ: ${p.stock}`}
                    </div>
                  </div>

                  {/* Card Content Details */}
                  <div className="p-3 pt-2.5 flex flex-col justify-between flex-1  shrink-0 gap-1 w-full relative">
                    <div className="font-bold text-xs leading-tight line-clamp-2 text-slate-200 min-h-[32px] group-hover:text-blue-300 transition-colors">
                      {p.name}
                    </div>

                    <div className="flex items-end justify-between mt-1">
                      <span className="font-black text-sm text-white tracking-tight">
                        {p.priceSell} <span className="text-[10px] text-slate-500 ml-0.5 font-semibold font-mono">руб.</span>
                      </span>
                      <span className="text-[9px] font-mono text-slate-500 block truncate max-w-[50%] text-right">
                        Арт: <span className="text-slate-400 font-bold">{p.sku}</span>
                      </span>
                    </div>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* RENDER FISCAL CHECK OUT / THERMAL PRINTER MODAL */}
      {receiptToShow && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-sm z-[120] flex items-center justify-center p-4">
          <div className="bg-[#0A0C10] rounded-3xl p-6 w-full max-w-sm border border-slate-800/80 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto text-slate-200">

            <div className="text-center pb-2 border-b border-dashed border-slate-800">
              <h3 className="font-extrabold text-white tracking-tight text-sm">МАГАЗИН &quot;1000 МЕЛОЧЕЙ&quot;</h3>
              <p className="text-[9px] text-slate-500">Рынок &quot;Караван&quot;, корпус 10, бокс 10.8</p>
              <p className="text-[9px] text-slate-500">Тел: +7 9088101002 </p>
            </div>

            <div className="space-y-1.5 text-[11px] font-mono text-slate-300">
              <p className="flex justify-between">
                <span>Чек номер:</span>
                <span className="font-bold text-blue-400"># {receiptToShow.id.split('-').pop()?.toUpperCase() || receiptToShow.id.toUpperCase()}</span>
              </p>
              <p className="flex justify-between">
                <span>Дата:</span>
                <span>{new Date(receiptToShow.timestamp).toLocaleString('ru-RU')}</span>
              </p>
              <p className="flex justify-between">
                <span>Кассир:</span>
                <span>{cashierName}</span>
              </p>
              {receiptToShow.customer && (
                <p className="flex justify-between text-blue-400 font-semibold">
                  <span>Клиент CRM:</span>
                  <span>{receiptToShow.customer.name}</span>
                </p>
              )}
            </div>

            <div className="border-t border-b border-dashed border-slate-800 py-3 space-y-1 text-slate-300 font-mono text-[10px]">
              {receiptToShow.items.map((item: any, i: number) => (
                <div key={i} className="flex justify-between">
                  <div className="flex-1 pr-3">
                    <span className="block text-slate-200">{item.productName}</span>
                    <span className="text-slate-500">{item.quantity} шт x {item.priceSell} руб.</span>
                  </div>
                  <span className="font-bold shrink-0 text-slate-200">{(item.priceSell * item.quantity)} руб.</span>
                </div>
              ))}
            </div>

            <div className="space-y-1 font-mono text-[11px] text-slate-300">
              <div className="flex justify-between text-[10px] text-slate-500">
                <span>Итого до скидки:</span>
                <span>{receiptToShow.totalBeforeDiscount} руб.</span>
              </div>
              {receiptToShow.totalDiscount > 0 && (
                <div className="flex justify-between text-emerald-400 font-medium font-semibold">
                  <span>Скидка постоянного гостя:</span>
                  <span>-{receiptToShow.totalDiscount} руб.</span>
                </div>
              )}
              <div className="flex justify-between font-extrabold text-xs text-white border-t border-slate-800 pt-2">
                <span>КАССОВЫЙ ИТОГ:</span>
                <span className="text-sm text-blue-400">{receiptToShow.finalPrice} руб.</span>
              </div>
            </div>

            <div className="bg-[#1C1E26] p-2.5 rounded-lg border border-slate-800 text-[10px] font-mono text-slate-400 space-y-1">
              <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest block">Тип закрытия чека:</span>
              <p className="flex justify-between">
                <span>Наличный расчет:</span>
                <span>{receiptToShow.paymentMethod === 'CASH' || receiptToShow.paymentMethod === 'SPLIT' ? `${receiptToShow.paidCash} руб.` : '0 руб.'}</span>
              </p>
              <p className="flex justify-between">
                <span>По безналичному расчету (Карта):</span>
                <span>{receiptToShow.paymentMethod === 'CARD' || receiptToShow.paymentMethod === 'SPLIT' ? `${receiptToShow.paidCard} ` : '0'} руб.</span>
              </p>
              <p className="flex justify-between">
                <span>Записано в реестр долгов:</span>
                <span className="text-rose-400 font-bold">{receiptToShow.paidDebt} руб.</span>
              </p>
            </div>

            {/* Simulated Fiscal QR Code */}
            <div className="flex flex-col items-center justify-center space-y-1 bg-[#161920] py-3 rounded-2xl border border-slate-800">
              <QrCode className="w-16 h-16 text-slate-400" />
              <span className="text-[8px] font-mono text-slate-500">ФП: 9942398402 | ФД: 10423</span>
              <span className="text-[9px] text-blue-400 font-bold tracking-wider uppercase font-mono">ОФД ПРОВЕДЕНО</span>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => {
                  alert('Имитация: Печать чека на Bluetooth-термопринтер 58мм завершена успешно!');
                  setReceiptToShow(null);
                }}
                className="flex-1 py-1.5 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5" />
                Печать термочека
              </button>
              <button
                onClick={() => setReceiptToShow(null)}
                className="py-1.5 px-3 border border-slate-800 rounded-xl hover:bg-slate-850 text-xs text-slate-300 font-semibold cursor-pointer"
              >
                Закрыть
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Barcode Scanner Modal */}
      {isScanning && (
        <BarcodeScanner
          products={products}
          onClose={() => setIsScanning(false)}
          onScanSuccess={(barcode) => {
            const product = products.find(p => p.barcode === barcode);
            if (product) {
              handleAddById(product.id);
            } else {
              setScannerFeedback(`Штрихкод ${barcode} не найден`);
              setTimeout(() => setScannerFeedback(''), 3000);
            }
            setIsScanning(false);
          }}
          placeholderText="Ожидаю штрихкод..."
        />
      )}
    </div>
  );
}
