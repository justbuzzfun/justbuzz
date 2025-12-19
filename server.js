const { 
    Connection, Keypair, PublicKey, Transaction, SystemProgram, 
    TransactionMessage, VersionedTransaction, LAMPORTS_PER_SOL 
} = require('@solana/web3.js');
const { 
    Liquidity, Token, TokenAmount, Percent, 
    TOKEN_PROGRAM_ID, SOL, LOOKUP_TABLE_CACHE 
} = require('@raydium-io/raydium-sdk');
const { getMint } = require('@solana/spl-token');
const axios = require('axios');
const bs58 = require('bs58');
const express = require('express');

// ======================================================
// ⚙️ تنظیماتِ جنگی (WAR CONFIG)
// ======================================================

// 1. کلید خصوصی کیف پول (با موجودی SOL)
const PRIVATE_KEY = "2oxLcQTzSSHkTC2bb2SrFuxyKmrip7YwKVUurZP6GLDhAaTC1gbMV8g3tWuqtX9uKFcxk56TNECuqstTzEpc5nUh"; 

// 2. لینک Helius (اختصاصی تو)
const RPC_ENDPOINT = "https://mainnet.helius-rpc.com/?api-key=1779c0aa-451c-4dc3-89e2-96e62ca68484";

// 3. تنظیمات خرید
const BUY_AMOUNT = 0.001; // مقدار خرید به سولانا (خیلی کم برای تست)
const JITO_TIP = 100000; // رشوه (0.0001 SOL)

// آدرس‌های ثابت
const JITO_ENGINE = "https://mainnet.block-engine.jito.wtf/api/v1/bundles";
const RAYDIUM_PROGRAM_ID = new PublicKey("675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8");
const JITO_TIPS = [ "96gYZGLnJFVFzxGpYNBSU05fT6EW7qZk4sL8383r", "Hf3aaHtS5259dwhF7e5rppQ4g8Q1vF8Zp5Q5z5s5" ];

const connection = new Connection(RPC_ENDPOINT, 'confirmed');
let wallet;

// سرور وب
const app = express();
app.get('/', (req, res) => res.send('💀 KRONOS REAL-MONEY ENGINE ACTIVE'));
app.listen(process.env.PORT || 3000);

// --- راه اندازی ---
try {
    if (PRIVATE_KEY.includes("YOUR_NEW")) throw new Error("Private Key Missing");
    wallet = Keypair.fromSecretKey(bs58.decode(PRIVATE_KEY));
    console.log(`💀 KRONOS MEV STARTED`);
    console.log(`👤 Wallet: ${wallet.publicKey.toString().substring(0, 6)}...`);
    console.log(`💰 Buy Size: ${BUY_AMOUNT} SOL`);
} catch (e) { console.error("❌ KEY ERROR:", e.message); }

// --- 1. اسکنر ---
async function startKronos() {
    console.log("👁️ Scanning for New Pools...");
    connection.onLogs(
        RAYDIUM_PROGRAM_ID,
        async ({ logs, err, signature }) => {
            if (err) return;
            if (logs.some(log => log.includes("initialize2"))) {
                console.log(`\n⚡ POOL FOUND: ${signature}`);
                processToken(signature);
            }
        },
        "processed"
    );
}

// --- 2. پردازش و امنیت ---
async function processToken(signature) {
    try {
        // کمی مکث برای ثبت شدن توکن در شبکه
        await new Promise(r => setTimeout(r, 2000));

        const tx = await connection.getParsedTransaction(signature, { maxSupportedTransactionVersion: 0 });
        if (!tx) return;

        const accountKeys = tx.transaction.message.accountKeys;
        let tokenMint = null;
        let poolId = null;

        // پیدا کردن آدرس توکن و استخر
        // (در تراکنش initialize2، معمولا اکانت چهارم یا پنجم آدرس توکنه)
        for (const account of accountKeys) {
            const pubkey = account.pubkey.toString();
            if (!pubkey.startsWith("1111") && !pubkey.startsWith("So11") && !pubkey.startsWith("Rayd") && !pubkey.startsWith("Sys")) {
                tokenMint = pubkey;
                // آدرس استخر هم معمولا توی لاگ‌ها یا Keys هست، اینجا برای سرعت، فرض میکنیم اولین آدرس غیرسیستمی توکنه
                // برای گرفتن Pool ID واقعی باید مارکت رو فچ کنیم که پایین انجام میدیم
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
        const mintInfo = await getMint(connection, new PublicKey(mint));
        
        // فیلتر: اگر قابلیت چاپ یا فریز باز باشه، نخر
        if (mintInfo.mintAuthority !== null || mintInfo.freezeAuthority !== null) {
            console.log(`🛑 UNSAFE TOKEN: ${mint}`);
            return;
        }

        console.log(`✅ SAFE TOKEN: ${mint}`);
        console.log(`🚀 PREPARING SWAP...`);
        
        // اجرای خرید
        executeSwap(mint);

    } catch (e) { console.log("Check Error"); }
}

// --- 4. ساخت و ارسال تراکنش خرید ---
async function executeSwap(tokenMint) {
    try {
        // دریافت اطلاعات استخر از API ری‌دیوم (برای ساخت تراکنش لازمه)
        // این بخش ممکنه برای توکن‌های خیلی جدید چند ثانیه تاخیر داشته باشه
        const response = await axios.get(`https://api.raydium.io/v2/sdk/liquidity/mainnet.json`);
        const poolList = [...response.data.official, ...response.data.unOfficial];
        const poolInfo = poolList.find(p => p.baseMint === tokenMint || p.quoteMint === tokenMint);

        if (!poolInfo) {
            console.log("⏳ Pool info not indexed yet...");
            return;
        }

        // محاسبه مقدار
        const amountIn = new TokenAmount(Token.WSOL, BUY_AMOUNT, false);
        const currencyOut = new Token(TOKEN_PROGRAM_ID, new PublicKey(tokenMint), poolInfo.baseDecimals);
        const slippage = new Percent(50, 100); // 50% Slippage (برای اینکه حتما بخره)

        // ساخت دستور سواپ
        const { innerTransactions } = await Liquidity.makeSwapInstructionSimple({
            connection,
            poolKeys: poolInfo,
            userKeys: {
                tokenAccounts: [], // برای SOL نیازی نیست
                owner: wallet.publicKey,
            },
            amountIn: amountIn,
            amountOut: new TokenAmount(currencyOut, 1, false), // حداقل 1 واحد
            fixedSide: 'in',
            makeTxVersion: 0,
        });

        const swapInstructions = innerTransactions[0].instructions;

        // ساخت دستور رشوه
        const tipAccount = new PublicKey(JITO_TIPS[Math.floor(Math.random() * JITO_TIPS.length)]);
        const tipIx = SystemProgram.transfer({
            fromPubkey: wallet.publicKey,
            toPubkey: tipAccount,
            lamports: JITO_TIP,
        });

        // بستن باندل
        const { blockhash } = await connection.getLatestBlockhash();
        
        const messageV0 = new TransactionMessage({
            payerKey: wallet.publicKey,
            recentBlockhash: blockhash,
            instructions: [
                ...swapInstructions, // دستورات خرید
                tipIx // دستور رشوه
            ], 
        }).compileToV0Message();

        const transaction = new VersionedTransaction(messageV0);
        transaction.sign([wallet]);
        const serializedTx = bs58.encode(transaction.serialize());

        // شلیک به Jito
        console.log("🚀 SENDING ATOMIC BUNDLE...");
        const payload = {
            jsonrpc: "2.0",
            id: 1,
            method: "sendBundle",
            params: [[serializedTx]]
        };

        const res = await axios.post(JITO_ENGINE, payload, { headers: { 'Content-Type': 'application/json' } });
        console.log("✅ BUNDLE SENT! ID:", res.data.result);

    } catch (e) {
        console.log("❌ Swap Failed:", e.message);
    }
}

process.on('uncaughtException', (err) => {});
startKronos();
