const TelegramBot = require('node-telegram-bot-api');
const { Connection, PublicKey } = require('@solana/web3.js');
const express = require('express');

// --- تنظیمات ---
const TELEGRAM_TOKEN = "8596274256:AAHvtmJHhBG7evC3Errp20ZcxUxP-tfQ-g0";
const MY_CHAT_ID = "61848555";
const HELIUS_KEY = "1779c0aa-451c-4dc3-89e2-96e62ca68484"; // کلید Helius

// ساخت لینک‌های دقیق
const HTTPS_URL = `https://mainnet.helius-rpc.com/?api-key=${HELIUS_KEY}`;
const WSS_URL = `wss://mainnet.helius-rpc.com/?api-key=${HELIUS_KEY}`;

const RAYDIUM_PROGRAM_ID = "675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8";

const bot = new TelegramBot(TELEGRAM_TOKEN, { polling: true });

// اتصال دوگانه (HTTP + WebSocket)
const connection = new Connection(HTTPS_URL, {
    wsEndpoint: WSS_URL,
    commitment: 'confirmed'
});

const app = express();
app.get('/', (req, res) => res.send('🔊 MONITORING ACTIVE...'));
app.listen(process.env.PORT || 3000);

console.log("🦅 DEBUG MODE STARTED...");
bot.sendMessage(MY_CHAT_ID, "🦅 **DEBUG MODE ON**\nTesting connection to Solana...");

// --- ضربان قلب (برای اینکه بفهمیم قطع نشده) ---
setInterval(async () => {
    try {
        const slot = await connection.getSlot();
        console.log(`💓 Alive | Slot: ${slot}`);
    } catch (e) {
        console.log("⚠️ Connection Error:", e.message);
    }
}, 10000); // هر ۱۰ ثانیه

async function startSniper() {
    console.log("📡 Connecting to Raydium Stream...");
    const publicKey = new PublicKey(RAYDIUM_PROGRAM_ID);
    
    try {
        connection.onLogs(
            publicKey,
            async ({ logs, err, signature }) => {
                if (err) return;
                
                // در حالت دیباگ، هر لاگی که "initialize" داشته باشه رو میفرستیم
                // حتی اگه initialize2 نباشه، میخوایم ببینیم اصلا چیزی میاد؟
                if (logs.some(log => log.includes("initialize"))) {
                    console.log(`🔥 LOG DETECTED: ${signature}`);
                    
                    bot.sendMessage(MY_CHAT_ID, `🧪 **SIGNAL RECEIVED**\n\nSig: \`${signature}\`\n\n[Check Solscan](https://solscan.io/tx/${signature})`, { parse_mode: 'Markdown', disable_web_page_preview: true });
                }
            },
            "processed"
        );
        console.log("✅ Listener Attached.");
    } catch (e) {
        console.log("❌ Listener Failed:", e.message);
        bot.sendMessage(MY_CHAT_ID, "❌ CONNECTION FAILED. Check Logs.");
    }
}

// جلوگیری از کرش
process.on('uncaughtException', (err) => { console.log('Fatal Error:', err.message); });

startSniper();
