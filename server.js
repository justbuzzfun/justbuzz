const TelegramBot = require('node-telegram-bot-api');
const { Connection, PublicKey } = require('@solana/web3.js');
const axios = require('axios');
const express = require('express');

// ==========================================
// ⚙️ تنظیمات
// ==========================================
const TELEGRAM_TOKEN = "8497155020:AAHmrjAbyAE7vXET6BH0APyvhHazH42SVtc";
const MY_CHAT_ID = "61848555";
const HELIUS_RPC = "https://mainnet.helius-rpc.com/?api-key=1779c0aa-451c-4dc3-89e2-96e62ca68484";
const RAYDIUM_PROGRAM_ID = "675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8";

// ==========================================
// 🚀 سیستم
// ==========================================
const bot = new TelegramBot(TELEGRAM_TOKEN, { polling: true });
const connection = new Connection(HELIUS_RPC, 'confirmed');

const app = express();
app.get('/', (req, res) => res.send('🕵️ INSIDER RADAR ACTIVE'));
app.listen(process.env.PORT || 3000);

console.log("🦅 INSIDER RADAR STARTED...");

async function startScanning() {
    console.log("👁️ Scanning for Whales...");
    const publicKey = new PublicKey(RAYDIUM_PROGRAM_ID);
    
    connection.onLogs(
        publicKey,
        async ({ logs, err, signature }) => {
            if (err) return;
            if (logs.some(log => log.includes("initialize2"))) {
                console.log(`⚡ POOL FOUND: ${signature}`);
                // 4 ثانیه صبر میکنیم تا توزیع توکن انجام بشه و دیتابیس آپدیت شه
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

        // 1. فیلتر امنیتی (اول امنیت!)
        const deadly = risks.filter(r => 
            r.name === 'Mint Authority' || 
            r.name === 'Freeze Authority' || 
            r.name === 'Liquidity Not Locked'
        );

        if (deadly.length > 0) {
            console.log(`🛑 UNSAFE: ${mint}`);
            return;
        }

        // 2. تحلیل اینسایدر (توزیع توکن) 🕵️‍♂️
        const topHolders = data.topHolders || [];
        let insiderPct = 0;
        let whaleCount = 0;

        // جمع زدن موجودی ۱۰ نفر اول (به جز استخر نقدینگی)
        topHolders.forEach(h => {
            if (!h.address.includes("Raydium") && !h.address.includes("5Q544")) { // فیلتر آدرس‌های صرافی
                insiderPct += h.pct;
                if(h.pct > 2) whaleCount++; // کسی که بیشتر از ۲٪ داره نهنگه
            }
        });

        // 3. تشخیص نوع پروژه
        let type = "🟢 FAIR LAUNCH";
        let urgency = "";
        
        if (insiderPct > 15) {
            type = "💎 INSIDER / VC PLAY";
            urgency = "🔥 WHALES ARE INSIDE!";
        } else if (insiderPct > 50) {
            type = "⚠️ HIGH RISK (Centralized)"; // اگه خیلی زیاد دستشون باشه خطرناکه
        }

        console.log(`✅ GEM: ${mint} | Insiders: ${insiderPct.toFixed(1)}%`);
        sendAlert(mint, score, insiderPct, type, urgency);

    } catch (e) { console.log("API Error"); }
}

function sendAlert(address, score, insiderPct, type, urgency) {
    const trojanLink = `https://t.me/solana_trojanbot?start=${address}`;
    const photonLink = `https://photon-sol.tinyastro.io/en/lp/${address}`;

    const msg = `
${type}

📜 \`${address}\`
(Tap to Copy)

🕵️‍♂️ **Inside Info:**
• Held by Whales: **${insiderPct.toFixed(1)}%**
• Safety Score: ${score} (Safe)
• Mint/Freeze: Disabled

${urgency}

🛒 **SNIPE NOW:**
🦄 [Trojan](${trojanLink})
📊 [Photon](${photonLink})
    `;

    bot.sendMessage(MY_CHAT_ID, msg, { 
        parse_mode: 'Markdown', 
        disable_web_page_preview: true 
    });
}

process.on('uncaughtException', (err) => { console.log('⚠️ Error:', err.message); });

startScanning();
