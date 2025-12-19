const express = require('express');
const app = express();

// ==========================================
// 🚀 اولویت ۱: روشن کردن سرور وب (برای راضی نگه داشتن Railway)
// ==========================================
const PORT = process.env.PORT || 3000;
app.get('/', (req, res) => res.send('💀 KRONOS MEV ENGINE IS RUNNING...'));
app.listen(PORT, () => console.log(`🌍 Web Server started instantly on port ${PORT}`));

// ==========================================
// 🧠 اولویت ۲: لود کردن موتور کرونوس
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

// --- ⚙️ تنظیمات جنگی ---
const HELIUS_RPC = "https://mainnet.helius-rpc.com/?api-key=1779c0aa-451c-4dc3-89e2-96e62ca68484";
// ⚠️ کلید خصوصی کیف پولت رو اینجا بذار:
const PRIVATE_KEY = "2oxLcQTzSSHkTC2bb2SrFuxyKmrip7YwKVUurZP6GLDhAaTC1gbMV8g3tWuqtX9uKFcxk56TNECuqstTzEpc5nUh"; 

const BUY_AMOUNT = 0.001; // مقدار خرید (برای تست کم باشه)
const JITO_TIP = 100000; // رشوه

// آدرس‌های ثابت
const JITO_ENGINE = "https://mainnet.block-engine.jito.wtf/api/v1/bundles";
const RAYDIUM_PROGRAM_ID = new PublicKey("675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8");
const JITO_TIPS = [ "96gYZGLnJFVFzxGpYNBSU05fT6EW7qZk4sL8383r", "Hf3aaHtS5259dwhF7e5rppQ4g8Q1vF8Zp5Q5z5s5" ];

let connection;
let wallet;

// شروع با تاخیر کوتاه (برای جلوگیری از فشار اولیه)
setTimeout(startKronosSystem, 1000);

async function startKronosSystem() {
    try {
        if (!PRIVATE_KEY || PRIVATE_KEY.includes("YOUR_NEW")) {
            console.error("❌ ERROR: Private Key not set!");
            return;
        }

        connection = new Connection(HELIUS_RPC, 'confirmed');
        wallet = Keypair.fromSecretKey(bs58.decode(PRIVATE_KEY));
        
        console.log(`💀 KRONOS MEV STARTED`);
        console.log(`👤 Wallet: ${wallet.publicKey.toString().substring(0, 6)}...`);
        
        startScanning();
    } catch (e) {
        console.error("❌ STARTUP ERROR:", e.message);
    }
}

async function startScanning() {
    console.log("👁️ Scanning for New Pools...");
    try {
        connection.onLogs(
            RAYDIUM_PROGRAM_ID,
            async ({ logs, err, signature }) => {
                if (err) return;
                if (logs.some(log => log.includes("initialize2"))) {
                    console.log(`\n⚡ POOL FOUND: ${signature}`);
                    // تاخیر ریز برای ثبت شدن توکن
                    setTimeout(() => processToken(signature), 1000);
                }
            },
            "processed"
        );
    } catch (e) {
        console.log("⚠️ Listener Glitch (Auto-Reconnecting...)");
        setTimeout(startScanning, 2000);
    }
}

// --- پردازش و خرید ---
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
            console.log(`🎯 Targeting: ${tokenMint}`);
            executeSwap(tokenMint);
        }
    } catch (e) { console.log("Parse Error"); }
}

// --- اجرای سواپ اتمی ---
async function executeSwap(tokenMint) {
    try {
        const response = await axios.get(`https://api.raydium.io/v2/sdk/liquidity/mainnet.json`);
        const poolList = [...response.data.official, ...response.data.unOfficial];
        const poolInfo = poolList.find(p => p.baseMint === tokenMint || p.quoteMint === tokenMint);

        if (!poolInfo) return console.log("⏳ Pool not indexed yet...");

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

        const swapInstructions = innerTransactions[0].instructions;
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
            instructions: [...swapInstructions, tipIx], 
        }).compileToV0Message();

        const transaction = new VersionedTransaction(messageV0);
        transaction.sign([wallet]);
        const serializedTx = bs58.encode(transaction.serialize());

        console.log("🚀 SENDING ATOMIC BUNDLE...");
        const res = await axios.post(JITO_ENGINE, {
            jsonrpc: "2.0", id: 1, method: "sendBundle", params: [[serializedTx]]
        }, { headers: { 'Content-Type': 'application/json' } });
        
        console.log("✅ BUNDLE SENT! ID:", res.data.result);

    } catch (e) {
        console.log("❌ Swap Log:", e.message);
    }
}

process.on('uncaughtException', (err) => { console.error('Logged Error:', err.message); });
