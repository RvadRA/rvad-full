import React, { useMemo, useState } from 'react';
import { Product, SaleTransaction } from '../types';
import { Package, TrendingDown, Sparkles, Tag, Undo2, CheckCircle2 } from 'lucide-react';

interface DeadStockProps {
  products: Product[];
  sales: SaleTransaction[];
  onUpdateProduct: (product: Product) => void;
}

export default function DeadStock({ products, sales, onUpdateProduct }: DeadStockProps) {
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'info' } | null>(null);

  const showToast = (message: string, type: 'success' | 'info' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };
  const deadStockItems = useMemo(() => {
    const sixtyDaysAgo = new Date();
    sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);

    // Find products with no sales in the last 60 days
    return products.filter(product => {
      const lastSale = sales
        .filter(sale => sale.items.some(item => item.productId === product.id))
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0];
      
      if (!lastSale) return product.stock > 0; // Never sold, but has stock

      return new Date(lastSale.timestamp) < sixtyDaysAgo && product.stock > 0;
    });
  }, [products, sales]);

  const handleApplyMarkdown = (product: Product) => {
    const originalPrice = product.originalPriceSell ?? product.priceSell;
     const proposedPrice = Math.round(originalPrice * 0.6); // 40% discount (leaves 60%)
    
    let newPriceSell = proposedPrice;
    let promoLabel = 'Уценка 40%';
    let msg = `Товар "${product.name}" успешно уценен на 40%! Новая розничная цена: ${newPriceSell} руб.`;
    
    if (proposedPrice < product.priceBuy) {
      if (originalPrice <= product.priceBuy) {
        showToast(`Товар "${product.name}" уже имеет розничную цену на уровне или ниже закупочной (${product.priceBuy} руб.). Уценка невозможна!`, 'info');
        return;
      }
      
      newPriceSell = product.priceBuy;
      const actualDiscountPercent = Math.round(((originalPrice - newPriceSell) / originalPrice) * 100);
      promoLabel = `Уценка ${actualDiscountPercent}%`;
      msg = `Уценка 40% для "${product.name}" превысила бы закуп. Применена максимально возможная уценка на ${actualDiscountPercent}% до закупочной стоимости: ${newPriceSell} руб.`;
    }
    
    
    const updated: Product = {
      ...product,
      originalPriceSell: originalPrice,
      priceSell: newPriceSell,
      isPromo: true,
      promoLabel: promoLabel,
    };
    
    onUpdateProduct(updated);
     showToast(msg, 'success');
      };

  const handleApplyProductOfTheDay = (product: Product) => {
    const originalPrice = product.originalPriceSell ?? product.priceSell;
    const newPriceSell = Math.round(originalPrice * 0.85); // 15% discount (leaves 85%)
    
    const updated: Product = {
      ...product,
      originalPriceSell: originalPrice,
      priceSell: newPriceSell,
      isPromo: true,
      promoLabel: 'Товар Дня',
    };
    
    onUpdateProduct(updated);
    showToast(`Товар "${product.name}" объявлен Товаром Дня! Новая цена со скидкой 15%: ${newPriceSell} руб.`, 'success');
  };

  const handleResetPromo = (product: Product) => {
    if (!product.originalPriceSell) return;
    
    // Restore original price and remove promo tags
    const updated: Product = {
      ...product,
      priceSell: product.originalPriceSell,
      isPromo: false,
      promoLabel: null,
      originalPriceSell: null,
    };
    
    onUpdateProduct(updated);
    showToast(`Акция сброшена для "${product.name}". Возвращена исходная цена: ${product.originalPriceSell} руб.`, 'info');
  };
  return (
    <div className="space-y-6 relative">
      {/* Toast Notification System inside the TAB */}
      {toast && (
        <div className="fixed bottom-20 right-6 z-50 bg-[#1e2330] border border-emerald-500/30 text-emerald-400 px-4 py-3 rounded-2xl shadow-2xl flex items-center gap-3 animate-in fade-in duration-300">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          <span className="text-xs font-bold font-sans tracking-wide text-slate-200">{toast.message}</span>
        </div>
      )}

      <div className="bg-[#161920] p-5 rounded-3xl border border-slate-800/80 shadow-2xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
       <div className="bg-amber-500/20 p-3 rounded-2xl border border-amber-500/30">
          <Package className="w-6 h-6 text-amber-400" />
        </div>
        <div>
          <h2 className="text-xl font-black text-white">Мертвый Груз (AI Маркетинг)</h2>
            <p className="text-slate-500 text-xs font-mono mt-1">Товары без движений за последние 60 дней. Действуйте, чтобы ускорить оборачиваемость!</p>
          </div>
        </div>
        <div className="bg-[#1C1E26] px-4 py-2.5 rounded-2xl border border-slate-800/50 flex items-center gap-2.5 shrink-0 self-start md:self-auto">
          <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
          <span className="text-xs text-slate-400 font-mono font-bold">Выявлено позиций: {deadStockItems.length}</span>
     </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
               {deadStockItems.map(item => {
          const originalPrice = item.originalPriceSell ?? item.priceSell;
          
          return (
            <div key={item.id} className="bg-[#161920] rounded-3xl border border-slate-800 p-5 shadow-xl flex flex-col justify-between hover:border-slate-700/80 transition-all duration-300 relative overflow-hidden group">
              {item.isPromo && (
                <div className="absolute top-0 right-0 bg-emerald-500/10 border-b border-l border-emerald-500/30 px-3 py-1 rounded-bl-xl text-[10px] font-bold text-emerald-400 font-mono flex items-center gap-1.5 animate-pulse">
                  {item.promoLabel === 'Товар Дня' ? <Sparkles className="w-3 h-3 text-amber-400 shrink-0" /> : <Tag className="w-3 h-3 text-emerald-400 shrink-0" />}
                  {item.promoLabel}
                </div>
              )}

              <div className="space-y-2">
                <div className="bg-slate-900/45 p-1 rounded-2xl w-fit border border-slate-800/60 text-[9px] font-mono text-slate-500">
                  Артикул: {item.sku}
                </div>
                <h3 className="font-bold text-white text-sm leading-snug pr-16">{item.name}</h3>
                <p className="text-xs text-slate-400 font-sans">
                  Текущий остаток: <span className="text-amber-400 font-black font-mono">{item.stock} {item.unit}</span>
                </p>
                
                <div className="mt-4 pt-3 border-t border-slate-800/50 flex items-baseline justify-between">
                  <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider font-mono">Цена продажи:</span>
                  <div className="flex items-center gap-2">
                    {item.isPromo && item.originalPriceSell && (
                      <span className="text-xs text-slate-500 font-mono line-through">{item.originalPriceSell} р.</span>
                    )}
                    <span className={`text-base font-black font-mono ${item.isPromo ? 'text-emerald-400' : 'text-slate-200'}`}>
                      {item.priceSell} руб.
                    </span>
                  </div>
                </div>
              </div>
              
              <div className="mt-5 space-y-2.5">
                {item.isPromo ? (
                  <button 
                    onClick={() => handleResetPromo(item)}
                    className="w-full bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white px-3 py-2 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 border border-slate-700/80 cursor-pointer"
                  >
                    <Undo2 className="w-3.5 h-3.5 text-slate-400" />
                    Сбросить акцию
                  </button>
                ) : (
                  <div className="flex gap-2">
                    <button 
                      onClick={() => handleApplyMarkdown(item)}
                      className="flex-1 bg-amber-600/10 hover:bg-amber-600 text-amber-400 hover:text-white px-3 py-2 rounded-xl border border-amber-500/20 text-xs font-bold transition cursor-pointer flex items-center justify-center gap-1"
                    >
                      <Tag className="w-3 h-3 text-amber-400 hover:text-white shrink-0" />
                      Уценка 40%
                    </button>
                    <button 
                      onClick={() => handleApplyProductOfTheDay(item)}
                      className="flex-1 bg-indigo-600/10 hover:bg-indigo-600 text-indigo-400 hover:text-white px-3 py-2 rounded-xl border border-indigo-500/20 text-xs font-bold transition cursor-pointer flex items-center justify-center gap-1"
                    >
                      <Sparkles className="w-3 h-3 text-indigo-400 hover:text-white shrink-0" />
                      Товар Дня
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
         {deadStockItems.length === 0 && (
          <div className="col-span-full text-center py-20 text-slate-500 bg-[#161920]/50 rounded-3xl border border-slate-800/80 border-dashed">
            <TrendingDown className="w-12 h-12 mx-auto mb-3 opacity-20" />
            <p className="text-sm font-bold">Неликвидных товаров не обнаружено.</p>
          </div>
        )}
      </div>
    </div>
  );
}
