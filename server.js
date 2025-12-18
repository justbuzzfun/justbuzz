const express = require('express');
const http = require('http');
const { Server } = require("socket.io");
const { Connection, PublicKey } = require('@solana/web3.js');
const axios = require('axios');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static('public'));

// --- ⚙️ تنظیمات (موتور Helius فعال شد) ---
const RPC_ENDPOINT = "https://mainnet.helius-rpc.com/?api-key=1779c0aa-451c-4dc3-89e2-96e62ca68484"; 
const RAYDIUM_PROGRAM_ID = new PublicKey("675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8");

const connection = new Connection(RPC_ENDPOINT, 'confirmed');

console.log("🔥 TITAN SNIPER: HELIUS ENGINE ACTIVATED...");
console.log("🛡️ SECURITY FILTERS: ON");

async function startSniper() {
    console.log("📡 Listening to Raydium Liquidity Pool V4...");
    
    // استفاده از WebSocket اختصاصی Helius
    connection.onLogs(
        RAYDIUM_PROGRAM_ID,
        async ({ logs, err, signature }) => {
            if (err) return;

            // تشخیص ساخت استخر جدید
            if (logs.some(log => log.includes("initialize2"))) {
                console.log(`\n⚡ FAST DETECT! Sig: ${signature}`);
                
                // صبر کوتاه برای ایندکس شدن تراکنش (چون سرعتت خیلی بالاست)
                setTimeout(() => extractAndCheck(signature), 2000);
            }
        },
        "processed"
    );
}

// استخراج آدرس و چک کردن امنیت
async function extractAndCheck(signature) {
    try {
        const tx = await connection.getParsedTransaction(signature, { maxSupportedTransactionVersion: 0 });
        if (!tx) return;

        const accountKeys = tx.transaction.message.accountKeys;
        
        for (const account of accountKeys) {
            const pubkey = account.pubkey.toString();
            if (!pubkey.startsWith("1111") && !pubkey.startsWith("So11") && !pubkey.startsWith("Rayd") && !pubkey.startsWith("Sys")) {
                checkSecurity(pubkey);
                break;
            }
        }
    } catch (e) {
        console.log("Parse Error (Normal for new tokens)", e.message);
    }
