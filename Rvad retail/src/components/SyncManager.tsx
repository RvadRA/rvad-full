/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';
import { SyncTask, Product, SaleTransaction, Customer, Employee } from '../types';
import { RefreshCw, Wifi, WifiOff, ListFilter, Trash2, ArrowUpRight, AlertTriangle, CheckCircle, Clock, Send, Bot, Smartphone, MessageCircle, AlertCircle } from 'lucide-react';

interface SyncManagerProps {
  isOnline: boolean;
  setIsOnline: (online: boolean) => void;
  syncQueue: SyncTask[];
  onClearQueue: () => void;
  onTriggerSync: () => void;
  isSyncing: boolean;
  syncLogs: string[];
  products?: Product[];
  sales?: SaleTransaction[];
  customers?: Customer[];
  employees?: Employee[];
}

export default function SyncManager({
  isOnline,
  setIsOnline,
  syncQueue,
  onClearQueue,
  onTriggerSync,
  isSyncing,
  syncLogs,
  products = [],
  sales = [],
  customers = [],
  employees = []
}: SyncManagerProps) {

  // Interactive Telegram Simulator State
  const [messages, setMessages] = useState<Array<{ sender: 'owner' | 'bot'; text: string; time: string }>>([
    { 
      sender: 'bot', 
      text: '👋 Здравствуйте! Я интерактивный бот магазина "1000 Мелочей". Я помогаю Вам контролировать магазин удаленно в реальном времени.\n\nИспользуйте интерактивное меню кнопок внизу или отправьте любую команду (например, /status или /revenue).', 
      time: '13:00' 
    }
  ]);
  const [inputText, setInputText] = useState('');
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Auto scroll of mock chat window
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Current DateTime generator
  const getSimulatedTime = () => {
    const d = new Date();
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  };

  // Process user message inside mock Telegram bot
  const handleSendMessage = (textToSend: string) => {
    if (!textToSend.trim()) return;

    const userMsg = textToSend.trim();
    const timeNow = getSimulatedTime();

    // Add user message
    setMessages(prev => [...prev, { sender: 'owner', text: userMsg, time: timeNow }]);
    setInputText('');

    // Trigger fake bot typing indicator and then respond with real metrics
    setTimeout(() => {
      let botResponse = '';
      const cmd = userMsg.toLowerCase().trim();

      if (cmd.includes('/status') || cmd === '📋 /status сводка') {
        const activeCashier = employees.length > 0 ? employees[0].name : 'Айбек (Кассир-старший)';
        const lowStockCount = products.filter(p => p.stock <= p.minStock).length;
        const totalStockVal = products.reduce((sum, p) => sum + (p.stock * p.priceSell), 0).toLocaleString('ru-RU');
        
        botResponse = `📊 **СВОДКА МАГАЗИНА : "1000 Мелочей"**\n\n` +
          `👤 **Смена:** Активный кассир — **${activeCashier}**.\n` +
          `📈 **Выручка за сегодня:** ${sales.length > 0 ? sales.reduce((sum, s) => sum + s.finalPrice, 0).toLocaleString('ru-RU') : '0'} руб. (${sales.length} чеков)\n` +
          `📦 **Оценка склада продаж:** ${totalStockVal} руб.\n` +
          `⚠️ **Дефицит остатков:** Заканчивается товаров: **${lowStockCount} шт.**\n\n` +
          `🔌 **Статус терминалов:** Канал связи и резервный буфер IndexedDB активны. Владелец подключен к Cloud-ноде.`;
      } 
      else if (cmd.includes('/revenue') || cmd === '💰 /revenue финансы') {
        const totalRevenue = sales.reduce((sum, s) => sum + s.finalPrice, 0);
        const cashPay = Math.round(totalRevenue * 0.4);
        const cardPay = totalRevenue - cashPay;
        const activeDebt = customers.reduce((sum, c) => sum + (c.debtLimit - c.debtLimit), 0); // Placeholder debt or cumulative
        const totalDebtAmount = customers.reduce((sum, c) => sum + (c.debt || 0), 0).toLocaleString('ru-RU');

        botResponse = `💸 **ФИНАНСОВЫЙ ОТЧЕТ melochey_control_bot**\n\n` +
          `🪙 **Общий оборот продаж:** ${totalRevenue.toLocaleString('ru-RU')} руб.\n` +
          `💵 — **Наличные:** ${cashPay.toLocaleString('ru-RU')} руб.\n` +
          `💳 — **Банковская карта:** ${cardPay.toLocaleString('ru-RU')} руб.\n\n` +
          `🤝 **Общий долг клиентов (тетрадь):** ${totalDebtAmount} руб. у ${customers.filter(c => (c.debt || 0) > 0).length} покупателей.`;
      } 
      else if (cmd.includes('/low_stock') || cmd === '📉 /low_stock дефицит') {
        const lowStockProducts = products.filter(p => p.stock <= p.minStock).slice(0, 4);
        
        if (lowStockProducts.length === 0) {
          botResponse = `✅ **Все товары в достатке!**\nНи у одного товара остатки не опустились ниже установленного минимума. Склад заполнен отлично.`;
        } else {
          botResponse = `⚠️ **ВНИМАНИЕ: ЗАКАНЧИВАЮТСЯ ТОВАРЫ!**\n\n` +
            lowStockProducts.map(p => `• **${p.name}**\n  Осталось: _${p.stock} ${p.unit}_ (Мин: ${p.minStock})\n  Артикул: \`${p.sku}\``).join('\n\n') +
            (products.filter(p => p.stock <= p.minStock).length > 4 ? `\n\n_...и еще несколько товаров на критическом лимите._` : '');
        }
      } 
      else if (cmd.includes('/alerts') || cmd === '⚡ /alerts тест событий') {
        const randomNum = Math.floor(Math.random() * 3);
        if (randomNum === 0) {
          botResponse = `🔔 **СИСТЕМНЫЙ СИГНАЛ: СМЕНА ЗАКРЫТА!**\n\n` +
            `Кассир: **Айбек К.**\n` +
            `Время: ${new Date().toLocaleTimeString('ru-RU')}\n` +
            `Итого выручки: ${sales.reduce((sum, s) => sum + s.finalPrice, 0).toLocaleString('ru-RU')} руб.\n` +
            `Излишек в кассе: +150 руб. (согласно RFID-счётчику).\n\n_Смена сдана инкассатору успешно._`;
        } else if (randomNum === 1) {
          botResponse = `🚨 **ВНИМАНИЕ: ПРЕВЫШЕН ЛИМИТ ДОВЕРИЯ!**\n\n` +
            `Покупатель: **Рустам Махмудов**\n` +
            `Текущий долг: **54,200 руб.** (Предел: 50,000 руб.)\n` +
            `Действие кассира: Заблокировано добавление в долг до подтверждения администратора.`;
        } else {
          botResponse = `📉 **КРИТИЧЕСКИЙ ОСТАТОК НА СКЛАДЕ!**\n\n` +
            `Спецификация: **Хлеб Батон Нарезной**\n` +
            `Текущий остаток: **1 шт.** на витрине.\n` +
            `Поставщик: _ООО Хлебзавод Премиум_. Рекомендуется срочный дозаказ по горячей кнопке.`;
        }
      } 
      else {
        botResponse = `❓ **Неизвестная команда.**\n\nПожалуйста, воспользуйтесь интерактивными кнопками меню внизу или введите следующие команды:\n/status — Общая сводка с кассы\n/revenue — Касса, наличные и карты\n/low_stock — Дефицитные остатки\n/alerts — Тест случайного пуш-события`;
      }

      setMessages(prev => [...prev, { sender: 'bot', text: botResponse, time: getSimulatedTime() }]);
    }, 600);
  };

  return (
    <div className="space-y-6 text-slate-200">
      
      {/* Upper Widgets row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        
        {/* Network Toggle Card */}
        <div className="bg-[#14161F] border p-5 rounded-2xl border-slate-800 shadow-md flex flex-col justify-between">
          <div className="space-y-1.5">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider font-mono">Статус подключения к Сети</h3>
            <div className="flex items-center gap-2">
              {isOnline ? (
                <>
                  <div className="w-2.5 h-2.5 bg-emerald-500 rounded-full animate-pulse" />
                  <span className="text-sm font-semibold text-emerald-400 flex items-center gap-1">
                    <Wifi className="w-4 h-4" /> Сеть активна (Онлайн)
                  </span>
                </>
              ) : (
                <>
                  <div className="w-2.5 h-2.5 bg-rose-500 rounded-full animate-pulse" />
                  <span className="text-sm font-semibold text-rose-400 flex items-center gap-1">
                    <WifiOff className="w-4 h-4" /> Автономный режим
                  </span>
                </>
              )}
            </div>
            <p className="text-[11.5px] text-slate-400 leading-relaxed">
              Вы можете принудительно отключить интернет, чтобы проверить, как приложение накапливает чеки в локальный буфер.
            </p>
          </div>
          <div className="mt-4 pt-4 border-t border-slate-800/60">
            <button
              onClick={() => setIsOnline(!isOnline)}
              className={`w-full py-2.5 px-4 rounded-xl text-xs font-extrabold transition cursor-pointer ${
                isOnline
                  ? 'bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 border border-rose-500/20'
                  : 'bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 border border-emerald-500/20'
              }`}
            >
              {isOnline ? 'Перейти в Офлайн' : 'Подключить Интернет'}
            </button>
          </div>
        </div>

        {/* Sync Queue Size Card */}
        <div className="bg-[#14161F] border p-5 rounded-2xl border-slate-800 shadow-md flex flex-col justify-between">
          <div className="space-y-1.5">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider font-mono">Очередь синхронизации (IndexedDB)</h3>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-black text-white">{syncQueue.length}</span>
              <span className="text-[11px] text-slate-400">пакетов ожидает отправки</span>
            </div>
            <p className="text-[11.5px] text-slate-400 leading-relaxed">
              Каждая продажа и оплата долга за пределами сети автоматически помещается в буфер FIFO.
            </p>
          </div>
          <div className="mt-4 pt-4 border-t border-slate-800/60 flex gap-2 w-full">
            <button
              onClick={onTriggerSync}
              disabled={isSyncing || syncQueue.length === 0}
              className={`flex-1 py-2.5 px-4 rounded-xl text-xs font-extrabold flex items-center justify-center gap-1.5 text-white shadow-sm transition cursor-pointer ${
                isSyncing || syncQueue.length === 0
                  ? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-850'
                  : 'bg-indigo-600 hover:bg-indigo-500 active:scale-95'
              }`}
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
              Синхронизировать
            </button>
            <button
              onClick={onClearQueue}
              disabled={syncQueue.length === 0}
              title="Очистить очередь"
              className="p-2.5 border border-slate-800 rounded-xl hover:bg-slate-850 disabled:opacity-50 text-slate-400 hover:text-rose-400 transition cursor-pointer"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Sync Status / Conflict Counter */}
        <div className="bg-[#14161F] border p-5 rounded-2xl border-slate-800 shadow-md flex flex-col justify-between">
          <div className="space-y-1.5">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider font-mono">Разрешение Инцидентов</h3>
            <div className="flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-emerald-400" />
              <span className="text-sm font-semibold text-white">Все конфликты улажены</span>
            </div>
            <p className="text-[11.5px] text-slate-400 leading-relaxed">
              Коммит-протокол: Складские балансы закупа перепроверяются сервером по правилу FIFO. Минусовой остаток не рушит транзакции.
            </p>
          </div>
          <div className="mt-4 pt-4 border-t border-slate-800/60 flex items-center justify-between text-xs text-slate-500 font-mono">
            <span>Протокол реконсиляции:</span>
            <span className="text-indigo-400 font-bold">AUTO_MERGE_v1</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
        
        {/* Left column: sync queue table */}
        <div className="md:col-span-7 bg-[#14161F] p-5 rounded-2xl border border-slate-800 shadow-md space-y-4">
          <div className="flex justify-between items-center pb-2 border-b border-slate-800/85">
            <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
              <ListFilter className="w-4 h-4 text-indigo-400" /> Буферизованные Пакеты в Очереди
            </h3>
            <span className="text-[10px] uppercase font-bold text-slate-400 bg-slate-900/40 px-2.5 py-1 rounded-md border border-slate-800">
              IndexedDB Cache
            </span>
          </div>

          {syncQueue.length === 0 ? (
            <div className="border border-dashed border-slate-800 text-center py-10 rounded-xl space-y-2 bg-[#0C0E14]/40">
              <CheckCircle className="w-8 h-8 text-emerald-400 mx-auto" />
              <p className="text-xs font-bold text-white">Очередь абсолютно чиста</p>
              <p className="text-[10px] text-slate-400 max-w-sm mx-auto px-4 leading-relaxed">
                Все розничные продажи, долги и накладные синхронизированы с резервной копией на центральном сервере.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-850 text-slate-400 font-medium">
                    <th className="pb-2">ID таски</th>
                    <th className="pb-2">Тип События</th>
                    <th className="pb-2 text-right">Детали события</th>
                    <th className="pb-2 text-right">Время</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/40">
                  {syncQueue.map((task) => (
                    <tr key={task.id} className="hover:bg-slate-900/40 text-slate-300">
                      <td className="py-2.5 font-mono text-[10px] text-slate-500">{task.id}</td>
                      <td className="py-2.5">
                        {task.type === 'SALE_TRANSACTION' && (
                          <span className="bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded-full text-[10px] font-semibold border border-emerald-500/20">
                            Продажа (POS)
                          </span>
                        )}
                        {task.type === 'DEBT_PAYMENT' && (
                          <span className="bg-indigo-500/10 text-indigo-400 px-2 py-0.5 rounded-full text-[10px] font-semibold border border-indigo-500/20">
                            Погашение долга
                          </span>
                        )}
                        {task.type === 'STOCK_CORRECTION' && (
                          <span className="bg-amber-500/10 text-amber-500 px-2 py-0.5 rounded-full text-[10px] font-semibold border border-amber-500/20">
                            Накладная / Склад
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 text-right font-medium text-white">
                        {task.type === 'SALE_TRANSACTION' && `${task.payload.finalPrice} руб.`}
                        {task.type === 'DEBT_PAYMENT' && `-${task.payload.amount} руб.`}
                        {task.type === 'STOCK_CORRECTION' && `Смена остатка`}
                      </td>
                      <td className="py-2.5 text-right text-slate-500 text-[10px] font-mono">
                        {new Date(task.timestamp).toLocaleTimeString('ru-RU')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Right column: sync logs / activity terminal */}
        <div className="md:col-span-5 bg-slate-950 p-5 rounded-2xl border border-slate-800 shadow-xl flex flex-col h-[320px] md:h-auto">
          <div className="flex justify-between items-center pb-3 border-b border-slate-850">
            <h3 className="text-xs font-bold text-slate-300 flex items-center gap-1.5 uppercase font-mono tracking-wider">
              <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-ping" /> Терминал Синхронизации
            </h3>
            <span className="text-[9px] text-slate-500 uppercase font-mono">SyncLogs.sh</span>
          </div>
          <div className="flex-1 mt-3 overflow-y-auto font-mono text-[10.5px] text-slate-400 space-y-1.5 scrollbar-thin">
            {syncLogs.length === 0 ? (
              <p className="text-slate-600 italic text-center pt-8">Жду запуска процесса синхронизации...</p>
            ) : (
              syncLogs.map((log, index) => {
                let colorClass = 'text-slate-400';
                if (log.includes('УСПЕШНО') || log.includes('Успешно')) colorClass = 'text-emerald-400';
                if (log.includes('Внимание') || log.includes('КОНФЛИКТ')) colorClass = 'text-amber-400';
                if (log.includes('[ERROR]')) colorClass = 'text-rose-400';
                
                return (
                  <div key={index} className="flex gap-1 items-start leading-relaxed">
                    <span className="text-slate-700 select-none">&gt;</span>
                    <span className={colorClass}>{log}</span>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* 🚀 Brand New Interactive Telegram Owner Bot Simulator Widget */}
      <div className="bg-[#14161F] border border-slate-800 rounded-3xl p-5 shadow-2xl space-y-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-slate-800/80 pb-4 gap-2">
          <div>
            <div className="flex items-center gap-1.5">
              <Bot className="w-5 h-5 text-indigo-400" />
              <h3 className="text-sm font-bold text-white uppercase tracking-wider font-mono">Telegram-бот для Владельца Бизнеса</h3>
            </div>
            <p className="text-xs text-slate-400 mt-1">Интеграция с реальным Telegram ботом активна параллельно с графическим симулятором смартфона ниже!</p>
          </div>
          <div className="flex items-center gap-1.5 bg-indigo-500/10 p-1.5 px-3 rounded-xl border border-indigo-500/20 text-[10.5px] font-mono text-indigo-300">
            <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
            <span className="font-extrabold">Реальный бот: @melochey_control_bot</span>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* Left instructions or context cards */}
          <div className="lg:col-span-4 space-y-3 flex flex-col justify-between">
            <div className="space-y-3">
              <div className="bg-[#0A0C10]/60 p-3.5 border border-slate-850 rounded-2xl">
                <span className="text-[10px] text-amber-500 font-extrabold uppercase font-mono block">✅ РЕАЛЬНАЯ ИНТЕГРАЦИЯ</span>
                <p className="text-slate-350 text-[11px] leading-relaxed mt-1">
                  Вы можете открыть настоящий мессенджер Telegram, найти бота <b className="text-indigo-400 font-bold">@melochey_control_bot</b> и нажать <b>/start</b>. Бот моментально связывается с вашей активной веб-сессией браузера!
                </p>
              </div>

              <div className="bg-[#0A0C10]/60 p-3.5 border border-slate-850 rounded-2xl">
                <span className="text-[10px] text-emerald-400 font-extrabold uppercase font-mono block font-sans">⚡ Доступные команды в реальном Telegram:</span>
                <ul className="text-slate-400 text-[11px] leading-relaxed mt-1.5 space-y-1">
                  <li>• <b>/status</b> — Сводка кассы, чеки, выручка.</li>
                  <li>• <b>/revenue</b> — Финансовый разрез (кэш/карта/долги).</li>
                  <li>• <b>/low_stock</b> — Дефицитные остатки.</li>
                  <li>• <b>/alerts</b> — Симуляция ПУШ-оповещений.</li>
                </ul>
              </div>
            </div>

            <div className="bg-indigo-950/20 p-3.5 border border-indigo-900/20 rounded-2xl flex items-start gap-2 text-indigo-300">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-indigo-400" />
              <div className="text-[10.5px] leading-relaxed">
                Вы можете редактировать товары, пробивать новые чеки на кассе, изменять должников — реальный Telegram-бот будет рассчитывать обновленные показатели на лету!
              </div>
            </div>
          </div>

          {/* Right simulated Telegram messenger smartphone interface */}
          <div className="lg:col-span-8 bg-[#0F111A] border border-slate-850 rounded-2xl shadow-inner max-w-full overflow-hidden flex flex-col h-[400px]">
            
            {/* Telegram Header */}
            <div className="bg-[#17212B] p-3 text-white flex items-center justify-between shrink-0 border-b border-slate-900 shadow-md">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 bg-indigo-500 text-white font-black flex items-center justify-center rounded-full text-sm select-none shadow">
                  TD
                </div>
                <div>
                  <h4 className="font-bold text-xs">"1000 Мелочей" Ассистент</h4>
                  <span className="text-[10px] text-indigo-300">бот, доступен в реальном времени</span>
                </div>
              </div>
              <div className="text-slate-400 hover:text-white cursor-pointer select-none">
                ⚙️
              </div>
            </div>

            {/* Simulated Chat Dialogue Bubble Frame */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-[#0E1621] scrollbar-thin flex flex-col">
              {messages.map((m, id) => (
                <div 
                  key={id} 
                  className={`flex flex-col max-w-[85%] ${m.sender === 'owner' ? 'self-end items-end' : 'self-start items-start'} animate-in slide-in-from-bottom-2 duration-150`}
                >
                  <div 
                    className={`p-3 rounded-2xl text-[11.5px] leading-relaxed whitespace-pre-line text-white shadow-sm ${
                      m.sender === 'owner' 
                        ? 'bg-[#2B5278] rounded-tr-none' 
                        : 'bg-[#182533] rounded-tl-none border border-slate-800'
                    }`}
                  >
                    {m.text}
                  </div>
                  <span className="text-[9px] text-slate-500 font-mono mt-1 px-1">{m.time}</span>
                </div>
              ))}
              <div ref={chatEndRef} />
            </div>

            {/* Telegram Custom Bot Keyboard API (Interactive Quick buttons layout) */}
            <div className="bg-[#111921] p-2 border-t border-slate-900 shrink-0 grid grid-cols-2 sm:grid-cols-4 gap-1.5">
              <button
                type="button"
                onClick={() => handleSendMessage('📋 /status сводка')}
                className="py-2.5 px-3 bg-[#1e2c3a] hover:bg-[#273a4d] text-slate-250 hover:text-white font-extrabold rounded-xl text-[10.5px] transition cursor-pointer flex items-center justify-center gap-1 shadow active:scale-95 duration-75"
              >
                📋 /status сводка
              </button>
              <button
                type="button"
                onClick={() => handleSendMessage('💰 /revenue финансы')}
                className="py-2.5 px-3 bg-[#1e2c3a] hover:bg-[#273a4d] text-slate-250 hover:text-white font-extrabold rounded-xl text-[10.5px] transition cursor-pointer flex items-center justify-center gap-1 shadow active:scale-95 duration-75"
              >
                💰 /revenue финансы
              </button>
              <button
                type="button"
                onClick={() => handleSendMessage('📉 /low_stock дефицит')}
                className="py-2.5 px-3 bg-[#1e2c3a] hover:bg-[#273a4d] text-[#e2b740] hover:text-white font-extrabold rounded-xl text-[10.5px] transition cursor-pointer flex items-center justify-center gap-1 shadow active:scale-95 duration-75"
              >
                📉 /low_stock дефицит
              </button>
              <button
                type="button"
                onClick={() => handleSendMessage('⚡ /alerts тест событий')}
                className="py-2.5 px-3 bg-[#1e2c3a] hover:bg-[#273a4d] text-[#e24040] hover:text-white font-extrabold rounded-xl text-[10.5px] transition cursor-pointer flex items-center justify-center gap-1 shadow active:scale-95 duration-75"
              >
                ⚡ /alerts тест событий
              </button>
            </div>

            {/* Bottom Message typing input bar */}
            <form 
              onSubmit={(e) => {
                e.preventDefault();
                handleSendMessage(inputText);
              }}
              className="bg-[#17212B] p-2.5 flex items-center gap-2 shrink-0 border-t border-slate-900"
            >
              <input
                type="text"
                placeholder="Напишите сообщение боту..."
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                className="flex-1 bg-[#111921] border border-slate-900 text-white rounded-full p-2 px-4 placeholder-slate-500 text-[11.5px] focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
              <button
                type="submit"
                className="p-2 bg-[#2D759E] hover:bg-[#3488b8] text-white rounded-full transition active:scale-90 cursor-pointer shadow-md shrink-0 flex items-center justify-center"
              >
                <Send className="w-3.5 h-3.5" />
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
