// --- src/dashboard/auth.js ---
const express = require('express');
const crypto = require('crypto');

function createAuthRouter(client) {
    const router = express.Router();
    
    // Güvenlik anahtarı: Çerezleri imzalamak için (üretim ortamında .env'den alınmalıdır, şimdilik rastgele veya config'den)
    const COOKIE_SECRET = process.env.COOKIE_SECRET || crypto.randomBytes(32).toString('hex');
    const CLIENT_ID = process.env.CLIENT_ID || client.user.id;
    const CLIENT_SECRET = process.env.CLIENT_SECRET;
    const REDIRECT_URI = process.env.REDIRECT_URI || 'http://localhost:3000/auth/callback';

    if (!CLIENT_SECRET) {
        console.error('⚠️ [Dashboard] CLIENT_SECRET .env dosyasında bulunamadı! OAuth2 çalışmayabilir.');
    }

    router.get('/login', (req, res) => {
        const authUrl = `https://discord.com/api/oauth2/authorize?client_id=${CLIENT_ID}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&response_type=code&scope=identify%20guilds.members.read`;
        res.redirect(authUrl);
    });

    router.get('/callback', async (req, res) => {
        const { code } = req.query;
        if (!code) return res.status(400).send('Kod eksik.');

        try {
            // 1. Token Takası
            const tokenResponse = await fetch('https://discord.com/api/v10/oauth2/token', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded'
                },
                body: new URLSearchParams({
                    client_id: CLIENT_ID,
                    client_secret: CLIENT_SECRET,
                    grant_type: 'authorization_code',
                    code: code,
                    redirect_uri: REDIRECT_URI
                }).toString()
            });

            if (!tokenResponse.ok) {
                const err = await tokenResponse.text();
                throw new Error(`Token hatası: ${err}`);
            }
            
            const tokenData = await tokenResponse.json();
            const { access_token } = tokenData;

            // 2. Kullanıcı Bilgilerini Çek (@me)
            const userResponse = await fetch('https://discord.com/api/v10/users/@me', {
                headers: {
                    Authorization: `Bearer ${access_token}`
                }
            });

            if (!userResponse.ok) throw new Error('Kullanıcı bilgileri alınamadı.');
            const userData = await userResponse.json();
            const userId = userData.id;
            const username = userData.username;
            const avatar = userData.avatar 
                ? `https://cdn.discordapp.com/avatars/${userId}/${userData.avatar}.png` 
                : 'https://cdn.discordapp.com/embed/avatars/0.png';

            // 3. Sunucu Üyesi (Guild Member) Fetch
            const guildId = client.config.GUILD_ID;
            const guild = client.guilds.cache.get(guildId) || await client.guilds.fetch(guildId).catch(() => null);
            
            if (!guild) {
                return res.status(500).send('Ana sunucu bulunamadı.');
            }

            const member = await guild.members.fetch(userId).catch(() => null);
            if (!member) {
                return res.status(403).send('Bu panele erişmek için sunucuda üye olmalısınız.');
            }

            // 4. Yetki & Rol Kontrolü
            const BOT_OWNER_ID = client.config.BOT_OWNER_ID || client.config.SAHIP_ID;
            const YETKILI_ROL_IDLERI = client.config.YETKILI_ROL_IDLERI || [];
            const STAFF_ROLES = client.config.STAFF_ROLES || [];

            let isAdmin = false;
            let isStaff = false;

            if (userId === BOT_OWNER_ID || member.permissions.has('Administrator')) {
                isAdmin = true;
                isStaff = true;
            }

            for (const roleId of YETKILI_ROL_IDLERI) {
                if (member.roles.cache.has(roleId)) {
                    isAdmin = true;
                    isStaff = true;
                    break;
                }
            }

            for (const roleId of STAFF_ROLES) {
                if (member.roles.cache.has(roleId)) {
                    isStaff = true;
                    break;
                }
            }

            // 5. Çerez Kaydı
            const sessionPayload = {
                userId,
                username,
                avatar,
                isAdmin,
                isStaff
            };

            res.cookie('session_token', sessionPayload, {
                httpOnly: true,
                signed: true,
                maxAge: 1000 * 60 * 60 * 24 * 7 // 7 gün
            });

            // 6. Ana Sayfaya Yönlendir
            res.redirect('/');
        } catch (error) {
            console.error('🔴 [Dashboard OAuth2] Hata:', error);
            res.status(500).send('Giriş başarısız oldu. Lütfen tekrar deneyin.');
        }
    });

    router.get('/logout', (req, res) => {
        res.clearCookie('session_token');
        res.redirect('/auth/login');
    });

    return { authRouter: router, COOKIE_SECRET };
}

module.exports = createAuthRouter;
