const express = require('express');
const app = express();

// --- 1. راه اندازی فوری سرور (برای جلوگیری از ارور Railway) ---
const PORT = process.env.PORT || 3000;
app.get('/', (req, res) => res.send('🦅 KRONOS IS ALIVE...'));
app.listen(PORT, () => console.log(`🌍 Web Server started on port ${PORT}`));

// --- 2. ایمپورت ابزارها ---
const TelegramBot = require('node-telegram-bot-api');
const { Connection, Keypair, PublicKey, Transaction, SystemProgram, TransactionMessage, VersionedTransaction } = require('@solana/web3.js');
const axios = require('axios');
const bs58 = require('bs58');

// ==========================================
// ⚙️ تنظیمات (اینجا رو چک کن)
// ==========================================
const TELEGRAM_TOKEN = "8596274256:AAHvtmJHhBG7evC3Errp20ZcxUxP-tfQ-g0";
const MY_CHAT_ID = "61848555";
const HELIUS_RPC = "https://mainnet.helius-rpc.com/?api-key=1779c0aa-451c-4dc3-89e2-96e62ca68484";
const RAYDIUM_PROGRAM_ID = "675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8";

// ⚠️ کلید خصوصی جدیدت رو اینجا بذار (بین دو تا کوتیشن)
const PRIVATE_KEY = "2oxLcQTzSSHkTC2bb2SrFuxyKmrip7YwKVUurZP6GLDhAaTC1gbMV8g3tWuqtX9uKFcxk56TNECuqstTzEpc5nUh"; 

// ==========================================
// 🛡️ سیستم ضد مرگ (Anti-Crash)
// ==========================================
process.on('uncaughtException', (err) => { console.error('🔥 CRITICAL ERROR:', err.message); });
process.on('unhandledRejection', (reason, promise) => { console.error('⚠️ Unhandled Rejection:', reason); });

// ==========================================
// 🧠 شروع موتور کرونوس
// ==========================================
let bot = null;
let connection = null;
let wallet = null;

async function startSystem() {
    console.log("⚙️ Booting System...");

    // A. تست کیف پول
    try {
        if (!PRIVATE_KEY || PRIVATE_KEY.includes("YOUR_NEW")) {
            console.error("❌ ERROR: Private Key is missing in line 25!");
            return;
        }
        wallet = Keypair.fromSecretKey(bs58.decode(PRIVATE_KEY));
        console.log(`✅ Wallet Loaded: ${wallet.publicKey.toString().substring(0, 6)}...`);
    } catch (e) {
        console.error("❌ WALLET ERROR: Invalid Private Key format.");
        return;
    }

    // B. اتصال به تلگرام
    try {
        bot = new TelegramBot(TELEGRAM_TOKEN, { polling: true });
        // حذف پیام خوشامدگویی برای جلوگیری از ارورهای احتمالی تلگرام در شروع
        console.log("✅ Telegram Bot Active");
    } catch (e) {
        console.error("⚠️ Telegram Error:", e.message);
    }

    // C. اتصال به سولانا
    try {
        connection = new Connection(HELIUS_RPC, 'confirmed');
        console.log("✅ Helius RPC Connected");
        startScanning();
    } catch (e) {
        console.error("❌ RPC Error:", e.message);
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
                if (logs.some(log => log.includes("initialize2"))) {
                    console.log(`⚡ TARGET: ${signature}`);
                    
                    if(bot) {
                        const link = `https://photon-sol.tinyastro.io/en/lp/${signature}`;
                        bot.sendMessage(MY_CHAT_ID, `⚡ **NEW POOL**\nSig: \`${signature}\`\n\n[Check Solscan](${link})`, { parse_mode: 'Markdown', disable_web_page_preview: true }).catch(e => console.log("Msg Error"));
                    }
                }
            },
            "processed"
        );
    } catch (e) {
        console.error("⚠️ Listener Error:", e.message);
    }
}

// استارت با تاخیر کوچک (برای اطمینان از لود شدن سرور)
setTimeout(startSystem, 2000);
