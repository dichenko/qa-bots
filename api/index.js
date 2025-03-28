const { Telegraf } = require('telegraf');
const { createClient } = require('@supabase/supabase-js');

// Конфигурация из переменных окружения
// Поддержка нескольких ботов - получаем все переменные с префиксом BOT_TOKEN_
const BOT_TOKENS = {};
Object.keys(process.env).forEach(key => {
  if (key.startsWith('TELEGRAM_BOT_TOKEN_')) {
    const botId = key.replace('TELEGRAM_BOT_TOKEN_', '');
    BOT_TOKENS[botId] = process.env[key];
  }
});

// Добавляем поддержку основного токена для обратной совместимости
if (process.env.TELEGRAM_BOT_TOKEN) {
  BOT_TOKENS['DEFAULT'] = process.env.TELEGRAM_BOT_TOKEN;
}

const OWNER_ID = process.env.OWNER_TELEGRAM_ID;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Проверка обязательных переменных окружения
if (Object.keys(BOT_TOKENS).length === 0 || !OWNER_ID) {
  console.error('Отсутствуют обязательные переменные окружения для бота');
  process.exit(1);
}

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Отсутствуют обязательные переменные окружения для Supabase');
  process.exit(1);
}

// Дополнительная проверка переменных окружения для отладки
console.log('SUPABASE_URL задан:', !!SUPABASE_URL);
console.log('SUPABASE_KEY задан:', !!SUPABASE_KEY);
console.log('Количество ботов:', Object.keys(BOT_TOKENS).length);
console.log('IDs ботов:', Object.keys(BOT_TOKENS).join(', '));

// Инициализация Supabase клиента
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Проверка существования таблицы
async function checkTableExists() {
  try {
    console.log('Проверяем наличие таблицы qa_bot_messages...');
    const { data, error } = await supabase
      .from('qa_bot_messages')
      .select('id')
      .limit(1);
    
    if (error) {
      console.error('Ошибка при проверке таблицы qa_bot_messages:', error);
      // Создаем таблицу, если есть необходимые права
      if (error.code === '42P01') { // Код ошибки PostgreSQL для отсутствующей таблицы
        console.log('Таблица не найдена. Попытка создать таблицу...');
      }
    } else {
      console.log('Таблица qa_bot_messages существует.');
    }
  } catch (err) {
    console.error('Ошибка при проверке таблицы:', err);
  }
}

// Вызываем проверку таблицы при запуске
checkTableExists();

// Инициализация ботов
const bots = {};
Object.entries(BOT_TOKENS).forEach(([botId, token]) => {
  try {
    const bot = new Telegraf(token);
    
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
        `👤 Пользователь с ID: ${userId}\nИмя: ${userName || 'Не указано'}\nФамилия: ${userSurname || 'Не указана'}\nДействие: Запустил бота\nБот: ${botId}`
      );

      // Сохранение в БД
      await saveMessageToDatabase(userId, userName, userSurname, messageText, timestamp, botId);
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
          // Получение ID пользователя и ID бота из оригинального сообщения
          const originalMessageText = ctx.message.reply_to_message.text;
          const userIdMatch = originalMessageText.match(/ID: (\d+)/);
          const botIdMatch = originalMessageText.match(/Бот: ([A-Z0-9_]+)/);
          
          if (userIdMatch && userIdMatch[1] && botIdMatch && botIdMatch[1]) {
            const recipientId = userIdMatch[1];
            const targetBotId = botIdMatch[1];
            const targetBot = bots[targetBotId];
            
            if (targetBot) {
              // Отправка ответа пользователю
              await targetBot.telegram.sendMessage(recipientId, `Ответ: ${messageText}`);
              
              // Сохранение ответа в БД
              await saveMessageToDatabase(OWNER_ID, 'Владелец', '', `Ответ для ${recipientId}: ${messageText}`, timestamp, targetBotId);
              
              // Подтверждение владельцу
              await ctx.reply(`Ответ отправлен пользователю ${recipientId} через бота ${targetBotId}`);
            } else {
              await ctx.reply(`Не найден бот с ID: ${targetBotId}`);
            }
          } else {
            await ctx.reply('Не удалось определить ID пользователя или бота для ответа');
          }
        } 
        // Если сообщение от обычного пользователя (не владельца)
        else if (ctx.from.id.toString() !== OWNER_ID) {
          // Проверяем, было ли сообщение от пользователя за последние 24 часа
          const hadRecentMessages = await hasRecentMessages(userId, botId);
          
          // Отправляем стандартный ответ только если не было сообщений за последние 24 часа
          if (!hadRecentMessages) {
            await ctx.reply('Получили ваше сообщение, скоро ответим');
          }
          
          // Отправка сообщения владельцу в любом случае
          await bot.telegram.sendMessage(
            OWNER_ID,
            `👤 Пользователь с ID: ${userId}\nИмя: ${userName || 'Не указано'}\nФамилия: ${userSurname || 'Не указана'}\nСообщение: ${messageText}\nБот: ${botId}`
          );
          
          // Сохранение в БД в любом случае
          await saveMessageToDatabase(userId, userName, userSurname, messageText, timestamp, botId);
        }
      }
    });

    // Обработка ошибок
    bot.catch((err, ctx) => {
      console.error(`Ошибка для ${ctx.updateType} в боте ${botId}`, err);
    });
    
    // Добавляем бота в список
    bots[botId] = bot;
    console.log(`Бот ${botId} успешно инициализирован`);
    
  } catch (error) {
    console.error(`Ошибка при инициализации бота ${botId}:`, error);
  }
});

// Функция для сохранения сообщения в БД
async function saveMessageToDatabase(userId, userName, userSurname, messageText, timestamp, botId) {
  try {
    console.log('Попытка сохранить сообщение в БД:', {
      tgid: userId,
      user_name: userName,
      text: messageText.substring(0, 20) + '...', // Показываем только начало сообщения для логов
      bot_id: botId
    });
    
    // Проверка данных перед отправкой
    if (!userId) {
      console.error('userId не определен');
      return;
    }
    
    // Преобразуем userId в строку, если он не строка
    const tgidValue = userId.toString();
    
    const { data, error } = await supabase
      .from('qa_bot_messages')
      .insert([
        { 
          tgid: tgidValue,
          user_name: userName || null,
          user_surname: userSurname || null,
          text: messageText || '',
          timecode: timestamp,
          bot_id: botId
        }
      ]);
    
    if (error) {
      console.error('Ошибка при сохранении в БД:', error);
      // Отправляем ошибку владельцу бота для отладки
      try {
        const firstBot = Object.values(bots)[0];
        await firstBot.telegram.sendMessage(
          OWNER_ID,
          `⚠️ Ошибка при сохранении в БД:\nКод: ${error.code}\nСообщение: ${error.message}\nДетали: ${error.details || 'нет'}`
        );
      } catch (e) {
        console.error('Не удалось отправить сообщение об ошибке владельцу:', e);
      }
    } else {
      console.log('Сообщение успешно сохранено в БД');
    }
  } catch (err) {
    console.error('Критическая ошибка при работе с БД:', err);
    // Отправляем критическую ошибку владельцу бота
    try {
      const firstBot = Object.values(bots)[0];
      await firstBot.telegram.sendMessage(
        OWNER_ID,
        `🔴 Критическая ошибка при работе с БД: ${err.message}`
      );
    } catch (e) {
      console.error('Не удалось отправить сообщение о критической ошибке владельцу:', e);
    }
  }
}

// Функция для проверки наличия сообщений за последние 24 часа
async function hasRecentMessages(userId, botId) {
  try {
    // Получаем время 24 часа назад
    const oneDayAgo = new Date();
    oneDayAgo.setHours(oneDayAgo.getHours() - 24);
    const oneDayAgoStr = oneDayAgo.toISOString();
    
    console.log(`Проверяем сообщения пользователя ${userId} в боте ${botId} за последние 24 часа (после ${oneDayAgoStr})...`);
    
    const { data, error } = await supabase
      .from('qa_bot_messages')
      .select('id, timecode')
      .eq('tgid', userId.toString())
      .eq('bot_id', botId)
      .gte('timecode', oneDayAgoStr)
      .order('timecode', { ascending: false })
      .limit(1);
    
    if (error) {
      console.error('Ошибка при проверке недавних сообщений:', error);
      return false; // В случае ошибки считаем, что сообщений нет
    }
    
    const hasRecent = data && data.length > 0;
    console.log(`Найдены ли сообщения за последние 24 часа: ${hasRecent}`, hasRecent ? `(последнее в ${data[0].timecode})` : '');
    
    return hasRecent;
  } catch (err) {
    console.error('Критическая ошибка при проверке недавних сообщений:', err);
    return false; // В случае ошибки считаем, что сообщений нет
  }
}

// Webhook для Vercel
module.exports = async (req, res) => {
  try {
    if (req.method === 'POST') {
      // Получаем путь запроса для определения бота
      const path = req.url || '';
      
      let botId = 'DEFAULT'; // По умолчанию используем DEFAULT
      
      // Извлекаем ID бота из пути, только если путь содержит более одного сегмента
      const pathSegments = path.split('/').filter(segment => segment);
      if (pathSegments.length > 1) {
        botId = pathSegments[pathSegments.length - 1];
      }
      
      console.log(`Получен запрос на ${path}, определен botId: ${botId}`);
      
      // Проверяем, существует ли бот с таким ID
      if (bots[botId]) {
        await bots[botId].handleUpdate(req.body);
        res.status(200).end();
      } else {
        // Если бот не найден, но есть DEFAULT бот, используем его
        if (botId !== 'DEFAULT' && bots['DEFAULT']) {
          console.log(`Бот с ID "${botId}" не найден, используем DEFAULT`);
          await bots['DEFAULT'].handleUpdate(req.body);
          res.status(200).end();
        } else {
          // Если бот не найден и нет DEFAULT бота
          console.error(`Бот с ID "${botId}" не найден (путь: ${path}), доступные боты: ${Object.keys(bots).join(', ')}`);
          res.status(404).json({ error: 'Бот не найден', availableBots: Object.keys(bots) });
        }
      }
    } else {
      // Для GET запросов возвращаем информацию о доступных ботах
      const activeBots = Object.keys(bots);
      res.status(200).json({ 
        status: 'Система активна',
        bots: activeBots,
        count: activeBots.length
      });
    }
  } catch (error) {
    console.error('Ошибка при обработке запроса:', error);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
}; 