// --- src/dashboard/server.js ---
const express = require('express');
const cookieParser = require('cookie-parser');
const path = require('path');
const createAuthRouter = require('./auth');
const createApiRouter = require('./routes');

function startDashboard(client) {
    const app = express();
    const PORT = process.env.PORT || client.config.PORT || 3000;

    // Body parser & JSON
    app.use(express.json());
    app.use(express.urlencoded({ extended: true }));

    // Auth & Cookie Config
    const { authRouter, COOKIE_SECRET } = createAuthRouter(client);
    app.use(cookieParser(COOKIE_SECRET));

    // Mount Auth Router
    app.use('/auth', authRouter);

    // Kök Dizin Koruması: Ana sayfaya girişte çerez yoksa login'e yönlendir
    app.get('/', (req, res, next) => {
        if (!req.signedCookies.session_token) {
            return res.redirect('/auth/login');
        }
        next();
    });

    // Statik Dosyalar (SPA Frontend)
    app.use(express.static(path.join(__dirname, '../../public')));

    // Mount API Router
    const apiRouter = createApiRouter(client);
    app.use('/api', apiRouter);

    // 404 Handler
    app.use((req, res) => {
        res.status(404).send('Sayfa bulunamadı.');
    });

    // Global Error Handler (Botun çökmesini engeller)
    app.use((err, req, res, next) => {
        console.error('🔴 [Dashboard Hata]', err.stack);
        res.status(500).json({ error: 'Sunucu içinde bir hata oluştu.' });
    });

    // Sunucuyu Başlat
    app.listen(PORT, () => {
        console.log(`🌐 [Dashboard] Web paneli http://localhost:${PORT} üzerinde başlatıldı.`);
    }).on('error', (err) => {
        console.error('🔴 [Dashboard] Sunucu başlatılamadı:', err.message);
    });
}

module.exports = { startDashboard };
