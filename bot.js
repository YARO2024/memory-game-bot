const { Telegraf, Markup } = require('telegraf');

const bot = new Telegraf(process.env.BOT_TOKEN);

// =====================
// ХРАНИЛИЩА
// =====================
const games = {};
const duels = {};
const stats = {};

// =====================
// УТИЛИТЫ
// =====================
const sleep = ms => new Promise(r => setTimeout(r, ms));
const normWord = w =>
  w.toLowerCase().replace(/[.,!?]/g, '').trim();

const genNumber = type => {
  if (type === 1) return String(Math.floor(Math.random() * 10));
  if (type === 2) return String(10 + Math.floor(Math.random() * 90));
  return String(100 + Math.floor(Math.random() * 900));
};

const ranks = [
  { d: 5, name: '🟢 Новичок' },
  { d: 10, name: '🔵 Уверенный' },
  { d: 20, name: '🟣 Мастер памяти' },
  { d: 30, name: '🔴 Легенда' }
];

const getRank = d =>
  [...ranks].reverse().find(r => d >= r.d)?.name || '⚪ Начинающий';

// =====================
// START
// =====================
bot.start(ctx => {
  delete games[ctx.chat.id];

  ctx.reply(
    '🧠 Игра «Я беру с собой»\n\n' +
    'Выбери режим:\n' +
    '📝 Слова\n' +
    '🔢 Цифры\n\n' +
    '⚔️ Дуэль: /duel',
    Markup.keyboard(['📝 Слова', '🔢 Цифры']).resize()
  );
});

// =====================
// SOLO MODES
// =====================
bot.hears('📝 Слова', ctx => initSolo(ctx, 'words'));

bot.hears('🔢 Цифры', ctx => {
  ctx.reply(
    'Выбери сложность:',
    Markup.keyboard(['1️⃣ 1 знак', '2️⃣ 2 знака', '3️⃣ 3 знака']).resize()
  );
});

bot.hears(['1️⃣ 1 знак', '2️⃣ 2 знака', '3️⃣ 3 знака'], ctx => {
  const map = { '1️⃣ 1 знак': 1, '2️⃣ 2 знака': 2, '3️⃣ 3 знака': 3 };
  initSolo(ctx, 'numbers', map[ctx.message.text]);
});

function initSolo(ctx, mode, numType = null) {
  games[ctx.chat.id] = {
    mode,
    numType,
    chain: [],
    used: new Set(),
    lives: 3,
    lastBotMsg: null,
    bonusUnlocked: false
  };

  ctx.reply(
    '🔥 Игра началась!\n' +
    '— Повтори цепочку\n' +
    '— Добавь ОДНО своё\n' +
    '— Сообщения стираются\n\n' +
    'Напиши первое 👇',
    Markup.removeKeyboard()
  );
}

// =====================
// DUEL
// =====================
bot.command('duel', ctx => {
  delete games[ctx.chat.id];

  const code = Math.random().toString(36).slice(2, 7);
  duels[code] = {
    players: [ctx.chat.id],
    chain: [],
    turn: 0,
    mode: null,
    numType: null,
    stage: 'wait_join'
  };

  ctx.reply(`⚔️ Дуэль создан!\nПередай другу:\n/join_${code}`);
});

bot.hears(/\/join_(\w+)/, ctx => {
  const duel = duels[ctx.match[1]];
  if (!duel || duel.players.length === 2)
    return ctx.reply('Дуэль недоступна');

  duel.players.push(ctx.chat.id);
  duel.stage = 'choose_mode';

  duel.players.forEach(id =>
    bot.telegram.sendMessage(
      id,
      '⚔️ Дуэль началась!\nВыберите режим:',
      Markup.keyboard(['📝 Слова', '🔢 Цифры']).resize()
    )
  );
});

// =====================
// TEXT HANDLER
// =====================
bot.on('text', async ctx => {
  const text = ctx.message.text;
  const id = ctx.chat.id;

  if (text.startsWith('/')) return;

  // ----- DUEL -----
  const duel = Object.values(duels).find(d => d.players.includes(id));
  if (duel && duel.stage === 'playing') {
    if (duel.players[duel.turn] !== id) {
      try { await ctx.deleteMessage(); } catch {}
      return;
    }

    try { await ctx.deleteMessage(); } catch {}

    const value =
      duel.mode === 'words'
        ? normWord(text)
        : text.trim();

    if (duel.chain.includes(value)) {
      duel.players.forEach(pid =>
        bot.telegram.sendMessage(pid, '❌ Повтор — ты проиграл')
      );
      return endDuel(duel);
    }

    duel.chain.push(value);
    duel.turn = (duel.turn + 1) % 2;

    duel.players.forEach(pid =>
      bot.telegram.sendMessage(
        pid,
        `Цепочка: ${duel.chain.join(' ')}\nХод игрока ${duel.turn + 1}`
      )
    );
    return;
  }

  // ----- SOLO -----
  const game = games[id];
  if (!game) return;

  try { await ctx.deleteMessage(); } catch {}

  const parts =
    game.mode === 'words'
      ? text.split(/[ ,]+/).map(normWord)
      : text.split(/[ ,]+/);

  const expected = game.chain.join(' ');
  const received = parts.slice(0, -1).join(' ');

  if (game.chain.length && received !== expected) {
    game.lives--;
    if (game.lives <= 0) {
      ctx.reply(`💀 Игра окончена\nРанг: ${getRank(game.chain.length)}`);
      delete games[id];
    } else {
      ctx.reply(`❌ Ошибка. ❤️ Осталось: ${game.lives}`);
    }
    return;
  }

  const newItem = parts.at(-1);
  if (game.used.has(newItem)) {
    ctx.reply('❌ Повтор запрещён');
    return;
  }

  game.chain.push(newItem);
  game.used.add(newItem);

  await botTurn(ctx, game);
});

// =====================
// BOT TURN
// =====================
async function botTurn(ctx, game) {
  await ctx.sendChatAction('typing');
  await sleep(900);

  if (game.lastBotMsg) {
    try { await ctx.deleteMessage(game.lastBotMsg); } catch {}
  }

  let value;
  do {
    value =
      game.mode === 'words'
        ? ['нож','рюкзак','аптечка','огниво','еда','вода','карта']
            [Math.floor(Math.random()*7)]
        : genNumber(game.numType);
  } while (game.used.has(value));

  game.chain.push(value);
  game.used.add(value);

  const msg = await ctx.reply(value);
  game.lastBotMsg = msg.message_id;

  if (game.chain.length >= 10 && !game.bonusUnlocked) {
    game.bonusUnlocked = true;
    ctx.reply('🌀 БОНУС: попробуй повторить в ОБРАТНОМ порядке!');
  }
}

// =====================
// END DUEL
// =====================
function endDuel(duel) {
  for (const k in duels) if (duels[k] === duel) delete duels[k];
}

// =====================
bot.launch();
