// Скрипт для получения информации о базе данных Supabase
const { createClient } = require('@supabase/supabase-js');

// Получаем переменные окружения
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

module.exports = async (req, res) => {
  // Собираем информацию о переменных окружения
  const envInfo = {
    SUPABASE_URL: SUPABASE_URL ? 'Установлен' : 'Отсутствует',
    SUPABASE_URL_LENGTH: SUPABASE_URL ? SUPABASE_URL.length : 0,
    SUPABASE_KEY: SUPABASE_KEY ? 'Установлен' : 'Отсутствует',
    SUPABASE_KEY_LENGTH: SUPABASE_KEY ? SUPABASE_KEY.length : 0,
    POSTGRES_URL: process.env.POSTGRES_URL ? 'Установлен' : 'Отсутствует',
    POSTGRES_USER: process.env.POSTGRES_USER ? 'Установлен' : 'Отсутствует',
    POSTGRES_HOST: process.env.POSTGRES_HOST ? 'Установлен' : 'Отсутствует',
    BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN ? 'Установлен' : 'Отсутствует',
    OWNER_ID: process.env.OWNER_TELEGRAM_ID ? 'Установлен' : 'Отсутствует'
  };

  // Проверяем наличие необходимых переменных окружения
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    return res.status(400).json({
      success: false,
      error: 'Отсутствуют переменные окружения для Supabase',
      environmentVariables: envInfo
    });
  }

  try {
    // Создаем клиент Supabase
    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
    
    // Проверяем соединение с Supabase
    const { data: connectionTest, error: connectionError } = await supabase
      .from('qa-bot-messages')
      .select('id')
      .limit(1);

    // Получаем список таблиц в базе данных (если есть доступ)
    let tables = [];
    let tablesError = null;
    
    try {
      const { data: tablesData, error: tablesListError } = await supabase.rpc('get_tables');
      if (!tablesListError && tablesData) {
        tables = tablesData;
      } else {
        tablesError = tablesListError;
      }
    } catch (err) {
      tablesError = err.message;
    }

    // Формируем ответ
    return res.status(200).json({
      success: true,
      environmentVariables: envInfo,
      connection: {
        connected: !connectionError,
        error: connectionError ? {
          code: connectionError.code,
          message: connectionError.message,
          details: connectionError.details
        } : null,
        tableExists: !connectionError
      },
      tables: {
        list: tables,
        error: tablesError
      }
    });

  } catch (error) {
    console.error('Ошибка при получении информации о базе данных:', error);
    return res.status(500).json({
      success: false,
      error: 'Ошибка при получении информации о базе данных',
      details: error.message,
      environmentVariables: envInfo
    });
  }
}; 