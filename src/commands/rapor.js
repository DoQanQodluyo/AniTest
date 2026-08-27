const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const db = require('croxydb');
const config = require('../../config.js');

function yetkiliKontrolEt(member, user) {
    if (!member && !user) return false;
    const userId = user?.id || member?.id;
    if (userId === config.BOT_OWNER_ID || userId === config.SAHIP_ID) return true;
    if (member?.permissions?.has(PermissionFlagsBits.Administrator)) return true;

    const izinliRoller = Array.isArray(config.YETKILI_ROL_IDLERI) ? config.YETKILI_ROL_IDLERI : [];
    if (member?.roles?.cache) {
        return member.roles.cache.some(role => izinliRoller.includes(role.id));
    }
    return false;
}

const data = new SlashCommandBuilder()
    .setName('rapor')
    .setDescription('Yetkilinin faaliyet ve performans raporunu görüntüler')
    .addUserOption(opt => opt.setName('kullanici').setDescription('Hedef yetkili (Varsayılan: Siz)').setRequired(false));

module.exports = {
    name: 'rapor',
    data: data.toJSON(),
    description: 'Yetkilinin faaliyet ve performans raporunu görüntüler',
    async execute(message, args, client) {
        const options = message.slashOptions || message.options;
        const member = message.member;
        const user = message.author || message.user;

        if (!yetkiliKontrolEt(member, user)) {
            return message.reply({ content: '❌ Bu komutu kullanmak için yetkili olmalısınız.', flags: 64 });
        }

        const targetUser = options?.getUser?.('kullanici') || user;
        const msgCount = db.get(`chat_7d_${message.guild.id}_${targetUser.id}`) || 0;
        const voiceMs = db.get(`voice_7d_${message.guild.id}_${targetUser.id}`) || 0;
        const voiceMin = Math.floor(voiceMs / 60000);
        const partnerData = db.get(`partnerData_${targetUser.id}`) || {};
        const partnerSayi = partnerData.haftalik || 0;
        const uyarilar = db.get(`lider_uyari_${targetUser.id}`) || [];
        const vardiyaDurumu = db.get(`vardiya_aktif_${targetUser.id}`) ? '🟢 Vardiyada' : '🔴 Vardiyada Değil';

        const embed = new EmbedBuilder()
            .setTitle(`📊 Yetkili Faaliyet Raporu: ${targetUser.tag || targetUser.username}`)
            .setColor('Gold')
            .setThumbnail(targetUser.displayAvatarURL?.({ extension: 'png' }) || null)
            .addFields(
                { name: '💬 Son 7 Günlük Mesaj', value: `**${msgCount}** mesaj`, inline: true },
                { name: '🔊 Ses Süresi', value: `**${voiceMin}** dakika`, inline: true },
                { name: '🤝 Partner Sayısı', value: `**${partnerSayi}**`, inline: true },
                { name: '⚠️ Uyarı Sayısı', value: `**${uyarilar.length}**`, inline: true },
                { name: '📌 Vardiya Durumu', value: vardiyaDurumu, inline: true }
            )
            .setFooter({ text: 'AniTest Yetkili Rapor Sistemi' })
            .setTimestamp();

        return message.reply({ embeds: [embed] });
    }
};
