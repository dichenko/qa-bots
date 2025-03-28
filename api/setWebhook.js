// Вспомогательная функция для установки вебхука
// Вызывается при деплое на Vercel

const { createClient } = require('@supabase/supabase-js');

// Поддержка нескольких ботов - получаем все переменные с префиксом BOT_TOKEN_
const BOT_TOKENS = {};

// Сначала проверяем стандартный формат TELEGRAM_BOT_TOKEN_<ID>
Object.keys(process.env).forEach(key => {
  if (key.startsWith('TELEGRAM_BOT_TOKEN_')) {
    const botId = key.replace('TELEGRAM_BOT_TOKEN_', '');
    BOT_TOKENS[botId] = process.env[key];
  }
});

// Проверяем переменные в других возможных форматах
Object.keys(process.env).forEach(key => {
  // Проверяем формат TELEGRAM_<ID>_BOT_TOKEN
  if (key.startsWith('TELEGRAM_') && key.endsWith('_BOT_TOKEN') && !key.startsWith('TELEGRAM_BOT_TOKEN_')) {
    const botId = key.replace('TELEGRAM_', '').replace('_BOT_TOKEN', '');
    BOT_TOKENS[botId] = process.env[key];
    console.log(`Найден альтернативный формат переменной для бота ${botId}: ${key}`);
  }
  // Проверяем другие возможные форматы, если они используются
  else if (key.startsWith('BOT_TOKEN_')) {
    const botId = key.replace('BOT_TOKEN_', '');
    BOT_TOKENS[botId] = process.env[key];
    console.log(`Найден альтернативный формат переменной для бота ${botId}: ${key}`);
  }
  else if (key === 'TELEGRAM_MYSHADOW' || key === 'TELEGRAM_TOKEN_MYSHADOW') {
    BOT_TOKENS['MYSHADOW'] = process.env[key];
    console.log(`Найден специальный формат переменной для бота MYSHADOW: ${key}`);
  }
  else if (key === 'TELEGRAM_FEELME36' || key === 'TELEGRAM_TOKEN_FEELME36') {
    BOT_TOKENS['FEELME36'] = process.env[key];
    console.log(`Найден специальный формат переменной для бота FEELME36: ${key}`);
  }
});

// Поддерживаем обратную совместимость
if (process.env.TELEGRAM_BOT_TOKEN && Object.keys(BOT_TOKENS).length === 0) {
  // Только если нет других ботов, используем MAIN как ID
  BOT_TOKENS['MAIN'] = process.env.TELEGRAM_BOT_TOKEN;
}

// Проверим, был ли добавлен хотя бы один бот MYSHADOW, если нет - проверим другие переменные
if (!BOT_TOKENS['MYSHADOW'] && process.env.TELEGRAM_BOT_TOKEN) {
  console.log('Бот MYSHADOW не найден в стандартных переменных, попробуем использовать TELEGRAM_BOT_TOKEN');
  BOT_TOKENS['MYSHADOW'] = process.env.TELEGRAM_BOT_TOKEN;
}

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

module.exports = async (req, res) => {
  try {
    if (Object.keys(BOT_TOKENS).length === 0) {
      return res.status(400).json({ error: 'Ни один токен бота не указан в переменных окружения' });
    }

    // Получаем базовый URL из заголовков
    const host = req.headers.host || '';
    const protocol = host.includes('localhost') ? 'http' : 'https';
    
    // Информация о переменных окружения для отладки
    const envInfo = {
      botTokensCount: Object.keys(BOT_TOKENS).length,
      botIds: Object.keys(BOT_TOKENS),
      supabaseUrlPresent: !!SUPABASE_URL,
      supabaseKeyPresent: !!SUPABASE_KEY,
    };

    // Проверка соединения с Supabase
    let supabaseStatus = { connected: false, error: null };
    
    if (SUPABASE_URL && SUPABASE_KEY) {
      try {
        const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
        const { data, error } = await supabase.from('qa_bot_messages').select('id').limit(1);
        
        if (error) {
          supabaseStatus = { connected: false, error: error.message, code: error.code };
        } else {
          supabaseStatus = { connected: true, message: 'Успешное подключение к Supabase' };
        }
      } catch (error) {
        supabaseStatus = { connected: false, error: error.message };
      }
    }

    // Результаты установки вебхуков для всех ботов
    const results = {};
    
    // Получаем список всех ботов
    const botIds = Object.keys(BOT_TOKENS);
    
    // Устанавливаем вебхуки для каждого бота
    for (const [botId, token] of Object.entries(BOT_TOKENS)) {
      try {
        // Формируем URL для вебхука
        const webhookUrl = `${protocol}://${host}/api/index/${botId}`;
        console.log(`Устанавливаем вебхук для бота ${botId} на: ${webhookUrl}`);
        
        // Устанавливаем вебхук
        const response = await fetch(
          `https://api.telegram.org/bot${token}/setWebhook?url=${webhookUrl}`
        );
        
        const data = await response.json();
        results[botId] = {
          success: data.ok,
          url: webhookUrl,
          response: data
        };
      } catch (error) {
        results[botId] = {
          success: false,
          error: error.message
        };
      }
    }
    
    // Проверяем, все ли вебхуки успешно установлены
    const allSuccessful = Object.values(results).every(result => result.success);
    
    if (allSuccessful) {
      return res.status(200).json({ 
        success: true, 
        message: `Все вебхуки успешно установлены`,
        results: results,
        env: envInfo,
        supabase: supabaseStatus,
        webhookUrls: Object.entries(results).map(([botId, result]) => ({
          botId,
          url: result.url
        }))
      });
    } else {
      return res.status(207).json({ 
        success: false, 
        message: 'Не все вебхуки были успешно установлены',
        results: results,
        env: envInfo,
        supabase: supabaseStatus,
        webhookUrls: Object.entries(results).map(([botId, result]) => ({
          botId,
          url: result.url
        }))
      });
    }
  } catch (error) {
    console.error('Ошибка при установке вебхуков:', error);
    return res.status(500).json({ 
      success: false, 
      error: 'Внутренняя ошибка сервера',
      details: error.message
    });
  }
}; 