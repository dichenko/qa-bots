# Настройка вебхуков для Telegram ботов

## Автоматическая настройка

Настройка вебхуков может выполняться:

1. **При деплое**: Используйте команду `npm run deploy:with-webhooks` для деплоя и автоматической настройки вебхуков.

2. **Ежедневно**: Настроено ежедневное задание (CRON), которое вызывает `/api/setWebhook` каждый день в полночь.

3. **Вручную через браузер**: Посетите URL `https://qa-bots.vercel.app/setwebhook` или `https://qa-bots.vercel.app/api/setWebhook`.

## Ручная настройка (при необходимости)

Если у вас возникают проблемы с автоматической настройкой, вы можете настроить вебхуки вручную для каждого бота:

```
https://api.telegram.org/bot<ТОКЕН_БОТА>/setWebhook?url=https://qa-bots.vercel.app/api/index/<ID_БОТА>
```

Пример для бота FEELME36:
```
https://api.telegram.org/bot<ТОКЕН_FEELME36>/setWebhook?url=https://qa-bots.vercel.app/api/index/FEELME36
```

Пример для бота MYSHADOW:
```
https://api.telegram.org/bot<ТОКЕН_MYSHADOW>/setWebhook?url=https://qa-bots.vercel.app/api/index/MYSHADOW
```

## Проверка вебхуков

Чтобы проверить, правильно ли настроен вебхук для бота, используйте:

```
https://api.telegram.org/bot<ТОКЕН_БОТА>/getWebhookInfo
```

## Добавление новых ботов

При добавлении нового бота:

1. Добавьте токен бота в переменные окружения Vercel в формате `TELEGRAM_BOT_TOKEN_<ID_БОТА>`
2. Выполните повторный деплой с `npm run deploy:with-webhooks`
3. Или вручную настройте вебхук для нового бота 