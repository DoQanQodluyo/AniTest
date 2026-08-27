// --- src/dashboard/routes.js ---
const express = require('express');
const db = require('croxydb');

function createApiRouter(client) {
    const router = express.Router();
    
    // Auth Middleware: Her rotada çerez doğrulaması yapar
    router.use((req, res, next) => {
        const session = req.signedCookies.session_token;
        if (!session) {
            return res.status(401).json({ error: 'Yetkisiz erişim. Lütfen giriş yapın.' });
        }
        req.user = session;
        next();
    });

    // ==========================================
    // 1. ÜYE (MEMBER) ENDPOINTLERİ
    // ==========================================
    router.get('/user/profile', async (req, res) => {
        try {
            const { userId, username, avatar, isAdmin, isStaff } = req.user;
            const guildId = client.config.GUILD_ID;
            const guild = client.guilds.cache.get(guildId) || await client.guilds.fetch(guildId).catch(() => null);
            
            let roles = [];
            if (guild) {
                const member = await guild.members.fetch(userId).catch(() => null);
                if (member) {
                    roles = member.roles.cache.map(r => ({ id: r.id, name: r.name, color: r.hexColor }));
                }
            }

            // Görev durumu
            const gorevVerisi = db.get(`gorev_${userId}`) || { tamamlandi: false, ilerleme: 0, hedef: 10 };
            
            // Teşekkür (Kudos) puanı hesaplama
            const kudosHistory = db.get(`kudos_history_${guildId}`) || [];
            const kudosPuan = kudosHistory.filter(k => k.receiverId === userId).length;

            // Chart.js için son 7 günlük sahte veya gerçek mesaj/ses aktivite verisi
            // Not: croxydb'den haftalık veri çekilecek (chat_7d_{guildId}_{userId})
            const gunlukAktivite = db.get(`chat_gunluk_${guildId}_${userId}`) || [0, 0, 0, 0, 0, 0, 0];
            const sesAktivite = db.get(`voice_gunluk_${guildId}_${userId}`) || [0, 0, 0, 0, 0, 0, 0];

            res.json({
                profile: { userId, username, avatar, isAdmin, isStaff, roles },
                stats: {
                    gorev: gorevVerisi,
                    kudos: kudosPuan,
                    chart: {
                        labels: ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'],
                        mesajVerisi: gunlukAktivite,
                        sesVerisi: sesAktivite.map(ms => Math.floor((ms || 0) / 60000)) // Dakikaya çevir
                    }
                }
            });
        } catch (error) {
            console.error('🔴 [API Profile] Hata:', error);
            res.status(500).json({ error: 'Profil verileri alınırken hata oluştu.' });
        }
    });

    // ==========================================
    // 2. YÖNETİCİ (ADMIN) ENDPOINTLERİ
    // ==========================================
    
    // Admin yetki kontrolü middleware'i
    const adminOnly = (req, res, next) => {
        if (!req.user.isAdmin) {
            return res.status(403).json({ error: 'Bu işlem için yönetici yetkisine sahip olmalısınız.' });
        }
        next();
    };

    router.get('/admin/overview', adminOnly, (req, res) => {
        const ramUsageMB = (process.memoryUsage().rss / 1024 / 1024).toFixed(2);
        const uptimeSeconds = process.uptime();
        const uptimeHours = (uptimeSeconds / 3600).toFixed(2);
        
        const guildId = client.config.GUILD_ID;
        const guild = client.guilds.cache.get(guildId);
        const totalMembers = guild ? guild.memberCount : 0;
        const ping = client.ws.ping;

        res.json({
            ram: ramUsageMB,
            uptime: uptimeHours,
            members: totalMembers,
            ping: ping
        });
    });

    router.get('/admin/channels', adminOnly, async (req, res) => {
        const guildId = client.config.GUILD_ID;
        const guild = client.guilds.cache.get(guildId) || await client.guilds.fetch(guildId).catch(() => null);
        
        if (!guild) return res.status(500).json({ error: 'Sunucu bulunamadı.' });

        const channels = guild.channels.cache
            .filter(c => c.isTextBased() || c.isVoiceBased())
            .map(c => ({ id: c.id, name: c.name, type: c.type }));

        const statChannels = db.get('stat_channels') || [];
        const krizChannels = db.get('kriz_channels') || [];
        const duyuruChannels = db.get('duyuru_channels') || [];

        res.json({
            channels,
            configs: { statChannels, krizChannels, duyuruChannels }
        });
    });

    router.post('/admin/channels/set', adminOnly, (req, res) => {
        const { channelId, type } = req.body;
        if (!channelId || !type) return res.status(400).json({ error: 'Eksik veri.' });

        const dbKey = `${type}_channels`;
        let list = db.get(dbKey) || [];
        
        if (list.includes(channelId)) {
            list = list.filter(id => id !== channelId); // Çıkar
        } else {
            list.push(channelId); // Ekle
        }

        db.set(dbKey, list);
        res.json({ success: true, message: `Kanal konfigürasyonu güncellendi.`, list });
    });

    router.get('/admin/sicil/:targetUserId', adminOnly, (req, res) => {
        const { targetUserId } = req.params;
        const sicilKayitlari = db.get(`sicil_${targetUserId}`) || [];
        res.json({ sicil: sicilKayitlari });
    });

    router.post('/admin/sicil/add', adminOnly, (req, res) => {
        const { targetUserId, reason, penaltyType, adminTag } = req.body;
        if (!targetUserId || !reason || !penaltyType) return res.status(400).json({ error: 'Eksik veri.' });

        const sicilKayitlari = db.get(`sicil_${targetUserId}`) || [];
        const yeniKayit = {
            tarih: new Date().toISOString(),
            sebep: reason,
            ceza: penaltyType,
            yetkili: adminTag || req.user.username
        };

        sicilKayitlari.push(yeniKayit);
        db.set(`sicil_${targetUserId}`, sicilKayitlari);
        
        res.json({ success: true, sicil: sicilKayitlari });
    });

    router.post('/admin/team/leader', adminOnly, (req, res) => {
        const { teamName, leaderId, action } = req.body;
        if (!teamName || !leaderId || !action) return res.status(400).json({ error: 'Eksik veri.' });

        const teams = db.get('teams') || {};
        if (!teams[teamName]) {
            teams[teamName] = { leader: null, members: [] };
        }

        if (action === 'assign') {
            teams[teamName].leader = leaderId;
        } else if (action === 'remove') {
            teams[teamName].leader = null;
        }

        db.set('teams', teams);
        res.json({ success: true, teamName, leader: teams[teamName].leader });
    });

    return router;
}

module.exports = createApiRouter;
