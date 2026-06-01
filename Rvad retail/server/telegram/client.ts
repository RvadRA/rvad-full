import { db } from '../db/connection';
import { customers, debtPayments, saleTransactions } from '../db/schema';
import { sendTelegramMessage } from './internal';
import { resetCodes } from '../routes/storefrontAuth';
import { eq, desc } from 'drizzle-orm';

export async function handleClientBotUpdate(token: string, message: any) {
  if (!message) return;
  console.log(`[Client Bot] Incoming update:`, JSON.stringify(message));
  if (!message.text) return;
  const chatId = message.chat.id;
  const text = message.text.trim();
  const cmd = text.toLowerCase();

  const debtorKeyboardMarkup = {
    keyboard: [
      [{ text: "📉 Мой долг (Остаток)" }],
      [{ text: "📜 История выплат" }, { text: "📦 Детализация по товарам" }],
      [{ text: "🧾 Последняя накладная" }]
    ],
    resize_keyboard: true,
    one_time_keyboard: false
  };

  // 1b. Deep linking check for password reset: /start reset_<phone> or /start reset-<phone>
  const resetParamMatch = text.match(/^\/start\s+reset[_-](\S+)/i);
  if (resetParamMatch) {
    const rawPhone = resetParamMatch[1].trim();
    try {
      let clean = rawPhone.replace(/\D/g, '');
      if (clean.startsWith('8') && clean.length === 11) {
        clean = '7' + clean.slice(1);
      }
      
      const allCust = await db.select().from(customers);
      const customer = allCust.find(c => {
        let cc = c.phone.replace(/\D/g, '');
        if (cc.startsWith('8') && cc.length === 11) {
          cc = '7' + cc.slice(1);
        }
        return cc === clean;
      });

      if (customer) {
        // Link Telegram Chat ID
        await db.update(customers)
          .set({ telegramChatId: String(chatId) })
          .where(eq(customers.id, customer.id));

        // Generate a 4-digit code
        const code = Math.floor(1000 + Math.random() * 9000).toString();
        resetCodes.set(clean, { code, expires: Date.now() + 10 * 60 * 1000 });

        const replyText = `🎉 <b>Успешная привязка Telegram!</b>\n\n` +
                    `Здравствуйте, <b>${customer.name}</b>!\n` +
                    `Ваш аккаунт привязан к системе.\n\n` +
                    `🔑 <b>Код сброса пароля:</b> <code>${code}</code>\n\n` +
                    `Введите его на сайте магазина "1000 Мелочей" для установки нового пароля.`;
        
        await sendTelegramMessage(token, chatId, replyText, debtorKeyboardMarkup);
      } else {
        const replyText = `❌ <b>Ошибка привязки</b>\n\n` +
                    `Клиент с номером телефона <code>${rawPhone}</code> не найден в базе магазина "1000 Мелочей".`;
        await sendTelegramMessage(token, chatId, replyText);
      }
    } catch (e: any) {
      console.error("Reset link binding error:", e.message);
      await sendTelegramMessage(token, chatId, `❌ Ошибка при обработке сброса пароля.`);
    }
    return;
  }

  // 1. Deep linking check: /start client_<customerId> or /start client-<customerId>
  const startParamMatch = text.match(/^\/start\s+client[_-](\S+)/i);
  if (startParamMatch) {
    const rawId = startParamMatch[1].trim();
    try {
      // Find customer by id
      const customerList = await db.select().from(customers).where(eq(customers.id, rawId));
      let customer = customerList[0];

      if (!customer) {
        // Fallback check: find case-insensitive or by custom prefixed id if needed
        const allCust = await db.select().from(customers);
        customer = allCust.find(c => 
          c.id.toLowerCase() === rawId.toLowerCase() ||
          c.id.toLowerCase() === `cust-${rawId.toLowerCase()}` ||
          c.id.toLowerCase() === `customer-${rawId.toLowerCase()}`
        )!;
      }

      if (customer) {
        // Bind Telegram Chat ID
        await db.update(customers)
          .set({ telegramChatId: String(chatId) })
          .where(eq(customers.id, customer.id));
        
        const replyText = `🎉 <b>Успешная привязка аккаунта!</b>\n\n` +
                    `Здравствуйте, <b>${customer.name}</b>!\n` +
                    `Я официальный ассистент магазина "1000 Мелочей".\n\n` +
                    `Вы успешно подключили свой личный кабинет для контроля задолженностей и истории оплат (сервис "Nasiya").\n\n` +
                    `Используйте интерактивное меню кнопок внизу для проверки Вашего долга.`;

        await sendTelegramMessage(token, chatId, replyText, debtorKeyboardMarkup);
      } else {
        const replyText = `❌ <b>Ошибка привязки</b>\n\n` +
                    `Клиент с ID <code>${rawId}</code> не найден в базе магазина "1000 Мелочей".\n` +
                    `Пожалуйста, запросите новую ссылку-приглашение у кассира или администратора магазина.`;
        await sendTelegramMessage(token, chatId, replyText);
      }
    } catch (e: any) {
      console.error("Deep link binding error:", e.message);
      await sendTelegramMessage(token, chatId, `❌ Ошибка при обработке привязки.`);
    }
    return;
  }

  // Find customer by linked telegramChatId
  let linkedCustomer = null;
  try {
    const customerList = await db.select().from(customers).where(eq(customers.telegramChatId, String(chatId)));
    linkedCustomer = customerList[0];
  } catch (e) {}

  if (cmd === '/start') {
    if (linkedCustomer) {
      const replyText = `👋 <b>С возвращением, ${linkedCustomer.name}!</b>\n\n` +
                  `Ваш аккаунт привязан к системе контроля долга "Nasiya" магазина "1000 Мелочей".\n\n` +
                  `Кнопки управления уже доступны внизу.`;
      await sendTelegramMessage(token, chatId, replyText, debtorKeyboardMarkup);
    } else {
      const replyText = `🛑 <b>Доступ ограничен.</b>\n\n` +
                  `Для привязки аккаунта воспользуйтесь персональной ссылкой от администратора магазина (например, полученной от кассира).`;
      await sendTelegramMessage(token, chatId, replyText, debtorKeyboardMarkup);
    }
    return;
  }

  if (cmd.includes('мой долг') || cmd.includes('баланс') || cmd.includes('остаток') || cmd === '/debt') {
    if (linkedCustomer) {
      const replyText = `📉 <b>Ваш текущий остаток долга:</b> <u>${(linkedCustomer.debt).toLocaleString('ru-RU')} руб.</u>\n\n` +
                  `💳 <b>Ваш лимит кредита:</b> ${linkedCustomer.debtLimit.toLocaleString('ru-RU')} руб.\n` +
                  `🏷️ <b>Персональная скидка:</b> ${linkedCustomer.discountPercent}%\n\n` +
                  `🙏 <i>Уплатить задолженность вы можете наличными кассиру либо через QR-код СБП в магазине "1000 Мелочей". Спасибо за вашу честность!</i>`;
      await sendTelegramMessage(token, chatId, replyText, debtorKeyboardMarkup);
    } else {
      const replyText = `⚠️ <b>Ваш аккаунт не привязан к карте клиента.</b>\n\nДля привязки воспользуйтесь персональной ссылкой-приглашением от администратора.`;
      await sendTelegramMessage(token, chatId, replyText, debtorKeyboardMarkup);
    }
    return;
  }

  if (cmd.includes('история выплат') || cmd.includes('выплат') || cmd.includes('транзакци')) {
    if (linkedCustomer) {
      try {
        const customerPayments = await db.select().from(debtPayments).where(eq(debtPayments.customerId, linkedCustomer.id));
        const customerSales = await db.select().from(saleTransactions).where(eq(saleTransactions.customerId, linkedCustomer.id));
        
        const debtSales = customerSales.filter(s => s.paymentMethod === 'DEBT' || s.paidDebt > 0);

        const combinedHistory = [
          ...customerPayments.map(p => ({
            timestamp: p.timestamp,
            text: `🟢 <b>${new Date(p.timestamp).toLocaleDateString('ru-RU')}</b> — Оплачено <b>${p.amount.toLocaleString('ru-RU')} руб.</b> (${p.paymentMethod === 'CASH' ? 'Наличные' : 'Карта'})`
          })),
          ...debtSales.map(s => ({
            timestamp: s.timestamp,
            text: `🔴 <b>${new Date(s.timestamp).toLocaleDateString('ru-RU')}</b> — Покупка в долг на сумму <b>${(s.paidDebt || s.finalPrice || 0).toLocaleString('ru-RU')} руб.</b>`
          }))
        ].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()).slice(0, 10);

        let replyText = '';
        if (combinedHistory.length === 0) {
          replyText = `📜 <b>ИСТОРИЯ ВЫПЛАТ И ТРАНЗАКЦИЙ</b>\n\n` +
                      `За вами пока не числится произведенных оплат или покупок в кредит.`;
        } else {
          replyText = `📜 <b>ИСТОРИЯ ВЫПЛАТ И ТРАНЗАКЦИЙ (Лимит: 10)</b>\n\n` +
                      combinedHistory.map(h => h.text).join('\n\n') +
                      `\n\n💰 <b>Итого текущий долг к оплате:</b> ${linkedCustomer.debt.toLocaleString('ru-RU')} руб.`;
        }
        await sendTelegramMessage(token, chatId, replyText, debtorKeyboardMarkup);
      } catch (err) {
        await sendTelegramMessage(token, chatId, `❌ Не удалось получить историю транзакций.`);
      }
    } else {
      const replyText = `⚠️ <b>Ваш аккаунт не привязан к карте клиента.</b>\nДля привязки воспользуйтесь персональной ссылкой.`;
      await sendTelegramMessage(token, chatId, replyText, debtorKeyboardMarkup);
    }
    return;
  }

  if (cmd.includes('детализация') || cmd.includes('товарам') || cmd.includes('что взято')) {
    if (linkedCustomer) {
      try {
        const customerSales = await db.select().from(saleTransactions).where(eq(saleTransactions.customerId, linkedCustomer.id));
        const debtSales = customerSales.filter(s => s.paymentMethod === 'DEBT' || s.paidDebt > 0);
        
        const itemSumMap: Record<string, { name: string, qty: number }> = {};

        for (const sale of debtSales) {
          if (Array.isArray(sale.items)) {
            for (const item of sale.items) {
              const pId = item.productId || item.productName;
              if (!itemSumMap[pId]) {
                itemSumMap[pId] = { name: item.productName, qty: 0 };
              }
              itemSumMap[pId].qty += item.quantity;
            }
          }
        }

        const itemsList = Object.values(itemSumMap);
        let replyText = '';
        if (itemsList.length === 0) {
          replyText = `📦 <b>ДЕТАЛИЗАЦИЯ ТОВАРОВ В ДОЛГУ</b>\n\n` +
                      `За вами сейчас не числится приобретенных товаров в долг.`;
        } else {
          replyText = `📦 <b>ДЕТАЛИЗАЦИЯ ВЗЯТЫХ ТОВАРОВ В КРЕДИТ:</b>\n\n` +
                      itemsList.map(it => `• <b>${it.name}</b> — <b>${it.qty} шт.</b>`).join('\n') +
                      `\n\n📉 <i>Для закрытия долга Вы можете внести любую сумму на кассе магазина "1000 Мелочей".</i>`;
        }
        await sendTelegramMessage(token, chatId, replyText, debtorKeyboardMarkup);
      } catch (err) {
        await sendTelegramMessage(token, chatId, `❌ Не удалось получить детализацию.`);
      }
    } else {
      const replyText = `⚠️ <b>Ваш аккаунт не привязан к карте клиента.</b>`;
      await sendTelegramMessage(token, chatId, replyText, debtorKeyboardMarkup);
    }
    return;
  }

  if (cmd.includes('последняя накладная') || cmd.includes('накладн') || cmd.includes('покупки')) {
    if (linkedCustomer) {
      try {
        const customerSales = await db.select().from(saleTransactions).where(eq(saleTransactions.customerId, linkedCustomer.id));
        if (customerSales.length === 0) {
          const replyText = `🧾 <b>НАКЛАДНЫЕ</b>\n\nУ вас пока нет покупок в нашей системе.`;
          await sendTelegramMessage(token, chatId, replyText, debtorKeyboardMarkup);
        } else {
          const latestSale = customerSales.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0];
          
          let itemsText = '';
          if (Array.isArray(latestSale.items)) {
            itemsText = latestSale.items.map(it => `• ${it.productName}: ${it.quantity} шт. x ${it.priceSell} руб. = ${it.quantity * it.priceSell} руб.`).join('\n');
          }

          const replyText = `🧾 <b>ПОСЛЕДНЯЯ НАКЛАДНАЯ (Покупка)</b>\n` + 
                            `Магазин: "1000 Мелочей"\n` +
                            `Дата: ${new Date(latestSale.timestamp).toLocaleDateString('ru-RU')} ${new Date(latestSale.timestamp).toLocaleTimeString('ru-RU')}\n\n` +
                            `<b>Товары:</b>\n` +
                            itemsText + `\n\n` +
                            (latestSale.totalDiscount > 0 ? `🎁 Скидка: ${latestSale.totalDiscount} руб.\n` : '') +
                            `💰 <b>Итого к оплате: ${latestSale.finalPrice} руб.</b>\n` +
                            `💳 Способ оплаты: ${latestSale.paymentMethod === 'CASH' ? 'Наличные' : latestSale.paymentMethod === 'CARD' ? 'Карта' : latestSale.paymentMethod === 'SPLIT' ? 'Смешанная' : 'В долг'}`;
          await sendTelegramMessage(token, chatId, replyText, debtorKeyboardMarkup);
        }
      } catch (err) {
        await sendTelegramMessage(token, chatId, `❌ Не удалось загрузить последнюю накладную.`);
      }
    } else {
      const replyText = `⚠️ <b>Ваш аккаунт не привязан к карте клиента.</b>`;
      await sendTelegramMessage(token, chatId, replyText, debtorKeyboardMarkup);
    }
    return;
  }

  const replyText = `❓ <b>Неизвестная команда.</b>\n\nПожалуйста, воспользуйтесь интерактивным кнопочным меню внизу для просмотра долга и транзакций.`;
  await sendTelegramMessage(token, chatId, replyText, debtorKeyboardMarkup);
}
