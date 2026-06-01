import { handleInternalBotUpdate } from './internal';
import { handleClientBotUpdate } from './client';

export function startPolling(internalToken?: string, clientToken?: string) {
  const startThread = (token: string, handler: (token: string, message: any) => Promise<void>, name: string) => {
    console.log(`📡 Запуск локального Polling [${name}]...`);
    let offset = 0;
    const poll = async () => {
      try {
        const response = await fetch(`https://api.telegram.org/bot${token}/getUpdates?offset=${offset}&timeout=10`);
        if (response.ok) {
          const data: any = await response.json();
          if (data.ok && Array.isArray(data.result)) {
            for (const update of data.result) {
              offset = update.update_id + 1;
              if (update.message) {
                await handler(token, update.message);
              } else if (update.callback_query) {
                await handler(token, {
                  callback_query: update.callback_query,
                  chat: update.callback_query.message.chat,
                  from: update.callback_query.from,
                  text: ""
                });
              }
            }
          }
        }
      } catch (err: any) {
        // Suppress timeout/network noise
        if (!err.message?.includes('timeout') && err.name !== 'TimeoutError') {
          console.error(`⚠️ Ошибка Telegram Bot Polling [${name}]:`, err.message);
        }
        await new Promise(r => setTimeout(r, 5000));
      }
      setTimeout(poll, 1000);
    };
    poll();
  };

  const setBotCommands = async (token: string, commands: { command: string; description: string }[]) => {
    try {
      const res = await fetch(`https://api.telegram.org/bot${token}/setMyCommands`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ commands })
      });
      if (res.ok) {
        console.log(`[Telegram Bot] Commands set successfully for token ${token.slice(0, 10)}...`);
      } else {
        console.warn(`[Telegram Bot] Failed to set commands: ${res.status}`);
      }
    } catch (err: any) {
      console.error(`[Telegram Bot] Failed to set commands error:`, err.message);
    }
  };

  if (internalToken) {
    setBotCommands(internalToken, [
      { command: 'status', description: 'Сводка кассы и состояние магазина' },
      { command: 'revenue', description: 'Отчет по финансам и выручке' },
      { command: 'orders', description: 'Список 5 последних интернет-заказов' },
      { command: 'low_stock', description: 'Дефицит и критические остатки товаров' },
      { command: 'alerts', description: 'Тест системных оповещений владельца' }
    ]);
    startThread(internalToken, handleInternalBotUpdate, "Internal Bot");
  }
  if (clientToken) {
    startThread(clientToken, handleClientBotUpdate, "Client Bot");
  }
}
