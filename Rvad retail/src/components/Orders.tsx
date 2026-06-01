import React, { useState, useMemo } from 'react';
import { SaleTransaction, Customer, Product } from '../types';
import { 
  ShoppingBag, Search, Filter, Calendar, 
  ChevronDown, ChevronUp, Coins, CreditCard, 
  User, RefreshCw, FileText, Truck, Store 
} from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';

interface OrdersProps {
  sales: SaleTransaction[];
  customers: Customer[];
  products: Product[];
}

export default function Orders({ sales, customers, products }: OrdersProps) {
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');
  const [filterSource, setFilterSource] = useState<'all' | 'online' | 'pos'>('all');
  const [filterPayment, setFilterPayment] = useState<'all' | 'CASH' | 'CARD' | 'DEBT' | 'SPLIT'>('all');
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);

  // Helper to determine if transaction was made online via storefront
  const isOnlineOrder = (sale: SaleTransaction) => {
    return sale.id.startsWith('sf-') || sale.cashierName.startsWith('Storefront:');
  };

  const filteredSales = useMemo(() => {
    return sales
      .filter(sale => {
        const query = searchQuery.toLowerCase().trim();
        const matchesSearch = 
          sale.id.toLowerCase().includes(query) ||
          sale.cashierName.toLowerCase().includes(query) ||
          (sale.customerId && customers.find(c => c.id === sale.customerId)?.name.toLowerCase().includes(query));

        const isOnline = isOnlineOrder(sale);
        const matchesSource = 
          filterSource === 'all' ||
          (filterSource === 'online' && isOnline) ||
          (filterSource === 'pos' && !isOnline);

        const matchesPayment = 
          filterPayment === 'all' || 
          sale.paymentMethod === filterPayment;

        return matchesSearch && matchesSource && matchesPayment;
      })
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [sales, searchQuery, filterSource, filterPayment, customers]);

  // Statistics calculation
  const stats = useMemo(() => {
    let totalRevenue = 0;
    let onlineRevenue = 0;
    let posRevenue = 0;
    let totalOrders = 0;
    let onlineOrders = 0;
    let posOrders = 0;

    filteredSales.forEach(sale => {
      totalRevenue += sale.finalPrice;
      totalOrders++;
      if (isOnlineOrder(sale)) {
        onlineRevenue += sale.finalPrice;
        onlineOrders++;
      } else {
        posRevenue += sale.finalPrice;
        posOrders++;
      }
    });

    return {
      totalRevenue,
      onlineRevenue,
      posRevenue,
      totalOrders,
      onlineOrders,
      posOrders
    };
  }, [filteredSales]);

  return (
    <div className="space-y-6">
      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-[#161920] p-5 rounded-2xl border border-slate-800/80 shadow-lg">
          <span className="text-[10px] uppercase font-bold text-slate-500 block mb-1">Общая Выручка</span>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black text-white font-mono">{(stats.totalRevenue).toLocaleString('ru-RU')} руб.</span>
          </div>
          <p className="text-[10px] text-slate-400 mt-1">Всего заказов: <span className="font-mono text-white">{stats.totalOrders}</span></p>
        </div>

        <div className="bg-[#161920] p-5 rounded-2xl border border-slate-800/80 shadow-lg">
          <span className="text-[10px] uppercase font-bold text-sky-400 block mb-1">Онлайн-Заказы (Магазин)</span>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black text-sky-400 font-mono">{(stats.onlineRevenue).toLocaleString('ru-RU')} руб.</span>
          </div>
          <p className="text-[10px] text-slate-400 mt-1">Сайт/Телеграм: <span className="font-mono text-sky-400">{stats.onlineOrders}</span></p>
        </div>

        <div className="bg-[#161920] p-5 rounded-2xl border border-slate-800/80 shadow-lg">
          <span className="text-[10px] uppercase font-bold text-emerald-400 block mb-1">Продажи POS-Кассы</span>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black text-emerald-450 text-emerald-400 font-mono">{(stats.posRevenue).toLocaleString('ru-RU')} руб.</span>
          </div>
          <p className="text-[10px] text-slate-400 mt-1">Офлайн на кассе: <span className="font-mono text-emerald-400">{stats.posOrders}</span></p>
        </div>
      </div>

      {/* Filters and Search */}
      <div className="bg-[#161920] p-5 rounded-2xl border border-slate-800/80 shadow-2xl space-y-4">
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-3">
          <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
            <ShoppingBag className="w-4 h-4 text-indigo-400" /> История всех продаж и заказов
          </h3>
          
          <div className="flex flex-wrap gap-2 w-full lg:w-auto">
            {/* Source Filter */}
            <div className="flex bg-[#1C1E26] border border-slate-800 p-1 rounded-xl text-xs">
              <button
                type="button"
                onClick={() => setFilterSource('all')}
                className={`px-3 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                  filterSource === 'all' ? 'bg-indigo-600 text-white' : 'text-slate-400'
                }`}
              >
                Все
              </button>
              <button
                type="button"
                onClick={() => setFilterSource('online')}
                className={`px-3 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                  filterSource === 'online' ? 'bg-indigo-600 text-sky-300' : 'text-slate-400'
                }`}
              >
                Онлайн
              </button>
              <button
                type="button"
                onClick={() => setFilterSource('pos')}
                className={`px-3 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                  filterSource === 'pos' ? 'bg-indigo-600 text-emerald-300' : 'text-slate-400'
                }`}
              >
                POS-Касса
              </button>
            </div>

            {/* Payment Filter */}
            <select
              value={filterPayment}
              onChange={(e) => setFilterPayment(e.target.value as any)}
              className="bg-[#1C1E26] border border-slate-800 px-3 py-1 rounded-xl text-xs text-slate-300 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              <option value="all">Все оплаты</option>
              <option value="CASH">Наличные</option>
              <option value="CARD">Карта</option>
              <option value="DEBT">В долг</option>
              <option value="SPLIT">Смешанный</option>
            </select>
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
          <input
            type="text"
            placeholder="Поиск по ID заказа, имени клиента или кассира..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-[#1C1E26] border border-slate-800 pl-9 pr-3 py-2 rounded-xl text-xs text-slate-200 focus:ring-1 focus:ring-indigo-500 outline-none"
          />
        </div>

        {/* Orders List */}
        <div className="space-y-3 max-h-[550px] overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-slate-800">
          {filteredSales.length === 0 ? (
            <div className="text-center py-10 bg-[#1C1E26]/30 rounded-2xl border border-slate-800 text-slate-500">
              <ShoppingBag className="w-10 h-10 mx-auto mb-2 opacity-50 text-slate-500" />
              <p className="text-xs font-semibold text-slate-400">Заказы не найдены</p>
            </div>
          ) : (
            filteredSales.map((sale) => {
              const isExpanded = expandedOrderId === sale.id;
              const customer = sale.customerId ? customers.find(c => c.id === sale.customerId) : null;
              const isOnline = isOnlineOrder(sale);

              return (
                <div
                  key={sale.id}
                  className={`bg-[#1C1E26] rounded-2xl border transition-all duration-200 overflow-hidden ${
                    isExpanded 
                      ? 'border-indigo-500 shadow-xl' 
                      : 'border-slate-850 hover:border-slate-800 hover:bg-[#1E2129]'
                  }`}
                >
                  {/* Order Summary Header */}
                  <div
                    onClick={() => setExpandedOrderId(isExpanded ? null : sale.id)}
                    className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 cursor-pointer select-none"
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center border font-bold text-xs shrink-0 ${
                        isOnline 
                          ? 'bg-sky-500/10 text-sky-400 border-sky-500/25' 
                          : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/25'
                      }`}>
                        {isOnline ? <Truck className="w-4 h-4" /> : <Store className="w-4 h-4" />}
                      </div>

                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-black text-white">#{sale.id.toUpperCase()}</span>
                          <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold tracking-wider uppercase font-mono border ${
                            isOnline 
                              ? 'bg-sky-500/10 border-sky-500/20 text-sky-400' 
                              : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                          }`}>
                            {isOnline ? 'Сайт/Онлайн' : 'POS-Касса'}
                          </span>
                        </div>
                        <span className="text-[10px] text-slate-500 font-mono block mt-0.5">
                          {new Date(sale.timestamp).toLocaleString('ru-RU')}
                        </span>
                      </div>
                    </div>

                    <div className="flex flex-wrap md:flex-nowrap items-center gap-4 justify-between md:justify-end border-t border-slate-800/40 md:border-0 pt-3 md:pt-0">
                      <div className="text-xs">
                        <span className="text-[9px] text-slate-500 uppercase block font-bold">Покупатель / Кассир:</span>
                        <span className="text-slate-300 font-medium font-bold block max-w-[150px] truncate">
                          {customer ? customer.name : (sale.customerId ? `ID: ${sale.customerId}` : 'Быстрый чек')}
                        </span>
                        <span className="text-[10px] text-slate-500 block">Исполнитель: {sale.cashierName}</span>
                      </div>

                      <div className="flex items-center gap-3">
                        <div className="px-3.5 py-1.5 rounded-xl bg-slate-800/50 border border-slate-850 font-mono text-center">
                          <span className="text-[9px] text-slate-500 block font-bold uppercase leading-none mb-0.5">Метод:</span>
                          <span className={`text-[10px] font-black tracking-wide ${
                            sale.paymentMethod === 'DEBT' ? 'text-rose-400' : 'text-slate-300'
                          }`}>
                            {sale.paymentMethod === 'CASH' && 'Наличные'}
                            {sale.paymentMethod === 'CARD' && 'Карта'}
                            {sale.paymentMethod === 'DEBT' && 'Рассрочка'}
                            {sale.paymentMethod === 'SPLIT' && 'Смешанный'}
                          </span>
                        </div>

                        <div className="px-4 py-1 rounded-xl bg-slate-900 border border-slate-800 text-right min-w-[100px]">
                          <span className="text-[9px] text-slate-500 block font-bold uppercase font-mono mb-0.5">Итого:</span>
                          <span className="text-xs font-black text-white font-mono">{sale.finalPrice.toLocaleString('ru-RU')} p.</span>
                        </div>

                        <div className="text-slate-550 text-slate-500">
                          {isExpanded ? <ChevronUp className="w-4 h-4 text-indigo-400" /> : <ChevronDown className="w-4 h-4" />}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Order Details Body */}
                  {isExpanded && (
                    <div className="bg-[#121419] p-4 border-t border-slate-850 animate-in slide-in-from-top-2 duration-200 text-xs">
                      <div className="space-y-4">
                        {isOnline && (
                          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center p-3 bg-[#161920] rounded-xl border border-slate-850 gap-3">
                            <div className="flex items-center gap-2">
                              <Truck className="w-4 h-4 text-sky-400" />
                              <div>
                                <span className="font-bold text-slate-350 block">Статус доставки интернет-заказа:</span>
                                <span className="text-[10px] text-slate-500">Этот статус напрямую отображается в личном кабинете клиента.</span>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <select
                                value={sale.status || 'processing'}
                                onChange={async (e) => {
                                  const newStatus = e.target.value;
                                  try {
                                    const token = localStorage.getItem('jwt_token');
                                    const res = await fetch(`/api/sales/${sale.id}/status`, {
                                      method: 'PATCH',
                                      headers: { 
                                        'Content-Type': 'application/json',
                                        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
                                      },
                                      body: JSON.stringify({ status: newStatus }),
                                    });
                                    if (res.ok) {
                                      queryClient.invalidateQueries({ queryKey: ['sales'] });
                                    } else {
                                      const errData = await res.json();
                                      alert("Ошибка при обновлении статуса: " + errData.error);
                                    }
                                  } catch (err: any) {
                                    alert("Ошибка при соединении с сервером: " + err.message);
                                  }
                                }}
                                className="bg-[#1C1E26] border border-slate-800 text-sky-350 font-bold px-3 py-1.5 rounded-xl text-xs focus:ring-1 focus:ring-sky-500 outline-none cursor-pointer"
                              >
                                <option value="processing">⏳ Обрабатывается (Processing)</option>
                                <option value="shipping">
                                  {sale.orderType === 'pickup' ? '📦 Готов к выдаче (Ready for Pickup)' : '🚚 В пути (Shipping)'}
                                </option>
                                <option value="delivered">
                                  {sale.orderType === 'pickup' ? '📥 Выдан (Picked up)' : '✅ Доставлен (Delivered)'}
                                </option>
                                <option value="cancelled">❌ Отменен (Cancelled)</option>
                              </select>
                            </div>
                          </div>
                        )}
                        <div className="flex justify-between items-center border-b border-slate-800/80 pb-2">
                          <span className="text-slate-200 font-extrabold uppercase font-mono tracking-wider flex items-center gap-1">
                            <FileText className="w-4 h-4 text-indigo-400" /> Спецификация и состав заказа
                          </span>
                        </div>

                        {/* Items Table */}
                        <div className="overflow-x-auto">
                          <table className="w-full text-left font-sans text-slate-300 border-collapse">
                            <thead>
                              <tr className="border-b border-slate-850 text-slate-500 text-[10px] uppercase font-mono tracking-wider">
                                <th className="pb-2">Товар</th>
                                <th className="pb-2 text-right">Закупочная</th>
                                <th className="pb-2 text-right">Цена продажи</th>
                                <th className="pb-2 text-center">Кол-во</th>
                                <th className="pb-2 text-right">Сумма</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-850/50">
                              {sale.items.map((it, idx) => (
                                <tr key={idx} className="hover:bg-slate-900/40">
                                  <td className="py-2.5 font-bold text-slate-250 text-slate-200">{it.productName}</td>
                                  <td className="py-2.5 text-right font-mono text-slate-500">{it.priceBuy} р.</td>
                                  <td className="py-2.5 text-right font-mono text-slate-300">{it.priceSell} р.</td>
                                  <td className="py-2.5 text-center font-mono text-slate-300">{it.quantity}</td>
                                  <td className="py-2.5 text-right font-mono font-bold text-indigo-300">
                                    {(it.quantity * it.priceSell).toLocaleString('ru-RU')} руб.
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>

                        {/* Financial summary breakdown */}
                        <div className="pt-3 border-t border-slate-800 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-[#161920]/40 p-4 rounded-xl border border-slate-850">
                          <div className="space-y-1 font-sans text-[11px] text-slate-400">
                            <div>Способ расчёта: <span className="font-bold text-white">
                              {sale.paymentMethod === 'CASH' ? 'Наличные' : 
                               sale.paymentMethod === 'CARD' ? 'Карта' : 
                               sale.paymentMethod === 'DEBT' ? 'В долг (Насия)' : 
                               sale.paymentMethod === 'SPLIT' ? 'Смешанный' : sale.paymentMethod}
                            </span></div>
                            {sale.paidCash > 0 && <div>Оплачено наличными: <span className="font-mono text-emerald-400 font-semibold">{sale.paidCash} р.</span></div>}
                            {sale.paidCard > 0 && <div>Оплачено картой: <span className="font-mono text-sky-400 font-semibold">{sale.paidCard} р.</span></div>}
                            {sale.paidDebt > 0 && <div>Оплачено в кредит (Nasiya): <span className="font-mono text-rose-400 font-semibold">{sale.paidDebt} р.</span></div>}
                          </div>

                          <div className="text-right w-full sm:w-auto font-mono">
                            {sale.totalDiscount > 0 && (
                              <div className="text-[10px] text-slate-500">
                                До скидки: {sale.totalBeforeDiscount} р. (Скидка {sale.totalDiscount} р.)
                              </div>
                            )}
                            <div className="text-sm font-black text-white flex items-center justify-end gap-1 mt-0.5">
                              <span>К Оплате:</span>
                              <span className="text-emerald-400 text-base">{sale.finalPrice.toLocaleString('ru-RU')} руб.</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
