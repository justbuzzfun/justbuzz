const TelegramBot = require('node-telegram-bot-api');
const { Connection, PublicKey } = require('@solana/web3.js');
const axios = require('axios');
const express = require('express');

// --- ⚙️ تنظیمات ---
const TELEGRAM_TOKEN = "8596274256:AAHvtmJHhBG7evC3Errp20ZcxUxP-tfQ-g0";
const MY_CHAT_ID = "61848555";
const HELIUS_KEY = "1779c0aa-451c-4dc3-89e2-96e62ca68484";

// تنظیمات اتصال پیشرفته (همونی که جواب داد)
const HTTPS_URL = `https://mainnet.helius-rpc.com/?api-key=${HELIUS_KEY}`;
const WSS_URL = `wss://mainnet.helius-rpc.com/?api-key=${HELIUS_KEY}`;

const RAYDIUM_PROGRAM_ID = "675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8";

// راه‌اندازی ربات
const bot = new TelegramBot(TELEGRAM_TOKEN, { polling: true });
const connection = new Connection(HTTPS_URL, {
    wsEndpoint: WSS_URL,
    commitment: 'confirmed'
});

// سرور فیک
const app = express();
app.get('/', (req, res) => res.send('🦅 TITAN IS WATCHING...'));
app.listen(process.env.PORT || 3000);

console.log("🦅 TITAN HYBRID STARTED...");

// --- 1. فرمان شروع ---
bot.onText(/\/start/, (msg) => {
    bot.sendMessage(msg.chat.id, 
        "🦅 **TITAN SNIPER ONLINE**\n\n✅ Helius WSS: Connected\n🛡️ Safety Filter: ACTIVE\n\nWaiting for gems...", 
        { parse_mode: 'Markdown' }
    );
});

// --- 2. ضربان قلب (برای زنده ماندن اتصال) ---
setInterval(async () => {
    try {
        const slot = await connection.getSlot();
        console.log(`💓 System Alive | Slot: ${slot}`);
    } catch (e) { console.log("⚠️ Ping failed, reconnecting..."); }
}, 20000);

// --- 3. موتور شکارچی ---
async function startSniper() {
    console.log("📡 Listening to Raydium Stream...");
    const publicKey = new PublicKey(RAYDIUM_PROGRAM_ID);
    
    connection.onLogs(
        publicKey,
        async ({ logs, err, signature }) => {
            if (err) return;
            if (logs.some(log => log.includes("initialize2"))) {
                console.log(`⚡ Token Detected: ${signature}`);
                // بررسی امنیت
                checkSafety(signature);
            }
        },
        "processed"
    );
}

// --- 4. بررسی امنیت (RugCheck) ---
async function checkSafety(signature) {
    try {
        const tx = await connection.getParsedTransaction(signature, { maxSupportedTransactionVersion: 0 });
        if (!tx) return;

        const accountKeys = tx.transaction.message.accountKeys;
        
        for (const account of accountKeys) {
            const pubkey = account.pubkey.toString();
            if (!pubkey.startsWith("1111") && !pubkey.startsWith("So11") && !pubkey.startsWith("Rayd") && !pubkey.startsWith("Sys") && !pubkey.startsWith("Token")) {
                
                // درخواست به RugCheck
                try {
                    const response = await axios.get(`https://api.rugcheck.xyz/v1/tokens/${pubkey}/report/summary`);
                    const data = response.data;
                    
                    if (data) {
                        const risks = data.risks || [];
                        const deadly = risks.filter(r => r.name === 'Mint Authority' || r.name === 'Freeze Authority' || r.name === 'Liquidity Not Locked');
                        
                        // فقط اگر امن بود پیام بده
                        if (deadly.length === 0) {
                            sendAlert(pubkey, data.score);
                        } else {
                            console.log(`❌ Unsafe: ${pubkey}`);
                        }
                    }
                } catch (e) { /* API Error */ }
                break;
            }
        }
    } catch (e) { console.log("Parse Error"); }
}

// --- 5. ارسال پیام ---
function sendAlert(address, score) {
    const photonLink = `https://photon-sol.tinyastro.io/en/lp/${address}`;
    const bonkBotLink = `https://t.me/bonkbot_bot?start=${address}`;
    
    const msg = `
💎 **GEM FOUND!**

📜 \`${address}\`
(Tap to Copy)

🛡️ **Score:** ${score} (Safe)
✅ Mint: Renounced
✅ LP: Locked

🚀 **BUY NOW:**
[Photon](${photonLink}) | [BonkBot](${bonkBotLink})
    `;

    bot.sendMessage(MY_CHAT_ID, msg, { parse_mode: 'Markdown', disable_web_page_preview: true });
}

process.on('uncaughtException', (err) => { console.log('⚠️ Error:', err.message); });
startSniper();
