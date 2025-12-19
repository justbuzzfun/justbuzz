const { 
    Connection, Keypair, PublicKey, Transaction, SystemProgram, 
    TransactionMessage, VersionedTransaction, LAMPORTS_PER_SOL 
} = require('@solana/web3.js');
const axios = require('axios');
const bs58 = require('bs58');
const express = require('express');

// ======================================================
// 💀 تنظیماتِ سطحِ خدا (KRONOS CONFIG)
// ======================================================

// 1. کلید خصوصی کیف پولت (باید مقداری سولانا داشته باشه برای رشوه)
const PRIVATE_KEY = "2oxLcQTzSSHkTC2bb2SrFuxyKmrip7YwKVUurZP6GLDhAaTC1gbMV8g3tWuqtX9uKFcxk56TNECuqstTzEpc5nUh"; 

// 2. لینک Helius (سوخت)
const RPC_ENDPOINT = "https://mainnet.helius-rpc.com/?api-key=1779c0aa-451c-4dc3-89e2-96e62ca68484";

// 3. آدرس انجین Jito (دروازه زمان - سرور نیویورک)
const JITO_ENGINE_URL = "https://ny.mainnet.block-engine.jito.wtf/api/v1/bundles";

// 4. مقدار رشوه (Tip) برای اینکه ماینر تراکنش رو اول بذاره
// 0.0001 SOL (برای تست) - در مواقع جنگ باید زیاد بشه
const JITO_TIP_AMOUNT = 100000; 

// آدرس‌های دریافت رشوه Jito (اینا ثابتن)
const JITO_TIP_ACCOUNTS = [
    "96gYZGLnJFVFzxGpYNBSU05fT6EW7qZk4sL8383r", 
    "Hf3aaHtS5259dwhF7e5rppQ4g8Q1vF8Zp5Q5z5s5",
    "Cw8CFyM9FkoMi7K7Crf6HNQqf4uEMzpKw6QNghXLvLkY",
    "ADaUMid9yfUytqMBgopXSjbCp5R971r8tJW7OL1nwRkH"
];

// اتصال به شبکه
const connection = new Connection(RPC_ENDPOINT, 'confirmed');
let wallet;

// سرور برای زنده ماندن در Railway (بدون تلگرام)
const app = express();
app.get('/', (req, res) => res.send('💀 KRONOS MEV ENGINE IS RUNNING (SILENT MODE)'));
app.listen(process.env.PORT || 3000);

// --- راه اندازی سیستم ---
try {
    if (PRIVATE_KEY.includes("YOUR_NEW")) throw new Error("PRIVATE KEY MISSING");
    wallet = Keypair.fromSecretKey(bs58.decode(PRIVATE_KEY));
    console.log(`💀 KRONOS ENGINE STARTED`);
    console.log(`👤 Wallet: ${wallet.publicKey.toString().substring(0, 6)}...`);
    console.log(`🔌 Connected to Jito Block Engine (NY)`);
} catch (e) {
    console.error("❌ CRITICAL: Private Key Error");
}

// --- 1. رادار (اسکنر) ---
const RAYDIUM_PROGRAM_ID = new PublicKey("675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8");

async function startKronos() {
    console.log("👁️ Scanning Mempool (Silent Mode)...");
    
    connection.onLogs(
        RAYDIUM_PROGRAM_ID,
        async ({ logs, err, signature }) => {
            if (err) return;
            if (logs.some(log => log.includes("initialize2"))) {
                console.log(`⚡ TARGET FOUND: ${signature}`);
                // اجرای حمله اتمی
                executeAtomicBundle(signature);
            }
        },
        "processed"
    );
}

// --- 2. ساخت و ارسال باندل Jito ---
async function executeAtomicBundle(signature) {
    if (!wallet) return;

    try {
        console.log("⏳ Building Jito Bundle...");

        // دریافت Blockhash تازه (حیاتی برای سرعت)
        const { blockhash } = await connection.getLatestBlockhash();
        
        // --- A. ساخت دستور رشوه (Tip Instruction) ---
        // این پولی هست که ماینر رو میخره
        const randomTipAccount = new PublicKey(JITO_TIP_ACCOUNTS[Math.floor(Math.random() * JITO_TIP_ACCOUNTS.length)]);
        const tipIx = SystemProgram.transfer({
            fromPubkey: wallet.publicKey,
            toPubkey: randomTipAccount,
            lamports: JITO_TIP_AMOUNT,
        });

        // --- B. ساخت دستور خرید (Swap Instruction) ---
        // ⚠️ نکته حرفه‌ای: اینجا جای کد خرید Raydium هست.
        // برای اینکه سرور کرش نکنه (چون کد کامل سواپ خیلی سنگینه)، من فعلاً
        // یک تراکنش "خالی" (Memo) میذارم که فقط باندل رو تست کنیم.
        // وقتی دیدی توی Solscan لاگ شد، یعنی تونستیم بلاک رو بخریم.
        const memoIx = new Transaction().add(
            SystemProgram.transfer({
                fromPubkey: wallet.publicKey,
                toPubkey: wallet.publicKey,
                lamports: 0, 
            })
        ).instructions[0];

        // --- C. بسته‌بندی (Bundling) ---
        // تمام تراکنش‌ها در یک پکیج اتمی
        const messageV0 = new TransactionMessage({
            payerKey: wallet.publicKey,
            recentBlockhash: blockhash,
            instructions: [memoIx, tipIx], // اول خرید (اینجا ممو)، بعد رشوه
        }).compileToV0Message();

        const transaction = new VersionedTransaction(messageV0);
        transaction.sign([wallet]);

        const serializedTx = bs58.encode(transaction.serialize());

        // --- D. شلیک به انجین Jito ---
        console.log("🚀 Sending Bundle to Miner...");
        
        const payload = {
            jsonrpc: "2.0",
            id: 1,
            method: "sendBundle",
            params: [[serializedTx]]
        };

        const res = await axios.post(JITO_ENGINE_URL, payload, { 
            headers: { 'Content-Type': 'application/json' } 
        });

        console.log("✅ BUNDLE FIRED! Bundle ID:", res.data.result);

    } catch (e) {
        console.log("❌ Bundle Failed:", e.message);
    }
}

// جلوگیری از کرش
process.on('uncaughtException', (err) => { console.log('⚠️ Error:', err.message); });

startKronos();
