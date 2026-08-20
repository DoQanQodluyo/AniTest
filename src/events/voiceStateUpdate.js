const db = require('croxydb');
const { trafikArtir } = require('../utils/trafficAnalyzer');
const { gorevIlerlemesi } = require('../utils/taskHub');

module.exports = {
    name: 'voiceStateUpdate',
    async execute(oldState, newState, client) {
        const member = newState.member || oldState.member;
        if (!member || member.user.bot) return;

        const guildId = (newState.guild || oldState.guild).id;
        const userId = member.id;
        const now = Date.now();

        if (!oldState.channelId && newState.channelId) {
            trafikArtir('ses', guildId, 1, new Date(), newState.channelId);
        }

        // 1. Durum: Kullanıcı Sese Katıldı (Önceden seste değildi, şimdi bir kanalda)
        if (!oldState.channelId && newState.channelId) {
            db.set(`voiceStart_${guildId}_${userId}`, now);
        }

        // 2. Durum: Kullanıcı Ses Kanalından Ayrıldı (Önceden sesteydi, şimdi değil)
        else if (oldState.channelId && !newState.channelId) {
            const joinTime = db.get(`voiceStart_${guildId}_${userId}`);
            if (joinTime) {
                const duration = now - joinTime; // Milisaniye cinsinden fark
                if (duration >= 5 * 60 * 1000) {
                    db.add(`voice_7d_${guildId}_${userId}`, duration);
                    db.add(`voice_24h_${guildId}_${userId}`, duration);
                }
                if (duration >= 5 * 60 * 1000 && client.config.GOREV_ROLU_ID && member.roles.cache.has(client.config.GOREV_ROLU_ID)) {
                    gorevIlerlemesi(userId, 'ses');
                }
                db.delete(`voiceStart_${guildId}_${userId}`); // Kaydı temizle
            }
        }

        // 3. Durum: Kanal Değiştirdi (A kanalından B kanalına geçti)
        else if (oldState.channelId && newState.channelId && oldState.channelId !== newState.channelId) {
            const joinTime = db.get(`voiceStart_${guildId}_${userId}`);
            if (joinTime) {
                const duration = now - joinTime;
                if (duration >= 5 * 60 * 1000) db.add(`voice_7d_${guildId}_${userId}`, duration);
            }
            // Yeni kanal için süreyi sıfırdan tekrar başlat
            db.set(`voiceStart_${guildId}_${userId}`, now);
        }
    }
};