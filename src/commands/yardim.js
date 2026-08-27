// --- src/commands/yardim.js ---
const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const path = require('path');
const config = require(path.join(__dirname, '../../config.js'));

module.exports = {
    data: new SlashCommandBuilder()
        .setName('yardim')
        .setDescription('Botun tüm komutlarını ve sistem bağlantılarını listeler'),
    
    async execute(interaction, client) {
        const embed = new EmbedBuilder()
            .setTitle('📚 AniBot v2 • Komut ve Sistem Kılavuzu')
            .setDescription('Sunucumuzun tüm yönetim, istatistik, görev ve adalet mekanizmaları aşağıda listelenmiştir.')
            .setColor('#5865F2')
            .addFields(
                {
                    name: '🛡️ Yönetim & Moderasyon',
                    value: '• `/duyuru` - Gelişmiş rol etiketli duyuru yayınlar\n• `/sicil` - Kullanıcı sicil sorgulama, ceza ekleme ve temizleme\n• `/kriz` - Acil durum modu ve yavaş mod kontrolleri\n• `/ban`, `/kick`, `/mute` - Temel ve toplu yaptırımlar',
                    inline: false
                },
                {
                    name: '📊 Analiz & İstatistik',
                    value: '• `/analiz` - Canlı sunucu durumu, RAM yükü ve bot sağlığı\n• `/analiz gazete` - Haftalık otomatik/manuel gazete basımı\n• `/analiz snipe` - Kanaldaki son silinen mesajı yakalar\n• `/istatistik` - Ses ve metin aktivite dökümleri',
                    inline: false
                },
                {
                    name: '📋 Görev & Takım Masası',
                    value: '• `/gorev` - Etkileşimli butonlu haftalık görev paneli\n• `/takim` - Ekip liderliği, puan durumu ve iş bölümü\n• `/tesekkur` - Topluluk içi Kudos teşekkür puanı verme',
                    inline: false
                },
                {
                    name: '⚖️ Anayasa & Kural Kitapçığı',
                    value: '• `/kural kitapcik` - Resmi sunucu kurallarını listeler\n• `/kural ekle / sil` - Kuralları otomatik ID indeksleme ile yönetir\n• `/yasa` - Meclis yasa tasarıları ve oylama sistemi',
                    inline: false
                }
            )
            .setFooter({ 
                text: 'Canlı veriler ve grafikler için Web Dashboard panelini ziyaret edin.', 
                iconURL: client.user.displayAvatarURL() 
            })
            .setTimestamp();

        const dashboardUrl = config.DASHBOARD_URL || 'http://78.154.103.8:16362';

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
