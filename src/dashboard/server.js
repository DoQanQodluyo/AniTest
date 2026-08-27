// --- src/dashboard/server.js ---
const express = require('express');
const cookieParser = require('cookie-parser');
const path = require('path');
const createAuthRouter = require('./auth');
const createApiRouter = require('./routes');

function startDashboard(client) {
    const app = express();
    const config = client.config;
    const PORT = parseInt(process.env.PORT || process.env.SERVER_PORT || config.PORT || 16362, 10);

    // Body parser & JSON
    app.use(express.json());
    app.use(express.urlencoded({ extended: true }));

    // Auth & Cookie Config
    const { authRouter } = createAuthRouter(client);
    app.use(cookieParser(config.COOKIE_SECRET || 'anibot_secure_session_token_2026'));

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

    // Sunucuyu Başlat - 0.0.0.0 Host Binding (Pterodactyl / Docker Bridge Uyumluluğu)
    app.listen(PORT, '0.0.0.0', () => {
        const dashUrl = config.DASHBOARD_URL || `http://78.154.103.8:${PORT}`;
        console.log(`🌐 [Dashboard] Aktif: ${dashUrl} (Host: 0.0.0.0, Port: ${PORT})`);
    }).on('error', (err) => {
        console.error('🔴 [Dashboard] Sunucu başlatılamadı:', err.message);
    });
}

module.exports = { startDashboard };
