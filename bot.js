const { Telegraf } = require('telegraf');

// 🔐 Проверка токена (КРИТИЧЕСКИ ВАЖНО)
if (!process.env.BOT_TOKEN) {
  console.error('❌ BOT_TOKEN is missing');
  process.exit(1);
}

const bot = new Telegraf(process.env.BOT_TOKEN);

// =====================
// 🧠 ИГРА "Я БЕРУ С СОБОЙ"
// =====================

const games = {}; // хранение состояния по chat.id

// нормализация слова (без регистра, окончаний, мусора)
function normalize(word) {
  return word
    .toLowerCase()
    .replace(/[.,!?]/g, '')
    .trim();
}

// старт / сброс
bot.start((ctx) => {
  const chatId = ctx.chat.id;

  games[chatId] = {
    chain: [],
    record: 0
  };

  ctx.reply(
    '🧠 Игра началась!\n\n' +
    'Напиши ЛЮБОЕ слово.\n' +
    'Я добавлю своё.\n' +
    'Ты должен повторить всю цепочку и добавить новое.\n\n' +
    '❗ Повторы запрещены.'
  );
});

// кнопка "Заново"
bot.command('reset', (ctx) => {
  const chatId = ctx.chat.id;
  delete games[chatId];

  ctx.reply('🔄 Игра сброшена. Напиши новое слово.');
});

// основной ввод
bot.on('text', (ctx) => {
  const chatId = ctx.chat.id;
  const text = ctx.message.text;

  if (!games[chatId]) {
    games[chatId] = { chain: [], record: 0 };
  }

  const game = games[chatId];

  // разбиваем ввод: можно с запятыми, можно без
  const userWords = text
    .split(',')
    .map(w => normalize(w))
    .filter(Boolean);

  // 1️⃣ Первый ход
  if (game.chain.length === 0) {
    const firstWord = userWords[0];
    game.chain.push(firstWord);

    const botWord = generateBotWord(game.chain);
    game.chain.push(botWord);

    ctx.reply(botWord);
    return;
  }

  // 2️⃣ Проверка цепочки
  const expected = game.chain.join(' ');
  const received = userWords.join(' ');

  if (received !== expected) {
    ctx.reply(
      '❌ Неверно.\n\n' +
      `Текущая глубина: ${game.chain.length}\n` +
      `Рекорд: ${game.record}\n\n` +
      'Можешь попробовать исправить или написать /reset'
    );
    return;
  }

  // 3️⃣ Добавляем новое слово пользователя
  const newWord = userWords[userWords.length - 1];

  if (game.chain.includes(newWord)) {
    ctx.reply('❌ Повторы запрещены. Попробуй другое слово.');
    return;
  }

  game.chain.push(newWord);

  // 4️⃣ Бот добавляет слово
  const botWord = generateBotWord(game.chain);
  game.chain.push(botWord);

  game.record = Math.max(game.record, game.chain.length);

  ctx.reply(`✅ Правильно!\n\n${botWord}`);
});

// генерация слова бота
function generateBotWord(usedWords) {
  const baseWords = [
    'хлеб', 'чай', 'компас', 'верёвка', 'фонарь',
    'палатка', 'рюкзак', 'спички', 'карта', 'нож',
    'вода', 'котелок', 'куртка', 'ботинки', 'еда',
    'ложка', 'кружка', 'соль', 'сахар', 'аптечка'
  ];

  const available = baseWords.filter(w => !usedWords.includes(w));

  if (available.length === 0) {
    return 'тишина'; // fallback, если всё закончилось
  }

  return available[Math.floor(Math.random() * available.length)];
}

// =====================
// 🚀 ЗАПУСК
// =====================
bot.launch()
  .then(() => console.log('Бот запущен'))
  .catch(err => console.error('Ошибка запуска бота:', err));

// корректное завершение
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
