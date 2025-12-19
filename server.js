const express = require('express');
const app = express();

// --- 1. راه اندازی فوری سرور (برای سبز شدن Railway) ---
const PORT = process.env.PORT || 3000;
app.get('/', (req, res) => res.send('🦅 KRONOS ENGINE IS RUNNING SMOOTHLY...'));
app.listen(PORT, () => console.log(`🌍 Web Server started on port ${PORT}`));

// --- 2. ایمپورت ابزارها ---
const TelegramBot = require('node-telegram-bot-api');
const { Connection, Keypair, PublicKey } = require('@solana/web3.js');
const axios = require('axios');
const bs58 = require('bs58');

// ==========================================
// ⚙️ تنظیمات حیاتی
// ==========================================
const TELEGRAM_TOKEN = "8596274256:AAHvtmJHhBG7evC3Errp20ZcxUxP-tfQ-g0";
const MY_CHAT_ID = "61848555";
const HELIUS_RPC = "https://mainnet.helius-rpc.com/?api-key=1779c0aa-451c-4dc3-89e2-96e62ca68484";
const RAYDIUM_PROGRAM_ID = "675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8";

// ⚠️ کلید خصوصی جدیدت رو اینجا بذار
const PRIVATE_KEY = "2oxLcQTzSSHkTC2bb2SrFuxyKmrip7YwKVUurZP6GLDhAaTC1gbMV8g3tWuqtX9uKFcxk56TNECuqstTzEpc5nUh"; 

// ==========================================
// 🧠 شروع سیستم
// ==========================================
let bot = null;
let connection = null;

async function startSystem() {
    console.log("⚙️ Booting Kronos...");

    // A. اتصال به تلگرام (با رفع ارور Conflict)
    try {
        bot = new TelegramBot(TELEGRAM_TOKEN, { 
            polling: {
                interval: 300,
                autoStart: true,
                params: { timeout: 10 }
            }
        });

        // مدیریت خطای 409 (تداخل)
        bot.on('polling_error', (error) => {
            if (error.code === 'ETELEGRAM' && error.message.includes('409 Conflict')) {
                console.log("⚠️ Telegram Conflict: Waiting for old instance to close...");
                // کاری نکن، خودش درست میشه
            } else {
                console.log("Telegram Error:", error.message);
            }
        });

        console.log("✅ Telegram Connected");
    } catch (e) {
        console.error("Telegram Setup Failed:", e.message);
    }

    // B. اتصال به سولانا
    try {
        connection = new Connection(HELIUS_RPC, 'confirmed');
        const slot = await connection.getSlot();
        console.log(`✅ Helius Connected (Slot: ${slot})`);
        
        // شروع اسکن
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
                        try {
                            const link = `https://photon-sol.tinyastro.io/en/lp/${signature}`;
                            bot.sendMessage(MY_CHAT_ID, `⚡ **NEW GEM FOUND**\nSig: \`${signature}\`\n\n[Check Photon](${link})`, { parse_mode: 'Markdown', disable_web_page_preview: true });
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

// جلوگیری از مرگ سرور
process.on('uncaughtException', (err) => {});
process.on('unhandledRejection', (reason) => {});

startSystem();
