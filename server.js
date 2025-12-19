const express = require('express');
const app = express();

// --- 1. سرور وب برای زنده ماندن در Railway ---
const PORT = process.env.PORT || 3000;
app.get('/', (req, res) => res.send('🦅 KRONOS V2 IS HUNTING...'));
app.listen(PORT, () => console.log(`🌍 Server running on port ${PORT}`));

// --- 2. ابزارها ---
const TelegramBot = require('node-telegram-bot-api');
const { Connection, Keypair, PublicKey } = require('@solana/web3.js');
const axios = require('axios');
const bs58 = require('bs58');

// ==========================================
// ⚙️ تنظیمات نهایی (با توکن جدید)
// ==========================================

// 1. توکن جدید ربات تلگرام:
const TELEGRAM_TOKEN = "8497155020:AAHmrjAbyAE7vXET6BH0APyvhHazH42SVtc";

// 2. آیدی عددی خودت:
const MY_CHAT_ID = "61848555";

// 3. تنظیمات شبکه سولانا (Helius):
const HELIUS_RPC = "https://mainnet.helius-rpc.com/?api-key=1779c0aa-451c-4dc3-89e2-96e62ca68484";
const RAYDIUM_PROGRAM_ID = "675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8";

// 4. ⚠️ کلید خصوصی کیف پولت رو اینجا بذار:
const PRIVATE_KEY = "2oxLcQTzSSHkTC2bb2SrFuxyKmrip7YwKVUurZP6GLDhAaTC1gbMV8g3tWuqtX9uKFcxk56TNECuqstTzEpc5nUh"; 

// ==========================================
// 🧠 شروع سیستم
// ==========================================
let bot = null;
let connection = null;

async function startSystem() {
    console.log("⚙️ Booting Kronos V2...");

    try {
        // اتصال به ربات جدید
        bot = new TelegramBot(TELEGRAM_TOKEN, { polling: true });
        
        // ارسال پیام تست به تو
        await bot.sendMessage(MY_CHAT_ID, "🦅 **KRONOS V2 CONNECTED!**\nNew Bot ID Verified.\nWaiting for gems...", { parse_mode: 'Markdown' });
        console.log("✅ Telegram Connected Successfully");

        // اتصال به سولانا
        connection = new Connection(HELIUS_RPC, 'confirmed');
        console.log("✅ Helius Connected");
        
        // شروع اسکن بازار
        startScanning();

    } catch (e) {
        console.error("❌ Startup Error:", e.message);
    }
}

async function startScanning() {
    console.log("👁️ Scanning Raydium Mempool...");
    const publicKey = new PublicKey(RAYDIUM_PROGRAM_ID);
    
    try {
        connection.onLogs(
            publicKey,
            async ({ logs, err, signature }) => {
                if (err) return;
                // تشخیص توکن جدید
                if (logs.some(log => log.includes("initialize2"))) {
                    console.log(`⚡ TARGET: ${signature}`);
                    
                    if(bot) {
                        try {
                            const link = `https://photon-sol.tinyastro.io/en/lp/${signature}`;
                            // ارسال پیام به تلگرام
                            bot.sendMessage(MY_CHAT_ID, `⚡ **NEW GEM FOUND**\nSig: \`${signature}\`\n\n[Check Solscan](${link})`, { parse_mode: 'Markdown', disable_web_page_preview: true });
                        } catch(e) {}
                    }
                }
            },
            "processed"
        );
    } catch (e) {
        console.error("⚠️ Listener Error:", e.message);
    }
}

// جلوگیری از مرگ سرور (خیلی مهم)
process.on('uncaughtException', (err) => { console.log('Log:', err.message); });
process.on('polling_error', (err) => { console.log('Telegram Polling Error (Ignored)'); });

startSystem();
