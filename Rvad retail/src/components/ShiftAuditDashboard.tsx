import React from 'react';
import { Employee, UserRole } from '../types';
import { Shield, Clock, Users, LogOut } from 'lucide-react';

interface ShiftAuditDashboardProps {
  employees: Employee[];
  onCloseShift: () => void;
}

export default function ShiftAuditDashboard({ employees, onCloseShift }: ShiftAuditDashboardProps) {
  const onlineEmployees = employees.filter(e => e.isOnline && e.status === 'ACTIVE');
  
  return (
    <div className="space-y-6">
      <div className="bg-[#161920] p-5 rounded-3xl border border-slate-800/80 shadow-2xl flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="bg-indigo-500/20 p-3 rounded-2xl border border-indigo-500/30">
            <Shield className="w-6 h-6 text-indigo-400" />
          </div>
          <div>
            <h2 className="text-xl font-black text-white">Быстрый Аудит Смены (B3S)</h2>
            <p className="text-slate-500 text-xs font-mono mt-1">Текущий статус смены и онлайн-операторы</p>
          </div>
        </div>
        
        <div className="flex items-center gap-6">
          <div className="text-right">
            <div className="text-3xl font-black text-white">{onlineEmployees.length} / {employees.length}</div>
            <p className="text-slate-500 text-[10px] uppercase font-mono tracking-widest">Операторов в сети</p>
          </div>

          <button
            onClick={() => {
              // Direct call - App.tsx internal logic can handle confirmation if needed 
              // but we've seen confirm() can be flaky in some iframe environments
              onCloseShift();
            }}
            className="bg-rose-600 hover:bg-rose-500 text-white px-4 py-2.5 rounded-xl font-bold text-xs flex items-center gap-2 transition-all active:scale-95 cursor-pointer shadow-lg shadow-rose-900/20"
          >
            <LogOut className="w-4 h-4" />
            Закрыть смену
          </button>
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {employees.map(emp => (
          <div key={emp.id} className="bg-[#161920] p-4 rounded-2xl border border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`w-3 h-3 rounded-full ${emp.isOnline ? 'bg-emerald-500' : 'bg-slate-700'}`} />
              <div>
                <span className="font-bold text-slate-200 text-sm">{emp.name}</span>
                <span className="text-[10px] block text-slate-500 font-mono">{emp.role}</span>
              </div>
            </div>
            {emp.isOnline && <Clock className="w-4 h-4 text-emerald-400" />}
          </div>
        ))}
      </div>
    </div>
  );
}
