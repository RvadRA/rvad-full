/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { BusinessExpense, UserRole } from '../types';
import { 
  Plus, 
  Trash2, 
  Edit3, 
  Filter, 
  Calendar, 
  Receipt, 
  AlertCircle, 
  Check, 
  X, 
  FileText, 
  HelpCircle,
  TrendingDown
} from 'lucide-react';

interface ExpensesManagementProps {
  expenses: BusinessExpense[];
  onAddExpense: (category: BusinessExpense['category'], amount: number, date: string, notes?: string) => void;
  onUpdateExpense: (id: string, category: BusinessExpense['category'], amount: number, date: string, notes?: string) => void;
  onDeleteExpense: (id: string) => void;
  currentRole: UserRole;
}

const CATEGORIES: BusinessExpense['category'][] = [
  'Аренда',
  'Зарплата',
  'Закупка товара',
  'Маркетинг',
  'Коммунальные услуги',
  'Питание',
  'Прочее'
];

export default function ExpensesManagement({
  expenses,
  onAddExpense,
  onUpdateExpense,
  onDeleteExpense,
  currentRole
}: ExpensesManagementProps) {
  // Form states
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingExpenseId, setEditingExpenseId] = useState<string | null>(null);
  const [category, setCategory] = useState<BusinessExpense['category']>('Прочее');
  const [amount, setAmount] = useState<string>('');
  const [date, setDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [notes, setNotes] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Filters
  const [selectedMonth, setSelectedMonth] = useState<string>('ALL'); // format: YYYY-MM or 'ALL'
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>('ALL');

  // Deletion state
  const [expenseToDelete, setExpenseToDelete] = useState<BusinessExpense | null>(null);

  // Validation & Submit
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      setErrorMessage('Пожалуйста, введите корректную сумму расхода больше нуля.');
      return;
    }

    if (!category) {
      setErrorMessage('Пожалуйста, укажите категорию расхода.');
      return;
    }

    if (!date) {
      setErrorMessage('Пожалуйста, выберите дату.');
      return;
    }

    if (editingExpenseId) {
      onUpdateExpense(editingExpenseId, category, parsedAmount, date, notes.trim());
    } else {
      onAddExpense(category, parsedAmount, date, notes.trim());
    }

    // Reset form
    handleCloseForm();
  };

  const handleEditClick = (exp: BusinessExpense) => {
    setEditingExpenseId(exp.id);
    setCategory(exp.category);
    setAmount(exp.amount ? exp.amount.toString() : '0');
    
    // Fallback for older entries where date might be missing but timestamp exists
    let fallbackDate = new Date().toISOString().split('T')[0];
    if (exp.date) {
      fallbackDate = exp.date;
    } else if (exp.timestamp) {
      try {
        fallbackDate = new Date(exp.timestamp).toISOString().split('T')[0];
      } catch (e) {}
    }
    setDate(fallbackDate);
    
    setNotes(exp.notes || '');
    setErrorMessage(null);
    setIsFormOpen(true);
  };

  const handleCloseForm = () => {
    setIsFormOpen(false);
    setEditingExpenseId(null);
    setCategory('Прочее');
    setAmount('');
    setDate(new Date().toISOString().split('T')[0]);
    setNotes('');
    setErrorMessage(null);
  };

  // Extract unique months for filter from all expenses (format: "YYYY-MM")
  const getAvailableMonths = () => {
    const monthsSet = new Set<string>();
    expenses.forEach(exp => {
      if (exp.date) {
        monthsSet.add(exp.date.substring(0, 7)); // get YYYY-MM
      }
    });
    
    // Add current month if not present
    const currentMonthStr = new Date().toISOString().substring(0, 7);
    monthsSet.add(currentMonthStr);

    return Array.from(monthsSet).sort((a, b) => b.localeCompare(a));
  };

  const formatMonthName = (yearMonth: string) => {
    const [year, month] = yearMonth.split('-');
    const months = [
      'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
      'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'
    ];
    return `${months[parseInt(month, 10) - 1]} ${year}`;
  };

  // Filter expenses
  const filteredExpenses = expenses.filter(exp => {
    const matchesMonth = selectedMonth === 'ALL' || (exp.date && exp.date.startsWith(selectedMonth));
    const matchesCategory = selectedCategoryFilter === 'ALL' || exp.category === selectedCategoryFilter;
    return matchesMonth && matchesCategory;
  });

  const totalFilteredAmount = filteredExpenses.reduce((sum, exp) => sum + exp.amount, 0);

  return (
    <div className="space-y-6">
      {/* 1. Header with add action */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-[#161920] p-4 rounded-2xl border border-slate-800/80 shadow-2xl">
        <div>
          <span className="text-[10px] uppercase font-bold text-slate-500 font-mono">Финансовый контроль бизнеса</span>
          <h2 className="text-base font-extrabold text-white flex items-center gap-1.5 mt-0.5">
            <Receipt className="text-indigo-400 w-4.5 h-4.5" /> Операционные расходы
          </h2>
        </div>
        
        <button
          type="button"
          onClick={() => {
            handleCloseForm();
            setIsFormOpen(true);
          }}
          className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold rounded-xl text-xs flex items-center gap-1.5 shadow-lg active:scale-95 transition cursor-pointer w-full sm:w-auto justify-center"
        >
          <Plus className="w-4 h-4" /> Добавить расход
        </button>
      </div>

      {/* 2. Quick indicators & Filters bar */}
      <div className="grid grid-cols-1 xl:grid-cols-4 gap-4">
        {/* Indicators */}
        <div className="xl:col-span-1 bg-[#161920] border border-slate-800/80 p-4 rounded-2xl flex flex-col justify-between shadow-2xl">
          <span className="text-[10px] uppercase font-bold text-slate-500 font-mono">Итого расходов за период</span>
          <div className="mt-2.5">
            <p className="text-2xl font-black text-rose-400 font-mono">-{totalFilteredAmount.toLocaleString()} руб.</p>
            <p className="text-[10px] text-slate-400 mt-0.5">Всего записей: <strong className="text-slate-200">{filteredExpenses.length}</strong></p>
          </div>
        </div>

        {/* Filters Panel */}
        <div className="xl:col-span-3 bg-[#161920] border border-slate-800/80 p-4 rounded-2xl flex flex-col md:flex-row items-stretch md:items-center gap-4 shadow-2xl">
          <div className="flex-1 space-y-1">
            <label className="text-[10px] uppercase font-bold text-slate-500 font-mono flex items-center gap-1">
              <Filter className="w-3 h-3" /> Фильтр по месяцам
            </label>
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="w-full bg-[#1C1E26] border border-slate-800 text-slate-200 text-xs p-2.5 rounded-xl focus:outline-none focus:border-indigo-500 font-semibold cursor-pointer"
            >
              <option value="ALL">Все месяцы / Периоды</option>
              {getAvailableMonths().map(m => (
                <option key={m} value={m}>{formatMonthName(m)}</option>
              ))}
            </select>
          </div>

          <div className="flex-1 space-y-1">
            <label className="text-[10px] uppercase font-bold text-slate-500 font-mono flex items-center gap-1">
              <Calendar className="w-3 h-3" /> Фильтр по категориям
            </label>
            <select
              value={selectedCategoryFilter}
              onChange={(e) => setSelectedCategoryFilter(e.target.value)}
              className="w-full bg-[#1C1E26] border border-slate-800 text-slate-200 text-xs p-2.5 rounded-xl focus:outline-none focus:border-indigo-500 font-semibold cursor-pointer"
            >
              <option value="ALL">Все категории</option>
              {CATEGORIES.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* 3. Main interactive Form (Slide down / Modal) */}
      {isFormOpen && (
        <div className="bg-[#161920] border border-indigo-500/30 rounded-2xl p-5 shadow-2xl space-y-4 animate-in slide-in-from-top-2 duration-200">
          <div className="flex justify-between items-center border-b border-slate-800/60 pb-3">
            <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
              <Receipt className="text-indigo-400 w-4 h-4" />
              {editingExpenseId ? 'Редактировать расходную операцию' : 'Регистрация нового расхода'}
            </h3>
            <button 
              onClick={handleCloseForm}
              className="p-1 hover:bg-slate-800 text-slate-400 hover:text-white rounded-lg transition-all cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {errorMessage && (
            <div className="flex items-center gap-2 bg-rose-500/10 border border-rose-500/20 text-rose-450 p-3 rounded-xl text-xs">
              <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
              <p className="font-medium text-rose-400">{errorMessage}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-4 gap-4 text-xs">
            {/* Category */}
            <div className="space-y-1 md:col-span-1">
              <label className="text-[10px] uppercase font-mono font-bold text-slate-500">Категория расхода *</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as BusinessExpense['category'])}
                className="w-full bg-[#1C1E26] border border-slate-800 text-slate-200 p-3 rounded-xl focus:outline-none focus:border-indigo-500 font-bold cursor-pointer"
                required
              >
                {CATEGORIES.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>

            {/* Amount */}
            <div className="space-y-1 md:col-span-1">
              <label className="text-[10px] uppercase font-mono font-bold text-slate-500">Сумма (тыс. руб. / руб.) *</label>
              <div className="relative">
                <input
                  type="number"
                  step="any"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.00"
                  className="w-full bg-[#1C1E26] border border-slate-800 text-slate-200 p-3 pl-8 rounded-xl focus:outline-none focus:border-indigo-500 font-mono font-bold"
                  required
                />
                <span className="absolute left-3.5 top-3.5 text-slate-500 font-mono font-bold">₽</span>
              </div>
            </div>

            {/* Date */}
            <div className="space-y-1 md:col-span-1">
              <label className="text-[10px] uppercase font-mono font-bold text-slate-500">Дата операции *</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full bg-[#1C1E26] border border-slate-800 text-slate-200 p-3 rounded-xl focus:outline-none focus:border-indigo-500 font-mono font-bold"
                required
              />
            </div>

            {/* Notes */}
            <div className="space-y-1 md:col-span-1">
              <label className="text-[10px] uppercase font-mono font-bold text-slate-500">Описание / Комментарий</label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Напр. оплата за май"
                className="w-full bg-[#1C1E26] border border-slate-800 text-slate-200 p-3 rounded-xl focus:outline-none focus:border-indigo-500 font-semibold"
              />
            </div>

            {/* Action buttons */}
            <div className="md:col-span-4 flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={handleCloseForm}
                className="bg-[#1C1E26] hover:bg-slate-800 border border-slate-800 text-slate-300 px-4 py-2.5 rounded-xl font-bold cursor-pointer transition active:scale-95 text-xs"
              >
                Отмена
              </button>
              <button
                type="submit"
                className="bg-indigo-600 hover:bg-indigo-500 text-white px-5 py-2.5 rounded-xl font-black cursor-pointer transition active:scale-95 text-xs flex items-center gap-1.5 shadow-lg"
              >
                <Check className="w-4 h-4" />
                {editingExpenseId ? 'Сохранить изменения' : 'Внести в учет'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* 4. Table and list representation */}
      <div className="bg-[#161920] border border-slate-800/80 rounded-2xl overflow-hidden shadow-2xl">
        <div className="px-5 py-4 border-b border-slate-800/60 flex justify-between items-center bg-[#0A0C10]">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest font-mono">Проводки расходов ({filteredExpenses.length})</h3>
          <span className="text-[10px] bg-rose-500/10 border border-rose-500/15 text-rose-400 font-bold font-mono px-2 py-0.5 rounded uppercase">
            Расходный ордер
          </span>
        </div>

        {filteredExpenses.length === 0 ? (
          <div className="p-8 text-center space-y-2">
            <div className="w-12 h-12 bg-[#1C1E26] text-slate-500 rounded-2xl flex items-center justify-center mx-auto border border-slate-800">
              <Receipt className="w-6 h-6" />
            </div>
            <p className="text-xs text-slate-300 font-bold">Нет зарегистрированных расходов</p>
            <p className="text-[11px] text-slate-500 max-w-xs mx-auto">По этим критериям фильтрации не найдено ни одного расхода. Попробуйте сбросить фильтры.</p>
          </div>
        ) : (
          <>
            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto text-xs">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-[#1C1E26]/40 border-b border-slate-800/80 text-slate-450 text-[10px] font-bold uppercase font-mono text-slate-500">
                    <th className="p-4 w-28">Дата</th>
                    <th className="p-4 w-44">Категория</th>
                    <th className="p-4">Описание</th>
                    <th className="p-4 w-32 text-right">Сумма</th>
                    <th className="p-4 w-28 text-center">Действия</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/40 text-slate-300">
                  {filteredExpenses.map(exp => (
                    <tr key={exp.id} className="hover:bg-slate-800/40 transition">
                      <td className="p-4 font-mono font-bold text-[11px]">
                        {exp.date ? new Date(exp.date).toLocaleDateString('ru-RU') : 'N/A'}
                      </td>
                      <td className="p-4 font-bold">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wide ${
                          exp.category === 'Зарплата' ? 'bg-indigo-500/10 text-indigo-400' :
                          exp.category === 'Аренда' ? 'bg-amber-500/10 text-amber-400' :
                          exp.category === 'Закупка товара' ? 'bg-blue-500/10 text-blue-400' :
                          exp.category === 'Маркетинг' ? 'bg-purple-500/10 text-purple-400' :
                          exp.category === 'Коммунальные услуги' ? 'bg-cyan-500/10 text-cyan-400' :
                          exp.category === 'Питание' ? 'bg-orange-500/10 text-orange-400' :
                          'bg-slate-500/10 text-slate-400'
                        }`}>
                          {exp.category}
                        </span>
                      </td>
                      <td className="p-4 text-slate-350 italic">
                        {exp.notes || <span className="text-slate-600">нет комментария</span>}
                      </td>
                      <td className="p-4 font-black text-rose-400 text-right font-mono text-sm">
                        -{exp.amount.toLocaleString()} ₽
                      </td>
                      <td className="p-4 text-center">
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleEditClick(exp)}
                            className="p-1.5 hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-white rounded-lg transition title-edit cursor-pointer"
                            title="Редактировать"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setExpenseToDelete(exp)}
                            className="p-1.5 hover:bg-rose-500/10 border border-transparent hover:border-rose-500/20 text-rose-500 rounded-lg transition cursor-pointer"
                            title="Удалить"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Layout cards */}
            <div className="block md:hidden divide-y divide-slate-800/60">
              {filteredExpenses.map(exp => (
                <div key={exp.id} className="p-4 hover:bg-slate-800/20 space-y-3">
                  <div className="flex justify-between items-start">
                    <div className="space-y-1">
                      <span className="text-[10px] font-mono text-slate-500 font-bold block">
                        {exp.date ? new Date(exp.date).toLocaleDateString('ru-RU') : 'N/A'}
                      </span>
                      <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wide ${
                        exp.category === 'Зарплата' ? 'bg-indigo-500/10 text-indigo-400' :
                        exp.category === 'Аренда' ? 'bg-amber-500/10 text-amber-400' :
                        exp.category === 'Закупка товара' ? 'bg-blue-500/10 text-blue-400' :
                        exp.category === 'Маркетинг' ? 'bg-purple-500/10 text-purple-400' :
                        exp.category === 'Коммунальные услуги' ? 'bg-cyan-500/10 text-cyan-400' :
                        exp.category === 'Питание' ? 'bg-orange-500/10 text-orange-400' :
                        'bg-slate-500/10 text-slate-400'
                      }`}>
                        {exp.category}
                      </span>
                    </div>
                    <div className="text-right">
                      <p className="font-black text-rose-400 font-mono text-sm">-{exp.amount.toLocaleString()} ₽</p>
                    </div>
                  </div>

                  {exp.notes && (
                    <p className="text-[11px] text-slate-400 italic bg-[#1C1E26]/50 p-2.5 rounded-xl border border-slate-800/40">
                      {exp.notes}
                    </p>
                  )}

                  <div className="flex justify-end gap-2 pt-1 border-t border-slate-800/20">
                    <button
                      type="button"
                      onClick={() => handleEditClick(exp)}
                      className="py-2 px-3 bg-[#1C1E26] hover:bg-slate-800 border border-slate-800 text-slate-300 font-bold rounded-xl text-[10px] transition cursor-pointer flex items-center gap-1"
                    >
                      <Edit3 className="w-3.5 h-3.5" /> Редактировать
                    </button>
                    <button
                      type="button"
                      onClick={() => setExpenseToDelete(exp)}
                      className="py-2 px-3 bg-rose-500/5 hover:bg-rose-500/10 border border-rose-500/20 text-rose-400 font-bold rounded-xl text-[10px] transition cursor-pointer flex items-center gap-1"
                    >
                      <Trash2 className="w-3.5 h-3.5" /> Удалить
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* CUSTOM DIALOG: DELETION CONFIRMATION */}
      {expenseToDelete && (
        <div className="fixed inset-0 z-55 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in text-xs">
          <div className="bg-[#12151B] border border-slate-800 rounded-3xl p-6 max-w-sm w-full shadow-2xl space-y-4 text-left">
            <div className="flex items-center gap-3 text-rose-500">
              <div className="p-3 bg-rose-500/10 rounded-2xl shrink-0">
                <AlertCircle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">Удалить операцию?</h3>
                <p className="text-[10px] text-slate-500 uppercase font-mono">Финансовая отмена</p>
              </div>
            </div>
            
            <p className="text-[11px] leading-relaxed text-slate-300">
              Вы хотите исключить из управленческого учета списание по категории <strong className="text-rose-450 font-bold">«{expenseToDelete.category}»</strong> на сумму <strong className="text-white font-mono font-black">{expenseToDelete.amount.toLocaleString()} ₽</strong> за {expenseToDelete.date}? Решение отменить списание повлияет на метрики прибыли в Аналитике.
            </p>
            
            <div className="flex items-center gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setExpenseToDelete(null)}
                className="flex-1 py-3 bg-[#1C1E26] hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-white font-bold rounded-xl text-xs transition cursor-pointer text-center"
              >
                Отмена
              </button>
              <button
                type="button"
                onClick={() => {
                  onDeleteExpense(expenseToDelete.id);
                  setExpenseToDelete(null);
                }}
                className="flex-1 py-3 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-xl text-xs transition cursor-pointer text-center"
              >
                Да, исключить
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
