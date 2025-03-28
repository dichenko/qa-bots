// Вспомогательная функция для установки вебхука
// Вызывается при деплое на Vercel

const { createClient } = require('@supabase/supabase-js');

// Поддержка нескольких ботов - получаем все переменные с префиксом BOT_TOKEN_
const BOT_TOKENS = {};
Object.keys(process.env).forEach(key => {
  if (key.startsWith('TELEGRAM_BOT_TOKEN_')) {
    const botId = key.replace('TELEGRAM_BOT_TOKEN_', '');
    BOT_TOKENS[botId] = process.env[key];
  }
});

// Поддерживаем обратную совместимость, но не используем специальный ID
if (process.env.TELEGRAM_BOT_TOKEN && Object.keys(BOT_TOKENS).length === 0) {
  // Только если нет других ботов, используем MAIN как ID
  BOT_TOKENS['MAIN'] = process.env.TELEGRAM_BOT_TOKEN;
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
    for (const [index, [botId, token]] of Object.entries(BOT_TOKENS).entries()) {
      try {
        // Формируем URL для вебхука
        let webhookUrl;
        
        // Первый бот в списке получает также корневой путь
        if (index === 0) {
          // Устанавливаем корневой путь для первого бота
          const rootWebhookUrl = `${protocol}://${host}/api/index`;
          console.log(`Устанавливаем вебхук для бота ${botId} на корневой путь: ${rootWebhookUrl}`);
          
          // Устанавливаем вебхук для корневого пути
          const rootResponse = await fetch(
            `https://api.telegram.org/bot${token}/setWebhook?url=${rootWebhookUrl}`
          );
          
          const rootData = await rootResponse.json();
          results[`${botId}_root`] = {
            success: rootData.ok,
            url: rootWebhookUrl,
            response: rootData
          };
        }
        
        // Всегда устанавливаем именованный путь для каждого бота
        webhookUrl = `${protocol}://${host}/api/index/${botId}`;
        console.log(`Устанавливаем вебхук для бота ${botId} на именованный путь: ${webhookUrl}`);
        
        // Устанавливаем вебхук для именованного пути
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
        supabase: supabaseStatus
      });
    } else {
      return res.status(207).json({ 
        success: false, 
        message: 'Не все вебхуки были успешно установлены',
        results: results,
        env: envInfo,
        supabase: supabaseStatus
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