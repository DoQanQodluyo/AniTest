// --- src/dashboard/auth.js ---
const express = require('express');
const crypto = require('crypto');

function createAuthRouter(client) {
    const router = express.Router();
    
    const COOKIE_SECRET = process.env.COOKIE_SECRET || crypto.randomBytes(32).toString('hex');
    const CLIENT_ID = client.config.CLIENT_ID || client.user.id;
    const CLIENT_SECRET = client.config.CLIENT_SECRET;
    const REDIRECT_URI = client.config.REDIRECT_URI || 'http://localhost:3000/auth/callback';

    if (!CLIENT_SECRET) {
        console.error('⚠️ [Dashboard] CLIENT_SECRET config dosyasında bulunamadı! OAuth2 çalışmayabilir.');
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
                const errBody = await tokenResponse.text();
                console.error('🔴 [OAuth2 Error Details]:', errBody);
                throw new Error(`Token hatası: ${tokenResponse.status}`);
            }
            
            const tokenData = await tokenResponse.json();
            const { access_token } = tokenData;

            // 2. Kullanıcı Bilgilerini Çek (@me)
            const userResponse = await fetch('https://discord.com/api/v10/users/@me', {
                headers: {
                    Authorization: `Bearer ${access_token}`
                }
            });

            if (!userResponse.ok) {
                const errBody = await userResponse.text();
                console.error('🔴 [OAuth2 Error Details - User Fetch]:', errBody);
                throw new Error('Kullanıcı bilgileri alınamadı.');
            }
            
            const userData = await userResponse.json();
            const userId = userData.id;
            const username = userData.username;
            const avatar = userData.avatar 
                ? `https://cdn.discordapp.com/avatars/${userId}/${userData.avatar}.png` 
                : 'https://cdn.discordapp.com/embed/avatars/0.png';

            // 3. Sunucu Üyesi (Guild Member) Fetch
            const guildId = client.config.GUILD_ID;
            const guild = client.guilds.cache.get(guildId) || await client.guilds.fetch(guildId).catch(() => null);
            
            let isAdmin = false;
            let isStaff = false;

            if (guild) {
                try {
                    const member = await guild.members.fetch(userId);
                    
                    const BOT_OWNER_ID = client.config.BOT_OWNER_ID || client.config.SAHIP_ID;
                    const YETKILI_ROL_IDLERI = client.config.YETKILI_ROL_IDLERI ? client.config.YETKILI_ROL_IDLERI.split(',') : [];
                    const STAFF_ROLES = client.config.STAFF_ROLES ? client.config.STAFF_ROLES.split(',') : [];

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
                } catch (memberErr) {
                    console.error('⚠️ [Dashboard OAuth2] Üye fetch hatası (Kullanıcı sunucuda olmayabilir veya önbellek hatası):', memberErr.message);
                    isAdmin = false;
                    isStaff = false;
                }
            } else {
                console.error('⚠️ [Dashboard OAuth2] Ana sunucu bulunamadı.');
            }

            // 4. Çerez Kaydı
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
                maxAge: 7 * 24 * 60 * 60 * 1000 // 7 gün
            });

            // 5. Ana Sayfaya Yönlendir
            res.redirect('/');
        } catch (error) {
            console.error('🔴 [Dashboard OAuth2] Hata:', error);
            res.status(500).send('Giriş başarısız oldu. Lütfen yetkiliye bildirin.');
        }
    });

    router.get('/logout', (req, res) => {
        res.clearCookie('session_token');
        res.redirect('/auth/login');
    });

    return { authRouter: router, COOKIE_SECRET };
}

module.exports = createAuthRouter;
