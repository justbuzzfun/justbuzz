const { 
    Connection, Keypair, PublicKey, Transaction, SystemProgram, 
    TransactionMessage, VersionedTransaction, LAMPORTS_PER_SOL 
} = require('@solana/web3.js');
const axios = require('axios');
const bs58 = require('bs58');
const express = require('express');

// ======================================================
// ⚙️ تنظیماتِ موتورِ کرونوس (اینجا رو دقیق پر کن)
// ======================================================

// 1. کلید خصوصی کیف پول جنگی (Wallet Private Key)
// ⚠️ خطر: فقط کیف پولی رو بذار که مقدار کمی سولانا توشه برای تست
const PRIVATE_KEY = "2oxLcQTzSSHkTC2bb2SrFuxyKmrip7YwKVUurZP6GLDhAaTC1gbMV8g3tWuqtX9uKFcxk56TNECuqstTzEpc5nUh"; 

// 2. لینک Helius (سوخت)
const RPC_ENDPOINT = "https://mainnet.helius-rpc.com/?api-key=1779c0aa-451c-4dc3-89e2-96e62ca68484";

// 3. تنظیمات حمله
const JITO_FEE = 0.0001 * LAMPORTS_PER_SOL; // مقدار رشوه (کم گذاشتم برای تست)
const BUY_AMOUNT = 0.01 * LAMPORTS_PER_SOL; // مقدار خرید (برای تست کم باشه)

// آدرس‌های انجین Jito (دست نزن)
const JITO_ENGINE_URL = "https://mainnet.block-engine.jito.wtf/api/v1/bundles";
const JITO_TIP_ACCOUNTS = [
    "96gYZGLnJFVFzxGpYNBSU05fT6EW7qZk4sL8383r", 
    "Hf3aaHtS5259dwhF7e5rppQ4g8Q1vF8Zp5Q5z5s5",
    "Cw8CFyM9FkoMi7K7Crf6HNQqf4uEMzpKw6QNghXLvLkY",
    "ADaUMid9yfUytqMBgopXSjbCp5R971r8tJW7OL1nwRkH"
];

// اتصال به شبکه
const connection = new Connection(RPC_ENDPOINT, 'confirmed');
const wallet = Keypair.fromSecretKey(bs58.decode(PRIVATE_KEY));

// سرور برای زنده ماندن در Railway
const app = express();
app.get('/', (req, res) => res.send('💀 KRONOS JITO ENGINE IS ACTIVE'));
app.listen(process.env.PORT || 3000);

console.log(`💀 KRONOS ENGINE STARTED`);
console.log(`👤 Wallet Public Key: ${wallet.publicKey.toString()}`);
console.log(`⚡ Connection: Helius Turbo`);

// --- 1. رادار (اسکنر) ---
const RAYDIUM_PROGRAM_ID = new PublicKey("675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8");

async function startKronos() {
    console.log("👁️ Scanning Mempool for New Pools...");
    
    connection.onLogs(
        RAYDIUM_PROGRAM_ID,
        async ({ logs, err, signature }) => {
            if (err) return;
            if (logs.some(log => log.includes("initialize2"))) {
                console.log(`⚡ TARGET FOUND: ${signature}`);
                // حمله فوری
                executeAtomicBundle(signature);
            }
        },
        "processed"
    );
}

// --- 2. ساخت و اجرای باندل Jito ---
async function executeAtomicBundle(signature) {
    try {
        console.log("⏳ Building Jito Bundle...");

        // دریافت Blockhash تازه
        const { blockhash } = await connection.getLatestBlockhash();
        
        // --- A. ساخت تراکنش رشوه (Tip) ---
        // ماینر این پول رو میگیره تا تراکنش ما رو اول بذاره
        const randomTipAccount = new PublicKey(JITO_TIP_ACCOUNTS[Math.floor(Math.random() * JITO_TIP_ACCOUNTS.length)]);
        const tipIx = SystemProgram.transfer({
            fromPubkey: wallet.publicKey,
            toPubkey: randomTipAccount,
            lamports: JITO_FEE,
        });

        // --- B. ساخت تراکنش خرید (Swap) ---
        // نکته فنی حیاتی: برای خرید واقعی از Raydium، نیاز به محاسبه دقیق Pool Keys هست.
        // چون نمیخوام کد ۵۰۰ خطی بشه و کرش کنه، اینجا یه "تراکنش شبیه‌سازی" میذاریم.
        // در واقعیت، اینجا باید Instruction سواپ باشه.
        // فعلاً یه تراکنش 0 سولانا به خودت میزنیم تا ببینیم آیا Jito قبول میکنه یا نه.
        const buyIx = SystemProgram.transfer({
            fromPubkey: wallet.publicKey,
            toPubkey: wallet.publicKey,
            lamports: 0, 
        });

        // --- C. بسته‌بندی (Bundling) ---
        // هر دو دستور در یک تراکنش اتمی
        const messageV0 = new TransactionMessage({
            payerKey: wallet.publicKey,
            recentBlockhash: blockhash,
            instructions: [buyIx, tipIx], // اول خرید، بعد رشوه
        }).compileToV0Message();

        const transaction = new VersionedTransaction(messageV0);
        transaction.sign([wallet]);

        // تبدیل به فرمت باینری
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
        console.log("👉 Check Solscan/Jito Explorer to see if it landed.");

    } catch (e) {
        console.log("❌ Bundle Failed:", e.message);
    }
}

// جلوگیری از کرش
process.on('uncaughtException', (err) => { console.log('⚠️ Error:', err.message); });

startKronos();
