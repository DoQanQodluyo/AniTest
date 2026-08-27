// --- src/commands/yardim.js ---
const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const config = require('../../config.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('yardim')
        .setDescription('Botun tüm komutlarını ve web paneli bağlantısını gösterir.'),
    
    async execute(interaction, client) {
        const embed = new EmbedBuilder()
            .setTitle('📚 Sistem Komutları ve Yardım Menüsü')
            .setDescription('Aşağıda botun sunduğu temel özellikler kategorize edilmiştir.')
            .setColor('Blurple')
            .addFields(
                { name: '🛡️ Moderasyon ve Disiplin', value: '`/sicil` - Kullanıcı sicil sorgulama ve ekleme\n`/ban`, `/kick`, `/mute` - Temel moderasyon\n`/massban` - Toplu cezalandırma', inline: false },
                { name: '📊 İstatistik ve Analiz', value: '`/analiz` - Sunucu durum raporu ve gazete basımı\n`/istatistik` - Bireysel veya sunucu chat/ses istatistikleri', inline: false },
                { name: '📋 Görev ve Ekip', value: '`/gorev` - Haftalık görevlere katılma ve durum\n`/takim` - Ekip yönetimi ve puan durumu', inline: false },
                { name: '📜 Kural ve Anayasa', value: '`/kural` - Sunucu kurallarını görüntüleme ve düzenleme\n`/yasa` - Meclis yasa önergeleri', inline: false }
            )
            .setFooter({ text: 'Daha detaylı yönetim için Web Panelini kullanabilirsiniz.', iconURL: client.user.displayAvatarURL() })
            .setTimestamp();

        const dashboardUrl = config.DASHBOARD_URL || 'http://localhost:3000';

        const row = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setLabel('🌐 Web Dashboard Paneli')
                    .setStyle(ButtonStyle.Link)
                    .setURL(dashboardUrl)
            );

        await interaction.reply({ embeds: [embed], components: [row] });
    }
};
