const { Telegraf, Markup } = require('telegraf');

if (!process.env.BOT_TOKEN) {
  console.error('❌ BOT_TOKEN is missing');
  process.exit(1);
}

const bot = new Telegraf(process.env.BOT_TOKEN);
const games = {};

// =====================
// 🧠 НОРМАЛИЗАЦИЯ
// =====================
function normalize(value) {
  return value
    .toString()
    .toLowerCase()
    .replace(/[.,!?]/g, '')
    .trim();
}

// =====================
// ⏳ ПАУЗА
// =====================
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// =====================
// 🚀 СТАРТ
// =====================
bot.start((ctx) => {
  ctx.reply(
    '🧠 *Игра «Я беру с собой»*\n\n' +
    'Выбери режим:\n\n' +
    '🔤 Слова\n🔢 Цифры',
    {
      parse_mode: 'Markdown',
      ...Markup.keyboard(['Слова', 'Цифры']).oneTime().resize()
    }
  );
});

bot.hears(['Слова', 'Цифры'], async (ctx) => {
  const mode = ctx.message.text.toLowerCase();

  games[ctx.chat.id] = {
    mode,
    chain: [],
    lastBotMessageId: null
  };

  await ctx.reply(
    `Режим выбран: *${mode}*\n\n` +
    'Приготовься…',
    { parse_mode: 'Markdown', ...Markup.removeKeyboard() }
  );

  await sleep(700);
  await ctx.reply('Напиши первое слово / число 👇');
});

// =====================
// 🎮 ОСНОВНАЯ ЛОГИКА
// =====================
bot.on('text', async (ctx) => {
  const chatId = ctx.chat.id;
  const msgId = ctx.message.message_id;

  if (!games[chatId]) {
    ctx.reply('Напиши /start чтобы начать игру');
    return;
  }

  const game = games[chatId];

  // ❌ удаляем сообщение игрока
  try { await ctx.deleteMessage(msgId); } catch {}

  const input = ctx.message.text
    .split(/[\s,]+/)
    .map(normalize)
    .filter(Boolean);

  // ===== ПЕРВЫЙ ХОД =====
  if (game.chain.length === 0) {
    const first = input[0];
    game.chain.push(first);

    await ctx.sendChatAction('typing');
    await sleep(1000);

    const botValue = generateBotValue(game);
    game.chain.push(botValue);

    const botMsg = await ctx.reply(botValue);
    game.lastBotMessageId = botMsg.message_id;
    return;
  }

  // ===== ПРОВЕРКА =====
  if (input.length !== game.chain.length + 1) return;

  for (let i = 0; i < game.chain.length; i++) {
    if (input[i] !== game.chain[i]) {
      await ctx.reply('❌ Ошибка. Попробуй ещё или /reset');
      return;
    }
  }

  const newValue = input[input.length - 1];
  if (game.chain.includes(newValue)) return;

  // ===== УСПЕХ =====
  game.chain.push(newValue);

  // 🧠 БОТ ДУМАЕТ
  await ctx.sendChatAction('typing');
  await sleep(900 + Math.random() * 600);

  // 🧹 УДАЛЯЕМ ПРЕДЫДУЩЕЕ СЛОВО
  try {
    if (game.lastBotMessageId) {
      await ctx.deleteMessage(game.lastBotMessageId);
    }
  } catch {}

  const botValue = generateBotValue(game);
  game.chain.push(botValue);

  const botMsg = await ctx.reply(botValue);
  game.lastBotMessageId = botMsg.message_id;
});

// =====================
// 🔢 / 🔤 ГЕНЕРАЦИЯ
// =====================
function generateBotValue(game) {
  if (game.mode === 'цифры') {
    const len =
      game.chain.length < 5 ? 1 :
      game.chain.length < 10 ? 2 : 3;

    const max = Math.pow(10, len);
    return String(Math.floor(Math.random() * max));
  }

  const words = [
    'хлеб','вода','нож','рюкзак','фонарь',
    'аптечка','карта','еда','ботинки','соль'
  ];

  const available = words.filter(w => !game.chain.includes(w));
  return available.length
    ? available[Math.floor(Math.random() * available.length)]
    : 'тишина';
}

bot.launch().then(() => console.log('🤖 Бот запущен'));
