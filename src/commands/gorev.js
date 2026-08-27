const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const db = require('croxydb');

const data = new SlashCommandBuilder()
    .setName('gorev')
    .setDescription('Görev yönetimi, katılım, durum ve görevli listesi paneli');

function gorevPaneliOlustur(user, guild) {
    const userId = user.id;
    const isMemberInDuty = db.get(`gorevli_${userId}`) || false;
    const progress = db.get(`gorev_puan_${userId}`) || 0;

    const embed = new EmbedBuilder()
        .setTitle('🎯 Görev Yönetim ve Takip Merkezi')
        .setColor(isMemberInDuty ? 'Green' : 'Blue')
        .setDescription(`Hoş geldin <@${userId}>!\nAşağıdaki butonları kullanarak göreve katılabilir, aktif durumunu sorgulayabilir veya görevli listesini inceleyebilirsin.`)
        .addFields(
            { name: '📌 Görev Durumunuz', value: isMemberInDuty ? '🟢 **Aktif Görevde**' : '🔴 **Görevde Değil**', inline: true },
            { name: '⭐ Toplanan Görev Puanı', value: `**${progress}** Puan`, inline: true }
        )
        .setFooter({ text: 'AniTest Görev Sistem Paneli' })
        .setTimestamp();

    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId('btn_gorev_katil')
            .setLabel('Göreve Katıl')
            .setStyle(ButtonStyle.Success)
            .setDisabled(isMemberInDuty),
        new ButtonBuilder()
            .setCustomId('btn_gorev_ayril')
            .setLabel('Görevden Ayrıl')
            .setStyle(ButtonStyle.Danger)
            .setDisabled(!isMemberInDuty),
        new ButtonBuilder()
            .setCustomId('btn_gorev_durum')
            .setLabel('Görevlerim ve İlerleme')
            .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
            .setCustomId('btn_gorev_liste')
            .setLabel('Görevli Listesi')
            .setStyle(ButtonStyle.Secondary)
    );

    return { embeds: [embed], components: [row] };
}

module.exports = {
    name: 'gorev',
    data: data.toJSON(),
    description: 'Görev yönetimi paneli',
    gorevPaneliOlustur,
    async execute(message, args, client) {
        const user = message.author || message.user;
        const guild = message.guild;
        const payload = gorevPaneliOlustur(user, guild);
        return message.reply(payload);
    }
};
