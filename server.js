const express = require('express');
const http = require('http');
const { Server } = require("socket.io");
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, 'public')));

// --- FAKE DATA FOR VIRAL EFFECT ---
// شروع شمارنده از یک عدد بالا (برای اینکه سایت شلوغ به نظر بیاد)
let totalVisits = 1240; 
let totalBuzzes = 850;

io.on('connection', (socket) => {
  // هر کی وصل شد، یکی به آمار کل اضافه کن
  totalVisits++;
  
  // ارسال آمار به همه
  io.emit('update-stats', { 
    visits: totalVisits, 
    buzzes: totalBuzzes 
  });

  socket.on('buzz-trigger', () => {
    totalBuzzes++;
    io.emit('shake-world');
    io.emit('update-stats', { 
      visits: totalVisits, 
      buzzes: totalBuzzes 
    });
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
