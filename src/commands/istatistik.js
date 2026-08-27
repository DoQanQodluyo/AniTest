const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('croxydb');

const data = new SlashCommandBuilder()
    .setName('istatistik')
    .setDescription('Sunucu ve kullanıcı genel istatistiklerini görüntüler')
    .addSubcommand(sub =>
        sub.setName('genel')
            .setDescription('Sunucu genel istatistiklerini ve aktivite özetini görüntüler')
    )
    .addSubcommand(sub =>
        sub.setName('kullanici')
            .setDescription('Kullanıcının aktivite verilerini görüntüler')
            .addUserOption(opt => opt.setName('kullanici').setDescription('Hedef kullanıcı').setRequired(false))
    );

module.exports = {
    name: 'istatistik',
    data: data.toJSON(),
    description: 'Sunucu ve kullanıcı genel istatistiklerini görüntüler',
    async execute(message, args, client) {
        const options = message.slashOptions || message.options;
        const altKomut = options?.getSubcommand?.() || args[0] || 'genel';
        const guild = message.guild;
        const user = message.author || message.user;

        if (altKomut === 'genel') {
            const allData = db.all() || {};
            let toplamMesaj = 0;
            let toplamUye = 0;
            for (const key in allData) {
                if (key.startsWith(`chat_7d_${guild.id}_`)) toplamMesaj += allData[key] || 0;
            }
            try { toplamUye = (await guild.members.fetch()).size; } catch { toplamUye = guild.memberCount || 0; }

            const embed = new EmbedBuilder()
                .setTitle(`📊 ${guild.name} — Sunucu İstatistik Paneli`)
                .setColor('Blue')
                .addFields(
                    { name: '👥 Toplam Üye', value: `**${toplamUye}**`, inline: true },
                    { name: '💬 Son 7 Günlük Mesaj', value: `**${toplamMesaj}**`, inline: true }
                )
                .setFooter({ text: 'AniTest İstatistik Sistemi' })
                .setTimestamp();

            return message.reply({ embeds: [embed] });
        }

        if (altKomut === 'kullanici') {
            const targetUser = options?.getUser?.('kullanici') || user;
            const msgCount = db.get(`chat_7d_${guild.id}_${targetUser.id}`) || 0;
            const voiceMs = db.get(`voice_7d_${guild.id}_${targetUser.id}`) || 0;
            const voiceMin = Math.floor(voiceMs / 60000);
            const kudos = db.get(`kudos_${targetUser.id}`) || 0;

            const embed = new EmbedBuilder()
                .setTitle(`👤 Kullanıcı Analizi: ${targetUser.tag || targetUser.username}`)
                .setColor('Blue')
                .setThumbnail(targetUser.displayAvatarURL?.({ extension: 'png' }) || null)
                .addFields(
                    { name: '💬 Son 7 Günlük Mesaj', value: `**${msgCount}** mesaj`, inline: true },
                    { name: '🔊 Son 7 Günlük Ses', value: `**${voiceMin}** dakika`, inline: true },
                    { name: '👏 Kudos Puanı', value: `**${kudos}**`, inline: true }
                )
                .setTimestamp();

            return message.reply({ embeds: [embed] });
        }

        return message.reply({ content: '❌ Geçersiz alt komut.', flags: 64 });
    }
};
