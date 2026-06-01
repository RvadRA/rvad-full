/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Customer, DebtPayment } from '../types';
import { ShieldAlert, Send, Banknote, CreditCard, Sparkles, MessageSquare, Bell, Calendar, RefreshCcw, FileDown, Link, QrCode, X, Search } from 'lucide-react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { api } from '../utils/api';
import { QRCodeSVG } from 'qrcode.react';

interface DebtTrackerProps {
  customers: Customer[];
  debtPayments: DebtPayment[];
  onAddDebtPayment: (customerId: string, amount: number, method: 'CASH' | 'CARD') => void;
  onUpdateCustomer?: (customer: Customer) => void;
}

export default function DebtTracker({
  customers,
  debtPayments,
  onAddDebtPayment,
  onUpdateCustomer
}: DebtTrackerProps) {
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
  const [paymentAmount, setPaymentAmount] = useState<number>(0);
  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'CARD'>('CASH');

  // Telegram states
  const [tgLogMsg, setTgLogMsg] = useState<string>('');
  const [telegramStatus, setTelegramStatus] = useState<string>('');
  const [showTgModal, setShowTgModal] = useState<boolean>(false);
  const [tgChatId, setTgChatId] = useState<string>('');
  const [tgCustomer, setTgCustomer] = useState<Customer | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [qrCustomer, setQrCustomer] = useState<Customer | null>(null);

  const [searchQuery, setSearchQuery] = useState('');

  const selectedCustomer = customers.find(c => c.id === selectedCustomerId);

  // Filter customers based on search query
  const filteredCustomers = customers.filter(c => 
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.phone?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.notes?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Math
  const totalOutstandingDebts = Math.round(customers.reduce((sum, c) => sum + c.debt, 0));
  const creditLimitExceededCount = customers.filter(c => c.debt > c.debtLimit).length;

  const handleCopyInviteLink = (customer: Customer, showOnlyQr = false) => {
    if (!showOnlyQr) {
      setQrCustomer(customer);
      return;
    }
    // Generate the official deep-link format specified in the requirements
    const botUsername = 'melochey_control_bot';
    const linkText = `https://t.me/${botUsername}?start=client_${customer.id}`;
    
    navigator.clipboard.writeText(linkText).then(() => {
      setCopiedId(customer.id);
      setTimeout(() => setCopiedId(null), 3000);
    }).catch(err => {
      console.error('Failed to copy text: ', err);
    });
  };

  const handleRepaySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustomerId || paymentAmount <= 0) return;
    
    if (selectedCustomer && paymentAmount > selectedCustomer.debt) {
      alert(`Внимание! Сумма погашения (${paymentAmount} р.) превышает текущий начисленный долг (${selectedCustomer.debt} р.)!`);
      return;
    }

    onAddDebtPayment(selectedCustomerId, paymentAmount, paymentMethod);
    setPaymentAmount(0);
    setSelectedCustomerId('');
  };

  const handleTgClick = async (customer: Customer) => {
    if (customer.debt <= 0) return;
    
    if (customer.telegramChatId) {
      // Auto-send if we know the chat ID
      await sendTelegramAlert(customer, customer.telegramChatId);
    } else {
      // Request manually if missing
      setTgCustomer(customer);
      setTgChatId('');
      setShowTgModal(true);
    }
  };

  const simulateTelegramAlert = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tgCustomer || !tgChatId) return;

    setShowTgModal(false);
    await sendTelegramAlert(tgCustomer, tgChatId);
  };

  const sendTelegramAlert = async (customer: Customer, chatId: string) => {
    setTelegramStatus('SENDING');
    
    const dateStr = new Date().toLocaleDateString('ru-RU');
    const msgTemplate = `НАПОМИНАНИЕ О ДОЛГЕ (Бот магазина "1000 Мелочей")\n\n` +
      `Уважаемый(а) ${customer.name},\n` +
      `Просим Вас обратить внимание на Вашу задолженность в магазине "1000 Мелочей" по состоянию на ${dateStr}.\n\n` +
      `💰 Текущая сумма долга: ${customer.debt} руб.\n` +
      `⚠️ Кредитный лимит доверия: ${customer.debtLimit} руб.\n\n` +
      `Вы можете закрыть долг наличными кассиру либо перевести по СБП в торговой точке. Благодарим за честность!`;

    try {
      const data = await api.telegram.send(chatId, msgTemplate, 'client');
      
      if (data.ok) {
        setTelegramStatus('SUCCESS');
        setTgLogMsg(msgTemplate);
        
        if (onUpdateCustomer && !customer.telegramChatId) {
          onUpdateCustomer({ ...customer, telegramChatId: chatId });
        }
      } else {
        throw new Error(data.description || 'Неизвестная ошибка API Telegram');
      }
    } catch (err: any) {
      setTelegramStatus('');
      console.error(`Ошибка при отправке в Telegram: ${err.message}`);
    }
  };

  const handleDownloadReport = () => {
    // Collect only customers with active debts
    const debtors = customers.filter(c => c.debt > 0);
    const dateStr = new Date().toLocaleDateString('ru-RU');
    const timeStr = new Date().toLocaleTimeString('ru-RU');
    
    // Add BOM for Excel utf-8 recognition
    let csvContent = "\uFEFF";
    csvContent += `ОТЧЕТ ПО ДОЛЖНИКАМ\n`;
    csvContent += `Дата создания:;${dateStr} ${timeStr}\n`;
    csvContent += `Общее количество должников:;${debtors.length}\n`;
    csvContent += `Общая сумма долгов:;${totalOutstandingDebts}\n\n`;
    
    csvContent += `ФИО / Имя Клиента;Номер телефона;Текущий долг (руб);Кредитный лимит (руб);Остаток лимита (руб);Дата последнего платежа/записи\n`;
    
    debtors.forEach(c => {
      const remain = c.debtLimit >= c.debt ? c.debtLimit - c.debt : 0;
      // Get the last payment date simply from debtPayments array if available
      const cPayments = debtPayments.filter(dp => dp.customerId === c.id);
      let lastDateStr = "Нет данных";
      if (cPayments.length > 0) {
        // Sort by dates descending
        cPayments.sort((a,b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
        lastDateStr = new Date(cPayments[0].timestamp).toLocaleDateString('ru-RU');
      }

      csvContent += `"${c.name}";"${c.phone}";${c.debt};${c.debtLimit};${remain};"${lastDateStr}"\n`;
    });
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `debt_report_${dateStr.replace(/\//g,'-')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handlePrintPdfReport = async () => {
    const debtors = customers.filter(c => c.debt > 0);
    const dateStr = new Date().toLocaleDateString('ru-RU');
    const timeStr = new Date().toLocaleTimeString('ru-RU');

    const container = document.createElement('div');
    container.style.position = 'absolute';
    container.style.top = '-9999px';
    container.style.left = '-9999px';
    container.style.width = '800px';
    container.style.padding = '40px';
    container.style.backgroundColor = '#ffffff';
    container.style.color = '#000000';
    container.style.fontFamily = 'sans-serif';

    let html = `
      <h1 style="font-size: 24px; margin-bottom: 5px;">ОТЧЕТ ПО ДОЛЖНИКАМ</h1>
      <div style="font-size: 14px; margin-bottom: 20px; color: #666;">
        Дата формирования: <strong>${dateStr} ${timeStr}</strong><br/>
        Количество должников: <strong>${debtors.length}</strong><br/>
        Общая сумма долгов: <strong>${totalOutstandingDebts.toLocaleString('ru-RU')} ₽</strong>
      </div>
      <table style="width: 100%; border-collapse: collapse; margin-top: 20px; font-size: 13px;">
        <thead>
          <tr>
            <th style="border: 1px solid #ccc; padding: 8px 10px; text-align: left; background-color: #f5f5f5; font-weight: bold;">ФИО Клиента</th>
            <th style="border: 1px solid #ccc; padding: 8px 10px; text-align: left; background-color: #f5f5f5; font-weight: bold;">Телефон</th>
            <th style="border: 1px solid #ccc; padding: 8px 10px; text-align: left; background-color: #f5f5f5; font-weight: bold;">Дата посл. платежа</th>
            <th style="border: 1px solid #ccc; padding: 8px 10px; text-align: right; background-color: #f5f5f5; font-weight: bold;">Кредитный лимит</th>
            <th style="border: 1px solid #ccc; padding: 8px 10px; text-align: right; background-color: #f5f5f5; font-weight: bold;">Остаток лимита</th>
            <th style="border: 1px solid #ccc; padding: 8px 10px; text-align: right; background-color: #f5f5f5; font-weight: bold; color: #e53e3e;">Текущий долг</th>
          </tr>
        </thead>
        <tbody>
    `;

    debtors.forEach(c => {
      const remain = c.debtLimit >= c.debt ? c.debtLimit - c.debt : 0;
      const cPayments = debtPayments.filter(dp => dp.customerId === c.id);
      let lastDateStr = "—";
      if (cPayments.length > 0) {
        cPayments.sort((a,b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
        lastDateStr = new Date(cPayments[0].timestamp).toLocaleDateString('ru-RU');
      }

      html += `
        <tr>
          <td style="border: 1px solid #ccc; padding: 8px 10px;">${c.name}</td>
          <td style="border: 1px solid #ccc; padding: 8px 10px;">${c.phone || '—'}</td>
          <td style="border: 1px solid #ccc; padding: 8px 10px;">${lastDateStr}</td>
          <td style="border: 1px solid #ccc; padding: 8px 10px; text-align: right;">${c.debtLimit.toLocaleString('ru-RU')}</td>
          <td style="border: 1px solid #ccc; padding: 8px 10px; text-align: right;">${remain.toLocaleString('ru-RU')}</td>
          <td style="border: 1px solid #ccc; padding: 8px 10px; text-align: right; color: #e53e3e; font-weight: bold;">${c.debt.toLocaleString('ru-RU')}</td>
        </tr>
      `;
    });

    html += `
        </tbody>
      </table>
    `;

    container.innerHTML = html;
    document.body.appendChild(container);

    try {
      const canvas = await html2canvas(container, { scale: 2, useCORS: true });
      const imgData = canvas.toDataURL('image/png');
      
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      
      let heightLeft = pdfHeight;
      let position = 0;
      const pageHeight = pdf.internal.pageSize.getHeight();

      pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, pdfHeight);
      heightLeft -= pageHeight;

      while (heightLeft >= 0) {
        position = heightLeft - pdfHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, pdfHeight);
        heightLeft -= pageHeight;
      }
      
      pdf.save(`debt_report_${dateStr.replace(/\//g,'-')}.pdf`);
    } catch (err) {
      console.error('Error generating PDF:', err);
      alert('Ошибка при создании PDF-отчета.');
    } finally {
      document.body.removeChild(container);
    }
  };

  return (
    <div className="space-y-6">
      {/* Debt KPI blocks */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-[#161920] border border-slate-800/80 p-5 rounded-2xl shadow-2xl">
          <span className="text-[10px] uppercase font-bold text-slate-500 font-mono">Общая задолженность клиентов</span>
          <p className="text-2xl font-black text-rose-450 text-rose-400 mt-1 font-mono">{totalOutstandingDebts.toLocaleString()} руб.</p>
          <span className="text-[9px] text-slate-500 font-mono block mt-1">Сумма всех долговых обязательств в CRM</span>
        </div>

        <div className="bg-[#161920] border border-slate-800/80 p-5 rounded-2xl shadow-2xl">
          <span className="text-[10px] uppercase font-bold text-slate-500 font-mono">Превышение кредитного лимита</span>
          <p className="text-2xl font-black text-amber-500 mt-1 font-mono">{creditLimitExceededCount} чел.</p>
          <span className="text-[9px] text-slate-500 font-mono block mt-1">Критические нарушения порога доверия</span>
        </div>

        <div className="bg-[#161920] border border-slate-800/80 p-5 rounded-2xl shadow-2xl">
          <span className="text-[10px] uppercase font-bold text-slate-500 font-mono">Состояние СБП / Сверяемость</span>
          <div className="flex items-center gap-1.5 mt-1.5">
            <div className="w-2.5 h-2.5 bg-emerald-500 rounded-full animate-pulse" />
            <span className="text-sm font-bold text-emerald-400">Касса и реестр синхронны</span>
          </div>
          <span className="text-[9px] text-slate-500 font-mono block mt-1">Офлайн буферы сверены</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Debtors List */}
        <div className="lg:col-span-8 bg-[#161920] p-5 rounded-2xl border border-slate-800/80 shadow-2xl space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800/60">
            <h3 className="text-sm font-bold text-white flex items-center gap-1.5 w-full sm:w-auto shrink-0">
              <ShieldAlert className="w-4 h-4 text-rose-500" /> Долги
            </h3>
            
            <div className="relative w-full sm:max-w-xs">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pt-pointer-events-none">
                <Search className="h-4 w-4 text-slate-500" />
              </div>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Поиск по имени, телефону..."
                className="w-full bg-[#1C1E26] border border-slate-700/80 pl-9 pr-3 py-2 rounded-xl text-sm text-slate-200 focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 placeholder-slate-500 transition-colors"
              />
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <div className="flex bg-[#12151B] border border-slate-700/80 rounded-xl overflow-hidden shadow-sm">
                <button
                  type="button"
                  onClick={handleDownloadReport}
                  className="px-3 py-1.5 hover:bg-slate-800 text-slate-300 border-r border-slate-700/80 text-xs font-bold transition flex items-center gap-1.5"
                  title="Скачать отчет в формате CSV (Excel)"
                >
                  <FileDown className="w-3.5 h-3.5 text-emerald-400" /> Excel
                </button>
                <button
                  type="button"
                  onClick={handlePrintPdfReport}
                  className="px-3 py-1.5 hover:bg-slate-800 text-slate-300 text-xs font-bold transition flex items-center gap-1.5"
                  title="Распечатать или сохранить как PDF"
                >
                  <FileDown className="w-3.5 h-3.5 text-rose-400" /> PDF
                </button>
              </div>
              <span className="text-[10px] bg-rose-500/10 text-rose-400 px-2.5 py-0.5 rounded-full font-bold border border-rose-500/20 whitespace-nowrap hidden sm:inline">
                Построчный Свод
              </span>
            </div>
          </div>

          {/* Desktop Table - Hidden on Mobile */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-800/60 text-slate-500 font-bold uppercase tracking-wider font-mono text-[10px]">
                  <th className="pb-3 text-left">Контрагент / Клиент</th>
                  <th className="pb-3 text-right">Текущий Долг</th>
                  <th className="pb-3 text-right">Порог кредита</th>
                  <th className="pb-3 text-center">Telegram напомнитель</th>
                  <th className="pb-3 text-right">Оплата долга</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/40">
                {filteredCustomers.map((c) => {
                  const isOverlimit = c.debt > c.debtLimit;
                  return (
                    <tr key={c.id} className="hover:bg-slate-800/40 text-slate-300 transition">
                      <td className="py-3">
                        <span className="font-bold text-white block">{c.name}</span>
                        <span className="text-[10px] text-slate-500 font-mono">{c.phone}</span>
                        {c.notes && <p className="text-[10px] italic text-indigo-400 mt-0.5">{c.notes}</p>}
                      </td>
                      <td className="py-3 text-right font-mono font-black text-rose-400">
                        {c.debt.toLocaleString()} руб.
                      </td>
                      <td className="py-3 text-right font-mono text-slate-500">
                        {c.debtLimit.toLocaleString()} руб.
                      </td>
                      <td className="py-3 text-center">
                        {c.telegramChatId ? (
                          <div className="inline-flex flex-col items-center">
                            <button
                              onClick={() => handleTgClick(c)}
                              className={`px-2 py-1 rounded-lg border text-[11px] font-bold inline-flex items-center gap-1 transition-all cursor-pointer bg-emerald-500/10 text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/20`}
                              title="Оповестить должника в Telegram"
                            >
                              <Send className="w-2.5 h-2.5" />
                              Напомнить
                            </button>
                            <span className="text-[8px] text-slate-500 font-mono mt-0.5">ID: {c.telegramChatId}</span>
                          </div>
                        ) : (
                           <button
                            onClick={() => handleCopyInviteLink(c)}
                            className={`px-2 py-1 rounded-lg border text-[11px] font-bold inline-flex items-center gap-1 transition-all cursor-pointer ${
                              copiedId === c.id 
                                ? 'bg-emerald-600 border-emerald-600 text-white' 
                                : 'bg-sky-500/10 text-sky-400 border-sky-500/20 hover:bg-sky-500/20'
                            }`}
                            title="Скопировать пригласительную ссылку для привязки"
                          >
                            <Link className="w-2.5 h-2.5" />
                            {copiedId === c.id ? 'Скопировано!' : 'Привязать'}
                          </button>
                        )}
                      </td>
                      <td className="py-3 text-right">
                        <button
                          onClick={() => {
                            setSelectedCustomerId(c.id);
                            setPaymentAmount(c.debt);
                          }}
                          disabled={c.debt === 0}
                          className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-45 text-white rounded-lg text-[10px] font-bold transition shadow-md cursor-pointer"
                        >
                          Внести зачет
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile responsive Cards - Shown only on Mobile */}
          <div className="block md:hidden space-y-3.5">
            {filteredCustomers.map((c) => {
              const isOverlimit = c.debt > c.debtLimit;
              return (
                <div 
                  key={c.id} 
                  className={`p-4 rounded-2xl border transition-all ${
                    isOverlimit 
                      ? 'bg-rose-950/20 border-rose-500/30 shadow-2xl' 
                      : 'bg-[#1C1E26]/50 border-slate-800/80 hover:bg-[#1C1E26]'
                  }`}
                >
                  <div className="flex justify-between items-start gap-2">
                    <div>
                      <span className="font-extrabold text-white text-sm block leading-tight">{c.name}</span>
                      <span className="text-[11px] text-slate-400 font-mono mt-0.5 block">{c.phone}</span>
                      {c.notes && <p className="text-[10px] italic text-indigo-400 mt-1.5 leading-relaxed">{c.notes}</p>}
                    </div>
                    {isOverlimit && (
                      <span className="bg-rose-500/10 text-rose-450 border border-rose-500/20 text-[9px] font-black uppercase px-2 py-0.5 rounded-full tracking-wider whitespace-nowrap">
                        Превышен!
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-3 mt-4 border-t border-slate-800/40 pt-3 text-xs">
                    <div className="bg-[#12151B] p-2.5 rounded-xl border border-slate-800/40">
                      <span className="text-[9px] uppercase font-bold text-slate-500 block tracking-wide font-mono">Долг:</span>
                      <span className="font-extrabold font-mono text-sm text-rose-400 mt-0.5 block">{c.debt.toLocaleString()} руб.</span>
                    </div>
                    <div className="bg-[#12151B] p-2.5 rounded-xl border border-slate-800/40">
                      <span className="text-[9px] uppercase font-bold text-slate-500 block tracking-wide font-mono">Порог:</span>
                      <span className="font-mono text-xs text-slate-400 mt-0.5 block">{c.debtLimit.toLocaleString()} руб.</span>
                    </div>
                  </div>

                  <div className="flex gap-2.5 mt-3.5 pt-1">
                    {c.telegramChatId ? (
                      <button
                        type="button"
                        onClick={() => handleTgClick(c)}
                        className={`flex-1 h-11 flex items-center justify-center gap-1.5 rounded-xl border text-xs font-bold transition-all cursor-pointer bg-emerald-500/10 text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/20 active:scale-95`}
                      >
                        <Send className="w-4 h-4 text-emerald-400" />
                        ТГ Напомнить
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleCopyInviteLink(c)}
                        className={`flex-1 h-11 flex items-center justify-center gap-1.5 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                          copiedId === c.id 
                            ? 'bg-emerald-600 border-emerald-600 text-white' 
                            : 'bg-sky-500/10 text-sky-400 border-sky-500/20 hover:bg-sky-500/20 active:scale-95'
                        }`}
                      >
                        <Link className="w-4 h-4" />
                        {copiedId === c.id ? 'Скопировано!' : 'ТГ Привязать'}
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => {
                        setSelectedCustomerId(c.id);
                        setPaymentAmount(c.debt);
                      }}
                      disabled={c.debt === 0}
                      className="flex-1 h-11 bg-emerald-600 hover:bg-emerald-500 active:scale-95 disabled:opacity-40 text-white rounded-xl text-xs font-bold transition-all shadow-md flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Banknote className="w-4 h-4" />
                      Внести зачет
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Repayment and simulated Telegram Log Display */}
        <div className="lg:col-span-4 space-y-6">
          {/* Repayment box */}
          {selectedCustomerId ? (
            <div className="bg-[#161920] border border-emerald-500/30 p-5 rounded-2xl shadow-2xl space-y-4">
              <div>
                <span className="text-[10px] uppercase font-bold text-emerald-400 font-mono">Погашение Кредита</span>
                <h4 className="text-sm font-bold text-white mt-1">
                  Зачесть долг: {selectedCustomer?.name}
                </h4>
              </div>

              <form onSubmit={handleRepaySubmit} className="space-y-4 text-xs">
                <div>
                  <label className="block text-slate-400 font-semibold mb-1">Сумма к внесению (руб.):</label>
                  <input
                    type="number"
                    max={selectedCustomer?.debt}
                    value={paymentAmount}
                    onChange={(e) => setPaymentAmount(Number(e.target.value))}
                    className="w-full bg-[#1C1E26] border border-slate-800 p-2.5 rounded-xl font-black text-rose-450 text-rose-400 font-mono text-sm focus:outline-none focus:border-emerald-500"
                  />
                  <span className="text-[10px] text-slate-500 block mt-1">Останется долг: {(selectedCustomer ? selectedCustomer.debt - paymentAmount : 0)} руб.</span>
                </div>

                <div>
                  <label className="block text-slate-400 font-semibold mb-1">Касса назначения:</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setPaymentMethod('CASH')}
                      className={`flex items-center gap-1 justify-center py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                        paymentMethod === 'CASH'
                          ? 'bg-emerald-600 border-emerald-600 text-white shadow-lg'
                          : 'bg-[#1C1E26] border-slate-800 text-slate-400 hover:bg-slate-800'
                      }`}
                    >
                      <Banknote className="w-3.5 h-3.5" /> Наличные
                    </button>
                    <button
                      type="button"
                      onClick={() => setPaymentMethod('CARD')}
                      className={`flex items-center gap-1 justify-center py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                        paymentMethod === 'CARD'
                          ? 'bg-emerald-600 border-emerald-600 text-white shadow-lg'
                          : 'bg-[#1C1E26] border-slate-800 text-slate-400 hover:bg-slate-800'
                      }`}
                    >
                      <CreditCard className="w-3.5 h-3.5" /> Терминал
                    </button>
                  </div>
                </div>

                <div className="flex gap-2 pt-1">
                  <button
                    type="submit"
                    className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white font-black py-2.5 rounded-xl transition cursor-pointer text-xs active:scale-95 shadow-lg"
                  >
                    Зафиксировать оплату
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedCustomerId('')}
                    className="px-3 py-2.5 border border-slate-800 bg-[#1C1E26] text-slate-300 rounded-xl hover:text-white hover:bg-slate-850 font-bold transition text-xs cursor-pointer"
                  >
                    Отмена
                  </button>
                </div>
              </form>
            </div>
          ) : (
            <div className="bg-[#161920] border p-5 rounded-2xl border-slate-800/80 shadow-2xl text-center py-8 space-y-2">
              <Banknote className="w-8 h-8 text-slate-600 mx-auto" />
              <h4 className="text-xs font-bold text-white">Быстрое погашение</h4>
              <p className="text-[11px] text-slate-400 max-w-xs mx-auto leading-relaxed">
                Нажмите кнопку &quot;Внести зачет&quot; возле любого дебитора, чтобы провести оплату и уменьшить баланс долгов в CRM.
              </p>
            </div>
          )}

          {/* Telegram sandbox status log */}
          <div className="bg-slate-900 text-slate-100 p-5 rounded-2xl border border-slate-800 shadow-lg space-y-3">
            <div className="flex justify-between items-center pb-2 border-b border-slate-800">
              <h4 className="text-[11px] font-bold text-sky-400 uppercase tracking-widest font-mono flex items-center gap-1">
                <Bell className="w-3.5 h-3.5" /> эмулятор telegram bot
              </h4>
              <span className="text-[9px] font-mono text-slate-500">sandbox_logs</span>
            </div>
            
            {telegramStatus === 'SENDING' && (
              <div className="text-center py-6 space-y-2 font-mono text-xs">
                <RefreshCcw className="w-6 h-6 text-sky-400 animate-spin mx-auto" />
                <p className="text-slate-400">Формирование полезной нагрузки JSON и отправка хука...</p>
              </div>
            )}

            {telegramStatus === 'SUCCESS' && tgLogMsg && (
              <div className="space-y-3">
                <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 text-[10.5px] font-mono whitespace-pre-line leading-relaxed text-slate-300">
                  {tgLogMsg.replace(/<\/?[^>]+(>|$)/g, "") /* strip html for view */}
                </div>
                <div className="text-[10px] text-slate-400 italic">
                  * Бот моментально пересылает сообщение на мобильный телефон клиента.
                </div>
              </div>
            )}

            {!telegramStatus && (
              <p className="text-slate-500 italic text-[11px] font-mono text-center py-8">
                Оповещения в Телеграм не запускались в этой сессии. Попробуйте нажать кнопку &quot;ТГ Бот&quot; у Алибека или Нурбека.
              </p>
            )}
          </div>
        </div>
      </div>

      {showTgModal && tgCustomer && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#0A0C10] rounded-3xl p-6 w-full max-w-md border border-slate-800/80 shadow-2xl space-y-4">
            <h3 className="font-extrabold text-white text-lg flex items-center gap-2">
              <Send className="w-5 h-5 text-sky-400" />
              Отправка в Telegram
            </h3>
            
            <p className="text-xs text-slate-400">
              Вы хотите отправить оповещение о долге клиенту <span className="text-slate-200 font-bold">{tgCustomer.name}</span> на сумму <span className="text-rose-400 font-bold">{tgCustomer.debt} руб.</span>
            </p>

            <div className="bg-[#1C1E26] p-4 rounded-2xl border border-slate-800 space-y-2.5">
              <span className="text-[10px] text-sky-400 font-extrabold uppercase font-mono tracking-wide">💡 Автоматическая привязка (Deep Linking):</span>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Вы можете отправить клиенту ссылку. При клике на Старт бот свяжется с его аккаунтом автоматически:
              </p>
              <button
                type="button"
                onClick={() => handleCopyInviteLink(tgCustomer, true)}
                className={`w-full py-2 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 border ${
                  copiedId === tgCustomer.id 
                    ? 'bg-emerald-600 border-emerald-600 text-white' 
                    : 'bg-sky-500/10 text-sky-400 border-sky-500/25 hover:bg-sky-500/20'
                }`}
              >
                <Link className="w-3.5 h-3.5" />
                {copiedId === tgCustomer.id ? 'Скопировано!' : 'Скопировать ссылку привязки'}
              </button>
            </div>

            <form onSubmit={simulateTelegramAlert} className="space-y-4 pt-2">
              <div className="space-y-1">
                <label className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">ID Чата Клиента (Chat ID)</label>
                <input
                  type="text"
                  required
                  value={tgChatId}
                  onChange={(e) => setTgChatId(e.target.value)}
                  className="w-full bg-[#1C1E26] border border-slate-700 p-2.5 rounded-xl text-white focus:border-sky-500 focus:outline-none font-mono text-sm"
                  placeholder="Например: 123456789"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button type="submit" className="flex-1 bg-sky-600 hover:bg-sky-500 text-white font-bold py-2.5 rounded-xl text-sm transition">
                  Отправить
                </button>
                <button
                  type="button"
                  onClick={() => setShowTgModal(false)}
                  className="px-5 border border-slate-700 text-slate-300 hover:bg-slate-800 rounded-xl text-sm font-bold transition"
                >
                  Отмена
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {qrCustomer && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[100] flex items-center justify-center p-4">
          <div className="bg-[#0A0C10] rounded-3xl p-8 w-full max-w-sm border border-slate-800/80 shadow-2xl text-center space-y-6 relative">
            <button 
              onClick={() => setQrCustomer(null)}
              className="absolute top-4 right-4 p-2 text-slate-500 hover:text-white hover:bg-slate-800 rounded-full transition"
            >
              <X className="w-5 h-5" />
            </button>
            
            <div className="space-y-2">
              <div className="w-12 h-12 bg-sky-500/10 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-sky-500/20">
                <QrCode className="w-6 h-6 text-sky-400" />
              </div>
              <h3 className="font-extrabold text-white text-xl">QR-код Клиента</h3>
              <p className="text-xs text-slate-400">
                Дайте клиенту <span className="text-white font-bold">{qrCustomer.name}</span> отсканировать этот код камерой телефона для мгновенной привязки к Telegram-боту.
              </p>
            </div>

            <div className="bg-white p-4 rounded-3xl inline-block shadow-xl mx-auto border-4 border-[#1C1E26]">
              <QRCodeSVG 
                value={`https://t.me/melochey_control_bot?start=client_${qrCustomer.id}`} 
                size={200} 
                level={"M"}
                includeMargin={false}
              />
            </div>

            <button
              type="button"
              onClick={() => handleCopyInviteLink(qrCustomer, true)}
              className={`w-full py-3 px-4 rounded-xl text-sm font-bold transition flex items-center justify-center gap-2 border ${
                copiedId === qrCustomer.id 
                  ? 'bg-emerald-600 border-emerald-600 text-white shadow-lg shadow-emerald-500/20' 
                  : 'bg-[#1C1E26] text-slate-300 border-slate-700 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <Link className="w-4 h-4" />
              {copiedId === qrCustomer.id ? 'Ссылка скопирована!' : 'Скопировать ссылку вручную'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
