// Вспомогательная функция для установки вебхука
// Вызывается при деплое на Vercel

const { createClient } = require('@supabase/supabase-js');

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

module.exports = async (req, res) => {
  try {
    if (!BOT_TOKEN) {
      return res.status(400).json({ error: 'Токен бота не указан в переменных окружения' });
    }

    // Получаем базовый URL из заголовков
    const host = req.headers.host || '';
    const protocol = host.includes('localhost') ? 'http' : 'https';
    const webhookUrl = `${protocol}://${host}/api/index`;

    // Информация о переменных окружения для отладки
    const envInfo = {
      botTokenPresent: !!BOT_TOKEN,
      botTokenLength: BOT_TOKEN ? BOT_TOKEN.length : 0,
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

    // Устанавливаем вебхук
    const response = await fetch(
      `https://api.telegram.org/bot${BOT_TOKEN}/setWebhook?url=${webhookUrl}`
    );
    
    const data = await response.json();
    
    if (data.ok) {
      return res.status(200).json({ 
        success: true, 
        message: `Вебхук установлен на ${webhookUrl}`,
        result: data,
        env: envInfo,
        supabase: supabaseStatus
      });
    } else {
      return res.status(400).json({ 
        success: false, 
        error: 'Не удалось установить вебхук',
        result: data,
        env: envInfo,
        supabase: supabaseStatus
      });
    }
  } catch (error) {
    console.error('Ошибка при установке вебхука:', error);
    return res.status(500).json({ 
      success: false, 
      error: 'Внутренняя ошибка сервера',
      details: error.message
    });
  }
}; 