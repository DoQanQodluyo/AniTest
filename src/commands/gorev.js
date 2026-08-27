// --- src/commands/gorev.js ---
const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const db = require('croxydb');
const config = require('../../config.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('gorev')
        .setDescription('Haftalık görev sistemine katılır, ayrılır veya durumunuzu görüntülersiniz.'),

    async execute(interaction, client) {
        const embed = new EmbedBuilder()
            .setTitle('🎯 Haftalık Görev Sistemi')
            .setDescription('Sunucuda aktif kalarak haftalık görevleri tamamlayın ve ödüller kazanın!\nAşağıdaki butonları kullanarak sisteme dahil olabilir veya durumunuzu kontrol edebilirsiniz.')
            .setColor('Green')
            .setFooter({ text: 'Görevler her hafta sıfırlanır.' })
            .setTimestamp();

        const row = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('gorev_katil')
                    .setLabel('Göreve Katıl')
                    .setStyle(ButtonStyle.Success)
                    .setEmoji('✅'),
                new ButtonBuilder()
                    .setCustomId('gorev_ayril')
                    .setLabel('Görevden Ayrıl')
                    .setStyle(ButtonStyle.Danger)
                    .setEmoji('❌'),
                new ButtonBuilder()
                    .setCustomId('gorev_durum')
                    .setLabel('Görev Durumum')
                    .setStyle(ButtonStyle.Primary)
                    .setEmoji('📊'),
                new ButtonBuilder()
                    .setCustomId('gorev_liste')
                    .setLabel('Sıralama (Top 10)')
                    .setStyle(ButtonStyle.Secondary)
                    .setEmoji('🏆')
            );

        // Not: Butonların çalışabilmesi için `interactionCreate` event'inde (örn. etkilesim.js) bu Custom ID'lerin dinlenmesi gerekir.
        // `db.set('gorev_' + userId, { ilerleme: 0, hedef: 10, tamamlandi: false })` şeklinde veri tutulmalıdır.

        await interaction.reply({ embeds: [embed], components: [row] });
    }
};
