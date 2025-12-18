const TelegramBot = require('node-telegram-bot-api');
const { Connection, PublicKey } = require('@solana/web3.js');
const axios = require('axios');
const express = require('express');

// ==========================================
// ⚙️ تنظیمات شخصی (اینجا دست نزن، تنظیم شده)
// ==========================================
const TELEGRAM_TOKEN = "8596274256:AAHvtmJHhBG7evC3Errp20ZcxUxP-tfQ-g0";
const MY_CHAT_ID = "61848555";
const HELIUS_RPC = "https://mainnet.helius-rpc.com/?api-key=1779c0aa-451c-4dc3-89e2-96e62ca68484";
const RAYDIUM_PROGRAM_ID = "675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8";

// راه‌اندازی ربات تلگرام و اتصال سولانا
const bot = new TelegramBot(TELEGRAM_TOKEN, { polling: true });
const connection = new Connection(HELIUS_RPC, 'confirmed');

// سرور فیک برای زنده نگه داشتن در Railway
const app = express();
app.get('/', (req, res) => res.send('💎 KRONOS ULTIMATE IS RUNNING...'));
app.listen(process.env.PORT || 3000);

console.log("🦅 KRONOS ULTIMATE STARTED...");

// --- 1. فرمان شروع ---
bot.onText(/\/start/, (msg) => {
    bot.sendMessage(msg.chat.id, 
        "🦅 **KRONOS SYSTEM ONLINE**\n\n" +
        "⚡ Connection: **Helius Elite**\n" +
        "🛡️ Safety Filter: **MAXIMUM**\n" +
        "🔭 Mode: **Sniper**\n\n" +
        "_Waiting for the next gem..._", 
        { parse_mode: 'Markdown' }
    );
});

// --- 2. موتور اسنایپر (Helius Listener) ---
async function startSniper() {
    console.log("📡 Listening to Raydium V4...");
    const publicKey = new PublicKey(RAYDIUM_PROGRAM_ID);
    
    connection.onLogs(
        publicKey,
        async ({ logs, err, signature }) => {
            if (err) return;
            // تشخیص دستور ساخت استخر (initialize2)
            if (logs.some(log => log.includes("initialize2"))) {
                console.log(`⚡ DETECTED: ${signature}`);
                // آنالیز امنیتی
                analyzeToken(signature);
            }
        },
        "processed"
    );
}

// --- 3. آنالیز توکن و امنیت ---
async function analyzeToken(signature) {
    try {
        const tx = await connection.getParsedTransaction(signature, { maxSupportedTransactionVersion: 0 });
        if (!tx) return;

        const accountKeys = tx.transaction.message.accountKeys;
        
        for (const account of accountKeys) {
            const pubkey = account.pubkey.toString();
            // فیلتر آدرس‌های سیستمی برای پیدا کردن توکن
            if (!pubkey.startsWith("1111") && !pubkey.startsWith("So11") && !pubkey.startsWith("Rayd") && !pubkey.startsWith("Sys") && !pubkey.startsWith("Token")) {
                
                // چک کردن امنیت با RugCheck
                try {
                    const response = await axios.get(`https://api.rugcheck.xyz/v1/tokens/${pubkey}/report/summary`);
                    const data = response.data;
                    
                    if (data) {
                        const risks = data.risks || [];
                        // لیست خطرات مرگبار
                        const deadly = risks.filter(r => 
                            r.name === 'Mint Authority' || 
                            r.name === 'Freeze Authority' || 
                            r.name === 'Liquidity Not Locked'
                        );
                        
                        // فقط اگر کاملاً امن بود
                        if (deadly.length === 0) {
                            sendTelegramAlert(pubkey, data.score);
                        } else {
                            console.log(`❌ Unsafe: ${pubkey}`);
                        }
                    }
                } catch (e) { /* API limitation ignore */ }
                break;
            }
        }
    } catch (e) { console.log("Parse Error"); }
}

// --- 4. ارسال گزارش به فرمانده (تو) ---
function sendTelegramAlert(address, score) {
    // لینک‌های سریع
    const photonLink = `https://photon-sol.tinyastro.io/en/lp/${address}`;
    const trojanLink = `https://t.me/solana_trojanbot?start=${address}`; // تروجان همون ربات سریع MEV هست
    const bonkBotLink = `https://t.me/bonkbot_bot?start=${address}`;
    
    const msg = `
💎 **GEM DETECTED!**

📜 **CA:** \`${address}\`
(Tap to Copy)

🛡️ **Score:** ${score} (Excellent)
✅ Mint: Renounced
✅ Freeze: Disabled
✅ Liquidity: Locked 🔥

⚡ **QUICK SNIPE:**
[🦄 Trojan (Fastest)](${trojanLink})
[🐶 BonkBot](${bonkBotLink})
[📊 Photon Chart](${photonLink})
    `;

    bot.sendMessage(MY_CHAT_ID, msg, { 
        parse_mode: 'Markdown', 
        disable_web_page_preview: true 
    });
}

// جلوگیری از خاموش شدن
process.on('uncaughtException', (err) => { console.log('⚠️ Error:', err.message); });

// استارت موتور
startSniper();
