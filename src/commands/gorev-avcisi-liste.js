const { EmbedBuilder, SlashCommandBuilder } = require('discord.js');

module.exports = {
    name: 'gorev-avcisi-liste',
    data: new SlashCommandBuilder().setName('gorev-avcisi-liste').setDescription('Görev rolüne sahip üyeleri listeler.'),
    aliases: ['gorev-uyeleri'], description: 'Görev rolüne katılmış üyeleri listeler.', usage: '/gorev-avcisi-liste', category: 'Görev Sistemi',
    async execute(message, args, client) {
        const rol = client.config.GOREV_ROLU_ID && message.guild.roles.cache.get(client.config.GOREV_ROLU_ID);
        if (!rol) return message.reply('Görev rolü yapılandırılmamış.');
        const uyeler = [...rol.members.values()];
        const liste = uyeler.length ? uyeler.map((uye, index) => `**${index + 1}.** <@${uye.id}>`).join('\n') : 'Görev rolüne sahip üye yok.';
        const embed = new EmbedBuilder().setTitle('🎯 Görev Avcıları').setColor('Purple').setDescription(liste).setFooter({ text: `Toplam: ${uyeler.length}` }).setTimestamp();
        return message.reply({ embeds: [embed] });
    }
};
