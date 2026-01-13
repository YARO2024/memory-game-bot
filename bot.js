const { Telegraf } = require('telegraf');
const natural = require('natural'); // стеммер для русского
const stemmer = natural.PorterStemmerRu;

// 🔑 Проверка токена
if (!process.env.BOT_TOKEN) {
  console.error('❌ BOT_TOKEN is missing');
  process.exit(1);
}

console.log("BOT_TOKEN:", process.env.BOT_TOKEN);

const bot = new Telegraf(process.env.BOT_TOKEN);

// =====================
// 🧠 ИГРА "Я БЕРУ С СОБОЮ"
const games = {};

// нормализация слова: lowercase + стемминг + удаление знаков
function normalize(word) {
  return stemmer.stem(word.toLowerCase().replace(/[.,!?]/g, '').trim());
}

// старт игры
bot.start((ctx) => {
  const chatId = ctx.chat.id;
  games[chatId] = { chain: [], record: 0 };

  ctx.reply(
    '🧠 Игра началась!\nНапиши ЛЮБОЕ слово.\n' +
    'Я добавлю своё.\nТы должен повторить всю цепочку и добавить новое.\n❗ Повторы запрещены.'
  );
});

// сброс игры
bot.command('reset', (ctx) => {
  const chatId = ctx.chat.id;
  delete games[chatId];
  ctx.reply('🔄 Игра сброшена. Напиши новое слово.');
});

// обработка текста
bot.on('text', (ctx) => {
  const chatId = ctx.chat.id;
  const text = ctx.message.text;

  if (!games[chatId]) games[chatId] = { chain: [], record: 0 };
  const game = games[chatId];

  // разбиваем ввод через пробел или запятую
  const userWordsRaw = text.split(/[\s,]+/).filter(Boolean);
  const userWordsNorm = userWordsRaw.map(normalize);

  // первый ход
  if (game.chain.length === 0) {
    const firstWordNorm = userWordsNorm[0];
    game.chain.push(firstWordNorm);

    const botWord = generateBotWord(game.chain);
    game.chain.push(normalize(botWord));

    ctx.reply(botWord); // только слово бота
    return;
  }

  // проверка цепочки по нормализованным словам
  for (let i = 0; i < game.chain.length; i++) {
    if (userWordsNorm[i] !== game.chain[i]) {
      ctx.reply(
        `❌ Неверно.\nТекущая глубина: ${game.chain.length}\nРекорд: ${game.record}\n\nПопробуй ещё или /reset`
      );
      return;
    }
  }

  // проверка повторов
  const newWordRaw = userWordsRaw[userWordsRaw.length - 1];
  const newWordNorm = normalize(newWordRaw);

  if (game.chain.includes(newWordNorm)) {
    ctx.reply('❌ Повторы запрещены. Попробуй другое слово.');
    return;
  }

  game.chain.push(newWordNorm);

  // бот добавляет слово
  const botWord = generateBotWord(game.chain);
  game.chain.push(normalize(botWord));

  game.record = Math.max(game.record, game.chain.length);

  ctx.reply(botWord);
});

// генерация слова бота
function generateBotWord(usedWords) {
  const baseWords = [
    'хлеб','чай','компас','верёвка','фонарь',
    'палатка','рюкзак','спички','карта','нож',
    'вода','котелок','куртка','ботинки','еда',
    'ложка','кружка','соль','сахар','аптечка'
  ];

  const available = baseWords.filter(w => !usedWords.includes(normalize(w)));
  return available.length === 0 ? 'тишина' : available[Math.floor(Math.random() * available.length)];
}

// запуск бота
bot.launch()
  .then(() => console.log('Бот запущен'))
  .catch(err => console.error('Ошибка запуска бота:', err));

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
