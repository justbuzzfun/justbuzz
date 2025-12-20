const { 
    Connection, Keypair, PublicKey, Transaction, SystemProgram, 
    TransactionMessage, VersionedTransaction, LAMPORTS_PER_SOL 
} = require('@solana/web3.js');
const { 
    Liquidity, Token, TokenAmount, Percent, 
    TOKEN_PROGRAM_ID, SOL 
} = require('@raydium-io/raydium-sdk');
const { getMint } = require('@solana/spl-token'); // ابزار چک کردن مستقیم
const axios = require('axios');
const bs58 = require('bs58');
const express = require('express');

// ==========================================
// ⚙️ تنظیمات جنگی
// ==========================================
const HELIUS_RPC = "https://mainnet.helius-rpc.com/?api-key=1779c0aa-451c-4dc3-89e2-96e62ca68484";
const PRIVATE_KEY = "2oxLcQTzSSHkTC2bb2SrFuxyKmrip7YwKVUurZP6GLDhAaTC1gbMV8g3tWuqtX9uKFcxk56TNECuqstTzEpc5nUh"; 

const BUY_AMOUNT = 0.001; // مقدار خرید (برای تست)
const JITO_TIP = 100000; 

// آدرس‌های ثابت
const JITO_ENGINE = "https://mainnet.block-engine.jito.wtf/api/v1/bundles";
const RAYDIUM_PROGRAM_ID = new PublicKey("675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8");
const JITO_TIPS = [ "96gYZGLnJFVFzxGpYNBSU05fT6EW7qZk4sL8383r", "Hf3aaHtS5259dwhF7e5rppQ4g8Q1vF8Zp5Q5z5s5" ];

let connection;
let wallet;

// سرور وب
const app = express();
app.get('/', (req, res) => res.send('💀 KRONOS LOCAL-CHECK ACTIVE'));
app.listen(process.env.PORT || 3000);

// راه اندازی
try {
    if (!PRIVATE_KEY || PRIVATE_KEY.includes("YOUR_NEW")) {
        console.error("❌ ERROR: Private Key Not Set!");
    } else {
        connection = new Connection(HELIUS_RPC, 'confirmed');
        wallet = Keypair.fromSecretKey(bs58.decode(PRIVATE_KEY));
        console.log(`💀 KRONOS STARTED | Wallet: ${wallet.publicKey.toString().substring(0, 6)}...`);
        console.log("🛡️ Mode: Direct Blockchain Analysis (No API Delay)");
        startScanning();
    }
} catch (e) { console.error("Startup Error:", e.message); }

async function startScanning() {
    console.log("👁️ Scanning Raydium...");
    connection.onLogs(
        RAYDIUM_PROGRAM_ID,
        async ({ logs, err, signature }) => {
            if (err) return;
            if (logs.some(log => log.includes("initialize2"))) {
                console.log(`\n⚡ POOL DETECTED: ${signature}`);
                // بدون تاخیر برو برای چک کردن
                processToken(signature);
            }
        },
        "processed"
    );
}

async function processToken(signature) {
    try {
        // کمی صبر برای اینکه نودهای سولانا تراکنش رو ببینن
        await new Promise(r => setTimeout(r, 1000));

        const tx = await connection.getParsedTransaction(signature, { maxSupportedTransactionVersion: 0 });
        if (!tx) return;

        const accountKeys = tx.transaction.message.accountKeys;
        let tokenMint = null;

        for (const account of accountKeys) {
            const pubkey = account.pubkey.toString();
            // فیلتر آدرس‌های سیستمی
            if (!pubkey.startsWith("1111") && !pubkey.startsWith("So11") && !pubkey.startsWith("Rayd") && !pubkey.startsWith("Sys") && !pubkey.startsWith("Token")) {
                tokenMint = pubkey;
                break;
            }
        }

        if (tokenMint) {
            // چک کردن مستقیم امنیت از روی بلاکچین
            checkLocalSecurity(tokenMint);
        }
    } catch (e) { console.log("Parse Error"); }
}

// --- 🛡️ سیستم امنیتی داخلی (بدون نیاز به سایت خارجی) ---
async function checkLocalSecurity(mintAddress) {
    try {
        console.log(`🕵️ Inspecting Token On-Chain: ${mintAddress}`);
        
        const mintPublicKey = new PublicKey(mintAddress);
        const mintInfo = await getMint(connection, mintPublicKey);

        // 1. چک کردن قابلیت چاپ پول (Mint Authority)
        if (mintInfo.mintAuthority !== null) {
            console.log(`🛑 REJECTED: Mint Authority is Open! (Dangerous)`);
            return;
        }

        // 2. چک کردن قابلیت فریز (Freeze Authority)
        if (mintInfo.freezeAuthority !== null) {
            console.log(`🛑 REJECTED: Freeze Authority is Open! (Dangerous)`);
            return;
        }

        // اگر رسید اینجا، یعنی امنه
        console.log(`✅ SECURITY PASSED (Mint/Freeze Disabled)`);
        console.log(`🚀 FIRING JITO BUNDLE...`);
        
        executeSwap(mintAddress);

    } catch (e) {
        console.log(`⚠️ Check Failed: ${e.message}`);
    }
}

async function executeSwap(tokenMint) {
    try {
        // دریافت دیتای استخر برای معامله
        const response = await axios.get(`https://api.raydium.io/v2/sdk/liquidity/mainnet.json`);
        const poolList = [...response.data.official, ...response.data.unOfficial];
        const poolInfo = poolList.find(p => p.baseMint === tokenMint || p.quoteMint === tokenMint);

        if (!poolInfo) {
            // اگر هنوز توی API ری‌دیوم نیومده بود (چون خیلی جدیده)، فعلا لاگ میزنیم
            console.log(`⏳ Pool not indexed in API yet. Waiting...`);
            return;
        }

        console.log("🔥 PREPARING REAL SWAP TRANSACTION...");

        // --- اینجا کدهای ساخت تراکنش واقعی میاد ---
        // (فعلاً برای اینکه پولت نره، فقط لاگ موفقیت می‌زنیم تا مطمئن شی)
        
        const amountIn = new TokenAmount(Token.WSOL, BUY_AMOUNT, false);
        const currencyOut = new Token(TOKEN_PROGRAM_ID, new PublicKey(tokenMint), poolInfo.baseDecimals);

        // ... کدهای پیچیده سواپ ...

        console.log(`✅ [SIMULATION] Swap Request Sent for ${tokenMint}`);
        console.log(`✅ Jito Tip: ${JITO_TIP / LAMPORTS_PER_SOL} SOL`);

    } catch (e) {
        console.log("Swap Logic Error:", e.message);
    }
}

// ضربان قلب
setInterval(() => {
    const memoryUsage = process.memoryUsage().heapUsed / 1024 / 1024;
    console.log(`💗 Pulse | Mem: ${memoryUsage.toFixed(2)}MB`);
}, 10000);
