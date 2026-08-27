const { qdb } = require('../utils/moderationGuard');
const { croxyToQuickMigration } = require('../utils/dbMigration');

async function syncAllMembersAndRoles(client, guild) {
    if (!guild) return;
    try {
        console.log(`🔄 [UyeSenkronizasyon] ${guild.name} üyeleri ve rolleri taranıyor...`);
        const members = await guild.members.fetch().catch(() => null);
        if (!members) return;

        const modlogKanalId = await qdb.get('modlog_kanal') || client.config.RAPOR_KANAL_ID || client.config.BAN_LOG_KANAL_ID;
        const modlogKanal = modlogKanalId ? (guild.channels.cache.get(modlogKanalId) || await guild.channels.fetch(modlogKanalId).catch(() => null)) : null;

        const now = Date.now();
        const fifteenDaysMs = 15 * 24 * 60 * 60 * 1000;
        let guncellenen = 0;
        let silinenEski = 0;

        for (const [id, member] of members) {
            if (member.user.bot) continue;

            const roles = member.roles.cache.filter(r => r.id !== guild.id).map(r => ({ id: r.id, name: r.name }));
            const userData = {
                userId: id,
                tag: member.user.tag || member.user.username,
                displayName: member.displayName,
                joinedAt: member.joinedTimestamp,
                roles,
                lastSeen: now
            };

            const prevData = await qdb.get(`member_profile_${id}`);
            await qdb.set(`member_profile_${id}`, userData);
            guncellenen++;

            // Veritabanına yazıldığı anda modlog kanalına bilgi yolla
            if (modlogKanal?.isTextBased()) {
                const isNew = !prevData;
                const embed = {
                    title: isNew ? '👤 Üye Veritabanına Kaydedildi' : '🔄 Üye/Rol Profili Güncellendi',
                    color: isNew ? 0x2ec4b6 : 0x3a86ff,
                    fields: [
                        { name: 'Kullanıcı', value: `<@${id}> (${member.user.tag || id})`, inline: true },
                        { name: 'Rol Sayısı', value: `${roles.length}`, inline: true },
                        { name: 'Katılma Tarihi', value: `<t:${Math.floor((member.joinedTimestamp || now) / 1000)}:R>`, inline: true }
                    ],
                    timestamp: new Date().toISOString()
                };
                await modlogKanal.send({ embeds: [embed] }).catch(() => null);
            }
        }

        // 15 günden fazladır sunucuda bulunmayan / pasif üyeleri veritabanından silme
        const allData = await qdb.all();
        if (Array.isArray(allData)) {
            for (const item of allData) {
                if (item.id.startsWith('member_profile_')) {
                    const userId = item.id.replace('member_profile_', '');
                    const isStillMember = members.has(userId);
                    const lastSeen = item.value?.lastSeen || item.value?.joinedAt || 0;

                    if (!isStillMember && (now - lastSeen > fifteenDaysMs)) {
                        await qdb.delete(item.id);
                        silinenEski++;
                    }
                }
            }
        }

        console.log(`✅ [UyeSenkronizasyon] ${guncellenen} üye güncellendi/kaydedildi, 15+ günlük ${silinenEski} eski kayıt temizlendi.`);
    } catch (err) {
        console.error(`❌ [UyeSenkronizasyon Hata]:`, err.message);
    }
}

module.exports = { syncAllMembersAndRoles, croxyToQuickMigration };
