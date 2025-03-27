// Вспомогательная функция для установки вебхука
// Вызывается при деплое на Vercel

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

module.exports = async (req, res) => {
  try {
    if (!BOT_TOKEN) {
      return res.status(400).json({ error: 'Токен бота не указан в переменных окружения' });
    }

    // Получаем базовый URL из заголовков
    const host = req.headers.host || '';
    const protocol = host.includes('localhost') ? 'http' : 'https';
    const webhookUrl = `${protocol}://${host}/api/index`;

    // Устанавливаем вебхук
    const response = await fetch(
      `https://api.telegram.org/bot${BOT_TOKEN}/setWebhook?url=${webhookUrl}`
    );
    
    const data = await response.json();
    
    if (data.ok) {
      return res.status(200).json({ 
        success: true, 
        message: `Вебхук установлен на ${webhookUrl}`,
        result: data
      });
    } else {
      return res.status(400).json({ 
        success: false, 
        error: 'Не удалось установить вебхук',
        result: data
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