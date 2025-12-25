const TelegramBot = require('node-telegram-bot-api');
const { Connection, PublicKey } = require('@solana/web3.js');
const axios = require('axios');
const express = require('express');

// ==========================================
// ⚙️ تنظیمات نهایی (با توکن جدید)
// ==========================================
const TELEGRAM_TOKEN = "7964377047:AAFfxhpOy-a3p0L_VbOfL2qriZxeyFNYX7o";
const MY_CHAT_ID = "61848555";
const HELIUS_RPC = "https://mainnet.helius-rpc.com/?api-key=1779c0aa-451c-4dc3-89e2-96e62ca68484";
const RAYDIUM_PROGRAM_ID = "675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8";

// ==========================================
// 🚀 سیستم سرور (برای سبز ماندن)
// ==========================================
const app = express();
app.get('/', (req, res) => res.send('🦅 KRONOS V3 IS RUNNING...'));
app.listen(process.env.PORT || 3000);

// ==========================================
// 🧠 راه‌اندازی ربات (ضد تداخل 409)
// ==========================================
let bot = null;
const connection = new Connection(HELIUS_RPC, 'confirmed');

async function startSystem() {
    console.log("⚙️ Starting Kronos V3...");

    try {
        // تنظیمات خاص برای جلوگیری از Conflict
        bot = new TelegramBot(TELEGRAM_TOKEN, { 
            polling: {
                interval: 2000,  // هر 2 ثانیه چک کن (فشار کمتر)
                autoStart: true,
                params: { timeout: 10 }
            }
        });

        // این قطعه کد جلوی پر شدن لاگ‌ها با ارور زرد رو می‌گیره
        bot.on('polling_error', (error) => {
            if (error.code === 'ETELEGRAM' && error.message.includes('409 Conflict')) {
                // نادیده بگیر، چون نسخه جدید داره جایگزین میشه
                console.log("⚠️ Conflict Handled. Waiting for old instance to close...");
            } else {
                console.log("TG Error:", error.message);
            }
        });

        console.log("✅ Telegram Connected");
        
        // ارسال پیام شروع (تست)
        try {
            await bot.sendMessage(MY_CHAT_ID, "🦅 **KRONOS V3 ONLINE**\nConflict Fixed.\nScanning Market...", { parse_mode: 'Markdown' });
        } catch(e) { console.log("Msg Error (User hasn't started bot yet)"); }

        startScanning();

    } catch (e) {
        console.error("Startup Error:", e.message);
    }
}

// --- اسکنر ---
async function startScanning() {
    console.log("👁️ Scanning Raydium...");
    const publicKey = new PublicKey(RAYDIUM_PROGRAM_ID);
    
    connection.onLogs(
        publicKey,
        async ({ logs, err, signature }) => {
            if (err) return;
            if (logs.some(log => log.includes("initialize2"))) {
                console.log(`⚡ TARGET: ${signature}`);
                // تاخیر برای ایندکس شدن
                setTimeout(() => processToken(signature), 3000);
            }
        },
        "processed"
    );
}

// --- پردازش توکن ---
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

// --- امنیت و اینسایدر ---
async function checkInsiderAndSecurity(mint) {
    try {
        const res = await axios.get(`https://api.rugcheck.xyz/v1/tokens/${mint}/report/summary`);
        const data = res.data;
        if (!data) return;

        const risks = data.risks || [];
        const score = data.score;

        const deadly = risks.filter(r => 
            r.name === 'Mint Authority' || 
            r.name === 'Freeze Authority' || 
            r.name === 'Liquidity Not Locked'
        );

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
    if(!bot) return;

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

// ضد مرگ
process.on('uncaughtException', (err) => { console.log('Server Error:', err.message); });

startSystem();
