const TelegramBot = require('node-telegram-bot-api');
const { Connection, PublicKey } = require('@solana/web3.js');
const axios = require('axios');
const express = require('express');

// --- ⚙️ تنظیمات ---
const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN || "8596274256:AAHvtmJHhBG7evC3Errp20ZcxUxP-tfQ-g0";
const MY_CHAT_ID = process.env.ADMIN_CHAT_ID || "61848555";
const RPC_ENDPOINT = "https://mainnet.helius-rpc.com/?api-key=1779c0aa-451c-4dc3-89e2-96e62ca68484";

// حداقل خرید برای آلارم (به سولانا)
const MIN_BUY_SOL = 5.0; 

// لیست خدایان
const TRACKED_WALLETS = [
    { name: "👑 MEV King", addr: "675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8" },
    { name: "🏦 Wintermute", addr: "5Q544fKrFoe6tsEbD7S8EmxGTJYAKtTVhAW5Q5pge4j1" },
    { name: "🎯 Sniper 1", addr: "HUpPyLU8KWisCAr3mzWy2FKT6uuxQ2qGgJQxyTpDoes5" },
    { name: "🐋 Super Whale", addr: "BieeZkdnBAgNYknzo3RH2vku7FcPkFZMZmRJANh2TpW" },
    { name: "🤖 Algo Bot", addr: "9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin" },
    { name: "🐸 Meme Expert", addr: "5fWkLJfoDsRAaXhPJcJY19qNtDDQ5h6q1SPzsAPRrUNG" },
    { name: "🔫 Fast Trigger", addr: "3xqUaVuAWsppb8yaSPJ2hvdvfjteMq2EbdCc3CLguaTE" }
];

const bot = new TelegramBot(TELEGRAM_TOKEN, { polling: true });
const connection = new Connection(RPC_ENDPOINT, 'confirmed');
const app = express();

app.get('/', (req, res) => res.send('🐺 KRONOS WOLFPACK IS HUNTING...'));
app.listen(process.env.PORT || 3000);

console.log("🐺 KRONOS INTELLIGENCE STARTED...");
bot.sendMessage(MY_CHAT_ID, `🐺 **KRONOS WOLFPACK ACTIVE**\nMin Buy: ${MIN_BUY_SOL} SOL\nMode: Cluster Detection`);

// حافظه موقت برای تشخیص حمله گروهی
// { "TokenAddress": { count: 1, time: 12345678 } }
let tokenHeatmap = {};

async function startSpying() {
    TRACKED_WALLETS.forEach(target => {
        try {
            const publicKey = new PublicKey(target.addr);
            connection.onLogs(
                publicKey,
                async ({ logs, err, signature }) => {
                    if (err) return;
                    // فقط تراکنش‌های موفق و مربوط به سواپ
                    const isSwap = logs.some(log => log.includes("Instruction: Swap") || log.includes("Raydium"));
                    if (isSwap) {
                        analyzeTransaction(signature, target);
                    }
                },
                "confirmed"
            );
        } catch (e) { console.log("Error tracking:", target.name); }
    });
}

async function analyzeTransaction(signature, target) {
    try {
        const tx = await connection.getParsedTransaction(signature, { maxSupportedTransactionVersion: 0 });
        if (!tx) return;

        // محاسبه تغییرات موجودی (Balance Changes)
        // این بخش پیچیدست: باید ببینیم SOL کم شده و توکن زیاد شده؟
        
        const preBalances = tx.meta.preTokenBalances;
        const postBalances = tx.meta.postTokenBalances;
        const preSol = tx.meta.preBalances;
        const postSol = tx.meta.postBalances;

        // پیدا کردن اکانت نهنگ در لیست اکانت‌ها
        const accountIndex = tx.transaction.message.accountKeys.findIndex(k => k.pubkey.toString() === target.addr);
        
        if (accountIndex === -1) return;

        // محاسبه مقدار سولانا خرج شده
        const solSpent = (preSol[accountIndex] - postSol[accountIndex]) / 1000000000;

        // اگر سولانا کم شده (یعنی خرج کرده) و مقدارش بیشتر از حده
        if (solSpent > 0.1) { // اینجا فعلا 0.1 میذاریم چون محاسبه دقیق گس فی سخته
            
            // پیدا کردن توکنی که خریده
            let boughtToken = null;
            
            if (postBalances && preBalances) {
                postBalances.forEach(post => {
                    if (post.owner === target.addr) {
                        const pre = preBalances.find(p => p.accountIndex === post.accountIndex);
                        const preAmount = pre ? pre.uiTokenAmount.uiAmount : 0;
                        const postAmount = post.uiTokenAmount.uiAmount;

                        if (postAmount > preAmount) {
                            boughtToken = post.mint;
                        }
                    }
                });
            }

            // اگر توکن پیدا شد و SOL/USDC نبود
            if (boughtToken && !boughtToken.startsWith("So11")) {
                handleDetection(target, boughtToken, solSpent, signature);
            }
        }
    } catch (e) { /* Ignore parsing errors */ }
}

function handleDetection(target, token, amountSol, signature) {
    const now = Date.now();
    
    // --- 🐺 منطق حمله گروهی (WOLFPACK) ---
    if (!tokenHeatmap[token]) {
        tokenHeatmap[token] = { count: 0, lastTime: now, buyers: [] };
    }

    // اگر از آخرین خرید خیلی گذشته (مثلا ۱ ساعت)، ریست کن
    if (now - tokenHeatmap[token].lastTime > 3600000) {
        tokenHeatmap[token] = { count: 0, lastTime: now, buyers: [] };
    }

    // اضافه کردن آمار
    tokenHeatmap[token].count++;
    tokenHeatmap[token].lastTime = now;
    if(!tokenHeatmap[token].buyers.includes(target.name)) {
        tokenHeatmap[token].buyers.push(target.name);
    }

    // --- تصمیم گیری برای ارسال پیام ---
    
    // حالت ۱: خرید سنگین (Whale Alert)
    if (amountSol >= MIN_BUY_SOL) {
        sendAlert("🐋 BIG WHALE BUY", target, token, amountSol, signature, "HIGH");
    }
    
    // حالت ۲: حمله گروهی (بیش از ۱ نهنگ در ۱ ساعت)
    else if (tokenHeatmap[token].buyers.length > 1) {
        const buyersList = tokenHeatmap[token].buyers.join(" + ");
        sendAlert("🐺 WOLFPACK DETECTED", {name: buyersList}, token, amountSol, signature, "CRITICAL");
    }
    
    // حالت ۳: خرید معمولی (فقط لاگ)
    else {
        console.log(`Small buy by ${target.name}: ${amountSol} SOL`);
    }
}

function sendAlert(title, target, token, amount, signature, level) {
    const emoji = level === "CRITICAL" ? "🚨🚨🚨" : "🟢";
    const photonLink = `https://photon-sol.tinyastro.io/en/lp/${token}`;
    const bonkBotLink = `https://t.me/bonkbot_bot?start=${token}`; // لینک مستقیم خرید

    const msg = `
${emoji} **${title}**

👤 **Hunter:** ${target.name}
💰 **Size:** ~${amount.toFixed(2)} SOL
🪙 **Token:** \`${token}\`

📊 **Heatmap:** ${tokenHeatmap[token].count} Buys / 1h

🔫 **ONE-TAP BUY:**
[BonkBot](${bonkBotLink}) | [Photon](${photonLink})
    `;

    bot.sendMessage(MY_CHAT_ID, msg, { parse_mode: 'Markdown', disable_web_page_preview: true });
}

// جلوگیری از کرش
process.on('uncaughtException', (err) => { console.log('⚠️ Error:', err.message); });

startSpying();
