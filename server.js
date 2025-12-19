const express = require('express');
const app = express();

// --- 1. سرور وب (برای اینکه Railway سبز بمونه) ---
const PORT = process.env.PORT || 3000;
app.get('/', (req, res) => res.send('🦅 KRONOS V2 IS RUNNING...'));
app.listen(PORT, () => console.log(`🌍 Server running on port ${PORT}`));

// --- 2. ابزارها ---
const TelegramBot = require('node-telegram-bot-api');
const { Connection, PublicKey } = require('@solana/web3.js');
const axios = require('axios');
const bs58 = require('bs58');

// ==========================================
// ⚙️ تنظیمات (توکن جدیدت)
// ==========================================
const TELEGRAM_TOKEN = "8497155020:AAHmrjAbyAE7vXET6BH0APyvhHazH42SVtc";
const MY_CHAT_ID = "61848555";
const HELIUS_RPC = "https://mainnet.helius-rpc.com/?api-key=1779c0aa-451c-4dc3-89e2-96e62ca68484";
const RAYDIUM_PROGRAM_ID = "675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8";

// ⚠️ کلید خصوصی جدیدت رو اینجا بذار
const PRIVATE_KEY = "2oxLcQTzSSHkTC2bb2SrFuxyKmrip7YwKVUurZP6GLDhAaTC1gbMV8g3tWuqtX9uKFcxk56TNECuqstTzEpc5nUh"; 

// ==========================================
// 🧠 شروع سیستم (بدون تداخل)
// ==========================================
let bot = null;
let connection = null;

async function startSystem() {
    console.log("⚙️ Booting Kronos V2...");

    // A. اتصال به تلگرام (با مکانیزم رفع ارور 409)
    try {
        // اول: هر وب‌هوکی که از قبل مونده رو پاک کن
        const tempBot = new TelegramBot(TELEGRAM_TOKEN);
        await tempBot.deleteWebHook();
        
        // دوم: با تنظیمات خاص وصل شو که اگر ارور داد، کرش نکنه
        bot = new TelegramBot(TELEGRAM_TOKEN, { 
            polling: {
                interval: 500, // هر نیم ثانیه چک کن (فشار کمتر)
                autoStart: true,
                params: { timeout: 10 }
            }
        });

        // مدیریت خطای تداخل (اینو گذاشتم که دیگه لاگ قرمز نده)
        bot.on('polling_error', (error) => {
            if (error.code === 'ETELEGRAM' && error.message.includes('409 Conflict')) {
                // این یعنی نسخه قبلی هنوز زنده‌ست. نادیده بگیر تا اون بمیره.
                console.log("⚠️ Conflict detected. Waiting for old instance to die...");
            } else {
                console.log("Tg Error:", error.message);
            }
        });

        // پیام شروع
        await bot.sendMessage(MY_CHAT_ID, "🦅 **KRONOS V2 ONLINE**\nConnection Established.", { parse_mode: 'Markdown' });
        console.log("✅ Telegram Connected");

    } catch (e) {
        console.error("⚠️ Telegram warning:", e.message);
    }

    // B. اتصال به سولانا
    try {
        connection = new Connection(HELIUS_RPC, 'confirmed');
        console.log("✅ Helius Connected");
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
                            bot.sendMessage(MY_CHAT_ID, `⚡ **NEW GEM**\nSig: \`${signature}\`\n\n[Check Solscan](${link})`, { parse_mode: 'Markdown', disable_web_page_preview: true });
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

// جلوگیری از مرگ سرور (خیلی مهم)
process.on('uncaughtException', (err) => { console.log('Log:', err.message); });

startSystem();
