const express = require('express');
const app = express();

// --- 1. سرور وب (برای سبز ماندن در Railway) ---
const PORT = process.env.PORT || 3000;
app.get('/', (req, res) => res.send('🦅 KRONOS IS WATCHING...'));
app.listen(PORT, () => console.log(`🌍 Server running on port ${PORT}`));

// --- 2. ابزارها ---
const TelegramBot = require('node-telegram-bot-api');
const { Connection, PublicKey } = require('@solana/web3.js');
const axios = require('axios');
const bs58 = require('bs58');

// ==========================================
// ⚙️ تنظیمات (اینجا رو چک کن)
// ==========================================
const TELEGRAM_TOKEN = "8596274256:AAHvtmJHhBG7evC3Errp20ZcxUxP-tfQ-g0";
const MY_CHAT_ID = "61848555";
const HELIUS_RPC = "https://mainnet.helius-rpc.com/?api-key=1779c0aa-451c-4dc3-89e2-96e62ca68484";
const RAYDIUM_PROGRAM_ID = "675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8";
const PRIVATE_KEY = "2oxLcQTzSSHkTC2bb2SrFuxyKmrip7YwKVUurZP6GLDhAaTC1gbMV8g3tWuqtX9uKFcxk56TNECuqstTzEpc5nUh"; // کلیدت رو بذار

// ==========================================
// 🧠 شروع سیستم (با قطع کردن اتصالات قبلی)
// ==========================================
let bot = null;
let connection = null;

async function startSystem() {
    console.log("⚙️ Killing old sessions...");

    // A. اتصال به تلگرام (روش جدید: اول قطع کن، بعد وصل شو)
    try {
        // اول بدون Polling میسازیم
        bot = new TelegramBot(TELEGRAM_TOKEN, { polling: false });
        
        // هر چی وب‌هوک یا اتصال قبلی هست پاک کن
        await bot.deleteWebHook();
        
        // حالا با قدرت شروع کن
        await bot.startPolling({ restart: true });
        
        console.log("✅ Telegram Connected (Clean Session)");
        
        // یه پیام تست بفرست که بفهمیم وصله
        bot.sendMessage(MY_CHAT_ID, "🦅 **KRONOS CONNECTED**\nReady to hunt.", { parse_mode: 'Markdown' });

    } catch (e) {
        console.error("⚠️ Telegram Fix Error:", e.message);
    }

    // B. اتصال به سولانا
    try {
        connection = new Connection(HELIUS_RPC, 'confirmed');
        console.log("✅ Helius RPC Connected");
        startScanning();
    } catch (e) {
        console.error("❌ RPC Error:", e.message);
    }
}

async function startScanning() {
    console.log("👁️ Scanning Raydium...");
    const publicKey = new PublicKey(RAYDIUM_PROGRAM_ID);
    
    try {
        connection.onLogs(
            publicKey,
            async ({ logs, err, signature }) => {
                if (err) return;
                if (logs.some(log => log.includes("initialize2"))) {
                    console.log(`⚡ TARGET: ${signature}`);
                    
                    if(bot) {
                        try {
                            const link = `https://photon-sol.tinyastro.io/en/lp/${signature}`;
                            bot.sendMessage(MY_CHAT_ID, `⚡ **NEW GEM FOUND**\nSig: \`${signature}\`\n\n[Check Solscan](${link})`, { parse_mode: 'Markdown', disable_web_page_preview: true });
                        } catch(e) {}
                    }
                }
            },
            "processed"
        );
    } catch (e) {
        console.error("Listener Error:", e.message);
    }
}

// جلوگیری از مرگ سرور
process.on('uncaughtException', (err) => { console.log('Log:', err.message); });

startSystem();
