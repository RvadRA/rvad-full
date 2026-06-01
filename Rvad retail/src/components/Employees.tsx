import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Employee, UserRole, EmployeeDocument } from '../types';
import { Users, Plus, Shield, Search, Calendar, FileText, AlertTriangle, Edit, Trash2, CheckCircle2, FileImage } from 'lucide-react';
import { api } from '../utils/api';

interface EmployeesProps {
  employees: Employee[];
  onAddEmployee: (e: Omit<Employee, 'id'>) => void;
  onUpdateEmployee: (e: Employee) => void;
  onDeleteEmployee: (id: string) => void;
}

export default function Employees({
  employees,
  onAddEmployee,
  onUpdateEmployee,
  onDeleteEmployee
}: EmployeesProps) {
  const [searchTerm, setSearchTerm] = useState('');
  
  // Modals state
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  
  // Form fields
  const [name, setName] = useState('');
  const [role, setRole] = useState<UserRole>(UserRole.CASHIER);
  const [phone, setPhone] = useState('');
  const [telegramChatId, setTelegramChatId] = useState('');
  const [pin, setPin] = useState('');

  // Documents state for selected employee
  const [showDocsModal, setShowDocsModal] = useState(false);
  
  // Calculate alerts (deadlines)
  const alerts = useMemo(() => {
    const today = new Date();
    const warns: { emp: Employee, doc: EmployeeDocument, type: 'EXPIRY' | 'PAYMENT', msg: string }[] = [];
    
    employees.forEach(emp => {
      emp.documents.forEach(doc => {
        // Expiry check
        if (doc.expiryDate) {
          const expDate = new Date(doc.expiryDate);
          const diffDays = Math.ceil((expDate.getTime() - today.getTime()) / (1000 * 3600 * 24));
          if (diffDays <= 14 && diffDays >= 0) {
            warns.push({ emp, doc, type: 'EXPIRY', msg: `Срок действия документа истекает через ${diffDays} дн. (${doc.expiryDate})` });
          } else if (diffDays < 0) {
            warns.push({ emp, doc, type: 'EXPIRY', msg: `Документ просрочен на ${Math.abs(diffDays)} дн!` });
          }
        }
        
        // Monthly payment check logic
        // Assuming payment is due every month on the same day as issueDate. Let's just find the next missing payment.
        if (doc.monthlyPayments && doc.monthlyPayments.length > 0) {
            // Very simplified: check last payment date vs today. If > 20 days since last payment, warn.
            // A real app would project the next exact date. For now, we approximate based on the latest payment.
            const latestPayment = doc.monthlyPayments.reduce((latest, p) => {
                const pd = new Date(p.date);
                return pd > latest ? pd : latest;
            }, new Date(0));
            
            const diffFromLastPayment = Math.ceil((today.getTime() - latestPayment.getTime()) / (1000 * 3600 * 24));
            if (diffFromLastPayment >= 20 && diffFromLastPayment < 30) {
                const daysLeft = 30 - diffFromLastPayment;
                warns.push({ emp, doc, type: 'PAYMENT', msg: `Очередная оплата (патент) ожидается через ${daysLeft} дн.` });
            } else if (diffFromLastPayment >= 30) {
                warns.push({ emp, doc, type: 'PAYMENT', msg: `Просрочена ежемесячная оплата (${diffFromLastPayment} дн. с последней)` });
            }
        }
      });
    });
    
    return warns;
  }, [employees]);

  // Telegram notification sender
  const sendTelegramNotification = async (chatId: string, message: string) => {
    try {
      await api.telegram.send(chatId, message, 'internal');
    } catch (e) {
      console.error('Failed to send telegram msg:', e);
    }
  };

  const notifiedAlerts = useRef<Set<string>>(new Set());
  useEffect(() => {
    alerts.forEach(alert => {
        const key = `${alert.emp.id}-${alert.doc.id}-${alert.type}`;
        if (alert.emp.telegramChatId && !notifiedAlerts.current.has(key)) {
            sendTelegramNotification(alert.emp.telegramChatId, `⚠️ ${alert.emp.name}, внимание: ${alert.msg}`);
            notifiedAlerts.current.add(key);
        }
    });
  }, [alerts]);

  const filteredEmployees = employees.filter(e => 
    e.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    e.phone.includes(searchTerm)
  );

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name) return;
    
    if (pin && !/^\d{4,6}$/.test(pin)) {
      alert('Ошибка: ПИН-код должен состоять из 4-6 цифр для быстрой авторизации!');
      return;
    }
    
    if (selectedEmployee) {
      onUpdateEmployee({
        ...selectedEmployee,
        name,
        role,
        phone,
        pin: pin || undefined,
        telegramChatId,
      });
    } else {
      onAddEmployee({
        name,
        role,
        phone,
        pin: pin || undefined,
        telegramChatId,
        status: 'ACTIVE',
        documents: [],
        joinDate: new Date().toISOString()
      });
    }
    
    setShowAddModal(false);
    setSelectedEmployee(null);
    setName('');
    setPhone('');
    setTelegramChatId('');
    setPin('');
    setRole(UserRole.CASHIER);
  };
  
  const openEdit = (emp: Employee) => {
    setSelectedEmployee(emp);
    setName(emp.name);
    setRole(emp.role);
    setPhone(emp.phone);
    setTelegramChatId(emp.telegramChatId || '');
    setPin(emp.pin || '');
    setShowAddModal(true);
  };

  return (
    <div className="space-y-6">
      {/* ALERTS SECTION */}
      {alerts.length > 0 && (
        <div className="bg-rose-500/10 border border-rose-500/30 p-4 rounded-3xl space-y-3">
          <div className="flex items-center gap-2 text-rose-400 font-bold mb-2">
            <AlertTriangle className="w-5 h-5" />
            <h3 className="uppercase tracking-wider text-sm font-mono">Требуется Внимание: Кадры и Документы</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {alerts.map((alert, i) => (
              <div key={i} className="bg-[#1C1E26]/80 p-3 rounded-2xl border border-rose-500/20 text-xs flex gap-3">
                <div className="bg-rose-500/20 p-2 rounded-xl h-fit">
                  {alert.type === 'EXPIRY' ? <FileText className="w-4 h-4 text-rose-400" /> : <Calendar className="w-4 h-4 text-amber-400" />}
                </div>
                <div>
                  <p className="font-bold text-slate-200">{alert.emp.name}</p>
                  <p className="text-[10px] text-slate-400 uppercase font-mono">{alert.doc.type} #{alert.doc.number}</p>
                  <p className="text-rose-400 font-mono mt-1 font-semibold">{alert.msg}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* HEADER & CONTROLS */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-[#161920] p-5 rounded-3xl border border-slate-800/80 shadow-2xl">
        <div className="flex items-center gap-3">
          <div className="bg-indigo-500/20 p-3 rounded-2xl border border-indigo-500/30">
            <Users className="w-6 h-6 text-indigo-400" />
          </div>
          <div>
            <h2 className="text-xl font-black text-white">Реестр Персонала</h2>
            <p className="text-slate-500 text-xs font-mono mt-1">Доступы, патенты, история сотрудников</p>
          </div>
        </div>
        
        <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto">
          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Поиск сотрудника..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-[#0A0C10] border border-slate-700 pl-9 pr-4 py-2 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
            />
          </div>
          <button
            onClick={() => {
              setSelectedEmployee(null);
              setName('');
              setPhone('');
              setRole(UserRole.CASHIER);
              setShowAddModal(true);
            }}
            className="w-full sm:w-auto flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-xl text-xs font-bold transition shadow-lg shadow-indigo-900/20"
          >
            <Plus className="w-4 h-4" />
            Добавить
          </button>
        </div>
      </div>

      {/* EMPLOYEES GRID */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredEmployees.map(emp => (
          <div key={emp.id} className="bg-[#161920] rounded-3xl border border-slate-800 p-5 shadow-xl flex flex-col justify-between">
            <div>
              <div className="flex justify-between items-start mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center text-slate-300 font-bold border border-slate-700 uppercase">
                    {emp.name.substring(0, 2)}
                  </div>
                  <div>
                    <h3 className="font-bold text-white text-sm">{emp.name}</h3>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <Shield className={`w-3 h-3 ${emp.role === UserRole.OWNER ? 'text-rose-400' : emp.role === UserRole.ADMIN ? 'text-amber-400' : 'text-blue-400'}`} />
                      <span className="text-[10px] text-slate-400 font-mono uppercase tracking-wider">{emp.role}</span>
                    </div>
                  </div>
                </div>
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${emp.status === 'ACTIVE' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-slate-700 text-slate-400'}`}>
                  {emp.status === 'ACTIVE' ? 'Активен' : 'Отключен'}
                </span>
              </div>
              
              <div className="space-y-1 mt-4">
                <p className="text-xs text-slate-400 flex justify-between"><span className="text-slate-500">Телефон:</span> <span className="font-mono text-slate-200">{emp.phone || '—'}</span></p>
                <p className="text-xs text-slate-400 flex justify-between"><span className="text-slate-500">Принят:</span> <span className="font-mono text-slate-200">{new Date(emp.joinDate).toLocaleDateString('ru-RU')}</span></p>
                <p className="text-xs text-slate-400 flex justify-between"><span className="text-slate-500">Документов:</span> <span className="font-mono text-indigo-400 font-bold">{emp.documents?.length || 0}</span></p>
                <p className="text-xs text-slate-400 flex justify-between">
                  <span className="text-slate-500">ПИН-код авторизации:</span>
                  <span className="font-mono text-indigo-300 font-bold">{emp.pin ? `🔑 ${emp.pin}` : '⚠️ Не задан (без пароля)'}</span>
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-2 mt-5 border-t border-slate-800 pt-4">
              <button
                onClick={() => {
                  setSelectedEmployee(emp);
                  setShowDocsModal(true);
                }}
                className="flex-1 flex justify-center items-center gap-1.5 py-1.5 bg-[#1C1E26] hover:bg-slate-800 border border-slate-700 rounded-lg text-xs font-semibold text-slate-300 transition"
              >
                <FileText className="w-3.5 h-3.5" />
                Документы
              </button>
              <button
                onClick={() => openEdit(emp)}
                className="p-1.5 bg-[#1C1E26] hover:bg-amber-500/20 border border-slate-700 hover:border-amber-500/30 rounded-lg text-slate-400 hover:text-amber-400 transition"
                title="Редактировать"
              >
                <Edit className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => {
                  if (window.confirm(`Отключить/Удалить сотрудника ${emp.name}?`)) {
                    onDeleteEmployee(emp.id);
                  }
                }}
                className="p-1.5 bg-[#1C1E26] hover:bg-rose-500/20 border border-slate-700 hover:border-rose-500/30 rounded-lg text-slate-400 hover:text-rose-400 transition"
                title="Удалить"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {filteredEmployees.length === 0 && (
        <div className="text-center py-20 text-slate-500 bg-[#161920]/50 rounded-3xl border border-slate-800/80 border-dashed">
          <Users className="w-12 h-12 mx-auto mb-3 opacity-20" />
          <p className="text-sm font-bold">Сотрудники не найдены</p>
        </div>
      )}

      {/* ADD/EDIT EMPLOYEE MODAL */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#0A0C10] rounded-3xl p-6 w-full max-w-md border border-slate-800/80 shadow-2xl">
            <h3 className="font-extrabold text-white text-lg mb-4">
              {selectedEmployee ? 'Редактировать сотрудника' : 'Новый сотрудник'}
            </h3>
            
            <form onSubmit={handleAddSubmit} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs text-slate-400 font-bold uppercase tracking-wider block">ФИО</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-[#1C1E26] border border-slate-700 p-2.5 rounded-xl text-white focus:border-indigo-500 focus:outline-none"
                  placeholder="Иванов Иван..."
                />
              </div>
              
              <div className="space-y-1">
                <label className="text-xs text-slate-400 font-bold uppercase tracking-wider block">Телефон</label>
                <input
                  type="text"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full bg-[#1C1E26] border border-slate-700 p-2.5 rounded-xl text-white focus:border-indigo-500 focus:outline-none font-mono"
                  placeholder="+7 (999) 000-00-00"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs text-slate-400 font-bold uppercase tracking-wider block">Telegram Chat ID</label>
                <input
                  type="text"
                  value={telegramChatId}
                  onChange={(e) => setTelegramChatId(e.target.value)}
                  className="w-full bg-[#1C1E26] border border-slate-700 p-2.5 rounded-xl text-white focus:border-indigo-500 focus:outline-none font-mono"
                  placeholder="123456789"
                />
              </div>
              
              <div className="space-y-1">
                <label className="text-xs text-slate-400 font-bold uppercase tracking-wider block">ПИН-код авторизации (4-6 цифр)</label>
                <input
                  type="text"
                  maxLength={6}
                  value={pin}
                  onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
                  className="w-full bg-[#1C1E26] border border-slate-700 p-2.5 rounded-xl text-white focus:border-indigo-500 focus:outline-none font-mono"
                  placeholder="Например: 1111"
                />
                <p className="text-[10px] text-slate-500 italic">
                  Безопасный короткий код для аутентификации этого пользователя.
                </p>
              </div>
              
              <div className="space-y-1">
                <label className="text-xs text-slate-400 font-bold uppercase tracking-wider block">Должность / Доступ</label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value as UserRole)}
                  className="w-full bg-[#1C1E26] border border-slate-700 p-2.5 rounded-xl text-white focus:border-indigo-500 focus:outline-none"
                >
                  <option value={UserRole.CASHIER}>Кассир (POS)</option>
                  <option value={UserRole.WAREHOUSE}>Кладовщик</option>
                  <option value={UserRole.ADMIN}>Администратор</option>
                  <option value={UserRole.OWNER}>Владелец</option>
                </select>
              </div>

              <div className="flex gap-2 pt-4">
                <button type="submit" className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-2.5 rounded-xl text-sm transition">
                  Сохранить
                </button>
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-5 border border-slate-600 text-slate-300 hover:bg-slate-800 rounded-xl text-sm font-bold transition"
                >
                  Отмена
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DOCUMENTS MANAGEMENT MODAL */}
      {showDocsModal && selectedEmployee && (
        <EmployeeDocumentsModal 
          employee={selectedEmployee}
          onClose={() => setShowDocsModal(false)}
          onUpdate={(updated) => onUpdateEmployee(updated)}
        />
      )}
    </div>
  );
}

// Inner Component for handling Documents Modal logic
function EmployeeDocumentsModal({ employee, onClose, onUpdate }: { employee: Employee, onClose: () => void, onUpdate: (e: Employee) => void }) {
  const [docType, setDocType] = useState('Патент');
  const [docNumber, setDocNumber] = useState('');
  const [issueDate, setIssueDate] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [notes, setNotes] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null);

  const handleAddDocument = (e: React.FormEvent) => {
    e.preventDefault();
    if (!docType || !docNumber) return;
    
    const newDoc: EmployeeDocument = {
      id: `doc-${Date.now()}`,
      type: docType,
      number: docNumber,
      issueDate,
      expiryDate,
      notes,
      scans: [], // In real app, handling file uploads
      monthlyPayments: []
    };
    
    const updated = {
      ...employee,
      documents: [...(employee.documents || []), newDoc]
    };
    
    onUpdate(updated);
    setShowAddForm(false);
    setDocNumber('');
    setIssueDate('');
    setExpiryDate('');
  };
  
  const handleAddPayment = (docId: string) => {
      const amount = prompt("Сумма чека за месяц (руб):");
      if (!amount || isNaN(Number(amount))) return;
      
      const pDate = new Date().toISOString();
      const updatedDocs = employee.documents.map(d => {
          if (d.id === docId) {
              return {
                  ...d,
                  monthlyPayments: [...(d.monthlyPayments || []), { date: pDate, amount: Number(amount) }]
              };
          }
          return d;
      });
      onUpdate({ ...employee, documents: updatedDocs });
  };
  
  const deleteDoc = (docId: string) => {
      if (window.confirm("Удалить этот документ?")) {
        onUpdate({ ...employee, documents: employee.documents.filter(d => d.id !== docId) });
      }
  };

  return (
    <div className="fixed inset-0 bg-black/90 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-[#0A0C10] rounded-3xl w-full max-w-4xl border border-slate-800/80 shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
        <div className="p-5 border-b border-slate-800 flex justify-between items-center bg-[#161920]">
          <div>
            <h3 className="font-extrabold text-white text-lg flex items-center gap-2">
              <FileText className="w-5 h-5 text-indigo-400" />
              Документы: {employee.name}
            </h3>
            <p className="text-xs text-slate-500 font-mono mt-0.5">Управление патентами, визами и историей оплат</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white font-bold text-sm">✕ Закрыть</button>
        </div>

        <div className="p-5 overflow-y-auto flex-1 space-y-6">
          {!showAddForm ? (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h4 className="text-sm font-bold text-slate-300 uppercase tracking-widest font-mono">Прикрепленные документы ({employee.documents?.length || 0})</h4>
                <button
                  onClick={() => setShowAddForm(true)}
                  className="bg-indigo-600/20 text-indigo-400 hover:bg-indigo-600 hover:text-white px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5" /> Добавить
                </button>
              </div>

              {employee.documents && employee.documents.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {employee.documents.map(doc => (
                    <div key={doc.id} className="bg-[#1C1E26] border border-slate-700 p-4 rounded-2xl flex flex-col justify-between">
                      <div>
                        <div className="flex justify-between items-start mb-2">
                          <span className="bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 px-2 py-0.5 rounded text-[10px] font-bold uppercase">{doc.type}</span>
                          <button onClick={() => deleteDoc(doc.id)} className="text-slate-500 hover:text-rose-400 p-1"><Trash2 className="w-3.5 h-3.5" /></button>
                        </div>
                        <p className="font-bold text-white font-mono text-sm mb-2">№ {doc.number}</p>
                        <div className="text-xs text-slate-400 space-y-1 font-mono">
                          <p>Действует до: {doc.expiryDate ? new Date(doc.expiryDate).toLocaleDateString('ru') : 'бессрочно'}</p>
                          <p>Выдан: {doc.issueDate ? new Date(doc.issueDate).toLocaleDateString('ru') : '—'}</p>
                        </div>
                      </div>
                      
                      <div className="mt-4 pt-3 border-t border-slate-700/50">
                        <div className="flex justify-between items-center mb-2">
                          <span className="text-[10px] uppercase text-slate-500 font-bold">Чеки/Оплаты: {doc.monthlyPayments?.length || 0}</span>
                          <button onClick={() => handleAddPayment(doc.id)} className="text-[10px] bg-slate-800 text-slate-300 hover:bg-emerald-600 hover:text-white px-2 py-1 rounded transition font-bold">
                            + Чек за месяц
                          </button>
                        </div>
                        {doc.monthlyPayments && doc.monthlyPayments.length > 0 ? (
                           <div className="max-h-24 overflow-y-auto space-y-1 pr-1">
                               {doc.monthlyPayments.slice().reverse().map((p, idx) => (
                                   <div key={idx} className="flex justify-between items-center text-[10px] font-mono bg-[#161920] p-1.5 rounded">
                                       <span className="text-slate-400">{new Date(p.date).toLocaleDateString('ru')}</span>
                                       <span className="text-emerald-400 font-bold">{p.amount} руб</span>
                                   </div>
                               ))}
                           </div>
                        ) : (
                            <p className="text-[10px] text-slate-600 italic">Нет зафиксированных оплат</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="bg-[#1C1E26] p-8 rounded-2xl text-center border border-slate-800 border-dashed">
                  <FileImage className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                  <p className="text-xs text-slate-400">У сотрудника нет прикрепленных документов.</p>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <h4 className="text-sm font-bold text-white uppercase font-mono">Добавление документа</h4>
              <form onSubmit={handleAddDocument} className="space-y-3 bg-[#1C1E26] p-4 rounded-2xl border border-slate-700">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs text-slate-400 font-bold uppercase">Тип документа</label>
                    <select value={docType} onChange={e => setDocType(e.target.value)} className="w-full bg-[#0A0C10] border border-slate-700 p-2 rounded-xl text-white text-sm focus:outline-none">
                      <option>Патент</option>
                      <option>Паспорт / ID</option>
                      <option>Регистрация (СНИЛС)</option>
                      <option>РВП / ВНЖ</option>
                      <option>Мед. Книжка</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-slate-400 font-bold uppercase">Номер документа</label>
                    <input type="text" required value={docNumber} onChange={e => setDocNumber(e.target.value)} className="w-full bg-[#0A0C10] border border-slate-700 p-2 rounded-xl text-white text-sm focus:outline-none font-mono" placeholder="77 2341235" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-slate-400 font-bold uppercase">Дата выдачи</label>
                    <input type="date" value={issueDate} onChange={e => setIssueDate(e.target.value)} className="w-full bg-[#0A0C10] border border-slate-700 p-2 rounded-xl text-white text-sm focus:outline-none" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-slate-400 font-bold uppercase">Действует до</label>
                    <input type="date" value={expiryDate} onChange={e => setExpiryDate(e.target.value)} className="w-full bg-[#0A0C10] border border-slate-700 p-2 rounded-xl text-white text-sm focus:outline-none" />
                  </div>
                  <div className="space-y-1 sm:col-span-2">
                    <label className="text-xs text-slate-400 font-bold uppercase">Примечания</label>
                    <input type="text" value={notes} onChange={e => setNotes(e.target.value)} className="w-full bg-[#0A0C10] border border-slate-700 p-2 rounded-xl text-white text-sm focus:outline-none" placeholder="..." />
                  </div>
                </div>
                
                <div className="flex gap-2 pt-3 mt-3 border-t border-slate-700">
                  <button type="submit" className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-2 px-4 rounded-xl text-xs transition">Сохранить документ</button>
                  <button type="button" onClick={() => setShowAddForm(false)} className="bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold py-2 px-4 rounded-xl text-xs transition">Отмена</button>
                </div>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
