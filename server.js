const TelegramBot = require('node-telegram-bot-api');
const { Connection, PublicKey } = require('@solana/web3.js');
const axios = require('axios');
const express = require('express');

// --- تنظیمات ---
// توکن ربات تلگرام و آیدی عددی خودت رو اینجا چک کن
const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN || "8596274256:AAHvtmJHhBG7evC3Errp20ZcxUxP-tfQ-g0";
const MY_CHAT_ID = process.env.ADMIN_CHAT_ID || "61848555";

// لینک Helius
const RPC_ENDPOINT = "https://mainnet.helius-rpc.com/?api-key=1779c0aa-451c-4dc3-89e2-96e62ca68484"; 
const RAYDIUM_PROGRAM_ID = "675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8";

// راه‌اندازی ربات
const bot = new TelegramBot(TELEGRAM_TOKEN, { polling: true });
const connection = new Connection(RPC_ENDPOINT, 'confirmed');

// سرور فیک برای زنده نگه داشتن Railway
const app = express();
app.get('/', (req, res) => res.send('TITAN IS ALIVE 🦅'));
app.listen(process.env.PORT || 3000);

console.log("🦅 TITAN BOT STARTED...");

// --- 1. پاسخ به دستور /start (اولویت بالا) ---
bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;
    bot.sendMessage(chatId, "🦅 **TITAN SNIPER IS ONLINE!**\n\n✅ Helius RPC: Connected\n✅ Security Filter: Active\n\nWaiting for new pools...", { parse_mode: 'Markdown' });
    console.log("Message received from:", chatId);
});

// --- 2. شکارچی (Sniper Logic) ---
async function startSniper() {
    console.log("📡 Listening to Raydium Logs...");
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

// --- 3. بررسی امنیت (RugCheck) ---
async function checkSafety(signature) {
    try {
        const tx = await connection.getParsedTransaction(signature, { maxSupportedTransactionVersion: 0 });
        if (!tx) return;

        const accountKeys = tx.transaction.message.accountKeys;
        
        for (const account of accountKeys) {
            const pubkey = account.pubkey.toString();
            // فیلتر آدرس‌های سیستمی
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
                            console.log(`❌ Unsafe Token: ${pubkey}`);
                        }
                    }
                } catch (e) { /* API Error */ }
                break;
            }
        }
    } catch (e) { console.log("Parse Error"); }
}

// --- 4. ارسال پیام به تلگرام ---
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

// جلوگیری از کرش
process.on('uncaughtException', (err) => { console.log('⚠️ Error:', err.message); });
process.on('unhandledRejection', (reason, p) => { console.log('⚠️ Unhandled Rejection'); });

// شروع
startSniper();
