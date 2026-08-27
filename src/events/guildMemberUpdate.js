const { qdb } = require('../utils/moderationGuard');

module.exports = {
    name: 'guildMemberUpdate',
    async execute(oldMember, newMember) {
        if (!newMember || newMember.user.bot) return;

        const oldRoles = oldMember.roles.cache.filter(r => r.id !== newMember.guild.id).map(r => r.id).sort().join(',');
        const newRoles = newMember.roles.cache.filter(r => r.id !== newMember.guild.id).map(r => r.id).sort().join(',');

        if (oldRoles === newRoles && oldMember.displayName === newMember.displayName) return;

        const roles = newMember.roles.cache.filter(r => r.id !== newMember.guild.id).map(r => ({ id: r.id, name: r.name }));
        const userData = {
            userId: newMember.id,
            tag: newMember.user.tag || newMember.user.username,
            displayName: newMember.displayName,
            joinedAt: newMember.joinedTimestamp || Date.now(),
            roles,
            lastSeen: Date.now()
        };

        await qdb.set(`member_profile_${newMember.id}`, userData);

        const modlogKanalId = await qdb.get('modlog_kanal') || newMember.client.config.RAPOR_KANAL_ID || newMember.client.config.BAN_LOG_KANAL_ID;
        if (modlogKanalId) {
            const modlogKanal = newMember.guild.channels.cache.get(modlogKanalId) || await newMember.guild.channels.fetch(modlogKanalId).catch(() => null);
            if (modlogKanal?.isTextBased()) {
                await modlogKanal.send({
                    embeds: [{
                        title: '🔄 Üye/Rol Güncellemesi Veritabanına Yazıldı',
                        color: 0x3a86ff,
                        fields: [
                            { name: 'Kullanıcı', value: `<@${newMember.id}> (${newMember.user.tag || newMember.id})`, inline: true },
                            { name: 'Güncel Rol Sayısı', value: `${roles.length}`, inline: true }
                        ],
                        timestamp: new Date().toISOString()
                    }]
                }).catch(() => null);
            }
        }
    }
};
