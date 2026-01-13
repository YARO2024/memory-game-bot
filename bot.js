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
  startGame(ctx.chat.id);
  ctx.reply(getIntroText(), { parse_mode: 'Markdown' });
});

function startGame(chatId) {
  games[chatId] = {
    chain: [],
    lives: 3,
    record: 0,
    awaitingReverse: false
  };
}

function getIntroText() {
  return (
    '🧠 *Игра «Я беру с собой»*\n\n' +
    'Ты проверяешь не скорость, а *чистую память*.\n\n' +
    '📌 Как это работает:\n' +
    '— ты повторяешь ВСЮ цепочку бота\n' +
    '— добавляешь ОДНО новое слово\n' +
    '— бот отвечает только своим словом\n\n' +
    '🔥 Фишки игры:\n' +
    '❤️ 3 жизни (ошибся — теряешь)\n' +
    '🏷 Ранги за глубину цепочки\n' +
    '🌀 Бонус-испытание на память\n' +
    '🧠 Можно писать как угодно:\n' +
    '_регистр, запятые, падежи — неважно_\n\n' +
    'Поехали. Напиши первое слово 👇'
  );
}

// =====================
// 🔄 СБРОС
// =====================
bot.command('reset', (ctx) => {
  startGame(ctx.chat.id);
  ctx.reply('🔄 Игра сброшена. Напиши новое слово.');
});

// =====================
// 🎮 ОСНОВНАЯ ЛОГИКА
// =====================
bot.on('text', (ctx) => {
  const chatId = ctx.chat.id;
  const text = ctx.message.text;

  // 🔥 АВТОСТАРТ, ЕСЛИ ИГРЫ НЕТ
  if (!games[chatId]) {
    startGame(chatId);
  }

  const game = games[chatId];

  // ===== БОНУС: ОБРАТНЫЙ ПОРЯДОК =====
  if (game.awaitingReverse) {
    const userWords = text.split(/[\s,]+/).map(normalize).filter(Boolean);
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

  const words = text.split(/[\s,]+/).map(normalize).filter(Boolean);

  // ===== ПЕРВЫЙ ХОД =====
  if (game.chain.length === 0) {
    game.chain.push(words[0]);
    const botWord = generateBotWord(game.chain);
    game.chain.push(normalize(botWord));
    ctx.reply(botWord);
    return;
  }

  // ===== СТРОГАЯ ПРОВЕРКА ДЛИНЫ =====
  if (words.length !== game.chain.length + 1) {
    ctx.reply(`❌ Нужно повторить ${game.chain.length} слов и добавить ОДНО новое`);
    return;
  }

  // ===== ПРОВЕРКА ЦЕПОЧКИ =====
  for (let i = 0; i < game.chain.length; i++) {
    if (words[i] !== game.chain[i]) {
      game.lives--;
      if (game.lives <= 0) {
        ctx.reply(
          `💀 Игра окончена\n🏷 Ранг: ${getRank(game.chain.length)}\nНапиши /start`
        );
        delete games[chatId];
        return;
      }
      ctx.reply(`❌ Ошибка\n❤️ Осталось жизней: ${game.lives}`);
      return;
    }
  }

  const newWord = words[words.length - 1];
  if (game.chain.includes(newWord)) {
    ctx.reply('❌ Это слово уже было');
    return;
  }

  game.chain.push(newWord);
  const botWord = generateBotWord(game.chain);
  game.chain.push(normalize(botWord));

  ctx.reply(
    `${botWord}\n📏 Глубина: ${game.chain.length}\n🏷 Ранг: ${getRank(game.chain.length)}`
  );

  if (game.chain.length === 10) {
    game.awaitingReverse = true;
    ctx.reply(
      '🌀 Хочешь бонус?\nПовтори цепочку В ОБРАТНОМ ПОРЯДКЕ',
      Markup.keyboard(['Да', 'Нет']).oneTime().resize()
    );
  }
});

// =====================
function generateBotWord(used) {
  const baseWords = [
    'хлеб','вода','нож','рюкзак','фонарь',
    'аптечка','карта','спички','еда',
    'ботинки','соль','куртка'
  ];
  const available = baseWords.filter(w => !used.includes(normalize(w)));
  return available.length
    ? available[Math.floor(Math.random() * available.length)]
    : 'тишина';
}

bot.launch().then(() => console.log('Бот запущен'));
