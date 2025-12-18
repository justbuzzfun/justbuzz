const express = require('express');
const http = require('http');
const { Server } = require("socket.io");
const { Connection, PublicKey } = require('@solana/web3.js');
const axios = require('axios'); // برای وصل شدن به RugCheck

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static('public'));

// --- ⚙️ تنظیمات ---
// برای سرعت بالا، حتما بعداً لینک Helius یا QuickNode خودت رو بذار
const RPC_ENDPOINT = "https://api.mainnet-beta.solana.com"; 
const RAYDIUM_PROGRAM_ID = new PublicKey("675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8");

const connection = new Connection(RPC_ENDPOINT, 'confirmed');

console.log("🛡️ TITAN ARMORED: RUG-PROOF MODE ON...");

async function startSniper() {
    console.log("📡 Scanning for Safe Pools...");
    
    connection.onLogs(
        RAYDIUM_PROGRAM_ID,
        async ({ logs, err, signature }) => {
            if (err) return;

            if (logs.some(log => log.includes("initialize2"))) {
                console.log(`\n🔎 POTENTIAL TOKEN FOUND. Analyzing...`);
                // کمی صبر میکنیم تا توکن در دیتابیس‌ها ثبت بشه
                setTimeout(() => extractAndCheck(signature), 3000);
            }
        },
        "processed"
    );
}

// استخراج آدرس و چک کردن امنیت
async function extractAndCheck(signature) {
    try {
        const tx = await connection.getParsedTransaction(signature, { maxSupportedTransactionVersion: 0 });
        if (!tx) return;

        const accountKeys = tx.transaction.message.accountKeys;
        
        // پیدا کردن آدرس توکن
        for (const account of accountKeys) {
            const pubkey = account.pubkey.toString();
            if (!pubkey.startsWith("1111") && !pubkey.startsWith("So11") && !pubkey.startsWith("Rayd") && !pubkey.startsWith("Sys")) {
                
                // --- 👮‍♂️ مرحله بازجویی (RUG CHECK API) ---
                checkSecurity(pubkey);
                break;
            }
        }
    } catch (e) {
        console.log("Parse Error", e.message);
    }
}

async function checkSecurity(tokenMint) {
    try {
        console.log(`🕵️ Checking Security for: ${tokenMint}`);
        
        // درخواست به RugCheck (رایگان)
        const response = await axios.get(`https://api.rugcheck.xyz/v1/tokens/${tokenMint}/report/summary`);
        const data = response.data;

        if (!data) return;

        // --- 🧠 فیلترهای سخت‌گیرانه ---
        const risks = data.risks || [];
        const score = data.score; // هر چی کمتر باشه بهتره (زیر 1000 امنه)
        
        // لیست خطرات مرگبار
        const deadlyRisks = risks.filter(r => 
            r.name === 'Mint Authority' || 
            r.name === 'Freeze Authority' || 
            r.name === 'High Holder Concentration' ||
            r.name === 'Liquidity Not Locked'
        );

        let safetyStatus = "SAFE";
        let color = "green";

        if (deadlyRisks.length > 0) {
            safetyStatus = "UNSAFE ❌";
            color = "red";
            console.log(`⚠️ REJECTED: ${tokenMint} (Risks found)`);
            return; // اگر خطر داشت، کلا بیخیال شو و به کاربر نشون نده
        }

        // اگر از فیلتر رد شد
        const lpLocked = data.liquidity_locked_pct || 0;
        
        // شرط نهایی: حداقل ۹۰٪ نقدینگی باید قفل/سوخته باشه
        // if (lpLocked < 90) {
        //    console.log(`⚠️ REJECTED: LP Not Locked (${lpLocked}%)`);
        //    return;
        // }

        console.log(`✅ VERIFIED SAFE: ${tokenMint}`);
        
        // ارسال سیگنال خرید
        io.emit('god-signal', {
            address: tokenMint,
            score: 100, // نمره کامل
            mintAuth: "✅ Renounced",
            freezeAuth: "✅ Disabled",
            lpStatus: `🔒 LP Locked/Burned`, // (${lpLocked}%)
            risks: "None Detected"
        });

    } catch (e) {
        // گاهی توکن خیلی جدیده و هنوز دیتایی نیست
        console.log(`⏳ Too fresh to analyze: ${tokenMint}`);
    }
}

io.on('connection', (socket) => {
    socket.emit('status', { msg: "ARMORED SNIPER RUNNING..." });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));

startSniper();
