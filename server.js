const express = require('express');
const app = express();

// ==========================================
// 🚀 سیستم ضد خاموشی (Heartbeat System)
// ==========================================
const PORT = process.env.PORT || 3000;
app.get('/', (req, res) => res.send('💀 KRONOS MEV ENGINE IS RUNNING...'));

// سرور وب رو روشن نگه دار
const webServer = app.listen(PORT, () => {
    console.log(`🌍 Web Server started on port ${PORT}`);
});

// این تایمر باعث میشه نود.جی‌اس هرگز بسته نشه
setInterval(() => {
    const memoryUsage = process.memoryUsage().heapUsed / 1024 / 1024;
    console.log(`💓 System Pulse | Memory: ${memoryUsage.toFixed(2)} MB`);
}, 10000); // هر ۱۰ ثانیه

// ==========================================
// 🧠 موتور کرونوس
// ==========================================
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

// --- ⚙️ تنظیمات ---
const HELIUS_RPC = "https://mainnet.helius-rpc.com/?api-key=1779c0aa-451c-4dc3-89e2-96e62ca68484";
// ⚠️ کلید خصوصی کیف پولت رو اینجا بذار:
const PRIVATE_KEY = "2oxLcQTzSSHkTC2bb2SrFuxyKmrip7YwKVUurZP6GLDhAaTC1gbMV8g3tWuqtX9uKFcxk56TNECuqstTzEpc5nUh"; 

const BUY_AMOUNT = 0.001; 
const JITO_TIP = 100000; 
const JITO_ENGINE = "https://mainnet.block-engine.jito.wtf/api/v1/bundles";
const RAYDIUM_PROGRAM_ID = new PublicKey("675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8");
const JITO_TIPS = [ "96gYZGLnJFVFzxGpYNBSU05fT6EW7qZk4sL8383r", "Hf3aaHtS5259dwhF7e5rppQ4g8Q1vF8Zp5Q5z5s5" ];

let connection;
let wallet;

// شروع سیستم با مدیریت خطا
async function initKronos() {
    try {
        if (!PRIVATE_KEY || PRIVATE_KEY.includes("YOUR_NEW")) {
            console.error("❌ ERROR: Private Key Missing!");
            return;
        }

        connection = new Connection(HELIUS_RPC, 'confirmed');
        wallet = Keypair.fromSecretKey(bs58.decode(PRIVATE_KEY));
        
        console.log(`💀 KRONOS ENGINE STARTED`);
        console.log(`👤 Wallet: ${wallet.publicKey.toString().substring(0, 6)}...`);
        
        // شروع اسکنر
        startScanner();

    } catch (e) {
        console.error("❌ INIT ERROR:", e.message);
        // تلاش مجدد در صورت خطا
        setTimeout(initKronos, 5000);
    }
}

function startScanner() {
    console.log("👁️ Watching Raydium Mempool...");
    
    try {
        connection.onLogs(
            RAYDIUM_PROGRAM_ID,
            async ({ logs, err, signature }) => {
                if (err) return;
                if (logs.some(log => log.includes("initialize2"))) {
                    console.log(`⚡ TARGET DETECTED: ${signature}`);
                    // پردازش در پس‌زمینه (بدون بلاک کردن سرور)
                    processTarget(signature).catch(e => console.log("Process Error:", e.message));
                }
            },
            "processed"
        );
    } catch (e) {
        console.error("⚠️ Connection Lost. Reconnecting...");
        setTimeout(startScanner, 2000);
    }
}

async function processTarget(signature) {
    // 1. دریافت اطلاعات تراکنش
    const tx = await connection.getParsedTransaction(signature, { maxSupportedTransactionVersion: 0 });
    if (!tx) return;

    const accountKeys = tx.transaction.message.accountKeys;
    let tokenMint = null;

    // پیدا کردن توکن
    for (const account of accountKeys) {
        const pubkey = account.pubkey.toString();
        if (!pubkey.startsWith("1111") && !pubkey.startsWith("So11") && !pubkey.startsWith("Rayd") && !pubkey.startsWith("Sys")) {
            tokenMint = pubkey;
            break;
        }
    }

    if (tokenMint) {
        console.log(`🎯 Locked on: ${tokenMint}`);
        await executeSwap(tokenMint);
    }
}

async function executeSwap(tokenMint) {
    try {
        // دریافت دیتای مارکت (ممکنه چند ثانیه طول بکشه تا Raydium ایندکس کنه)
        // برای همین ما اینجا 2 ثانیه صبر میکنیم
        await new Promise(r => setTimeout(r, 2000));

        const response = await axios.get(`https://api.raydium.io/v2/sdk/liquidity/mainnet.json`);
        const poolList = [...response.data.official, ...response.data.unOfficial];
        const poolInfo = poolList.find(p => p.baseMint === tokenMint || p.quoteMint === tokenMint);

        if (!poolInfo) return console.log(`⏳ Pool not ready yet: ${tokenMint}`);

        // محاسبات سواپ
        const amountIn = new TokenAmount(Token.WSOL, BUY_AMOUNT, false);
        const currencyOut = new Token(TOKEN_PROGRAM_ID, new PublicKey(tokenMint), poolInfo.baseDecimals);

        const { innerTransactions } = await Liquidity.makeSwapInstructionSimple({
            connection,
            poolKeys: poolInfo,
            userKeys: { tokenAccounts: [], owner: wallet.publicKey },
            amountIn: amountIn,
            amountOut: new TokenAmount(currencyOut, 1, false),
            fixedSide: 'in',
            makeTxVersion: 0,
        });

        const swapIx = innerTransactions[0].instructions;
        
        // دستور رشوه
        const tipAccount = new PublicKey(JITO_TIPS[Math.floor(Math.random() * JITO_TIPS.length)]);
        const tipIx = SystemProgram.transfer({
            fromPubkey: wallet.publicKey,
            toPubkey: tipAccount,
            lamports: JITO_TIP,
        });

        // ساخت باندل
        const { blockhash } = await connection.getLatestBlockhash();
        const messageV0 = new TransactionMessage({
            payerKey: wallet.publicKey,
            recentBlockhash: blockhash,
            instructions: [...swapIx, tipIx], 
        }).compileToV0Message();

        const transaction = new VersionedTransaction(messageV0);
        transaction.sign([wallet]);
        const serializedTx = bs58.encode(transaction.serialize());

        // شلیک!
        console.log("🚀 FIRING JITO BUNDLE...");
        const res = await axios.post(JITO_ENGINE, {
            jsonrpc: "2.0", id: 1, method: "sendBundle", params: [[serializedTx]]
        }, { headers: { 'Content-Type': 'application/json' } });

        console.log("✅ BUNDLE SENT! ID:", res.data.result);

    } catch (e) {
        console.log("❌ Swap Log:", e.message);
    }
}

// جلوگیری از مرگ ناگهانی
process.on('uncaughtException', (err) => { console.error('⚠️ Caught Exception:', err.message); });
process.on('SIGTERM', () => { console.log('🛑 SIGTERM received (Railway wants to stop us). Ignored for safety.'); });

// استارت
initKronos();
