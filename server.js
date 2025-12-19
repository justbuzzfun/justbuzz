const TelegramBot = require('node-telegram-bot-api');
const { Connection, Keypair, PublicKey, Transaction, SystemProgram, TransactionMessage, VersionedTransaction } = require('@solana/web3.js');
const axios = require('axios');
const bs58 = require('bs58');
const express = require('express');

// ==========================================
// ⚙️ تنظیمات (دقت کن)
// ==========================================
const TELEGRAM_TOKEN = "8596274256:AAHvtmJHhBG7evC3Errp20ZcxUxP-tfQ-g0";
const MY_CHAT_ID = "61848555";
const HELIUS_RPC = "https://mainnet.helius-rpc.com/?api-key=1779c0aa-451c-4dc3-89e2-96e62ca68484";
const RAYDIUM_PROGRAM_ID = "675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8";

// ⚠️ کلید خصوصی جدیدت رو اینجا بذار
const PRIVATE_KEY = "2oxLcQTzSSHkTC2bb2SrFuxyKmrip7YwKVUurZP6GLDhAaTC1gbMV8g3tWuqtX9uKFcxk56TNECuqstTzEpc5nUh"; 

// ==========================================
// 🛡️ سیستم ضد مرگ (Anti-Crash System)
// ==========================================
process.on('uncaughtException', (err) => {
    console.error('🔥 CRITICAL ERROR:', err.message);
    // سرور خاموش نمیشه، فقط گزارش میده
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('⚠️ Unhandled Rejection:', reason);
});

// ==========================================
// 🚀 شروع سرور
// ==========================================
const app = express();
app.get('/', (req, res) => res.send('🦅 KRONOS IS ALIVE AND HUNTING...'));

// گوش دادن به پورت (حیاتی برای Railway)
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🌍 Web Server running on port ${PORT}`));

// ==========================================
// 🧠 مغز ربات
// ==========================================
let bot = null;
let connection = null;
let wallet = null;

async function startSystem() {
    try {
        console.log("⚙️ Initializing Systems...");

        // 1. تست کیف پول
        try {
            if (PRIVATE_KEY.includes("YOUR_NEW")) {
                throw new Error("Private Key not set! Please replace text in code.");
            }
            wallet = Keypair.fromSecretKey(bs58.decode(PRIVATE_KEY));
            console.log(`✅ Wallet Loaded: ${wallet.publicKey.toString().substring(0, 6)}...`);
        } catch (e) {
            console.error("❌ WALLET ERROR: Check your Private Key format!");
            return; // ادامه نده اگه کیف پول خرابه
        }

        // 2. اتصال به تلگرام
        try {
            bot = new TelegramBot(TELEGRAM_TOKEN, { polling: true });
            bot.sendMessage(MY_CHAT_ID, "🦅 **KRONOS REBOOTED**\nSystem is Stable.", { parse_mode: 'Markdown' });
            console.log("✅ Telegram Connected");
        } catch (e) {
            console.error("⚠️ Telegram Error (Bot might be running elsewhere):", e.message);
        }

        // 3. اتصال به سولانا
        connection = new Connection(HELIUS_RPC, 'confirmed');
        console.log("✅ Helius RPC Connected");

        // 4. شروع اسکن
        startScanning();

    } catch (e) {
        console.error("❌ SETUP FAILED:", e.message);
    }
}

async function startScanning() {
    console.log("👁️ Scanning Mempool...");
    const publicKey = new PublicKey(RAYDIUM_PROGRAM_ID);
    
    try {
        connection.onLogs(
            publicKey,
            async ({ logs, err, signature }) => {
                if (err) return;
                if (logs.some(log => log.includes("initialize2"))) {
                    console.log(`⚡ TARGET: ${signature}`);
                    
                    // ارسال پیام به تلگرام (با مدیریت خطا)
                    if(bot) {
                        try {
                            const link = `https://photon-sol.tinyastro.io/en/lp/${signature}`; // موقت
                            bot.sendMessage(MY_CHAT_ID, `⚡ **NEW POOL**\nSig: \`${signature}\`\n\n[Check Solscan](${link})`, { parse_mode: 'Markdown', disable_web_page_preview: true });
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

// استارت
startSystem();
