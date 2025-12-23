const express = require('express');
const path = require('path');
const app = express();

// تنظیم پوشه public برای نمایش فایل html
app.use(express.static(path.join(__dirname, 'public')));

// مسیر اصلی
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🔮 ORACLE IS LIVE on port ${PORT}`));
