const express = require('express');
const http = require('http');
const { Server } = require("socket.io");
const { Connection, PublicKey } = require('@solana/web3.js');
const { getMint } = require('@solana/spl-token');
const bs58 = require('bs58');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static('public'));

// --- ⚙️ تنظیمات (اینجا کلید جدیدت رو بذار) ---
// هشدار: کلید قبلی رو نذار! یه کیف پول جدید بساز.
const PRIVATE_KEY_STRING = "2oxLcQTzSSHkTC2bb2SrFuxyKmrip7YwKVUurZP6GLDhAaTC1gbMV8g3tWuqtX9uKFcxk56TNECuqstTzEpc5nUh"; 

// اتصال به شبکه (برای سرعت بالا، اکانت Helius بساز و لینکش رو اینجا بذار)
const RPC_ENDPOINT = "https://api.mainnet-beta.solana.com"; 
const RAYDIUM_PROGRAM_ID = new PublicKey("675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8");

const connection = new Connection(RPC_ENDPOINT, 'confirmed');

console.log("🔥 TITAN SNIPER: GOD MODE ACTIVATED...");
console.log("🛡️ SECURITY FILTERS: ON (Checking Mint/Freeze Authority)");

async function startSniper() {
    console.log("📡 Listening to Raydium Liquidity Pool V4...");
    
    connection.onLogs(
        RAYDIUM_PROGRAM_ID,
        async ({ logs, err, signature }) => {
            if (err) return;

            // تشخیص ساخت استخر جدید
            if (logs.some(log => log.includes("initialize2"))) {
                console.log(`\n🔎 NEW POOL DETECTED! Sig: ${signature}`);
                
                // تحلیل امنیتی توکن
                analyzeTransaction(signature);
            }
        },
        "processed"
    );
}

// --- 🛡️ تحلیل امنیتی (RUG CHECK) ---
async function analyzeTransaction(signature) {
    try {
        // دریافت جزئیات تراکنش
        const tx = await connection.getParsedTransaction(signature, { maxSupportedTransactionVersion: 0 });
        if (!tx) return;

        const accountKeys = tx.transaction.message.accountKeys;
        
        // پیدا کردن آدرس توکن جدید
        for (const account of accountKeys) {
            const pubkey = account.pubkey.toString();
            
            // فیلتر کردن آدرس‌های سیستمی
            if (!pubkey.startsWith("1111") && !pubkey.startsWith("So11") && !pubkey.startsWith("Rayd") && !pubkey.startsWith("Sys")) {
                
                try {
                    // گرفتن اطلاعات توکن
                    const mintInfo = await getMint(connection, new PublicKey(pubkey));
                    
                    // --- 👮‍♂️ بررسی امنیتی (GOD FILTER) ---
                    const isMintable = mintInfo.mintAuthority !== null;
                    const isFreezable = mintInfo.freezeAuthority !== null;
                    const supply = Number(mintInfo.supply) / (10 ** mintInfo.decimals);

                    let score = 100;
                    if (isMintable) score -= 50;
                    if (isFreezable) score -= 50;

                    const status = {
                        address: pubkey,
                        mintAuth: isMintable ? "⚠️ DANGER (Can Mint More)" : "✅ SAFE (Renounced)",
                        freezeAuth: isFreezable ? "⚠️ DANGER (Can Freeze)" : "✅ SAFE",
                        supply: supply.toLocaleString(),
                        score: score
                    };

                    // ارسال به داشبورد
                    io.emit('god-signal', status);
                    
                    console.log(`💎 ANALYZED: ${pubkey} | Score: ${score}`);

                    // اینجا میشه دستور خرید اتوماتیک رو گذاشت
                    // فعلاً فقط سیگنال میدیم که امن تره
                    break; 
                } catch (e) {
                    // این آدرس توکن نبود، ادامه بده
                }
            }
        }
    } catch (e) {
        console.log("Error analyzing:", e.message);
    }
}

io.on('connection', (socket) => {
    socket.emit('status', { msg: "TITAN ENGINE RUNNING..." });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));

startSniper();
