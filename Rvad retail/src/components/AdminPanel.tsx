/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { UserRole, SecurityAuditLog, Product, Category, Customer, Supplier, SaleTransaction } from '../types';
import { Shield, KeyRound, Database, ClipboardList, Info, AlertOctagon, Terminal, Play, Eye } from 'lucide-react';

interface AdminPanelProps {
  currentRole: UserRole;
  setCurrentRole: (role: UserRole) => void;
  auditLogs: SecurityAuditLog[];
  products: Product[];
  categories: Category[];
  customers: Customer[];
  suppliers: Supplier[];
  sales: SaleTransaction[];
}

export default function AdminPanel({
  currentRole,
  setCurrentRole,
  auditLogs,
  products,
  categories,
  customers,
  suppliers,
  sales
}: AdminPanelProps) {
  const [dbTable, setDbTable] = useState<'products' | 'categories' | 'customers' | 'suppliers' | 'sales'>('products');
  const [rawSqlQuery, setRawSqlQuery] = useState<string>('SELECT * FROM products ORDER BY stock ASC;');
  const [sqlResult, setSqlResult] = useState<any[] | null>(null);

  const executeSimulatedQuery = () => {
    // Basic query analyzer simulation
    const query = rawSqlQuery.trim().toUpperCase();
    if (query.includes('PRODUCTS')) {
      const sorted = [...products].sort((a, b) => a.stock - b.stock);
      setSqlResult(sorted);
    } else if (query.includes('CUSTOMERS') || query.includes('DEBT')) {
      setSqlResult(customers);
    } else if (query.includes('SALES')) {
      setSqlResult(sales);
    } else if (query.includes('SUPPLIERS')) {
      setSqlResult(suppliers);
    } else {
      setSqlResult(categories);
    }
    alert('Имитация: SQL-запрос успешно выполнен на СУБД PostgreSQL!');
  };

  const getRoleBadgeColor = (role: UserRole) => {
    switch (role) {
      case UserRole.OWNER: return 'bg-purple-600 text-white';
      case UserRole.ADMIN: return 'bg-indigo-600 text-white';
      case UserRole.CASHIER: return 'bg-emerald-600 text-white';
      case UserRole.WAREHOUSE: return 'bg-amber-600 text-white';
      default: return 'bg-slate-600 text-white';
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. ROLE SWITCHERS / PERMISSIONS GRID */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
        <div>
          <span className="text-[10px] uppercase font-bold text-slate-400">Панель ролей и доступов</span>
          <h2 className="text-base font-extrabold text-slate-800 flex items-center gap-1.5">
            <KeyRound className="text-indigo-600 w-4.5 h-4.5" /> Управление правами персонала торговой точки
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Изменяя роль здесь, вы динамически ограничиваете или расширяете доступность модулей, моделируя боевой запуск.
          </p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {Object.values(UserRole).map((role) => {
            const isActive = currentRole === role;
            return (
              <button
                key={role}
                onClick={() => setCurrentRole(role)}
                className={`p-3.5 rounded-2xl border text-xs font-bold transition flex flex-col items-center gap-1.5 ${
                  isActive
                    ? 'bg-slate-900 text-white border-slate-950 shadow-md'
                    : 'bg-slate-50 hover:bg-slate-100 text-slate-600 border-slate-200'
                }`}
              >
                <Shield className="w-4 h-4" />
                {role === UserRole.OWNER && 'Владелец (Owner)'}
                {role === UserRole.ADMIN && 'Администратор'}
                {role === UserRole.CASHIER && 'Кассир (POS)'}
                {role === UserRole.WAREHOUSE && 'Кладовщик'}
              </button>
            );
          })}
        </div>

        {/* Current Permissions Disclaimer */}
        <div className="p-4 bg-slate-50 border rounded-xl flex items-start gap-3">
          <Info className="w-5 h-5 text-indigo-600 shrink-0 mt-0.5" />
          <div className="space-y-1 text-xs text-slate-600 leading-relaxed">
            <h4 className="font-bold text-slate-900">Текущий установленный уровень доступа:</h4>
            {currentRole === UserRole.OWNER && (
              <p>Вам доступны абсолютно все разделы, включая отчеты рентабельности, списание долгов, выгрузки баз данных и фискальную аналитику закупки.</p>
            )}
            {currentRole === UserRole.ADMIN && (
              <p>Вам доступно администрирование ценников закупа, добавление клиентов в CRM, просмотр транзакций. Опция безвозвратного удаления БД скрыта.</p>
            )}
            {currentRole === UserRole.CASHIER && (
              <p>Доступ ограничен Кассовым POS-терминалом и CRM. Вы не можете просматривать вкладку Аналитика закупки, лог маржинальности и менять роли коллег.</p>
            )}
            {currentRole === UserRole.WAREHOUSE && (
              <p>Вам открыт доступ только к модулям Склада, Приёма накладных от Поставщиков и Списания дефектов. Кассовые и финансовые функции заблокированы.</p>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Security / Cashier action logs audit (ACID Security Monitor) */}
        <div className="lg:col-span-6 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
            <ClipboardList className="w-4.5 h-4.5 text-rose-500" /> Журнал Аудита Безопасности (Audit Logging)
          </h3>

          <div className="space-y-3.5 max-h-[380px] overflow-y-auto pr-1">
            {auditLogs.map((log) => (
              <div key={log.id} className="p-3 bg-slate-50 border rounded-xl space-y-1.5 text-xs text-slate-600">
                <div className="flex justify-between items-start">
                  <span className="font-bold text-slate-900">{log.action}</span>
                  <span className={`px-2 py-0.5 rounded text-[9px] font-mono ${
                    log.severity === 'DANGER'
                      ? 'bg-rose-100 text-rose-800 font-bold'
                      : log.severity === 'WARNING'
                        ? 'bg-amber-100 text-amber-800 font-bold'
                        : 'bg-indigo-50 text-indigo-700 font-medium'
                  }`}>
                    {log.severity}
                  </span>
                </div>
                <p className="text-[11px] text-slate-500">{log.details}</p>
                <div className="flex justify-between text-[10px] text-slate-400 font-mono">
                  <span>Пользователь: [{log.role}] {log.user}</span>
                  <span>{new Date(log.timestamp).toLocaleTimeString('ru-RU')}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Live Postgres DB Explorer */}
        <div className="lg:col-span-6 bg-slate-900 text-slate-100 p-5 rounded-2xl border border-slate-800 shadow-xl space-y-4">
          <div className="flex justify-between items-center border-b border-slate-800 pb-2">
            <h3 className="text-xs font-bold font-mono text-emerald-400 flex items-center gap-1.5 uppercase">
              <Database className="w-4 h-4" /> Интерактивный Справочник PostgreSQL Explorer
            </h3>
            <span className="text-[9px] text-slate-500 font-mono">pg_connect()</span>
          </div>

          <p className="text-[11px] text-slate-400 leading-relaxed font-sans">
            Управляйте виртуальным ядром базы данных PostgreSQL. Ниже вы можете переключать системные таблицы, чтобы увидеть, в каком именно виде они структурированы внутри СУБД.
          </p>

          <div className="flex flex-wrap gap-1 bg-slate-950 p-1.5 rounded-lg border border-slate-850">
            {(['products', 'categories', 'customers', 'suppliers', 'sales'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => {
                  setDbTable(tab);
                  setRawSqlQuery(`SELECT * FROM ${tab};`);
                  setSqlResult(null);
                }}
                className={`px-2.5 py-1 rounded text-[10px] font-mono transition ${
                  dbTable === tab ? 'bg-indigo-600 text-white font-bold' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>

          {/* Simple virtual SQL terminal */}
          <div className="space-y-2">
            <div className="relative">
              <Terminal className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-3" />
              <input
                type="text"
                value={rawSqlQuery}
                onChange={(e) => setRawSqlQuery(e.target.value)}
                className="w-full bg-slate-950 text-emerald-400 font-mono text-[11px] pl-8 pr-16 py-2.5 rounded-lg border border-slate-800 focus:outline-none focus:border-indigo-500"
              />
              <button
                onClick={executeSimulatedQuery}
                title="Реализировать запрос"
                className="absolute right-1.5 top-1.5 px-2 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded text-[10px] font-bold font-mono flex items-center gap-0.5"
              >
                <Play className="w-2.5 h-2.5" /> RUN
              </button>
            </div>
          </div>

          {/* Result view */}
          <div className="h-56 overflow-y-auto bg-slate-950 p-3 rounded-lg border border-slate-800 font-mono text-[10px] text-slate-300">
            {sqlResult ? (
              <div className="space-y-2">
                <span className="text-[9px] text-emerald-400 font-bold block">// Результат запроса ({sqlResult.length} рядов):</span>
                <table className="w-full text-left relative text-[9px] text-slate-300 table-auto border-collapse">
                  <thead>
                    <tr className="border-b border-slate-800 text-slate-500">
                      <th className="pb-1">ID (uuid)</th>
                      <th className="pb-1">Поле наименования / Ключ</th>
                      <th className="pb-1 text-right">Показатель 1</th>
                      <th className="pb-1 text-right">Показатель 2</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-900">
                    {sqlResult.slice(0, 8).map((row: any, i) => (
                      <tr key={row.id || i}>
                        <td className="py-1 text-slate-500 truncate max-w-[50px]">{row.id || `row-${i}`}</td>
                        <td className="py-1 font-bold truncate max-w-[120px]">{row.name || row.company || row.timestamp || 'Канал'}</td>
                        <td className="py-1 text-right text-indigo-400">{row.priceSell || row.phone || row.paymentMethod || '-'}</td>
                        <td className="py-1 text-right text-rose-400">{row.stock || row.debt || row.finalPrice || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="space-y-2">
                <span className="text-[9px] text-indigo-400 font-bold block">// Сконвертированный JSON-Объект таблицы [{dbTable}]:</span>
                <pre className="max-h-44 overflow-y-auto font-mono text-[9px] text-slate-400 leading-tight">
                  {JSON.stringify(
                    dbTable === 'products' ? products.slice(0,2) :
                    dbTable === 'categories' ? categories :
                    dbTable === 'customers' ? customers.slice(0,2) :
                    dbTable === 'suppliers' ? suppliers : sales.slice(0,2),
                    null,
                    2
                  )}
                </pre>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
