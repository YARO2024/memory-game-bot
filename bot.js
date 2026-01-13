const { Telegraf, Markup } = require('telegraf');

// 🔹 Базовые слова (можно добавить ещё больше)
const baseWords = [
    'хлеб', 'сыр', 'сок', 'молоко', 'торт', 'яблоко',
    'чай', 'кофе', 'вода', 'печенье', 'шоколад',
    'мёд', 'компот', 'морс', 'каша', 'суп', 'мойва',
    'зерно', 'банан', 'апельсин', 'булка', 'рыба',
    'машина', 'дом', 'окно', 'дерево', 'стол', 'стул',
    'книга', 'ручка', 'лист', 'дверь', 'солнце', 'луна'
];

// 🔹 Токен
const bot = new Telegraf(process.env.BOT_TOKEN);

// 🔹 Цепочка
let chain = [];

// 🔹 Простая нормализация слова
function normalizeWord(word) {
    word = word.toLowerCase().trim();
    return word.replace(/[ауыеи]$/,'');
}

// 🔹 Выбираем уникальное слово для бота
function pickBotWord() {
    const used = chain.map(w => normalizeWord(w));
    const available = baseWords.filter(w => !used.includes(normalizeWord(w)));
    if (available.length === 0) return null; // слова закончились
    return available[Math.floor(Math.random() * available.length)];
}

// 🔹 /start
bot.start((ctx) => {
    chain = [];
    ctx.reply('🧠 Игра памяти началась!\nНапиши любое слово.');
});

// 🔹 Основная логика
bot.on('text', async (ctx) => {
    // Разбиваем по пробелу или запятой
    const inputWords = ctx.message.text
        .split(/[\s,]+/)
        .map(w => w.trim())
        .filter(Boolean);

    if (inputWords.length === 0) return;

    // Нормализуем
    const normalizedInput = inputWords.map(w => normalizeWord(w));

    // 🟢 Первый ход
    if (chain.length === 0) {
        chain.push(inputWords[0]);

        const botWord = pickBotWord();
        if (!botWord) {
            await ctx.reply('🏆 Поздравляю! Все слова использованы!');
            chain = [];
            return;
        }
        chain.push(botWord);

        await ctx.reply(botWord);
        await ctx.deleteMessage(ctx.message.message_id).catch(()=>{});
        return;
    }

    // 🟡 Проверка цепочки
    let correct = true;
    if (normalizedInput.length !== chain.length + 1) {
        correct = false;
    } else {
        for (let i = 0; i < chain.length; i++) {
            if (normalizedInput[i] !== normalizeWord(chain[i])) {
                correct = false;
                break;
            }
        }
    }

    // 🔴 Проверка повторов последнего слова пользователя
    const lastUserWord = normalizedInput[normalizedInput.length - 1];
    const normalizedChain = chain.map(w => normalizeWord(w));
    if (normalizedChain.includes(lastUserWord)) {
        await ctx.reply('❌ Это слово уже было! Исправь или начни заново.', Markup.inlineKeyboard([
            Markup.button.callback('🔄 Заново', 'reset_game')
        ]));
        return;
    }

    // 🔴 Если неверно
    if (!correct) {
        await ctx.reply('❌ Неверно. Исправь или начни заново.', Markup.inlineKeyboard([
            Markup.button.callback('🔄 Заново', 'reset_game')
        ]));
        return;
    }

    // 🟢 Верно
    chain.push(inputWords[inputWords.length - 1]);

    const botWord = pickBotWord();
    if (!botWord) {
        await ctx.reply('🏆 Поздравляю! Все слова использованы!');
        chain = [];
        return;
    }

    chain.push(botWord);
    await ctx.reply(`✅ Правильно!\n${botWord}`);
    await ctx.deleteMessage(ctx.message.message_id).catch(()=>{});
});

// 🔹 Кнопка "Заново"
bot.action('reset_game', async (ctx) => {
    chain = [];
    await ctx.editMessageText('🔄 Игра сброшена. Напиши новое слово.');
    await ctx.answerCbQuery();
});

// 🔹 Запуск
bot.launch();
console.log('Бот запущен');
