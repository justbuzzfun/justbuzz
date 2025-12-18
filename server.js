const TelegramBot = require('node-telegram-bot-api');
const { Connection, PublicKey } = require('@solana/web3.js');
const axios = require('axios');
const express = require('express');

const TELEGRAM_TOKEN = "8596274256:AAHvtmJHhBG7evC3Errp20ZcxUxP-tfQ-g0";
const MY_CHAT_ID = "61848555";
const HELIUS_RPC = "https://mainnet.helius-rpc.com/?api-key=1779c0aa-451c-4dc3-89e2-96e62ca68484";
const RAYDIUM_PROGRAM_ID = "675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8";

const bot = new TelegramBot(TELEGRAM_TOKEN, { polling: true });
const connection = new Connection(HELIUS_RPC, 'confirmed');
const app = express();

app.get('/', (req, res) => res.send('TEST MODE ACTIVE'));
app.listen(process.env.PORT || 3000);

console.log("TEST MODE STARTED: SHOWING ALL TOKENS...");
bot.sendMessage(MY_CHAT_ID, "⚠️ **TEST MODE ON**\nSending ALL tokens (Safe & Unsafe)...");

async function startSniper() {
    const publicKey = new PublicKey(RAYDIUM_PROGRAM_ID);
    connection.onLogs(
        publicKey,
        async ({ logs, err, signature }) => {
            if (err) return;
            if (logs.some(log => log.includes("initialize2"))) {
                // بدون هیچ معطلی و فیلتری بفرست
                sendRawAlert(signature);
            }
        },
        "processed"
    );
}

async function sendRawAlert(signature) {
    // تلاش برای پیدا کردن آدرس توکن (سریع)
    try {
        const tx = await connection.getParsedTransaction(signature, { maxSupportedTransactionVersion: 0 });
        if (!tx) return;
        const accountKeys = tx.transaction.message.accountKeys;
        for (const account of accountKeys) {
            const pubkey = account.pubkey.toString();
            if (!pubkey.startsWith("1111") && !pubkey.startsWith("So11") && !pubkey.startsWith("Rayd") && !pubkey.startsWith("Sys") && !pubkey.startsWith("Token")) {
                
                const photonLink = `https://photon-sol.tinyastro.io/en/lp/${pubkey}`;
                bot.sendMessage(MY_CHAT_ID, `🧪 **NEW TOKEN DETECTED!**\n\nCA: \`${pubkey}\`\n\n[Check on Photon](${photonLink})`, { parse_mode: 'Markdown', disable_web_page_preview: true });
                break;
            }
        }
    } catch(e) {}
}

process.on('uncaughtException', (err) => { console.log('Error:', err.message); });
startSniper();
