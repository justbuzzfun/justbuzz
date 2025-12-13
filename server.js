const express = require('express');
const http = require('http');
const { Server } = require("socket.io");
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, 'public')));

let totalBuzzes = 0;

io.on('connection', (socket) => {
  io.emit('update-stats', { online: io.engine.clientsCount, buzzes: totalBuzzes });

  socket.on('buzz-trigger', () => {
    totalBuzzes++;
    io.emit('shake-world'); // دستور لرزش برای همه
    io.emit('update-stats', { online: io.engine.clientsCount, buzzes: totalBuzzes });
  });

  socket.on('disconnect', () => {
    io.emit('update-stats', { online: io.engine.clientsCount, buzzes: totalBuzzes });
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
