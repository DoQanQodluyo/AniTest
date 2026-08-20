const { EmbedBuilder, SlashCommandBuilder } = require('discord.js');

module.exports = {
    name: 'istatistik-embed',
    data: new SlashCommandBuilder()
        .setName('istatistik-embed')
        .setDescription('Bir kullanıcının detaylı istatistik kartını gösterir.')
        .addUserOption(option => option
            .setName('kullanici')
            .setDescription('İstatistikleri gösterilecek kullanıcı.')
            .setRequired(false)),
    aliases: ['istatistik-kart', 'istatistikdetay', 'stat-kart'],
    description: 'Belirtilen kullanıcının detaylı partner ve mesaj istatistiklerini gösterir.',
    usage: '/istatistik-embed [kullanici]',
    category: 'Genel',
    execute(message, args, client, db) {
        const targetUser = message.mentions.users.first() || message.author;
        
        // Veritabanından veriyi çek
        const partnerData = db.get(`partnerData_${targetUser.id}`);
        const userMsgStats = db.get(`stat_${message.guild.id}_${targetUser.id}`) || 0;

        if (!partnerData) {
            return message.reply(`❌ **${targetUser.username}** kullanıcısına ait kayıtlı bir partner/sayaç verisi bulunamadı.`);
        }

        const embed = new EmbedBuilder()
            .setTitle(`📊 ${targetUser.username} - Detaylı İstatistik Kartı`)
            .setColor('Blurple')
            .setThumbnail(targetUser.displayAvatarURL({ dynamic: true }))
            .addFields(
                { name: '🏆 Partner Sıralaması', value: `\`#${partnerData.siralama}\``, inline: true },
                { name: '💬 Aktif Chat Puanı', value: `\`${userMsgStats} Mesaj\``, inline: true },
                { name: '\u200B', value: '\u200B', inline: false }, // Boşluk
                { name: '📅 Günlük Partner', value: `\`${partnerData.gunluk}\``, inline: true },
                { name: '📆 Haftalık Partner', value: `\`${partnerData.haftalik}\``, inline: true },
                { name: '🗓️ Aylık Partner', value: `\`${partnerData.aylik}\``, inline: true },
                { name: '🚀 Toplam Partner', value: `**\`${partnerData.toplam}\`**`, inline: false }
            )
            .setFooter({ text: 'Oto-Sicil & Partner Takip Sistemi', iconURL: client.user.displayAvatarURL() })
            .setTimestamp();

        message.channel.send({ embeds: [embed] });
    }
};