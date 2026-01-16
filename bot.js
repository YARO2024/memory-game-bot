const { Telegraf, Markup } = require('telegraf');

const bot = new Telegraf(process.env.BOT_TOKEN);

const games = {};
const duels = {};
const stats = {};

const sleep = ms => new Promise(r => setTimeout(r, ms));
const normalize = t => t.toLowerCase().replace(/[.,!?]/g, '').trim();

// ================= START =================
bot.start(ctx => {
  ctx.reply(
    '🧠 *Тренировка памяти*\n\nВыбери режим:',
    {
      parse_mode: 'Markdown',
      ...Markup.keyboard(['📝 Слова', '🔢 Цифры', '⚔️ Дуэль']).resize()
    }
  );
});

// ================= MODES =================
bot.hears('📝 Слова', ctx => initGame(ctx, 'words'));

bot.hears('🔢 Цифры', ctx => {
  ctx.reply(
    'Выбери сложность чисел:',
    Markup.keyboard(['1️⃣ Одна цифра', '2️⃣ Две цифры', '3️⃣ Три цифры']).resize()
  );
});

bot.hears(['1️⃣ Одна цифра', '2️⃣ Две цифры', '3️⃣ Три цифры'], ctx => {
  const map = {
    '1️⃣ Одна цифра': 'normal',
    '2️⃣ Две цифры': 'double',
    '3️⃣ Три цифры': 'triple'
  };
  initGame(ctx, 'numbers', map[ctx.message.text]);
});

// ================= INIT GAME =================
function initGame(ctx, mode, numberType = null) {
  const id = ctx.chat.id;
  games[id] = {
    mode,
    numberType,
    chain: [],
    botUsed: new Set(),
    lastBotMsg: null
  };
  stats[id] ??= { best: 0, games: 0 };
  ctx.reply('Игра началась. Напиши первое значение 👇', Markup.removeKeyboard());
}

// ================= DUEL =================
bot.hears('⚔️ Дуэль', ctx => {
  const code = Math.random().toString(36).slice(2, 7);
  duels[code] = {
    players: [ctx.chat.id],
    turnIndex: 0,
    chain: [],
    active: true
  };
  ctx.reply(`⚔️ Дуэль создан!\nПередай другу:\n/join_${code}`);
});

bot.hears(/\/join_(\w+)/, ctx => {
  const duel = duels[ctx.match[1]];
  if (!duel || duel.players.length === 2)
    return ctx.reply('Дуэль недоступна');

  duel.players.push(ctx.chat.id);

  duel.players.forEach(id =>
    bot.telegram.sendMessage(
      id,
      `⚔️ Дуэль началась!\nХод игрока: ${duel.players[0]}`
    )
  );
});

// ================= STATS =================
bot.command('stats', ctx => {
  const s = stats[ctx.chat.id];
  if (!s) return ctx.reply('Нет статистики');
  ctx.reply(`📊 Лучший результат: ${s.best}\n🎮 Игр: ${s.games}`);
});

// ================= MAIN HANDLER =================
bot.on('text', async ctx => {
  const id = ctx.chat.id;

  // DUEL MODE
  for (const duel of Object.values(duels)) {
    if (!duel.active || !duel.players.includes(id)) continue;

    if (duel.players[duel.turnIndex] !== id) {
      try { await ctx.deleteMessage(); } catch {}
      return;
    }

    try { await ctx.deleteMessage(); } catch {}

    const value = normalize(ctx.message.text);

    if (duel.chain.length > 0 &&
        duel.chain.slice(0, -1).includes(value)) {
      duel.active = false;
      return bot.telegram.sendMessage(id, '❌ Повтор — ты проиграл');
    }

    duel.chain.push(value);
    duel.turnIndex = (duel.turnIndex + 1) % 2;

    duel.players.forEach(pid =>
      bot.telegram.sendMessage(
        pid,
        `Цепочка: ${duel.chain.join(' ')}\nХод: ${duel.players[duel.turnIndex]}`
      )
    );
    return;
  }

  // SOLO MODE
  const game = games[id];
  if (!game) return;

  try { await ctx.deleteMessage(); } catch {}

  const input = ctx.message.text.split(/\s+/).map(normalize);

  if (game.chain.length > 0) {
    if (input.length !== game.chain.length + 1) return fail(ctx, id);

    for (let i = 0; i < game.chain.length; i++) {
      if (input[i] !== game.chain[i]) return fail(ctx, id);
    }
  }

  game.chain.push(input.at(-1));
  await botTurn(ctx, game);
});

// ================= BOT TURN =================
async function botTurn(ctx, game) {
  await ctx.sendChatAction('typing');
  await sleep(900);

  if (game.lastBotMsg) {
    try { await ctx.deleteMessage(game.lastBotMsg); } catch {}
  }

  const value = generateValue(game);
  game.chain.push(value);
  game.botUsed.add(value);

  const msg = await ctx.reply(value);
  game.lastBotMsg = msg.message_id;

  stats[ctx.chat.id].best = Math.max(
    stats[ctx.chat.id].best,
    game.chain.length
  );
}

// ================= GENERATOR =================
function generateValue(game) {
  let v;
  do {
    if (game.mode === 'words') {
      const words = ['рюкзак','нож','еда','карта','аптечка','вода','огниво'];
      v = words[Math.floor(Math.random() * words.length)];
    } else {
      if (game.numberType === 'normal')
        v = String(Math.floor(Math.random() * 10));
      if (game.numberType === 'double')
        v = String(Math.floor(10 + Math.random() * 90));
      if (game.numberType === 'triple')
        v = String(Math.floor(100 + Math.random() * 900));
    }
  } while (game.botUsed.has(v));
  return v;
}

// ================= FAIL =================
function fail(ctx, id) {
  stats[id].games++;
  ctx.reply('❌ Ошибка. Напиши /start чтобы начать заново');
  delete games[id];
}

bot.launch();
