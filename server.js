const { Connection, PublicKey } = require('@solana/web3.js');
const express = require('express');

// ==========================================
// ⚙️ تنظیمات اتصال (فیکس شده)
// ==========================================
const HELIUS_KEY = "1779c0aa-451c-4dc3-89e2-96e62ca68484";

// جدا کردن آدرس ارسال (HTTP) و آدرس شنود (WSS)
const HTTP_URL = `https://mainnet.helius-rpc.com/?api-key=${HELIUS_KEY}`;
const WSS_URL = `wss://mainnet.helius-rpc.com/?api-key=${HELIUS_KEY}`;

const RAYDIUM_PROGRAM_ID = new PublicKey("675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8");

// سرور وب برای زنده ماندن
const app = express();
app.get('/', (req, res) => res.send('🩺 DIAGNOSTIC MODE: WSS FORCED'));
app.listen(process.env.PORT || 3000);

console.log("🩺 STARTING DIAGNOSTIC MODE...");
console.log(`🔗 HTTP: ${HTTP_URL.substring(0, 20)}...`);
console.log(`🔗 WSS:  ${WSS_URL.substring(0, 20)}...`);

// تنظیمات اتصال با وب‌سوکت اجباری
const connection = new Connection(HTTP_URL, {
    wsEndpoint: WSS_URL,
    commitment: 'processed' // سریع‌ترین حالت
});

// --- 1. تست ضربان قلب (هر ۱۰ ثانیه) ---
setInterval(async () => {
    try {
        const slot = await connection.getSlot();
        console.log(`💗 System Pulse | Slot: ${slot} (Connection OK)`);
    } catch (e) {
        console.error("⚠️ Connection Error:", e.message);
    }
}, 10000);

// --- 2. شنود مطلق (بدون فیلتر) ---
async function startListening() {
    console.log("📡 Subscribing to Raydium Events...");
    
    try {
        connection.onLogs(
            RAYDIUM_PROGRAM_ID,
            (logs) => {
                if (logs.err) return;

                // هر چیزی که از Raydium میاد رو نشون بده (فقط برای اینکه ببینیم وصله)
                console.log(`📨 Log: ${logs.signature.substring(0,10)}...`);

                // اگه توکن جدید بود، جیغ بزن
                if (logs.logs.some(l => l.includes("initialize2"))) {
                    console.log(`🔥🔥🔥 NEW POOL FOUND: ${logs.signature}`);
                }
            },
            "processed"
        );
        console.log("✅ WebSocket Subscription Sent.");
    } catch (e) {
        console.error("❌ Subscription Failed:", e.message);
    }
}

// جلوگیری از کرش
process.on('uncaughtException', (err) => { console.log('Error:', err.message); });

startListening();
