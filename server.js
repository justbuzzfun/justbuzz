const { Connection, PublicKey } = require('@solana/web3.js');
const express = require('express');

// --- تنظیمات ---
const HELIUS_RPC = "https://mainnet.helius-rpc.com/?api-key=1779c0aa-451c-4dc3-89e2-96e62ca68484";
const RAYDIUM_PROGRAM_ID = new PublicKey("675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8");

// سرور وب
const app = express();
app.get('/', (req, res) => res.send('👁️ DEBUG MODE ACTIVE'));
app.listen(process.env.PORT || 3000);

console.log("🛠️ DEBUG MODE STARTED: TESTING CONNECTION...");

// اتصال
const connection = new Connection(HELIUS_RPC, {
    wsEndpoint: HELIUS_RPC.replace('https', 'wss'), // اطمینان از سوکت
    commitment: 'processed'
});

async function startDebug() {
    try {
        const slot = await connection.getSlot();
        console.log(`✅ Connection OK | Current Slot: ${slot}`);
        
        console.log("🎧 Listening to ALL Raydium activity (No Filters)...");

        connection.onLogs(
            RAYDIUM_PROGRAM_ID,
            (info) => {
                // اینجا هر چیزی که اتفاق بیفته رو چاپ میکنیم
                // فقط برای اینکه ببینیم چشمش بازه یا نه
                if (Math.random() < 0.1) { // (فقط ۱۰ درصد رو نشون میدیم که لاگ نترکه)
                    console.log(`👀 I SEE ACTIVITY! Sig: ${info.signature.substring(0,10)}...`);
                    
                    if (info.logs.some(l => l.includes("initialize2"))) {
                        console.log(`🔥 BINGO! FOUND 'initialize2' HERE!`);
                    }
                }
            },
            "processed"
        );

    } catch (e) {
        console.error("❌ CONNECTION FAILED:", e.message);
    }
}

// ضربان قلب
setInterval(() => console.log("💗 Still Waiting..."), 10000);

startDebug();
