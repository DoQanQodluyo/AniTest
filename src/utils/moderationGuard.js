const { EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const { QuickDB } = require('quick.db');
const qdb = new QuickDB();
const config = require('../../config.js');

function hiyerarsiUygunMu(yetkiliMember, hedefMember) {
    if (!hedefMember) return true; // Sunucuda değilse (unban vb.) hiyerarşi kontrolü atlanır
    if (hedefMember.id === yetkiliMember.guild.ownerId) return false;
    return yetkiliMember.roles.highest.position > hedefMember.roles.highest.position;
}

function adminMi(member, user) {
    if (!member && !user) return false;
    const userId = user?.id || member?.id;
    if (userId === config.BOT_OWNER_ID || userId === config.SAHIP_ID) return true;
    return Boolean(member?.permissions?.has(PermissionFlagsBits.Administrator));
}

function yetkiliKontrolEt(member, user) {
    if (!member && !user) return false;
    const userId = user?.id || member?.id;
    if (userId === config.BOT_OWNER_ID || userId === config.SAHIP_ID) return true;
    if (member?.permissions?.has(PermissionFlagsBits.Administrator) || member?.permissions?.has(PermissionFlagsBits.BanMembers)) return true;

    const izinliRoller = Array.isArray(config.YETKILI_ROL_IDLERI) && config.YETKILI_ROL_IDLERI.length
        ? config.YETKILI_ROL_IDLERI
        : (config.STAFF_ROLES || []);
    if (member?.roles?.cache) {
        return member.roles.cache.some(role => izinliRoller.includes(role.id));
    }
    return false;
}

async function modlogGonder(guild, client, { islem, hedef, yetkili, sebep, itirazDurumu }) {
    try {
        const kanalId = await qdb.get('modlog_kanal') || config.BAN_LOG_KANAL_ID || config.RAPOR_KANAL_ID;
        if (!kanalId) return;

        const kanal = guild.channels.cache.get(kanalId) || await guild.channels.fetch(kanalId).catch(() => null);
        if (!kanal?.isTextBased()) return;

        const embed = new EmbedBuilder()
            .setTitle(`🛡️ Moderasyon İşlemi: ${islem}`)
            .setColor(islem.includes('Ban') ? 'Red' : islem.includes('Kick') ? 'Orange' : 'Green')
            .addFields(
                { name: '👤 Hedef Kullanıcı', value: `${hedef.tag || hedef.username || 'Bilinmiyor'} (${hedef.id})`, inline: true },
                { name: '👮 Yetkili', value: `${yetkili.tag || yetkili.username || 'Bilinmiyor'} (${yetkili.id})`, inline: true },
                { name: '💬 Sebep', value: sebep || 'Belirtilmedi', inline: false },
                { name: '📅 Tarih', value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: true }
            )
            .setTimestamp();

        if (itirazDurumu) {
            embed.addFields({ name: '⚖️ İtiraz Durumu', value: itirazDurumu, inline: true });
        }

        await kanal.send({ embeds: [embed] }).catch(() => null);
    } catch (err) {
        console.error('[Modlog] Hata:', err.message);
    }
}

async function rolleriGeriYukle(guild, hedefId) {
    const kayit = (await qdb.get(`ban_${hedefId}`)) ?? (await qdb.get(`kick_${hedefId}`));
    if (!kayit || !kayit.roller?.length) return { basarili: true, eklenen: 0, basarisizRoller: [] };

    const member = await guild.members.fetch(hedefId).catch(() => null);
    if (!member) return { basarili: false, beklemede: true, eklenen: 0, basarisizRoller: [] };

    let eklenen = 0;
    const basarisizRoller = [];
    for (const rolId of kayit.roller) {
        const rol = guild.roles.cache.get(rolId);
        if (!rol) continue; // Rol silinmiş
        if (member.roles.cache.has(rolId)) continue;
        try {
            await member.roles.add(rolId);
            eklenen++;
        } catch (err) {
            basarisizRoller.push(rol.name || rolId);
        }
    }
    await qdb.set(`ban_${hedefId}`, { ...kayit, durum: 'roller_geri_yuklendi' });
    await qdb.set(`kick_${hedefId}`, { ...kayit, durum: 'roller_geri_yuklendi' });
    return { basarili: true, eklenen, basarisizRoller };
}

module.exports = {
    hiyerarsiUygunMu,
    yetkiliKontrolEt,
    adminMi,
    modlogGonder,
    rolleriGeriYukle,
    qdb
};
