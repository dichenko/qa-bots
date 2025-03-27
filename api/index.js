const { Telegraf } = require('telegraf');
const { createClient } = require('@supabase/supabase-js');

// Конфигурация из переменных окружения
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const OWNER_ID = process.env.OWNER_TELEGRAM_ID;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Проверка обязательных переменных окружения
if (!BOT_TOKEN || !OWNER_ID) {
  console.error('Отсутствуют обязательные переменные окружения для бота');
  process.exit(1);
}

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Отсутствуют обязательные переменные окружения для Supabase');
  process.exit(1);
}

// Инициализация Supabase клиента
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Инициализация бота
const bot = new Telegraf(BOT_TOKEN);

// Функция для сохранения сообщения в БД
async function saveMessageToDatabase(userId, userName, userSurname, messageText, timestamp) {
  try {
    const { data, error } = await supabase
      .from('qa-bot-messages')
      .insert([
        { 
          tgid: userId,
          user_name: userName || null,
          user_surname: userSurname || null,
          text: messageText,
          timecode: timestamp
        }
      ]);
    
    if (error) {
      console.error('Ошибка при сохранении в БД:', error);
    } else {
      console.log('Сообщение сохранено:', data);
    }
  } catch (err) {
    console.error('Ошибка при работе с БД:', err);
  }
}

// Обработчик команды /start
bot.start(async (ctx) => {
  const userId = ctx.from.id;
  const userName = ctx.from.first_name;
  const userSurname = ctx.from.last_name;
  const messageText = 'Пользователь запустил бота';
  const timestamp = new Date().toISOString();

  // Ответ пользователю
  await ctx.reply('Здравствуйте! Напишите ваше сообщение, и мы скоро на него ответим.');
  
  // Отправка уведомления владельцу
  await bot.telegram.sendMessage(
    OWNER_ID,
    `👤 Пользователь с ID: ${userId}\nИмя: ${userName || 'Не указано'}\nФамилия: ${userSurname || 'Не указана'}\nДействие: Запустил бота`
  );

  // Сохранение в БД
  await saveMessageToDatabase(userId, userName, userSurname, messageText, timestamp);
});

// Обработчик текстовых сообщений от пользователей
bot.on('message', async (ctx) => {
  if (ctx.message.text) {
    const userId = ctx.from.id;
    const userName = ctx.from.first_name;
    const userSurname = ctx.from.last_name;
    const messageText = ctx.message.text;
    const timestamp = new Date().toISOString();
    
    // Проверка, является ли сообщение ответом от владельца
    if (ctx.message.reply_to_message && ctx.from.id.toString() === OWNER_ID) {
      // Получение ID пользователя из оригинального сообщения
      const originalMessageText = ctx.message.reply_to_message.text;
      const userIdMatch = originalMessageText.match(/ID: (\d+)/);
      
      if (userIdMatch && userIdMatch[1]) {
        const recipientId = userIdMatch[1];
        // Отправка ответа пользователю
        await bot.telegram.sendMessage(recipientId, `Ответ: ${messageText}`);
        
        // Сохранение ответа в БД
        await saveMessageToDatabase(OWNER_ID, 'Владелец', '', `Ответ для ${recipientId}: ${messageText}`, timestamp);
        
        // Подтверждение владельцу
        await ctx.reply(`Ответ отправлен пользователю ${recipientId}`);
      } else {
        await ctx.reply('Не удалось определить ID пользователя для ответа');
      }
    } 
    // Если сообщение от обычного пользователя (не владельца)
    else if (ctx.from.id.toString() !== OWNER_ID) {
      // Ответ пользователю
      await ctx.reply('Получили ваше сообщение, скоро ответим');
      
      // Отправка сообщения владельцу
      await bot.telegram.sendMessage(
        OWNER_ID,
        `👤 Пользователь с ID: ${userId}\nИмя: ${userName || 'Не указано'}\nФамилия: ${userSurname || 'Не указана'}\nСообщение: ${messageText}`
      );
      
      // Сохранение в БД
      await saveMessageToDatabase(userId, userName, userSurname, messageText, timestamp);
    }
  }
});

// Обработка ошибок
bot.catch((err, ctx) => {
  console.error(`Ошибка для ${ctx.updateType}`, err);
});

// Webhook для Vercel
module.exports = async (req, res) => {
  try {
    if (req.method === 'POST') {
      await bot.handleUpdate(req.body);
      res.status(200).end();
    } else {
      // Для GET запросов можно вернуть какую-то информацию о боте
      res.status(200).json({ status: 'Бот активен' });
    }
  } catch (error) {
    console.error('Ошибка при обработке запроса:', error);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
}; 