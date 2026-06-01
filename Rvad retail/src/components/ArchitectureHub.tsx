/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Database, FileCode, Server, ListCollapse, KeyRound, Award, RefreshCw, Smartphone, TrendingUp, Cpu, HelpCircle } from 'lucide-react';

interface TabItem {
  id: string;
  name: string;
  icon: any;
  content: React.ReactNode;
}

export default function ArchitectureHub() {
  const [activeTab, setActiveTab] = useState<string>('database');

  const tabs: TabItem[] = [
    {
      id: 'database',
      name: 'База данных SQL',
      icon: Database,
      content: (
        <div className="space-y-6">
          <div className="border bg-slate-50 p-4 rounded-xl border-slate-200">
            <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2 mb-2">
              <Database className="w-4 h-4 text-emerald-600" /> PostgreSQL Реляционная Схема (Архитектура для Продакшна)
            </h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Рекомендуемая реляционная структура для работы розничной ОС на СУБД PostgreSQL. Спроектировано с учетом поддержки высокой нагрузки при поиске по штрихкодам, журналирования кассовых операций и автоматической синхронизации офлайн-пакетов.
            </p>
          </div>

          <div className="font-mono text-xs bg-slate-950 text-emerald-400 p-4 rounded-lg overflow-x-auto border border-emerald-950 shadow-inner max-h-[480px]">
            <pre>{`-- === СХЕМА СУБД RETAIL_OS (POSTGRESQL 15+) ===

-- 1. Справочник категорий
CREATE TABLE categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL UNIQUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. Справочник поставщиков
CREATE TABLE suppliers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(150) NOT NULL,
    company VARCHAR(150),
    phone VARCHAR(30) NOT NULL,
    debt NUMERIC(15, 2) DEFAULT 0.00,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3. Каталог товаров
CREATE TABLE products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    barcode VARCHAR(128) NOT NULL UNIQUE,
    sku VARCHAR(64) UNIQUE,
    category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
    price_buy NUMERIC(12, 2) NOT NULL,
    price_sell NUMERIC(12, 2) NOT NULL,
    stock NUMERIC(12, 3) NOT NULL DEFAULT 0.000,
    min_stock NUMERIC(12, 3) NOT NULL DEFAULT 5.000,
    unit VARCHAR(20) DEFAULT 'шт',
    supplier_id UUID REFERENCES suppliers(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 4. Справочник клиентов (CRM)
CREATE TABLE customers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(150) NOT NULL,
    phone VARCHAR(30) NOT NULL UNIQUE,
    debt NUMERIC(15, 2) DEFAULT 0.00,
    debt_limit NUMERIC(15, 2) DEFAULT 5000.00,
    loyalty_points INTEGER DEFAULT 0,
    discount_percent INT DEFAULT 0,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 5. Журнал продаж (Продажи / Транзакции)
CREATE TABLE sales (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    cashier_name VARCHAR(100) NOT NULL,
    customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
    total_price_buy NUMERIC(15, 2) NOT NULL,
    total_before_discount NUMERIC(15, 2) NOT NULL,
    total_discount NUMERIC(15, 2) DEFAULT 0.00,
    final_price NUMERIC(15, 2) NOT NULL,
    payment_method VARCHAR(20) NOT NULL CHECK (payment_method IN ('CASH', 'CARD', 'DEBT', 'SPLIT')),
    paid_cash NUMERIC(15, 2) DEFAULT 0.00,
    paid_card NUMERIC(15, 2) DEFAULT 0.00,
    paid_debt NUMERIC(15, 2) DEFAULT 0.00, -- Сумма записанная на долг
    sync_status VARCHAR(20) DEFAULT 'PENDING' CHECK (sync_status IN ('PENDING', 'SYNCED', 'CONFLICT'))
);

-- 6. Спецификация продаж (Детализация товаров в корзине)
CREATE TABLE sale_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sale_id UUID REFERENCES sales(id) ON DELETE CASCADE,
    product_id UUID REFERENCES products(id),
    product_name VARCHAR(255) NOT NULL,
    quantity NUMERIC(12, 3) NOT NULL,
    price_buy NUMERIC(12, 2) NOT NULL,
    price_sell NUMERIC(12, 2) NOT NULL,
    discount_percent INT DEFAULT 0
);

-- 7. Офлайн-очередь синхронизации (Очередь API)
CREATE TABLE sync_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id VARCHAR(100) NOT NULL,
    task_type VARCHAR(50) NOT NULL, -- 'SALE_TRANSACTION', 'DEBT_PAYMENT', 'STOCK_CORRECTION'
    payload JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    processed_at TIMESTAMP WITH TIME ZONE,
    status VARCHAR(20) DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'SUCCESS', 'FAILED', 'CONFLICT'))
);

-- 8. Системные логи безопасности (Аудит)
CREATE TABLE security_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    user_name VARCHAR(100) NOT NULL,
    user_role VARCHAR(30) NOT NULL,
    action VARCHAR(100) NOT NULL,
    details TEXT,
    severity VARCHAR(20) DEFAULT 'INFO'
);

-- 9. Персонал (Сотрудники)
CREATE TABLE employees (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(150) NOT NULL,
    role VARCHAR(50) NOT NULL,
    phone VARCHAR(30) NOT NULL,
    telegram_chat_id VARCHAR(50),
    status VARCHAR(20) DEFAULT 'ACTIVE',
    join_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 10. Документы сотрудников
CREATE TABLE employee_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id UUID REFERENCES employees(id) ON DELETE CASCADE,
    type VARCHAR(100) NOT NULL,
    document_number VARCHAR(100),
    issue_date DATE,
    expiry_date DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 11. Платежи по документам (Патенты)
CREATE TABLE employee_document_payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID REFERENCES employee_documents(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    amount NUMERIC(12, 2) NOT NULL,
    notes TEXT
);

-- ИНДЕКСЫ ДЛЯ СВЕРХБЫСТРОЙ РАБОТЫ (Индексация штрихкодов и дат)
CREATE INDEX idx_products_barcode ON products (barcode);
CREATE INDEX idx_products_sku ON products (sku);
CREATE INDEX idx_sales_timestamp ON sales (timestamp DESC);
CREATE INDEX idx_customers_phone ON customers (phone);
CREATE INDEX idx_sync_queue_status ON sync_queue (status) WHERE status = 'PENDING';`}</pre>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="border p-4 rounded-xl border-slate-200">
              <h4 className="text-xs font-bold text-slate-800 uppercase tracking-widest mb-1">Индексация B-Tree по Штрихкоду</h4>
              <p className="text-xs text-slate-600 leading-relaxed">
                Позволяет терминалу POS мгновенно находить товары из миллиона записей за &lt;0.5 мс. Запросы <code>WHERE barcode = 'X'</code> защищены уникальным индексом.
              </p>
            </div>
            <div className="border p-4 rounded-xl border-slate-200">
              <h4 className="text-xs font-bold text-slate-800 uppercase tracking-widest mb-1">Поля JSONB в Очереди (sync_queue)</h4>
              <p className="text-xs text-slate-600 leading-relaxed">
                Использование СУБД PostgreSQL JSONB гарантирует безболезненное хранение пакетов синхронизации любой сложности при сохранении высокой скорости чтения.
              </p>
            </div>
          </div>
        </div>
      )
    },
    {
      id: 'api-spec',
      name: 'Структура REST API',
      icon: Server,
      content: (
        <div className="space-y-4">
          <div className="border bg-slate-50 p-4 rounded-xl border-slate-200">
            <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2 mb-1">
              <Server className="w-4 h-4 text-sky-600" /> Проектирование REST API Эндпоинтов (v1)
            </h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Спецификация API для интеграции локальных кассовых терминалов и POS-приложений с центральным Express/Node.js сервером.
            </p>
          </div>

          <div className="border rounded-lg overflow-hidden border-slate-200 text-xs">
            <div className="grid grid-cols-12 bg-slate-100 font-bold p-2 text-slate-700 uppercase tracking-wider">
              <div className="col-span-2">Метод</div>
              <div className="col-span-4">Эндпоинт</div>
              <div className="col-span-6">Описание / Контракт</div>
            </div>

            <div className="divide-y divide-slate-100 dark:divide-slate-200">
              <div className="grid grid-cols-12 p-2 hover:bg-slate-50">
                <div className="col-span-2"><span className="bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded font-mono font-bold text-[10px]">POST</span></div>
                <div className="col-span-4 font-mono text-slate-800 font-medium">/api/v1/auth/login</div>
                <div className="col-span-6 text-slate-600">Авторизация пользователя. Возвращает: Access Token JWT, Refresh Token и роль.</div>
              </div>

              <div className="grid grid-cols-12 p-2 hover:bg-slate-50">
                <div className="col-span-2"><span className="bg-sky-100 text-sky-800 px-1.5 py-0.5 rounded font-mono font-bold text-[10px]">GET</span></div>
                <div className="col-span-4 font-mono text-slate-800 font-medium">/api/v1/products/scan/:code</div>
                <div className="col-span-6 text-slate-600">Мгновенный поиск товара по штрихкоду или SKU. Кэшируется в Redis на 10 сек.</div>
              </div>

              <div className="grid grid-cols-12 p-2 hover:bg-slate-50">
                <div className="col-span-2"><span className="bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded font-mono font-bold text-[10px]">POST</span></div>
                <div className="col-span-4 font-mono text-slate-800 font-medium">/api/v1/sales/checkout</div>
                <div className="col-span-6 text-slate-600">Проведение транзакции продажи. Обновляет складские остатки внутри ACID транзакции.</div>
              </div>

              <div className="grid grid-cols-12 p-2 hover:bg-slate-50">
                <div className="col-span-2"><span className="bg-sky-100 text-sky-800 px-1.5 py-0.5 rounded font-mono font-bold text-[10px]">GET</span></div>
                <div className="col-span-4 font-mono text-slate-800 font-medium">/api/v1/customers/:id/debts</div>
                <div className="col-span-6 text-slate-600">Получение баланса долгов клиента, кредитной истории, лимита и графика выплат.</div>
              </div>

              <div className="grid grid-cols-12 p-2 hover:bg-slate-50">
                <div className="col-span-2"><span className="bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded font-mono font-bold text-[10px]">POST</span></div>
                <div className="col-span-4 font-mono text-slate-800 font-medium">/api/v1/sync/pull</div>
                <div className="col-span-6 text-slate-600">Двусторонняя офлайн-синхронизация. Отправка неотправленных транзакций и забор обновленных цен/остатков.</div>
              </div>

              <div className="grid grid-cols-12 p-2 hover:bg-slate-50">
                <div className="col-span-2"><span className="bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded font-mono font-bold text-[10px]">PUT</span></div>
                <div className="col-span-4 font-mono text-slate-800 font-medium">/api/v1/inventory/correct</div>
                <div className="col-span-6 text-slate-600">Проведение ревизии, списание брака или корректировка остатков Вручную с фиксацией в аудите.</div>
              </div>

              <div className="grid grid-cols-12 p-2 hover:bg-slate-50">
                <div className="col-span-2"><span className="bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded font-mono font-bold text-[10px]">POST</span></div>
                <div className="col-span-4 font-mono text-slate-800 font-medium">/api/v1/suppliers/:id/order</div>
                <div className="col-span-6 text-slate-600">Создание нового заказа на поставку товара с добавлением во входящую ведомость.</div>
              </div>
            </div>
          </div>

          <div className="font-mono text-xs bg-slate-900 text-slate-200 p-4 rounded-lg overflow-x-auto border border-slate-700 shadow-inner">
            <h4 className="text-amber-400 mb-2 font-semibold">Пример полезной нагрузки при синхронизации офлайн-чека (JSON):</h4>
            <pre className={`text-[11px]`}>{`{
  "clientSyncId": "de305d54-75b4-431b-adb2-eb6b9e546011",
  "taskType": "SALE_TRANSACTION",
  "timestamp": "2026-05-22T04:52:41Z",
  "payload": {
    "saleId": "sale-1029",
    "cashierName": "Кассир Айбек",
    "items": [
      { "productId": "prod-1", "qty": 5, "priceSell": 150, "priceBuy": 85, "disc": 2 }
    ],
    "payment": { "method": "CASH", "cash": 1000, "card": 0, "debt": 0 },
    "customerId": "cust-2"
  }
}`}</pre>
          </div>
        </div>
      )
    },
    {
      id: 'offline-sync',
      name: 'Офлайн Синхронизация',
      icon: RefreshCw,
      content: (
        <div className="space-y-4">
          <div className="border bg-slate-50 p-4 rounded-xl border-slate-200">
            <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2 mb-1">
              <RefreshCw className="w-4 h-4 text-amber-600 animate-spin-slow" /> Логика работы Офлайн-First и Движка Синхронизации
            </h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Так как магазины часто находятся в цокольных этажах или перегруженных рынках, система спроектирована по концепции Offline-First. Кассир должен продолжить пробивать чеки даже при Оборванном кабеле интернета.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="border p-4 rounded-xl bg-orange-50 border-orange-200">
              <div className="bg-orange-100 text-orange-800 w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs mb-2">1</div>
              <h4 className="text-xs font-bold text-slate-900 mb-1">Кэширование данных (IndexedDB)</h4>
              <p className="text-[11px] text-slate-600 leading-relaxed">
                Все товары, справочники клиентов и накладные сохраняются локально в СУБД IndexedDB мобильного браузера. Приложение запускается без интернета благодаря Service Worker.
              </p>
            </div>

            <div className="border p-4 rounded-xl bg-indigo-50 border-indigo-200">
              <div className="bg-indigo-100 text-indigo-800 w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs mb-2">2</div>
              <h4 className="text-xs font-bold text-slate-900 mb-1">Офлайн-Очередь транзакций</h4>
              <p className="text-[11px] text-slate-600 leading-relaxed">
                Продажа фиксируется в локальную очередь SyncQueue. Складской баланс временно вычитается локально. Чек печатается с отметкой "В очереди".
              </p>
            </div>

            <div className="border p-4 rounded-xl bg-emerald-50 border-emerald-200">
              <div className="bg-emerald-100 text-emerald-800 w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs mb-2">3</div>
              <h4 className="text-xs font-bold text-slate-900 mb-1">Автореконсиляция (Слияние)</h4>
              <p className="text-[11px] text-slate-600 leading-relaxed">
                При обнаружении сети, фоновый веб-воркер отправляет пачки транзакций на сервер в строгом порядке FIFO. Конфликты (например, если товар закончился во время офлайна) разрешаются по правилам приоритета.
              </p>
            </div>
          </div>

          <div className="border p-4 rounded-xl border-slate-200 bg-white">
            <h4 className="text-xs font-bold text-slate-900 mb-2 flex items-center gap-1">Стратегия Разрешения Конфликтов (Conflict Resolution Rules):</h4>
            <ul className="text-xs text-slate-600 space-y-1.5 list-disc pl-4">
              <li><strong>Продажа при минусовом остатке:</strong> Допускается уход в технологический минус на складе. Лог аудита метит транзакцию тегом <code>STOCKS_WARNING</code>.</li>
              <li><strong>Пересекающиеся скидки:</strong> Если на сервере обновилась персональная скидка клиента, в приоритете остается скидка, предоставленная кассиром в офлайн-режиме во время продажи.</li>
              <li><strong>Одновременные транзакции долгов:</strong> Суммы долга клиента кумулятивно суммируются. Сейф-гарантия: изменения баланса перерассчитываются строго на сервере в хронологическом порядке.</li>
            </ul>
          </div>
        </div>
      )
    },
    {
      id: 'tg-notif',
      name: 'Telegram & Оповещения',
      icon: Cpu,
      content: (
        <div className="space-y-4">
          <div className="border bg-slate-50 p-4 rounded-xl border-slate-200">
            <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2 mb-1">
              <Cpu className="w-4 h-4 text-indigo-600" /> Архитектура Telegram-Оповещений
            </h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Интеграция с Telegram Bot API позволяет владельцу магазина оперативно контролировать бизнес-процессы прямо с телефона без необходимости открывать основное веб-приложение.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="border p-4 rounded-xl border-slate-200 hover:shadow-sm transition bg-white">
              <h4 className="text-xs font-bold text-teal-700 flex items-center gap-1.5 mb-1.5 uppercase">
                🔔 Оповещения Владельцу
              </h4>
              <p className="text-xs text-slate-600 leading-relaxed mb-3">
                Автоматическая рассылка важных сообщений по событиям:
              </p>
              <ul className="text-[11px] text-slate-600 space-y-1 pl-4 list-disc">
                <li><strong>Инвентарные алерты:</strong> "Внимание! Товар 'Клей Секундный' достиг критического остатка (4 шт)."</li>
                <li><strong>Финансовые отчеты:</strong> "Смена закрыта. Выручка за 22.05: 14,800 руб. Прибыль: 5,200 руб."</li>
                <li><strong>Фрод-аманал:</strong> "Внимание! Кассир Айбек удалил товар из оплаченного чека #124."</li>
              </ul>
            </div>

            <div className="border p-4 rounded-xl border-slate-200 hover:shadow-sm transition bg-white">
              <h4 className="text-xs font-bold text-amber-700 flex items-center gap-1.5 mb-1.5 uppercase">
                💸 Напоминания о долгах
              </h4>
              <p className="text-xs text-slate-600 leading-relaxed mb-3">
                Автоматическое генерирование красивых писем в мессенджеры для дебиторов магазина:
              </p>
              <ul className="text-[11px] text-slate-600 space-y-1 pl-4 list-disc">
                <li><strong>Шаблон текста:</strong> "Здравствуйте, Алибек Усенов! Информируем Вас о текущей задолженности перед магазином 'Хозтовары 1000' в размере 4,200 руб. Будем рады скорейшему возврату."</li>
                <li><strong>Кнопка быстрой оплаты:</strong> Ссылка на СБП с готовой суммой рассчета.</li>
              </ul>
            </div>
          </div>
          
          <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 text-slate-300 font-mono text-[10px]">
            <p className="text-emerald-400 font-bold mb-1">// Пример реализации хука триггера ТГ со стороны Node.js</p>
            <code>{`async function sendTelegramAlert(text: string) {
  const url = \`https://api.telegram.org/bot\${process.env.TELEGRAM_BOT_TOKEN}/sendMessage\`;
  await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: process.env.TELEGRAM_OWNER_CHAT_ID, text, parse_mode: 'HTML' })
  });
}`}</code>
          </div>
        </div>
      )
    },
    {
      id: 'scale-roadmap',
      name: 'Роадмап MVP и Масштабирование',
      icon: TrendingUp,
      content: (
        <div className="space-y-6">
          <div className="border bg-slate-50 p-4 rounded-xl border-slate-200">
            <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2 mb-1">
              <TrendingUp className="w-4 h-4 text-emerald-600" /> Дорожная Карта внедрения и стратегия масштабирования
            </h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              План перехода от прототипа MVP к полноценной розничной экосистеме, способной держать нагрузку до 5000+ обновлений балансов в секунду.
            </p>
          </div>

          <div className="space-y-4">
            <div className="relative pl-6 border-l-2 border-slate-200">
              <div className="absolute w-3 h-3 bg-emerald-600 rounded-full -left-[7px] top-1"></div>
              <h4 className="text-xs font-bold text-slate-900">Этап 1: MVP Прототип (Завершен)</h4>
              <p className="text-xs text-slate-600">
                Запуск мобильного POS-терминала, управление базовыми справочниками товаров. Накопление локального кэша в IndexedDB.
              </p>
            </div>

            <div className="relative pl-6 border-l-2 border-slate-200">
              <div className="absolute w-3 h-3 bg-emerald-600 rounded-full -left-[7px] top-1"></div>
              <h4 className="text-xs font-bold text-slate-900">Этап 2: Расширенная Логика и Мониторинг (Завершен)</h4>
              <p className="text-xs text-slate-600">
                Добавлен полноценный CRM, редактирование поставщиков и клиентов. Интеграция кадрового учета с уведомлениями о сроках документов. Реализована реальная интеграция Telegram-бота, AI-аналитика неликвида и Быстрый Аудит Смены (B3S).
              </p>
            </div>

            <div className="relative pl-6 border-l-2 border-slate-200">
              <div className="absolute w-3 h-3 bg-sky-500 rounded-full -left-[7px] top-1"></div>
              <h4 className="text-xs font-bold text-slate-900">Этап 3: Облачные Серверы и Безопасность (Текущий статус)</h4>
              <p className="text-xs text-slate-600">
                Развертывание Node.js Express API в Docker-контейнерах в Cloud Run, внедрение авторизации по JWT, инициализация СУБД PostgreSQL по обновленной спецификации.
              </p>
            </div>

            <div className="relative pl-6 border-l-2 border-slate-200">
              <div className="absolute w-3 h-3 bg-indigo-500 rounded-full -left-[7px] top-1"></div>
              <h4 className="text-xs font-bold text-slate-900">Этап 4: Интеллектуальный AI Модуль (Планируется)</h4>
              <p className="text-xs text-slate-600">
                Проектирование специальных витрин данных (OLAP) и сбор логов продаж для последующего скармливания ML-модели для анализа спроса и умного прогнозирования остатков (AI-driven Procurement).
              </p>
            </div>

            <div className="relative pl-6 border-l-2 border-slate-200">
              <div className="absolute w-3 h-3 bg-purple-500 rounded-full -left-[7px] top-1"></div>
              <h4 className="text-xs font-bold text-slate-900">Этап 4: Масштабирование на Сеть магазинов</h4>
              <p className="text-xs text-slate-600">
                Создание мастер-аккаунта Владельца для переключения между несколькими торговыми точками (бэк-офис). Шардирование PostgreSQL базы по <code>store_id</code>, интеграция Redis для снижения задержек авторизации и запросов.
              </p>
            </div>
          </div>
        </div>
      )
    }
  ];

  return (
    <div className="bg-slate-50 rounded-2xl p-4 md:p-6 border border-slate-200 shadow-sm space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 pb-4 border-b border-indigo-100">
        <div>
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <Cpu className="text-indigo-600 w-5 h-5" /> Архитектурный Центр Системы (RetailOS Core)
          </h2>
          <p className="text-xs text-slate-500">
            Здесь собраны спецификации, структуры таблиц SQL и алгоритмы розничной ОС в удобном для инженеров представлении.
          </p>
        </div>
        <div className="flex bg-slate-100 p-1 rounded-lg border border-slate-200">
          <span className="text-[10px] uppercase font-bold text-slate-500 px-2 py-1">MVP v1.0.0</span>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 pb-2">
        {tabs.map((tab) => {
          const IconComponent = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${
                isActive
                  ? 'bg-indigo-600 text-white shadow-sm font-semibold'
                  : 'bg-white hover:bg-slate-100 text-slate-600 border border-slate-200'
              }`}
            >
              <IconComponent className="w-3.5 h-3.5" />
              {tab.name}
            </button>
          );
        })}
      </div>

      <div className="bg-white p-5 rounded-xl border border-slate-200">
        {tabs.find((tab) => tab.id === activeTab)?.content}
      </div>

      <div className="bg-indigo-50 rounded-xl p-4 border border-indigo-100 flex items-start gap-4">
        <HelpCircle className="w-5 h-5 text-indigo-700 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <h4 className="text-xs font-bold text-indigo-900">Готовность к внедрению ИИ в будущем</h4>
          <p className="text-xs text-indigo-950 leading-relaxed">
            Архитектура базы данных спроектирована с учетом поддержки аналитических представлений (Views), которые в будущем можно отправлять напрямую в LLM (Gemini 2.5 Pro) для генерации умных советов по закупкам. В таблице <code>sales_items</code> собирается себестоимость закупки (<code>price_buy</code>), что позволяет с точностью до копейки рассчитывать чистую маржу.
          </p>
        </div>
      </div>
    </div>
  );
}
