const db = require('croxydb');

async function fetchPastWeekStats(guild) {
    if (!guild) return { success: false, reason: 'Sunucu nesnesi bulunamadı.' };

    const now = Date.now();
    const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;

    console.log(`🔎 [AuditFetcher] ${guild.name} sunucusu için son 7 günün verileri Discord API üzerinden taranıyor...`);

    const textChannels = guild.channels.cache.filter(c => 
        c.isTextBased() && !c.isThread() && c.messages?.fetch
    );

    let totalFetchedMessages = 0;

    for (const channel of textChannels.values()) {
        let lastId = null;
        let keepFetching = true;

        while (keepFetching) {
            const fetchOptions = { limit: 100 };
            if (lastId) fetchOptions.before = lastId;

            const messages = await channel.messages.fetch(fetchOptions).catch(() => null);
            if (!messages || messages.size === 0) break;

            for (const msg of messages.values()) {
                if (msg.createdTimestamp < sevenDaysAgo) {
                    keepFetching = false;
                    break;
                }
                if (msg.author?.bot) continue;

                const dateStr = new Date(msg.createdTimestamp).toISOString().split('T')[0];
                const userId = msg.author.id;
                const channelId = channel.id;

                db.add(`gazete_msg_${dateStr}`, 1);
                db.add(`gazete_user_msg_${dateStr}_${userId}`, 1);
                db.add(`gazete_channel_msg_${dateStr}_${channelId}`, 1);
                totalFetchedMessages++;
            }

            lastId = messages.last()?.id;
            if (messages.size < 100) break;
        }
    }

    try {
        const auditLogs = await guild.fetchAuditLogs({ limit: 100 }).catch(() => null);
        if (auditLogs) {
            for (const entry of auditLogs.entries.values()) {
                if (entry.createdTimestamp >= sevenDaysAgo) {
                    const dateStr = new Date(entry.createdTimestamp).toISOString().split('T')[0];
                    db.add(`gazete_audit_${dateStr}`, 1);
                }
            }
        }
    } catch (e) {}

    console.log(`✅ [AuditFetcher] Tarama tamamlandı. Toplam ${totalFetchedMessages} geçmiş mesaj DB'ye stoklandı.`);
    return { success: true, totalMessages: totalFetchedMessages };
}

function cleanExpiredStats() {
    console.log('🧹 [Auto-Cleanup] 7 günü geçen eski istatistik verileri temizleniyor...');
    const now = Date.now();
    const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;
    const allData = db.all() || {};

    let cleanedCount = 0;
    for (const key in allData) {
        const match = key.match(/^gazete_(?:msg|user_msg|channel_msg|joins|audit)_(\d{4}-\d{2}-\d{2})/);
        if (match) {
            const keyDate = new Date(match[1]).getTime();
            if (keyDate < sevenDaysAgo) {
                db.delete(key);
                cleanedCount++;
            }
        }
    }
    console.log(`✅ [Auto-Cleanup] ${cleanedCount} eski veritabanı kaydı temizlendi.`);
    return cleanedCount;
}

module.exports = { fetchPastWeekStats, cleanExpiredStats };
