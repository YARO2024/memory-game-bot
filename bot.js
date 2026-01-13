const { Telegraf, Markup } = require('telegraf');
const natural = require('natural');
const stemmer = natural.PorterStemmerRu;

// ===== ПРОВЕРКА ТОКЕНА =====
if (!process.env.BOT_TOKEN) {
  console.error('❌ BOT_TOKEN is missing');
  process.exit(1);
}

const bot = new Telegraf(process.env.BOT_TOKEN);

// ===== СОСТОЯНИЕ ИГР =====
const games = {};

// ===== РАНГИ =====
function getRank(depth) {
  if (depth >= 17) return '👑 Абсолют';
  if (depth >= 12) return '🔴 Легенда';
  if (depth >= 8)  return '🟣 Выживальщик';
  if (depth >= 5)  return '🔵 Путешественник';
  return '🟢 Новичок';
}

// ===== НОРМАЛИЗАЦИЯ =====
function normalize(word) {
  return stemmer.stem(
    word.toLowerCase().replace(/[.,!?]/g, '').trim()
  );
}

// ===== СТАРТ =====
bot.start((ctx) => {
  const chatId = ctx.chat.id;

  games[chatId] = {
    chain: [],
    lives: 3,
    record: 0,
    awaitingReverse: false
  };

  ctx.reply(
    '🧠 Игра началась!\n\n' +
    'Я беру с собой...\n\n' +
    'Ты пишешь слово — я добавляю своё.\n' +
    'Повтори всю цепочку и добавь новое.\n\n' +
    '❤️ Жизней: 3\n' +
    '❗ Повторы запрещены'
  );
});

// ===== СБРОС =====
bot.command('reset', (ctx) => {
  delete games[ctx.chat.id];
  ctx.reply('🔄 Игра сброшена. Напиши новое слово.');
});

// ===== ОСНОВНАЯ ЛОГИКА =====
bot.on('text', (ctx) => {
  const chatId = ctx.chat.id;
  const text = ctx.message.text;

  if (!games[chatId]) {
    ctx.reply('Напиши /start чтобы начать игру');
    return;
  }

  const game = games[chatId];

  // ===== БОНУС: ОБРАТНЫЙ ПОРЯДОК =====
  if (game.awaitingReverse) {
    const userWords = text.split(/[\s,]+/).map(normalize).filter(Boolean);
    const expected = [...game.chain].reverse();

    game.awaitingReverse = false;

    if (JSON.stringify(userWords) === JSON.stringify(expected)) {
      game.lives += 1;
      ctx.reply(
        '🏆 ИДЕАЛЬНАЯ ПАМЯТЬ!\n' +
        'Ты повторил цепочку в обратном порядке.\n\n' +
        '❤️ +1 жизнь'
      );
    } else {
      ctx.reply(
        '❌ Не получилось, но это был бонус.\n' +
        'Ты всё равно красавчик 😎'
      );
    }
    return;
  }

  const userWordsRaw = text.split(/[\s,]+/).filter(Boolean);
  const userWords = userWordsRaw.map(normalize);

  // ===== ПЕРВЫЙ ХОД =====
  if (game.chain.length === 0) {
    const first = userWords[0];
    game.chain.push(first);

    const botWord = generateBotWord(game.chain);
    game.chain.push(normalize(botWord));

    ctx.reply(botWord);
    return;
  }

  // ===== ПРОВЕРКА ЦЕПОЧКИ =====
  for (let i = 0; i < game.chain.length; i++) {
    if (userWords[i] !== game.chain[i]) {
      game.lives -= 1;

      if (game.lives <= 0) {
        ctx.reply(
          '💀 ИГРА ОКОНЧЕНА\n\n' +
          `Глубина: ${game.chain.length}\n` +
          `Ранг: ${getRank(game.chain.length)}\n` +
          `Рекорд: ${game.record}\n\n` +
          'Напиши /start чтобы начать заново'
        );
        delete games[chatId];
        return;
      }

      ctx.reply(
        `❌ Ошибка\n` +
        `❤️ Осталось жизней: ${game.lives}\n` +
        `Ранг: ${getRank(game.chain.length)}`
      );
      return;
    }
  }

  // ===== ПРОВЕРКА ПОВТОРА =====
  const newWord = userWords[userWords.length - 1];
  if (game.chain.includes(newWord)) {
    ctx.reply('❌ Повторы запрещены. Другое слово 👀');
    return;
  }

  game.chain.push(newWord);

  // ===== ХОД БОТА =====
  const botWord = generateBotWord(game.chain);
  game.chain.push(normalize(botWord));

  game.record = Math.max(game.record, game.chain.length);

  ctx.reply(
    `${botWord}\n\n` +
    `📏 Глубина: ${game.chain.length}\n` +
    `🏷 Ранг: ${getRank(game.chain.length)}`
  );

  // ===== ПРЕДЛОЖЕНИЕ БОНУСА =====
  if (game.chain.length === 10) {
    game.awaitingReverse = true;
    ctx.reply(
      '🌀 БОНУС-ИСПЫТАНИЕ\n' +
      'Хочешь попробовать повторить цепочку В ОБРАТНОМ ПОРЯДКЕ?',
      Markup.keyboard(['Да', 'Нет']).oneTime().resize()
    );
  }
});

// ===== СЛОВА БОТА =====
function generateBotWord(used) {
  const baseWords = [
    'хлеб','вода','нож','рюкзак','фонарь',
    'палатка','аптечка','карта','спички',
    'котелок','еда','куртка','ботинки'
  ];

  const available = baseWords.filter(
    w => !used.includes(normalize(w))
  );

  return available.length
    ? available[Math.floor(Math.random() * available.length)]
    : 'тишина';
}

// ===== ЗАПУСК =====
bot.launch()
  .then(() => console.log('Бот запущен'))
  .catch(console.error);

process.once('SIGINT', () => bot.stop());
process.once('SIGTERM', () => bot.stop());
