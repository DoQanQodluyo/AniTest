// --- src/dashboard/auth.js ---
const express = require('express');
const { PermissionFlagsBits } = require('discord.js');

function createAuthRouter(client) {
    const router = express.Router();
    const config = client.config;
    
    // Configuration Validation Guard
    const CLIENT_ID = config.CLIENT_ID;
    const CLIENT_SECRET = config.CLIENT_SECRET;
    const REDIRECT_URI = config.REDIRECT_URI || 'http://78.154.103.8:16362/auth/callback';

    if (!CLIENT_ID || !CLIENT_SECRET || CLIENT_ID === 'PLACEHOLDER' || CLIENT_SECRET === 'PLACEHOLDER') {
        console.error('🔴 [CRITICAL WARNING] Dashboard başlatılamıyor: config.CLIENT_ID veya config.CLIENT_SECRET eksik/hatalı. Lütfen .env dosyanızı kontrol edin.');
    }

    router.get('/login', (req, res) => {
        if (!CLIENT_ID) return res.status(500).send('OAuth2 yapılandırılmamış. config.CLIENT_ID eksik.');
        const authUrl = `https://discord.com/api/oauth2/authorize?client_id=${CLIENT_ID}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&response_type=code&scope=identify%20guilds.members.read`;
        res.redirect(authUrl);
    });

    router.get('/callback', async (req, res) => {
        const { code } = req.query;
        if (!code) {
            return res.redirect('/auth/login');
        }

        try {
            // 1. Token Takası - Basic Auth ve RFC-6749 uyumluluğu ile
            const credentials = Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64');
            const tokenResponse = await fetch('https://discord.com/api/v10/oauth2/token', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'Authorization': `Basic ${credentials}`
                },
                body: new URLSearchParams({
                    grant_type: 'authorization_code',
                    code: code,
                    redirect_uri: REDIRECT_URI
                }).toString()
            });

            if (!tokenResponse.ok) {
                const errorText = await tokenResponse.text();
                console.error('[OAuth2 Auth Exchange Failed]: Status:', tokenResponse.status, 'Payload:', errorText);

                // Code reuse veya geçersiz kod durumlarında kullanıcıyı temizce login'e yönlendir
                if (tokenResponse.status === 400) {
                    return res.redirect('/auth/login');
                }

                return res.status(tokenResponse.status).send(`
                    <div style="font-family: sans-serif; padding: 2rem;">
                        <h2 style="color: red;">Giriş Başarısız Oldu</h2>
                        <p>OAuth2 Token takası reddedildi (Durum: ${tokenResponse.status}).</p>
                        <p><strong>Lütfen şunları kontrol edin:</strong></p>
                        <ul>
                            <li><code>CLIENT_SECRET</code> doğruluğu</li>
                            <li><code>REDIRECT_URI</code> (Örn: <code>${REDIRECT_URI}</code>) adresinin Discord Developer portalındaki yönlendirme adresi ile birebir eşleştiğinden emin olun.</li>
                        </ul>
                        <p><a href="/auth/login" style="color: #4f46e5; font-weight: bold;">Tekrar Giriş Yap</a></p>
                    </div>
                `);
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
                const errorText = await userResponse.text();
                console.error('[OAuth2 User Fetch Failed]: Status:', userResponse.status, 'Payload:', errorText);
                return res.redirect('/auth/login');
            }
            
            const userData = await userResponse.json();
            const userId = userData.id;
            const username = userData.username;
            const avatar = userData.avatar 
                ? `https://cdn.discordapp.com/avatars/${userId}/${userData.avatar}.png` 
                : 'https://cdn.discordapp.com/embed/avatars/0.png';

            // 3. Sunucu Üyesi (Guild Member) Fetch & Tip-Güvenli Yetki Çözümlemesi
            const guildId = config.GUILD_ID;
            let isAdmin = false;
            let isStaff = false;

            const guild = client.guilds.cache.get(guildId) || await client.guilds.fetch(guildId).catch(() => null);
            if (guild) {
                const member = await guild.members.fetch(userId).catch(() => null);
                
                // Safe helper to normalize staff roles regardless of data type
                const staffRoleIds = Array.isArray(config.YETKILI_ROL_IDLERI)
                    ? config.YETKILI_ROL_IDLERI
                    : (typeof config.YETKILI_ROL_IDLERI === 'string' 
                        ? config.YETKILI_ROL_IDLERI.split(',').map(r => r.trim()).filter(Boolean) 
                        : []);

                isStaff = member ? staffRoleIds.some(roleId => member.roles.cache.has(roleId)) : false;

                const hasAdminPerm = member && (
                    member.permissions.has(PermissionFlagsBits.Administrator) ||
                    member.permissions.has('Administrator')
                );

                isAdmin = userIsOwner(userId, config) || hasAdminPerm || isStaff;
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
                maxAge: 7 * 24 * 60 * 60 * 1000 // 7 gün TTL
            });

            // 5. Ana Sayfaya Yönlendir
            res.redirect('/');
        } catch (error) {
            console.error('🔴 [Dashboard OAuth2] İç Sunucu Hatası:', error);
            res.status(500).send('<h2 style="color:red;font-family:sans-serif;padding:2rem;">Giriş sırasında sunucu içi bir hata oluştu. Lütfen bot loglarını kontrol edin.</h2>');
        }
    });

    router.get('/logout', (req, res) => {
        res.clearCookie('session_token');
        res.redirect('/auth/login');
    });

    return { authRouter: router };
}

function userIsOwner(userId, config) {
    const ownerId = config.BOT_OWNER_ID || config.SAHIP_ID;
    return userId === ownerId;
}

module.exports = createAuthRouter;
