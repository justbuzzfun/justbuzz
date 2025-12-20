const { Connection, Keypair, PublicKey } = require('@solana/web3.js');
const axios = require('axios');
const bs58 = require('bs58');
const express = require('express');

// ======================================================
// ⚙️ تنظیمات
// ======================================================
const HELIUS_RPC = "https://mainnet.helius-rpc.com/?api-key=1779c0aa-451c-4dc3-89e2-96e62ca68484";
const RAYDIUM_PROGRAM_ID = new PublicKey("675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8");

// ⚠️ کلید خصوصی کیف پولت:
const PRIVATE_KEY = "2oxLcQTzSSHkTC2bb2SrFuxyKmrip7YwKVUurZP6GLDhAaTC1gbMV8g3tWuqtX9uKFcxk56TNECuqstTzEpc5nUh"; 

let connection;
let wallet;

const app = express();
app.get('/', (req, res) => res.send('💀 KRONOS RETRY SYSTEM ACTIVE'));
app.listen(process.env.PORT || 3000);

// راه اندازی
try {
    if (!PRIVATE_KEY || PRIVATE_KEY.includes("YOUR_NEW")) {
        console.error("❌ ERROR: Private Key Not Set!");
    } else {
        connection = new Connection(HELIUS_RPC, 'confirmed');
        wallet = Keypair.fromSecretKey(bs58.decode(PRIVATE_KEY));
        console.log(`💀 KRONOS STARTED | Wallet: ${wallet.publicKey.toString().substring(0, 6)}...`);
        startScanning();
    }
} catch (e) { console.error("Startup Error:", e.message); }

async function startScanning() {
    console.log("👁️ Scanning Mempool...");
    connection.onLogs(
        RAYDIUM_PROGRAM_ID,
        async ({ logs, err, signature }) => {
            if (err) return;
            if (logs.some(log => log.includes("initialize2"))) {
                console.log(`\n⚡ TARGET DETECTED: ${signature}`);
                // صبر اولیه (۳ ثانیه)
                setTimeout(() => processToken(signature), 3000);
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
            if (!pubkey.startsWith("1111") && !pubkey.startsWith("So11") && !pubkey.startsWith("Rayd") && !pubkey.startsWith("Sys")) {
                tokenMint = pubkey;
                break;
            }
        }

        if (tokenMint) {
            console.log(`🎯 Analyzing Token: ${tokenMint}`);
            // شروع چرخه بررسی با تلاش مجدد
            checkSecurityWithRetry(tokenMint, 1);
        }
    } catch (e) { console.log("Parse Error:", e.message); }
}

// تابع هوشمند با قابلیت تلاش مجدد
async function checkSecurityWithRetry(mint, attempt) {
    try {
        const res = await axios.get(`https://api.rugcheck.xyz/v1/tokens/${mint}/report/summary`);
        const data = res.data;
        
        if (!data) throw new Error("No Data");

        const risks = data.risks || [];
        const score = data.score;
        
        const mintAuth = risks.find(r => r.name === 'Mint Authority');
        const freezeAuth = risks.find(r => r.name === 'Freeze Authority');
        const lpLocked = risks.find(r => r.name === 'Liquidity Not Locked');

        if (mintAuth || freezeAuth || lpLocked) {
            console.log(`🛑 REJECTED: Unsafe Token (Score: ${score})`);
            return;
        }

        console.log(`✅ SECURITY PASSED! Score: ${score}`);
        console.log(`🚀 FIRING JITO BUNDLE...`);
        
        // اینجا کد خرید اجرا میشه (فعلا لاگ)
        console.log(`💸 [SIMULATION] Buying ${mint}...`);

    } catch (e) {
        // اگر ارور داد (مثل الان که 400 داد)
        if (attempt <= 3) {
            console.log(`⚠️ RugCheck not ready (Attempt ${attempt}/3). Retrying in 2s...`);
            setTimeout(() => checkSecurityWithRetry(mint, attempt + 1), 2000);
        } else {
            console.log(`❌ Gave up on ${mint} after 3 attempts.`);
        }
    }
}

// ضربان قلب
setInterval(() => {
    const memoryUsage = process.memoryUsage().heapUsed / 1024 / 1024;
    console.log(`💗 Pulse | Mem: ${memoryUsage.toFixed(2)}MB`);
}, 10000);
