require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const fs = require('fs');
const path = require('path');

const token = process.env.TELEGRAM_BOT_TOKEN || process.env.TELEGRAM_BOT_TOKEN_CLIENT || process.env.TELEGRAM_BOT_TOKEN_INTERNAL;

if (!token) {
  console.error('ERROR: Telegram bot token is not configured. Set TELEGRAM_BOT_TOKEN, TELEGRAM_BOT_TOKEN_CLIENT, or TELEGRAM_BOT_TOKEN_INTERNAL in .env.');
  process.exit(1);
}

// Инициализируем бота
const bot = new TelegramBot(token, { polling: true });

// Файл-база данных (JSON)
const dbPath = path.join(__dirname, 'db.json');

// Чтение базы
function readDb() {
  if (!fs.existsSync(dbPath)) return [];
  return JSON.parse(fs.readFileSync(dbPath, 'utf8'));
}

// Запись в базу
function writeDb(data) {
  fs.writeFileSync(dbPath, JSON.stringify(data, null, 2), 'utf8');
}

// Обрабатываем команду /start
bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  const firstName = msg.from.first_name || '';
  const lastName = msg.from.last_name || '';
  const fullName = `${firstName} ${lastName}`.trim() || 'Пользователь';

  // Сохраняем в "базу данных"
  const dbLine = {
    chatId: chatId,
    name: fullName,
    username: msg.from.username || null,
    addedAt: new Date().toISOString()
  };

  const users = readDb();
  
  // Проверяем, есть ли уже этот пользователь в базе
  const existingUser = users.find(u => u.chatId === chatId);
  
  if (!existingUser) {
    users.push(dbLine);
    writeDb(users);
    
    bot.sendMessage(
      chatId, 
      `Здравствуйте, ${fullName}! Ваш профиль успешно привязан. Ваш Telegram Chat ID: ${chatId}. \n\nПередайте этот ID кассиру или менеджеру магазина "1000 Мелочей", чтобы получать уведомления.`
    );
    console.log(`[BOT] Новый пользователь сохранён: ${fullName} (Chat ID: ${chatId})`);
  } else {
    bot.sendMessage(
      chatId, 
      `Здравствуйте, ${fullName}! Вы уже зарегистрированы. \nВаш Telegram Chat ID: ${chatId}.`
    );
  }
});

console.log('Telegram-бот запущен. Ожидает сообщений...');
