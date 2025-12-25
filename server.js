const TelegramBot = require('node-telegram-bot-api');
const { Connection, PublicKey } = require('@solana/web3.js');
const axios = require('axios');
const express = require('express');

// ==========================================
// ⚙️ تنظیمات (اینجا رو درست کن)
// ==========================================

// ⚠️ توکن جدید رو از BotFather بگیر و بذار اینجا بین دو تا " "
const TELEGRAM_TOKEN = "7964377047:AAFfxhpOy-a3p0L_VbOfL2qriZxeyFNYX7o";

const MY_CHAT_ID = "61848555";
const HELIUS_RPC = "https://mainnet.helius-rpc.com/?api-key=1779c0aa-451c-4dc3-89e2-96e62ca68484";
const RAYDIUM_PROGRAM_ID = "7964377047:AAFfxhpOy-a3p0L_VbOfL2qriZxeyFNYX7o";

// ==========================================
// 🚀 سیستم
// ==========================================
let bot = null;
const connection = new Connection(HELIUS_RPC, 'confirmed');

const app = express();
app.get('/', (req, res) => res.send('🦅 KRONOS V3 IS ACTIVE'));
app.listen(process.env.PORT || 3000);

console.log("🦅 STARTING KRONOS V3...");

async function startSystem() {
    try {
        // اتصال به تلگرام
        bot = new TelegramBot(TELEGRAM_TOKEN, { 
            polling: {
                interval: 1000,
                autoStart: true,
                params: { timeout: 10 }
            }
        });

        // مدیریت ارور توکن اشتباه (401)
        bot.on('polling_error', (error) => {
            if (error.code === 'ETELEGRAM' && error.message.includes('401 Unauthorized')) {
                console.error("❌ CRITICAL: Token is invalid! Please update server.js");
                process.exit(1); // خاموش شو تا درستش کنی
            } else {
                console.log("TG Log:", error.message);
            }
        });

        console.log("✅ Telegram Connected");
        
        // پیام شروع
        bot.sendMessage(MY_CHAT_ID, "🦅 **KRONOS RECONNECTED**\nNew Token Verified.\nScanning Market...", { parse_mode: 'Markdown' });

        startScanning();

    } catch (e) {
        console.error("Startup Error:", e.message);
    }
}

async function startScanning() {
    console.log("👁️ Scanning Raydium...");
    const publicKey = new PublicKey(RAYDIUM_PROGRAM_ID);
    
    connection.onLogs(
        publicKey,
        async ({ logs, err, signature }) => {
            if (err) return;
            if (logs.some(log => log.includes("initialize2"))) {
                console.log(`⚡ POOL: ${signature}`);
                setTimeout(() => processToken(signature), 4000);
            }
        },
        "processed"
    );
}

async function processToken(signature) {
    try {
        const tx = await connection.getParsedTransaction(signature, { maxSupportedTransactionVersion: 0 });
        if (!tx) return;

        const accountKeys = tx.transaction.message.accountKeys;
        let tokenMint = null;

        for (const account of accountKeys) {
            const pubkey = account.pubkey.toString();
            if (!pubkey.startsWith("1111") && !pubkey.startsWith("So11") && !pubkey.startsWith("Rayd") && !pubkey.startsWith("Sys") && !pubkey.startsWith("Token")) {
                tokenMint = pubkey;
                break;
            }
        }

        if (tokenMint) {
            checkInsiderAndSecurity(tokenMint);
        }
    } catch (e) { console.log("Parse Error"); }
}

async function checkInsiderAndSecurity(mint) {
    try {
        const res = await axios.get(`https://api.rugcheck.xyz/v1/tokens/${mint}/report/summary`);
        const data = res.data;
        if (!data) return;

        const risks = data.risks || [];
        const score = data.score;
        const deadly = risks.filter(r => r.name === 'Mint Authority' || r.name === 'Freeze Authority' || r.name === 'Liquidity Not Locked');

        if (deadly.length > 0) {
            console.log(`🛑 UNSAFE: ${mint}`);
            return;
        }

        const topHolders = data.topHolders || [];
        let insiderPct = 0;
        topHolders.forEach(h => {
            if (!h.address.includes("Raydium") && !h.address.includes("5Q544")) {
                insiderPct += h.pct;
            }
        });

        let type = "🟢 FAIR LAUNCH";
        if (insiderPct > 15) type = "💎 INSIDER / VC PLAY";

        sendAlert(mint, score, insiderPct, type);
    } catch (e) { console.log("API Error"); }
}

function sendAlert(address, score, insiderPct, type) {
    const trojanLink = `https://t.me/solana_trojanbot?start=${address}`;
    const photonLink = `https://photon-sol.tinyastro.io/en/lp/${address}`;

    const msg = `
${type}

📜 \`${address}\`

🕵️‍♂️ **Insiders:** ${insiderPct.toFixed(1)}%
🛡️ **Score:** ${score} (Safe)

🛒 **SNIPE:**
🦄 [Trojan](${trojanLink}) | 📊 [Photon](${photonLink})
    `;

    bot.sendMessage(MY_CHAT_ID, msg, { parse_mode: 'Markdown', disable_web_page_preview: true });
}

process.on('uncaughtException', (err) => { console.log('Log:', err.message); });

startSystem();
