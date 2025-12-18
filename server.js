const express = require('express');
const http = require('http');
const { Server } = require("socket.io");
const { Connection, PublicKey } = require('@solana/web3.js');

// تلاش برای لود کردن axios با مدیریت خطا
let axios;
try {
    axios = require('axios');
} catch (e) {
    console.error("❌ ERROR: 'axios' library is missing! Please update package.json");
}

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static('public'));

// --- تنظیمات ---
const RPC_ENDPOINT = "https://mainnet.helius-rpc.com/?api-key=1779c0aa-451c-4dc3-89e2-96e62ca68484"; 
const RAYDIUM_PROGRAM_ID = "675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8";

let connection;
let isConnected = false;

// --- جلوگیری از کرش کردن سرور ---
process.on('uncaughtException', (err) => {
    console.log('⚠️ Caught exception:', err.message);
    // سرور خاموش نمیشه
});

// --- تابع شروع با امنیت بالا ---
async function startSystem() {
    console.log("🚀 Starting Server...");
    
    try {
        connection = new Connection(RPC_ENDPOINT, 'confirmed');
        console.log("✅ Connected to Helius RPC");
        isConnected = true;
        
        startSniper();
        
    } catch (e) {
        console.log("❌ Connection Failed:", e.message);
        isConnected = false;
    }
}

async function startSniper() {
    if (!isConnected) return;
    
    console.log("📡 Listening to Raydium...");
    try {
        const publicKey = new PublicKey(RAYDIUM_PROGRAM_ID);
        
        connection.onLogs(
            publicKey,
            async ({ logs, err, signature }) => {
                if (err) return;
                
                // جستجو برای توکن جدید
                if (logs.some(log => log.includes("initialize2"))) {
                    console.log(`⚡ NEW POOL: ${signature}`);
                    // تاخیر برای اطمینان
                    setTimeout(() => checkSafety(signature), 2000);
                }
            },
            "processed"
        );
    } catch (e) {
        console.log("⚠️ Sniper Error:", e.message);
    }
}

async function checkSafety(signature) {
    if (!axios) return; // اگر کتابخانه نبود، ادامه نده

    try {
        const tx = await connection.getParsedTransaction(signature, { maxSupportedTransactionVersion: 0 });
        if (!tx) return;

        const accountKeys = tx.transaction.message.accountKeys;
        
        for (const account of accountKeys) {
            const pubkey = account.pubkey.toString();
            // فیلتر کردن آدرس‌های سیستمی
            if (!pubkey.startsWith("1111") && !pubkey.startsWith("So11") && !pubkey.startsWith("Rayd") && !pubkey.startsWith("Sys")) {
                
                // درخواست به RugCheck
                try {
                    const response = await axios.get(`https://api.rugcheck.xyz/v1/tokens/${pubkey}/report/summary`);
                    const data = response.data;
                    
                    if (data) {
                        const risks = data.risks || [];
                        const deadly = risks.filter(r => r.name === 'Mint Authority' || r.name === 'Freeze Authority' || r.name === 'Liquidity Not Locked');
                        
                        if (deadly.length === 0) {
                            io.emit('god-signal', {
                                address: pubkey,
                                score: 100,
                                mintAuth: "✅ Safe",
                                freezeAuth: "✅ Safe",
                                risks: "None"
                            });
                        }
                    }
                } catch (apiErr) {
                    // نادیده گرفتن خطای API
                }
                break;
            }
        }
    } catch (e) {
        console.log("Analysis Error (Ignored)");
    }
}

io.on('connection', (socket) => {
    socket.emit('status', { msg: isConnected ? "SYSTEM ONLINE (HELIUS)" : "RECONNECTING..." });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));

startSystem();
