const { Telegraf, Markup } = require('telegraf');

if (!process.env.BOT_TOKEN) {
  console.error('❌ BOT_TOKEN is missing');
  process.exit(1);
}

const bot = new Telegraf(process.env.BOT_TOKEN);

const games = {};
const duels = {};
const stats = {};

// =====================
// 🧠 УТИЛИТЫ
// =====================
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

function normalize(v) {
  return v.toString().toLowerCase().replace(/[.,!?]/g, '').trim();
}

function todaySeed() {
  const d = new Date();
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

// =====================
// 🚀 START
// =====================
bot.start(ctx => {
  ctx.reply(
    '🧠 *Тренировка памяти*\n\n' +
    'Выбери режим:',
    {
      parse_mode: 'Markdown',
      ...Markup.keyboard(['Слова', 'Цифры']).resize().oneTime()
    }
  );
});

// =====================
// 🎮 РЕЖИМЫ
// =====================
bot.hears('Слова', ctx => initGame(ctx, 'words'));
bot.hears('Цифры', ctx => {
  ctx.reply(
    'Тип чисел:',
    Markup.keyboard(['Обычные', 'Двойные', 'Тройные']).resize().oneTime()
  );
});

bot.hears(['Обычные', 'Двойные', 'Тройные'], ctx => {
  const map = {
    'Обычные': 'normal',
    'Двойные': 'double',
    'Тройные': 'triple'
  };
  initGame(ctx, 'numbers', map[ctx.message.text]);
});

function initGame(ctx, mode, numberType = null) {
  const id = ctx.chat.id;

  games[id] = {
    mode,
    numberType,
    chain: [],
    botValues: new Set(),
    lastBotMessageId: null
  };

  stats[id] ??= { best: 0, games: 0 };

  ctx.reply('Игра началась. Напиши первое значение 👇', Markup.removeKeyboard());
}

// =====================
// 📊 STATS
// =====================
bot.command('stats', ctx => {
  const s = stats[ctx.chat.id];
  if (!s) return ctx.reply('Пока нет статистики');
  ctx.reply(
    `📊 *Статистика*\n\n` +
    `🎮 Игр: ${s.games}\n` +
    `🏆 Лучший результат: ${s.best}`,
    { parse_mode: 'Markdown' }
  );
});

// =====================
// ⚔️ DUEL
// =====================
bot.command('duel', ctx => {
  const code = Math.random().toString(36).slice(2, 7);
  duels[code] = { players: [ctx.chat.id], chain: [] };
  ctx.reply(`⚔️ Дуэль создан!\nПередай другу:\n/join_${code}`);
});

bot.hears(/\/join_(.+)/, ctx => {
  const code = ctx.match[1];
  const duel = duels[code];
  if (!duel) return ctx.reply('Дуэль не найдена');
  duel.players.push(ctx.chat.id);
  ctx.reply('⚔️ Дуэль началась!');
});

// =====================
// 📅 DAILY
// =====================
bot.command('daily', ctx => {
  ctx.reply(
    `📅 *Челлендж дня*\n\n` +
    `Режим: цифры (двойные)\n` +
    `Цель: 10 без ошибок\n\n` +
    `Seed: ${todaySeed()}`,
    { parse_mode: 'Markdown' }
  );
});

// =====================
// 🎮 GAME LOOP
// =====================
bot.on('text', async ctx => {
  const id = ctx.chat.id;
  const game = games[id];
  if (!game) return;

  try { await ctx.deleteMessage(); } catch {}

  const input = ctx.message.text.split(/[\s,]+/).map(normalize);

  if (game.chain.length === 0) {
    game.chain.push(input[0]);
    await botTurn(ctx, game);
    return;
  }

  if (input.length !== game.chain.length + 1) return;

  for (let i = 0; i < game.chain.length; i++) {
    if (input[i] !== game.chain[i]) {
      stats[id].games++;
      return ctx.reply('❌ Ошибка. /start — заново');
    }
  }

  game.chain.push(input.at(-1));
  stats[id].best = Math.max(stats[id].best, game.chain.length);
  await botTurn(ctx, game);
});

// =====================
// 🤖 BOT TURN
// =====================
async function botTurn(ctx, game) {
  await ctx.sendChatAction('typing');
  await sleep(900);

  if (game.lastBotMessageId) {
    try { await ctx.deleteMessage(game.lastBotMessageId); } catch {}
  }

  const value = generateUniqueValue(game);
  game.chain.push(value);
  game.botValues.add(value);

  const msg = await ctx.reply(value);
  game.lastBotMessageId = msg.message_id;
}

// =====================
// 🔢 / 🔤 GENERATOR
// =====================
function generateUniqueValue(game) {
  let value;
  do {
    if (game.mode === 'numbers') {
      const n = Math.floor(Math.random() * 9) + 1;
      if (game.numberType === 'double') value = `${n}${n}`;
      else if (game.numberType === 'triple') value = `${n}${n}${n}`;
      else value = String(n);
    } else {
      const words = ['хлеб','вода','нож','рюкзак','аптечка','еда','карта','соль'];
      value = words[Math.floor(Math.random() * words.length)];
    }
  } while (game.botValues.has(value));

  return value;
}

bot.launch();
