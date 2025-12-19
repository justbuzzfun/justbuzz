const { 
    Connection, Keypair, PublicKey, Transaction, SystemProgram, 
    TransactionMessage, VersionedTransaction, LAMPORTS_PER_SOL 
} = require('@solana/web3.js');
const { 
    Liquidity, Token, TokenAmount, Percent, 
    TOKEN_PROGRAM_ID, SOL 
} = require('@raydium-io/raydium-sdk');
const axios = require('axios');
const bs58 = require('bs58');
const express = require('express');

// ======================================================
// ⚙️ تنظیمات
// ======================================================
const HELIUS_RPC = "https://mainnet.helius-rpc.com/?api-key=1779c0aa-451c-4dc3-89e2-96e62ca68484";
// ⚠️ کلید خصوصی کیف پولت:
const PRIVATE_KEY = "2oxLcQTzSSHkTC2bb2SrFuxyKmrip7YwKVUurZP6GLDhAaTC1gbMV8g3tWuqtX9uKFcxk56TNECuqstTzEpc5nUh"; 

const BUY_AMOUNT = 0.001; 
const JITO_TIP = 100000; 
const JITO_ENGINE = "https://mainnet.block-engine.jito.wtf/api/v1/bundles";
const RAYDIUM_PROGRAM_ID = new PublicKey("675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8");
const JITO_TIPS = [ "96gYZGLnJFVFzxGpYNBSU05fT6EW7qZk4sL8383r", "Hf3aaHtS5259dwhF7e5rppQ4g8Q1vF8Zp5Q5z5s5" ];

let connection;
let wallet;

const app = express();
app.get('/', (req, res) => res.send('💀 KRONOS VERBOSE MODE ACTIVE'));
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
                // بررسی فوری
                processToken(signature);
            }
        },
        "processed"
    );
}

async function processToken(signature) {
    try {
        // کمی صبر برای ایندکس شدن
        await new Promise(r => setTimeout(r, 2000));

        const tx = await connection.getParsedTransaction(signature, { maxSupportedTransactionVersion: 0 });
        if (!tx) {
            console.log(`⚠️ TX Not found yet (Skipping)`);
            return;
        }

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
            checkSecurity(tokenMint);
        } else {
            console.log(`❌ Could not find Token Mint in TX.`);
        }
    } catch (e) { console.log("Parse Error:", e.message); }
}

async function checkSecurity(mint) {
    try {
        const res = await axios.get(`https://api.rugcheck.xyz/v1/tokens/${mint}/report/summary`);
        const data = res.data;
        
        if (!data) {
            console.log(`⚠️ No Data from RugCheck (Skipping)`);
            return;
        }

        const risks = data.risks || [];
        const score = data.score;
        
        // گزارش دقیق دلیل رد شدن
        const mintAuth = risks.find(r => r.name === 'Mint Authority');
        const freezeAuth = risks.find(r => r.name === 'Freeze Authority');
        const lpLocked = risks.find(r => r.name === 'Liquidity Not Locked');

        if (mintAuth) {
            console.log(`🛑 REJECTED: Mint Authority is Open! (SCAM RISK)`);
            return;
        }
        if (freezeAuth) {
            console.log(`🛑 REJECTED: Freeze Authority is Open! (SCAM RISK)`);
            return;
        }
        if (lpLocked) {
            console.log(`🛑 REJECTED: LP Not Locked! (RUG RISK)`);
            return;
        }

        if (score > 1000) {
             console.log(`🛑 REJECTED: Risk Score too high (${score})`);
             return;
        }

        // اگر رسید اینجا یعنی امنه
        console.log(`✅ SECURITY PASSED! Score: ${score}`);
        console.log(`🚀 FIRING JITO BUNDLE...`);
        
        executeSwap(mint);

    } catch (e) {
        console.log(`⚠️ Security Check Error: ${e.message}`);
    }
}

async function executeSwap(tokenMint) {
    // ... (همون کد خرید قبلی که داشتیم) ...
    // برای اینکه لاگ شلوغ نشه، اینجا فقط پیام موفقیت رو شبیه‌سازی می‌کنم
    // چون در واقعیت باید Pool Keys رو بگیریم که کدش طولانیه
    // اگر خواستی خرید واقعی انجام بشه، بگو کد کامل خرید رو بذارم
    console.log(`✅ [SIMULATION] Buying ${tokenMint} with 0.001 SOL...`);
}

// ضربان قلب
setInterval(() => {
    const memoryUsage = process.memoryUsage().heapUsed / 1024 / 1024;
    console.log(`💗 Pulse | Mem: ${memoryUsage.toFixed(2)}MB`);
}, 10000);
