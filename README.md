# Telegram Feedback Bot

Телеграм-бот для обратной связи с пользователями. Позволяет получать сообщения от пользователей и отвечать на них.

## Функциональность

1. Пользователь отправляет сообщение в бот
2. Бот отвечает "Получили ваше сообщение, скоро ответим"
3. Владелец бота получает уведомление о новом сообщении
4. Владелец может ответить, сделав reply на полученное сообщение
5. Пользователь получает ответ от владельца
6. Все сообщения сохраняются в базе данных Supabase

## Технический стек

- Node.js
- Telegraf.js (библиотека для Telegram Bot API)
- Supabase (база данных)
- Vercel (хостинг)

## Настройка Supabase

1. Создайте новый проект в Supabase
2. Создайте таблицу `messages` со следующей структурой:
   - `id` (serial, primary key)
   - `tgid` (text, not null)
   - `user_name` (text)
   - `user_surname` (text)
   - `text` (text, not null)
   - `timecode` (timestamp, not null)

## Установка и запуск

### Локальная разработка

1. Клонируйте репозиторий
2. Установите зависимости: `npm install`
3. Создайте файл `.env` на основе `.env.example` и заполните его вашими данными
4. Запустите бот локально: `npm run dev`

### Деплой на Vercel

1. Создайте новый проект на Vercel
2. Добавьте следующие переменные окружения в настройках проекта:
   - `TELEGRAM_BOT_TOKEN` - токен вашего Telegram бота
   - `OWNER_TELEGRAM_ID` - ваш Telegram ID
   - `SUPABASE_URL` - URL вашего проекта Supabase
   - `SUPABASE_SERVICE_KEY` - сервисный ключ Supabase
3. Выполните деплой: `npm run deploy`

## Настройка вебхуков для Telegram

После деплоя на Vercel, установите вебхук для бота, отправив запрос:

```
https://api.telegram.org/bot<TELEGRAM_BOT_TOKEN>/setWebhook?url=<VERCEL_URL>/api/index
```

Где:
- `<TELEGRAM_BOT_TOKEN>` - токен вашего бота
- `<VERCEL_URL>` - URL вашего проекта на Vercel 