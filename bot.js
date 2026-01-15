const { Telegraf, Markup } = require('telegraf');
const natural = require('natural');
const stemmer = natural.PorterStemmerRu;

if (!process.env.BOT_TOKEN) {
  console.error('❌ BOT_TOKEN is missing');
  process.exit(1);
}

const bot = new Telegraf(process.env.BOT_TOKEN);
const games = {};

// =====================
// 🧠 НОРМАЛИЗАЦИЯ
// =====================
function normalize(word) {
  return stemmer.stem(
    word.toLowerCase().replace(/[.,!?]/g, '').trim()
  );
}

// =====================
// 🏷 РАНГИ
// =====================
function getRank(depth) {
  if (depth >= 17) return '👑 Абсолют';
  if (depth >= 12) return '🔴 Легенда';
  if (depth >= 8)  return '🟣 Выживальщик';
  if (depth >= 5)  return '🔵 Путешественник';
  return '🟢 Новичок';
}

// =====================
// 🚀 СТАРТ
// =====================
bot.start((ctx) => {
  ctx.reply(
    '🧠 *Игра «Я беру с собой»*\n\nВыберите режим:\n\n' +
    '1️⃣ Запоминание слов\n2️⃣ Запоминание цифр (1–3 знака)',
    { parse_mode: 'Markdown', ...Markup.keyboard(['Слова','Цифры']).oneTime().resize() }
  );
});

bot.hears(['Слова','Цифры'], (ctx) => {
  const mode = ctx.message.text.toLowerCase();
  startGame(ctx.chat.id, mode);
  ctx.reply(
    `Выбран режим: *${mode}*\n\n` +
    '📌 Начнем игру. Напиши первое слово/число 👇',
    { parse_mode: 'Markdown', ...Markup.removeKeyboard() }
  );
});

function startGame(chatId, mode='слова') {
  games[chatId] = {
    chain: [],
    lives: 3,
    record: 0,
    awaitingReverse: false,
    mode: mode
  };
}

// =====================
// 🔄 СБРОС
// =====================
bot.command('reset', (ctx) => {
  if (!games[ctx.chat.id]) {
    ctx.reply('Напиши /start чтобы начать игру');
    return;
  }
  startGame(ctx.chat.id, games[ctx.chat.id].mode);
  ctx.reply('🔄 Игра сброшена. Напиши новое слово/число.');
});

// =====================
// 🎮 ОСНОВНАЯ ЛОГИКА
// =====================
bot.on('text', async (ctx) => {
  const chatId = ctx.chat.id;
  const messageId = ctx.message.message_id;

  if (!games[chatId]) {
    ctx.reply('Напиши /start чтобы начать игру');
    return;
  }

  const game = games[chatId];

  // ===== УДАЛЯЕМ СООБЩЕНИЕ ИГРОКА =====
  try { await ctx.deleteMessage(messageId); } catch (e) {}

  // ===== БОНУС: ОБРАТНЫЙ ПОРЯДОК =====
  if (game.awaitingReverse) {
    const userWords = ctx.message.text?.split(/[\s,]+/).map(normalize).filter(Boolean) || [];
    const expected = [...game.chain].reverse();
    game.awaitingReverse = false;

    if (JSON.stringify(userWords) === JSON.stringify(expected)) {
      game.lives++;
      ctx.reply('🏆 ИДЕАЛЬНАЯ ПАМЯТЬ!\n❤️ +1 жизнь');
    } else {
      ctx.reply('❌ Не получилось, но это был бонус 😉');
    }
    return;
  }

  const wordsRaw = ctx.message.text?.split(/[\s,]+/).filter(Boolean) || [];
  const words = wordsRaw.map(normalize);

  // ===== ПЕРВЫЙ ХОД =====
  if (game.chain.length === 0) {
    const first = words[0];
    game.chain.push(first);
    const botWord = generateBotWord(game);
    game.chain.push(botWord);
    return;
  }

  // ===== ПРОВЕРКА ДЛИНЫ =====
  if (words.length !== game.chain.length + 1) {
    return; // ничего не показываем — игрок видит пустое поле
  }

  // ===== ПРОВЕРКА ЦЕПОЧКИ =====
  for (let i = 0; i < game.chain.length; i++) {
    if (words[i] !== game.chain[i]) {
      game.lives--;
      if (game.lives <= 0) {
        delete games[chatId];
      }
      return; // ничего не показываем
    }
  }

  const newWord = words[words.length-1];
  if (game.chain.includes(newWord)) return;

  game.chain.push(newWord);
  const botWord = generateBotWord(game);
  game.chain.push(botWord);
  game.record = Math.max(game.record, game.chain.length);
});

// =====================
// 🧳 ГЕНЕРАЦИЯ СЛОВ / ЧИСЕЛ
// =====================
function generateBotWord(game) {
  if (game.mode === 'цифры') {
    // одно-, двух-, трёхзначные числа
    let n;
    if (game.chain.length < 5) n = 1;
    else if (game.chain.length < 10) n = 2;
    else n = 3;
    const num = Math.floor(Math.random() * Math.pow(10,n));
    return String(num);
  } else {
    // слова
    const baseWords = [
      'хлеб','вода','нож','рюкзак','фонарь',
      'аптечка','карта','спички','еда',
      'ботинки','соль','куртка'
    ];
    const available = baseWords.filter(w => !game.chain.includes(normalize(w)));
    return available.length
      ? available[Math.floor(Math.random() * available.length)]
      : 'тишина';
  }
}

bot.launch().then(() => console.log('Бот запущен'));
