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
// ⚙️ تنظیمات نهایی (WAR CONFIG)
// ======================================================

// 1. ⚠️ کلید خصوصی کیف پولت (باید سولانا داشته باشه):
const PRIVATE_KEY = "2oxLcQTzSSHkTC2bb2SrFuxyKmrip7YwKVUurZP6GLDhAaTC1gbMV8g3tWuqtX9uKFcxk56TNECuqstTzEpc5nUh"; 

// 2. لینک Helius (تست شده و سالم):
const RPC_ENDPOINT = "https://mainnet.helius-rpc.com/?api-key=1779c0aa-451c-4dc3-89e2-96e62ca68484";

// 3. تنظیمات خرید
const BUY_AMOUNT = 0.001; // مقدار خرید (برای تست کم باشه)
const JITO_TIP = 100000; // رشوه به ماینر

// آدرس‌های ثابت
const JITO_ENGINE = "https://mainnet.block-engine.jito.wtf/api/v1/bundles";
const RAYDIUM_PROGRAM_ID = new PublicKey("675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8");
const JITO_TIPS = [ "96gYZGLnJFVFzxGpYNBSU05fT6EW7qZk4sL8383r", "Hf3aaHtS5259dwhF7e5rppQ4g8Q1vF8Zp5Q5z5s5" ];

const connection = new Connection(RPC_ENDPOINT, 'confirmed');
let wallet;

// سرور وب برای زنده ماندن
const app = express();
app.get('/', (req, res) => res.send('💀 KRONOS ENGINE ACTIVE'));
app.listen(process.env.PORT || 3000);

// --- راه اندازی ---
try {
    if (PRIVATE_KEY.includes("YOUR_NEW")) throw new Error("Private Key Missing");
    wallet = Keypair.fromSecretKey(bs58.decode(PRIVATE_KEY));
    console.log(`💀 KRONOS MEV STARTED`);
    console.log(`👤 Wallet: ${wallet.publicKey.toString().substring(0, 6)}...`);
    console.log(`👁️ Watching Raydium for "initialize2"...`);
} catch (e) { console.error("❌ KEY ERROR:", e.message); }

// --- 1. اسکنر ---
async function startKronos() {
    connection.onLogs(
        RAYDIUM_PROGRAM_ID,
        async ({ logs, err, signature }) => {
            if (err) return;
            
            // اینجا فقط دنبال "ساخت استخر جدید" هستیم
            if (logs.some(log => log.includes("initialize2"))) {
                console.log(`\n⚡ NEW POOL DETECTED: ${signature}`);
                console.log(`⏳ Analyzing Security...`);
                // تاخیر ریز برای ثبت شدن توکن در RugCheck
                setTimeout(() => processToken(signature), 3000);
            }
        },
        "processed"
    );
}

// --- 2. پردازش و امنیت ---
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
            checkSecurityAndBuy(tokenMint);
        }
    } catch (e) { console.log("Parse Error"); }
}

// --- 3. چک امنیتی و خرید ---
async function checkSecurityAndBuy(mint) {
    try {
        // چک کردن با RugCheck
        const res = await axios.get(`https://api.rugcheck.xyz/v1/tokens/${mint}/report/summary`);
        const data = res.data;

        if (!data) {
            console.log(`⚠️ No Data for ${mint} (Skipping)`);
            return;
        }

        const risks = data.risks || [];
        // فیلترهای مرگبار
        const isMintable = risks.some(r => r.name === 'Mint Authority');
        const isFreezable = risks.some(r => r.name === 'Freeze Authority');
        const isUnLocked = risks.some(r => r.name === 'Liquidity Not Locked');

        // گزارش وضعیت (حتی اگر رد بشه)
        if (isMintable) {
            console.log(`🛑 REJECTED: ${mint} (Mint Authority Open)`);
            return;
        }
        if (isFreezable) {
            console.log(`🛑 REJECTED: ${mint} (Freeze Authority Open)`);
            return;
        }
        if (isUnLocked) {
            console.log(`🛑 REJECTED: ${mint} (LP Not Locked)`);
            return;
        }

        // اگر رسید اینجا یعنی امنه
        console.log(`✅ SAFE TOKEN FOUND: ${mint}`);
        console.log(`🚀 PREPARING JITO BUNDLE...`);
        
        executeSwap(mint);

    } catch (e) { 
        console.log(`⚠️ API Error checking ${mint}`); 
    }
}

// --- 4. ساخت و ارسال تراکنش خرید ---
async function executeSwap(tokenMint) {
    try {
        const response = await axios.get(`https://api.raydium.io/v2/sdk/liquidity/mainnet.json`);
        const poolList = [...response.data.official, ...response.data.unOfficial];
        const poolInfo = poolList.find(p => p.baseMint === tokenMint || p.quoteMint === tokenMint);

        if (!poolInfo) return console.log(`⏳ Pool info not ready yet...`);

        const amountIn = new TokenAmount(Token.WSOL, BUY_AMOUNT, false);
        const currencyOut = new Token(TOKEN_PROGRAM_ID, new PublicKey(tokenMint), poolInfo.baseDecimals);

        // ساخت دستور سواپ
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

        const { blockhash } = await connection.getLatestBlockhash();
        
        const messageV0 = new TransactionMessage({
            payerKey: wallet.publicKey,
            recentBlockhash: blockhash,
            instructions: [...swapIx, tipIx], 
        }).compileToV0Message();

        const transaction = new VersionedTransaction(messageV0);
        transaction.sign([wallet]);
        const serializedTx = bs58.encode(transaction.serialize());

        console.log("🚀 SENDING TO MINER...");
        const res = await axios.post(JITO_ENGINE, {
            jsonrpc: "2.0", id: 1, method: "sendBundle", params: [[serializedTx]]
        }, { headers: { 'Content-Type': 'application/json' } });

        console.log("✅ BUNDLE FIRED! ID:", res.data.result);

    } catch (e) {
        console.log("❌ Swap Failed:", e.message);
    }
}

// ضربان قلب
setInterval(() => console.log("💗 Pulse..."), 30000);
process.on('uncaughtException', (err) => {});

startKronos();
