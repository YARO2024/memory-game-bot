const { Telegraf, Markup } = require('telegraf');

if (!process.env.BOT_TOKEN) {
  console.error('❌ BOT_TOKEN is missing');
  process.exit(1);
}

const bot = new Telegraf(process.env.BOT_TOKEN);
const games = {};
const stats = {};

// =====================
// 🧠 УТИЛИТЫ
// =====================
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

function normalize(v) {
  return v.toString().toLowerCase().replace(/[.,!?]/g, '').trim();
}

// =====================
// 🚀 СТАРТ
// =====================
bot.start((ctx) => {
  ctx.reply(
    '🧠 *Тренировка памяти*\n\nВыбери режим:',
    {
      parse_mode: 'Markdown',
      ...Markup.keyboard(['Слова', 'Цифры']).oneTime().resize()
    }
  );
});

bot.hears('Слова', (ctx) => initGame(ctx, 'words'));
bot.hears('Цифры', (ctx) => {
  ctx.reply(
    'Выбери тип чисел:',
    Markup.keyboard(['Обычные', 'Двойные', 'Тройные']).oneTime().resize()
  );
});

bot.hears(['Обычные', 'Двойные', 'Тройные'], (ctx) => {
  initGame(ctx, 'numbers', ctx.message.text.toLowerCase());
});

function initGame(ctx, mode, numberType = null) {
  const id = ctx.chat.id;

  games[id] = {
    mode,
    numberType,
    chain: [],
    lastBotMessageId: null,
    streak: 0
  };

  stats[id] ??= {
    games: 0,
    best: 0,
    streak: 0
  };

  ctx.reply(
    'Игра началась. Напиши первое значение 👇',
    Markup.removeKeyboard()
  );
}

// =====================
// 📊 СТАТИСТИКА
// =====================
bot.command('stats', (ctx) => {
  const s = stats[ctx.chat.id];
  if (!s) {
    ctx.reply('Ты ещё не играл 🙂');
    return;
  }

  ctx.reply(
    `📊 *Твоя статистика*\n\n` +
    `🎮 Игр: ${s.games}\n` +
    `🏆 Лучший результат: ${s.best}\n` +
    `🔥 Серия без ошибок: ${s.streak}`,
    { parse_mode: 'Markdown' }
  );
});

// =====================
// 🎮 ИГРА
// =====================
bot.on('text', async (ctx) => {
  const id = ctx.chat.id;
  const game = games[id];
  if (!game) return;

  try { await ctx.deleteMessage(); } catch {}

  const input = ctx.message.text.split(/[\s,]+/).map(normalize);

  // первый ход
  if (game.chain.length === 0) {
    game.chain.push(input[0]);
    await sendBotValue(ctx, game);
    return;
  }

  // проверка
  if (input.length !== game.chain.length + 1) return;

  for (let i = 0; i < game.chain.length; i++) {
    if (input[i] !== game.chain[i]) {
      stats[id].games++;
      stats[id].streak = 0;
      ctx.reply('❌ Ошибка. /start — начать заново');
      return;
    }
  }

  const newVal = input.at(-1);

  // ❗ запрет повторов ТОЛЬКО для слов
  if (game.mode === 'words' && game.chain.includes(newVal)) return;

  game.chain.push(newVal);
  game.streak++;
  stats[id].streak = Math.max(stats[id].streak, game.streak);
  stats[id].best = Math.max(stats[id].best, game.chain.length);

  // 🧠 состояние потока
  if (game.streak === 5) {
    ctx.reply('🧠 Ты вошёл в состояние потока…');
  }

  await sendBotValue(ctx, game);
});

// =====================
// 🤖 ОТВЕТ БОТА
// =====================
async function sendBotValue(ctx, game) {
  await ctx.sendChatAction('typing');
  await sleep(800 + Math.random() * 700);

  if (game.lastBotMessageId) {
    try { await ctx.deleteMessage(game.lastBotMessageId); } catch {}
  }

  const value = generateValue(game);
  game.chain.push(value);

  const msg = await ctx.reply(value);
  game.lastBotMessageId = msg.message_id;
}

// =====================
// 🔢 / 🔤 ГЕНЕРАЦИЯ
// =====================
function generateValue(game) {
  if (game.mode === 'numbers') {
    if (game.numberType === 'двойные') {
      const n = Math.floor(Math.random() * 9) + 1;
      return `${n}${n}`;
    }
    if (game.numberType === 'тройные') {
      const n = Math.floor(Math.random() * 9) + 1;
      return `${n}${n}${n}`;
    }
    return String(Math.floor(Math.random() * 10));
  }

  const words = ['хлеб','вода','нож','рюкзак','аптечка','еда','соль','карта'];
  return words[Math.floor(Math.random() * words.length)];
}

bot.launch();
