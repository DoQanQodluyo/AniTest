const db = require('croxydb');
const { rolleriGeriYukle, modlogGonder, qdb } = require('../utils/moderationGuard');

module.exports = {
    name: 'guildMemberAdd',
    async execute(member) {
        if (!member) return;
        const bugunStr = new Date().toISOString().split('T')[0];
        db.add(`gazete_joins_${bugunStr}`, 1);

        // Yeni gelen üye profili ve rollerinin quick.db'ye anında yazılması
        const roles = member.roles.cache.filter(r => r.id !== member.guild.id).map(r => ({ id: r.id, name: r.name }));
        const userData = {
            userId: member.id,
            tag: member.user.tag || member.user.username,
            displayName: member.displayName,
            joinedAt: member.joinedTimestamp || Date.now(),
            roles,
            lastSeen: Date.now()
        };
        await qdb.set(`member_profile_${member.id}`, userData);

        const modlogKanalId = await qdb.get('modlog_kanal') || member.client.config?.RAPOR_KANAL_ID || member.client.config?.BAN_LOG_KANAL_ID;
        if (modlogKanalId) {
            const modlogKanal = member.guild.channels.cache.get(modlogKanalId) || await member.guild.channels.fetch(modlogKanalId).catch(() => null);
            if (modlogKanal?.isTextBased()) {
                await modlogKanal.send({
                    embeds: [{
                        title: '👤 Yeni Üye Katıldı ve Profili Kaydedildi',
                        color: 0x2ec4b6,
                        fields: [
                            { name: 'Kullanıcı', value: `<@${member.id}> (${member.user.tag || member.id})`, inline: true },
                            { name: 'Roller', value: `${roles.length} rol`, inline: true }
                        ],
                        timestamp: new Date().toISOString()
                    }]
                }).catch(() => null);
            }
        }

        // İtiraz onaylanmış ancak kullanıcı sunucuda yokken bekleyen rol geri yükleme
        const kayit = (await qdb.get(`ban_${member.id}`)) ?? (await qdb.get(`kick_${member.id}`));
        if (kayit && kayit.durum === 'onaylandi_bekliyor') {
            const sonuc = await rolleriGeriYukle(member.guild, member.id);
            if (sonuc.basarili) {
                let aciklama = `Sunucuya tekrar katılan <@${member.id}> üyesine **${sonuc.eklenen}** adet eski rolü otomatik geri verildi.`;
                if (sonuc.basarisizRoller?.length) {
                    aciklama += `\n⚠️ Yetki yetersizliği veya silinme sebebiyle eklenemeyen roller: ${sonuc.basarisizRoller.join(', ')}`;
                }
                await modlogGonder(member.guild, member.client, {
                    islem: 'Otomatik Rol Geri Yükleme',
                    hedef: member.user,
                    yetkili: { id: member.client.user.id, username: 'Otomatik Sistem' },
                    sebep: aciklama
                });

                // Rol geri yüklendikten sonra yetkili ise takımına da geri ekle
                await takimGeriEkle(member, kayit, modlogKanalId, member.client);
            }
        }
    }
};

/**
 * Banlı yetkili döndüğünde takımına geri ekler.
 */
async function takimGeriEkle(member, kayit, modlogKanalId, client) {
    try {
        const config = member.client.config || require('../../config.js');
        const izinliRoller = [
            ...(Array.isArray(config.YETKILI_ROL_IDLERI) ? config.YETKILI_ROL_IDLERI : []),
            ...(Array.isArray(config.STAFF_ROLES) ? config.STAFF_ROLES : [])
        ];

        // Geri yüklenen rollerden yetkili rolü içeriyor mu?
        const rolSnap = kayit.roller || [];
        const yetkiliRolVarMi = rolSnap.some(rolId => izinliRoller.includes(rolId));
        if (!yetkiliRolVarMi) return;

        // Takım üyesi listesinde zaten var mı?
        const takim = await qdb.get(`takim_uyeler_${member.guild.id}`) || [];
        if (takim.includes(member.id)) return;

        takim.push(member.id);
        await qdb.set(`takim_uyeler_${member.guild.id}`, takim);

        if (modlogKanalId) {
            const kanal = member.guild.channels.cache.get(modlogKanalId) || await member.guild.channels.fetch(modlogKanalId).catch(() => null);
            await kanal?.send({
                embeds: [{
                    title: '🛡️ Yetkili Takımına Geri Eklendi',
                    color: 0x3a86ff,
                    description: `<@${member.id}> itirazı kabul edilerek döndü ve **yetkili takımına** kaldığı yerden geri eklendi.`,
                    timestamp: new Date().toISOString()
                }]
            }).catch(() => null);
        }
    } catch (err) {
        console.error('[TakımGeriEkle Hata]', err.message);
    }
}
