// Скрипт для создания таблицы в Supabase
const { createClient } = require('@supabase/supabase-js');

// Получаем переменные окружения
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

module.exports = async (req, res) => {
  // Проверяем наличие необходимых переменных окружения
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    return res.status(400).json({
      success: false,
      error: 'Отсутствуют переменные окружения для Supabase'
    });
  }

  try {
    // Создаем клиент Supabase
    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
    console.log('Supabase клиент создан');

    // Проверяем, существует ли таблица
    const { data: existingTable, error: checkError } = await supabase
      .from('qa-bot-messages')
      .select('id')
      .limit(1);

    // Если таблица уже существует
    if (!checkError) {
      return res.status(200).json({
        success: true,
        message: 'Таблица qa-bot-messages уже существует'
      });
    }

    console.log('Проверка таблицы: ', checkError);

    // Таблица не существует, создаем её через SQL запрос
    // Используем RPC для выполнения SQL-запроса
    const { data: createTableData, error: createTableError } = await supabase.rpc('create_qa_bot_messages_table');

    if (createTableError) {
      console.error('Ошибка при создании таблицы через RPC:', createTableError);

      // Пробуем создать функцию для создания таблицы
      const createFunctionQuery = `
      CREATE OR REPLACE FUNCTION create_qa_bot_messages_table()
      RETURNS void AS $$
      BEGIN
        CREATE TABLE IF NOT EXISTS public.qa_bot_messages (
          id SERIAL PRIMARY KEY,
          tgid TEXT NOT NULL,
          user_name TEXT,
          user_surname TEXT,
          text TEXT NOT NULL,
          timecode TIMESTAMP NOT NULL DEFAULT NOW()
        );
        
        CREATE INDEX IF NOT EXISTS idx_qa_bot_messages_tgid ON public.qa_bot_messages(tgid);
        CREATE INDEX IF NOT EXISTS idx_qa_bot_messages_timecode ON public.qa_bot_messages(timecode);
      END;
      $$ LANGUAGE plpgsql SECURITY DEFINER;
      `;

      // Выполняем запрос на создание функции
      const { error: createFuncError } = await supabase.rpc('exec_sql', { sql: createFunctionQuery });

      if (createFuncError) {
        console.error('Ошибка при создании функции:', createFuncError);
        return res.status(500).json({
          success: false,
          error: 'Не удалось создать таблицу qa-bot-messages',
          details: createFuncError
        });
      }

      // Вызываем созданную функцию
      const { error: execFuncError } = await supabase.rpc('create_qa_bot_messages_table');

      if (execFuncError) {
        console.error('Ошибка при вызове функции создания таблицы:', execFuncError);
        return res.status(500).json({
          success: false,
          error: 'Не удалось вызвать функцию для создания таблицы',
          details: execFuncError
        });
      }
    }

    // Проверяем, создалась ли таблица
    const { data: checkAgain, error: checkAgainError } = await supabase
      .from('qa-bot-messages')
      .select('id')
      .limit(1);

    if (checkAgainError) {
      return res.status(500).json({
        success: false,
        error: 'Таблица не была создана',
        details: checkAgainError
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Таблица qa-bot-messages успешно создана'
    });

  } catch (error) {
    console.error('Критическая ошибка при создании таблицы:', error);
    return res.status(500).json({
      success: false,
      error: 'Критическая ошибка при создании таблицы',
      details: error.message
    });
  }
}; 