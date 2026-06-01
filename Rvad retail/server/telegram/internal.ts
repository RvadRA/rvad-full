import { db } from '../db/connection';
import { products, saleTransactions, customers, employees } from '../db/schema';
import { eq, desc } from 'drizzle-orm';

export async function sendTelegramMessage(token: string, chatId: number, text: string, keyboardMarkup?: any) {
  try {
    const body: any = {
      chat_id: chatId,
      text: text,
      parse_mode: 'HTML'
    };
    if (keyboardMarkup) {
      body.reply_markup = keyboardMarkup;
    }
    
    const sendResponse = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    
    if (!sendResponse.ok) {
      console.error(`Failed to send message to Telegram Chat ID ${chatId}: ${sendResponse.status}`);
    }
  } catch (error: any) {
    console.error(`Error sending message to Telegram: ${error.message}`);
  }
}

export let registeredOwnerChatIds: number[] = [];

if (process.env.OWNER_TELEGRAM_CHAT_ID) {
  const envId = parseInt(process.env.OWNER_TELEGRAM_CHAT_ID, 10);
  if (!isNaN(envId)) {
    registeredOwnerChatIds.push(envId);
  }
}

export async function handleInternalBotUpdate(token: string, message: any) {
  if (!message) return;

  console.log(`[Internal Bot] Incoming update:`, JSON.stringify(message));

  const chatId = message.chat?.id;
  if (!chatId) return;

  // Auto-register owner chat ID
  if (!registeredOwnerChatIds.includes(chatId)) {
    registeredOwnerChatIds.push(chatId);
    console.log(`[Telegram Owner Bot] Registered owner chatId: ${chatId}`);
  }

  const ownerKeyboardMarkup = {
    keyboard: [
      [{ text: "📋 сводка status" }, { text: "💰 финансы revenue" }],
      [{ text: "🛍️ заказы orders" }, { text: "📉 дефицит low_stock" }],
      [{ text: "⚡ тест событий alerts" }]
    ],
    resize_keyboard: true,
    one_time_keyboard: false
  };

  // Handle Callback Queries
  if (message.callback_query) {
    const callbackQuery = message.callback_query;
    const data = callbackQuery.data;
    const callbackChatId = callbackQuery.message.chat.id;
    const messageId = callbackQuery.message.message_id;

    if (data.startsWith('status_')) {
      const parts = data.split('_');
      const newStatus = parts[1];
      const saleId = parts.slice(2).join('_');

      try {
        const transactionList = await db.select().from(saleTransactions).where(eq(saleTransactions.id, saleId));
        if (transactionList.length === 0) {
          await sendTelegramMessage(token, callbackChatId, `❌ Заказ ${saleId} не найден.`);
          return;
        }

        const sale = transactionList[0];
        await db.update(saleTransactions)
          .set({ status: newStatus as any })
          .where(eq(saleTransactions.id, saleId));

        // Notify client via client bot if they have linked telegram
        const customerId = sale.customerId;
        const clientBotToken = process.env.TELEGRAM_BOT_TOKEN_CLIENT;
        if (customerId && clientBotToken) {
          const customerList = await db.select().from(customers).where(eq(customers.id, customerId));
          if (customerList.length > 0 && customerList[0].telegramChatId) {
            const customerChatId = parseInt(customerList[0].telegramChatId, 10);
            if (!isNaN(customerChatId)) {
              const statusName = newStatus === 'processing' ? 'Обрабатывается' : 
                                 newStatus === 'shipping' ? (sale.orderType === 'pickup' ? 'Готов к выдаче' : 'В пути') : 
                                 newStatus === 'delivered' ? (sale.orderType === 'pickup' ? 'Выдан' : 'Доставлен') : 'Отменен';
              const clientMsg = `🔔 <b>Статус вашего заказа #${saleId} изменился:</b>\n👉 <b>${statusName}</b>`;
              await sendTelegramMessage(clientBotToken, customerChatId, clientMsg);
            }
          }
        }

        const statusNameText = newStatus === 'processing' ? '⏳ Обрабатывается' : 
                               newStatus === 'shipping' ? (sale.orderType === 'pickup' ? '📦 Готов к выдаче' : '🚚 В пути') : 
                               newStatus === 'delivered' ? (sale.orderType === 'pickup' ? '📥 Выдан' : '✅ Доставлен') : '❌ Отменен';

        const itemsList = Array.isArray(sale.items) ? sale.items : [];
        const itemsText = itemsList.map((it: any) => `• ${it.productName} (${it.quantity} шт.)`).join('\n');

        const updatedText = `🔔 <b>Обновлен статус заказа!</b>\n\n` +
                            `🔖 <b>ID заказа:</b> <code>${saleId}</code>\n` +
                            `👤 <b>Статус:</b> <b>${statusNameText}</b>\n` +
                            `💰 <b>Сумма:</b> ${sale.finalPrice} руб.\n` +
                            `📦 <b>Тип доставки:</b> ${sale.orderType === 'pickup' ? 'Самовывоз' : 'Доставка'}\n` +
                            `🛍️ <b>Состав:</b>\n${itemsText}\n` +
                            `\nИзменить статус:`;

        const inlineKeyboard = {
          inline_keyboard: [
            [
              { text: "⏳ Обработка", callback_data: `status_processing_${saleId}` },
              { text: "📦 Готов/В пути", callback_data: `status_shipping_${saleId}` }
            ],
            [
              { text: "✅ Выдан/Доставлен", callback_data: `status_delivered_${saleId}` },
              { text: "❌ Отменить", callback_data: `status_cancelled_${saleId}` }
            ]
          ]
        };

        await fetch(`https://api.telegram.org/bot${token}/editMessageText`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: callbackChatId,
            message_id: messageId,
            text: updatedText,
            parse_mode: 'HTML',
            reply_markup: inlineKeyboard
          })
        });

        await fetch(`https://api.telegram.org/bot${token}/answerCallbackQuery`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            callback_query_id: callbackQuery.id,
            text: `Статус изменен на "${statusNameText.replace(/[^\w\sа-яА-Я]/g, '').trim()}"`
          })
        });
      } catch (e: any) {
        console.error('[Internal Telegram Bot] Callback error:', e.message);
      }
    }
    return;
  }

  if (message.text === undefined || message.text === "") return;
  const text = message.text.trim();
  const cmd = text.toLowerCase();
  const fromName = message.from?.first_name || 'Пользователь';

  if (cmd === '/start') {
    const replyText = `👋 Здравствуйте, <b>${fromName}</b>! Я бот для управления магазином "1000 Мелочей".\n\n` +
                `Используйте menu меню кнопок внизу или отправьте команды:\n` +
                `📋 <b>/status</b> — Сводка\n` +
                `💰 <b>/revenue</b> — Финансы\n` +
                `🛍️ <b>/orders</b> — Интернет-заказы`;
    await sendTelegramMessage(token, chatId, replyText, ownerKeyboardMarkup);
    return;
  }

  if (cmd.includes('/status') || cmd.includes('сводка')) {
    const allProducts = await db.select().from(products);
    const lowStockList = allProducts.filter(p => p.stock <= p.minStock);
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todaySales = await db.select().from(saleTransactions);
    const todaySalesFiltered = todaySales.filter(s => new Date(s.timestamp) >= today);

    const totalTodaySales = todaySalesFiltered.reduce((sum, s) => sum + s.finalPrice, 0);
    const totalStockVal = allProducts.reduce((sum, p) => sum + (p.stock * p.priceSell), 0);

    const activeOnlineEmployees = await db.select().from(employees).where(eq(employees.isOnline, true));
    const cashierName = activeOnlineEmployees.length > 0 ? activeOnlineEmployees.map(e => e.name).join(', ') : 'Нет активных';

    const replyText = `📋 <b>СВОДКА МАГАЗИНА : "1000 Мелочей"</b>\n\n` +
                `👤 <b>Смена:</b> Активные сотрудники — <b>${cashierName}</b>.\n` +
                `📈 <b>Выручка за сегодня:</b> ${totalTodaySales.toLocaleString('ru-RU')} руб. (${todaySalesFiltered.length} чеков)\n` +
                `📦 <b>Оценка склада продаж:</b> ${totalStockVal.toLocaleString('ru-RU')} руб. (всего ${allProducts.length} наим.)\n` +
                `⚠️ <b>Дефицит остатков:</b> Заканчивается товаров: <b>${lowStockList.length} шт.</b>\n\n` +
                `🔌 <b>Статус терминалов:</b> База данных PostgreSQL активна. Владелец подключен к Cloud-ноде в реальном времени.`;
    
    await sendTelegramMessage(token, chatId, replyText, ownerKeyboardMarkup);
    return;
  }

  if (cmd.includes('/revenue') || cmd.includes('финансы')) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const allSales = await db.select().from(saleTransactions);
    const todaySalesFiltered = allSales.filter(s => new Date(s.timestamp) >= today);

    const totalRevenue = todaySalesFiltered.reduce((sum, s) => sum + s.finalPrice, 0);
    const cashPay = todaySalesFiltered.reduce((sum, s) => sum + s.paidCash, 0);
    const cardPay = todaySalesFiltered.reduce((sum, s) => sum + s.paidCard, 0);

    const customerList = await db.select().from(customers);
    const totalDebtAmount = customerList.reduce((sum, c) => sum + c.debt, 0);
    const debtorsCount = customerList.filter(c => c.debt > 0).length;

    const replyText = `💰 <b>ФИНАНСОВЫЙ ОТЧЕТ ЗА СЕГОДНЯ</b>\n\n` +
                `🪙 <b>Общий оборот продаж:</b> ${totalRevenue.toLocaleString('ru-RU')} руб.\n` +
                `💵 — <b>Наличные:</b> ${cashPay.toLocaleString('ru-RU')} руб.\n` +
                `💳 — <b>Банковская карта:</b> ${cardPay.toLocaleString('ru-RU')} руб.\n\n` +
                `🤝 <b>Общий долг клиентов (тетрадь):</b> ${totalDebtAmount.toLocaleString('ru-RU')} руб. у ${debtorsCount} покупателей.`;
    
    await sendTelegramMessage(token, chatId, replyText, ownerKeyboardMarkup);
    return;
  }

  if (cmd.includes('/low_stock') || cmd.includes('дефицит')) {
    const allProducts = await db.select().from(products);
    const lowStockProducts = allProducts.filter(p => p.stock <= p.minStock).slice(0, 5);

    let replyText = '';
    if (lowStockProducts.length === 0) {
      replyText = `✅ <b>Все товары в достатке!</b>\nНи у одного товара остатки не опустились ниже установленного минимума. Склад заполнен отлично.`;
    } else {
      replyText = `📉 <b>ВНИМАНИЕ: ЗАКАНЧИВАЮТСЯ ТОВАРЫ!</b>\n\n` +
                  lowStockProducts.map(p => `• <b>${p.name}</b>\n  Осталось: <i>${p.stock} ${p.unit || 'шт'}</i> (Мин: ${p.minStock})\n  Артикул: <code>${p.sku || p.barcode}</code>`).join('\n\n') +
                  (allProducts.filter(p => p.stock <= p.minStock).length > 5 ? `\n\n<i>...и еще несколько товаров на критическом лимите.</i>` : '');
    }
    await sendTelegramMessage(token, chatId, replyText, ownerKeyboardMarkup);
    return;
  }

  if (cmd.includes('/orders') || cmd.includes('заказы')) {
    try {
      console.log(`[Internal Bot] Fetching orders for chatId: ${chatId}...`);
      const latestSales = await db.select().from(saleTransactions)
        .orderBy(desc(saleTransactions.timestamp));
      
      console.log(`[Internal Bot] Total sales in DB: ${latestSales.length}`);
      
      const storefrontSales = latestSales.filter(s => 
        ((s.cashierName && s.cashierName.startsWith('Storefront:')) || 
         s.orderType === 'pickup' || 
         s.orderType === 'delivery') &&
        s.status !== 'cancelled' &&
        s.status !== 'delivered'
      ).slice(0, 5);

      console.log(`[Internal Bot] Matched storefront sales: ${storefrontSales.length}`);

      if (storefrontSales.length === 0) {
        await sendTelegramMessage(token, chatId, `🛍️ <b>Интернет-заказов пока нет.</b>`, ownerKeyboardMarkup);
        return;
      }

      await sendTelegramMessage(token, chatId, `🛍️ <b>Последние 5 интернет-заказов:</b>`);

      for (const sale of storefrontSales) {
      const itemsList = Array.isArray(sale.items) ? sale.items : [];
      const itemsText = itemsList.map((it: any) => `• ${it.productName} (${it.quantity} шт.)`).join('\n');
      
      const statusVal = sale.status || 'processing';
      const statusNameText = statusVal === 'processing' ? '⏳ Обрабатывается' : 
                         statusVal === 'shipping' ? (sale.orderType === 'pickup' ? '📦 Готов к выдаче' : '🚚 В пути') : 
                         statusVal === 'delivered' ? (sale.orderType === 'pickup' ? '📥 Выдан' : '✅ Доставлен') : '❌ Отменен';

      const orderText = `🔖 <b>Заказ:</b> <code>${sale.id}</code>\n` +
                        `👤 <b>Статус:</b> <b>${statusNameText}</b>\n` +
                        `💰 <b>Сумма:</b> ${sale.finalPrice} руб.\n` +
                        `💳 <b>Способ оплаты:</b> ${
                          sale.paymentMethod === 'CASH' ? 'Наличные' :
                          sale.paymentMethod === 'CARD' ? 'Карта' :
                          sale.paymentMethod === 'DEBT' ? 'В долг (Насия)' :
                          sale.paymentMethod === 'SPLIT' ? 'Смешанный' : sale.paymentMethod
                        }\n` +
                        `📦 <b>Тип:</b> ${sale.orderType === 'pickup' ? 'Самовывоз' : 'Доставка'}\n` +
                        `🛍️ <b>Состав:</b>\n${itemsText}\n` +
                        `\nИзменить статус заказа:`;

      const inlineKeyboard = {
        inline_keyboard: [
          [
            { text: "⏳ Обработка", callback_data: `status_processing_${sale.id}` },
            { text: "📦 Готов/В пути", callback_data: `status_shipping_${sale.id}` }
          ],
          [
            { text: "✅ Выдан/Доставлен", callback_data: `status_delivered_${sale.id}` },
            { text: "❌ Отменить", callback_data: `status_cancelled_${sale.id}` }
          ]
        ]
      };

      await sendTelegramMessage(token, chatId, orderText, inlineKeyboard);
    }
    } catch (err: any) {
      console.error('[Internal Bot] Error in /orders handler:', err.message);
      await sendTelegramMessage(token, chatId, `❌ <b>Ошибка при получении заказов:</b> ${err.message}`, ownerKeyboardMarkup);
    }
    return;
  }

  if (cmd.includes('/alerts') || cmd.includes('тест')) {
    const randomNum = Math.floor(Math.random() * 3);
    let replyText = '';
    
    if (randomNum === 0) {
      replyText = `🔔 <b>СИСТЕМНЫЙ СИГНАЛ: ТЕСТ АЛЕРТА</b>\n\nВсе системы функционируют нормально. Связь с облачным бэкендом стабильная.`;
    } else if (randomNum === 1) {
      replyText = `🚨 <b>ВНИМАНИЕ: ТЕСТ БЕЗОПАСНОСТИ</b>\n\nЗафиксировано тестовое срабатывание системы фрод-мониторинга.`;
    } else {
      replyText = `📉 <b>ИНФО: ТЕСТ ЗАПАСОВ</b>\n\nОстатки некоторых позиций близки к минимальным. Проверьте раздел Дефицит.`;
    }
    await sendTelegramMessage(token, chatId, replyText, ownerKeyboardMarkup);
    return;
  }

  const replyText = `❓ <b>Неизвестная команда.</b>\n\nДля владельца доступны команды:\n/status — сводка кассы\n/revenue — отчет\n/orders — заказы\n/low_stock — дефицит\n/alerts — тест сценариев`;
  await sendTelegramMessage(token, chatId, replyText, ownerKeyboardMarkup);
}

export async function notifyOwnersOfNewOrder(
  order: any,
  customerName: string,
  deliveryAddress?: string,
  comment?: string
) {
  const internalToken = process.env.TELEGRAM_BOT_TOKEN_INTERNAL;
  if (!internalToken) return;

  const chatIds = [...registeredOwnerChatIds];
  
  if (process.env.OWNER_TELEGRAM_CHAT_ID) {
    const envId = parseInt(process.env.OWNER_TELEGRAM_CHAT_ID, 10);
    if (!isNaN(envId) && !chatIds.includes(envId)) {
      chatIds.push(envId);
    }
  }

  // Dynamically fetch active OWNER and ADMIN chat IDs from the database
  try {
    const activeEmployees = await db.select({
      telegramChatId: employees.telegramChatId,
      role: employees.role
    }).from(employees).where(eq(employees.status, 'ACTIVE'));
    
    for (const emp of activeEmployees) {
      if (emp.telegramChatId && (emp.role === 'OWNER' || emp.role === 'ADMIN')) {
        const id = parseInt(emp.telegramChatId, 10);
        if (!isNaN(id) && !chatIds.includes(id)) {
          chatIds.push(id);
        }
      }
    }
  } catch (err) {
    console.error('[notifyOwnersOfNewOrder] DB fetch error:', err);
  }

  if (chatIds.length === 0) return;

  const itemsList = Array.isArray(order.items) ? order.items : [];
  const itemsText = itemsList.map((it: any) => `• ${it.productName} (${it.quantity} шт.)`).join('\n');

  const text = `🔔 <b>Новый интернет-заказ!</b>\n\n` +
               `🔖 <b>ID заказа:</b> <code>${order.orderId}</code>\n` +
               `👤 <b>Клиент:</b> ${customerName}\n` +
               `📞 <b>Номер телефона:</b> ${order.phoneNumber}\n` +
               `💰 <b>Сумма:</b> ${order.finalPrice} руб.\n` +
               `💳 <b>Способ оплаты:</b> ${
                 order.paymentMethod === 'CASH' ? 'Наличные' :
                 order.paymentMethod === 'CARD' ? 'Карта' :
                 order.paymentMethod === 'DEBT' ? 'В долг (Насия)' : order.paymentMethod
               }\n` +
               `📦 <b>Тип доставки:</b> ${order.orderType === 'pickup' ? 'Самовывоз' : 'Доставка'}\n` +
               (deliveryAddress ? `📍 <b>Адрес:</b> ${deliveryAddress}\n` : '') +
               (comment ? `💬 <b>Комментарий:</b> ${comment}\n` : '') +
               `🛍️ <b>Состав:</b>\n${itemsText}\n` +
               `\nИзменить статус заказа:`;

  const inlineKeyboard = {
    inline_keyboard: [
      [
        { text: "⏳ Обработка", callback_data: `status_processing_${order.orderId}` },
        { text: "📦 Готов/В пути", callback_data: `status_shipping_${order.orderId}` }
      ],
      [
        { text: "✅ Выдан/Доставлен", callback_data: `status_delivered_${order.orderId}` },
        { text: "❌ Отменить", callback_data: `status_cancelled_${order.orderId}` }
      ]
    ]
  };

  for (const chatId of chatIds) {
    await sendTelegramMessage(internalToken, chatId, text, inlineKeyboard);
  }
}
