const { SlashCommandBuilder } = require('discord.js');
const { gorevDurumu, gorevEmbed } = require('../utils/taskHub');

module.exports = {
    name: 'gorevler',
    data: new SlashCommandBuilder().setName('gorevler').setDescription('Haftalık görevlerini ve ilerlemeni gösterir.'),
    aliases: ['gorev-listesi'], description: 'Kullanıcının restart-proof haftalık görev durumunu gösterir.', usage: '/gorevler', category: 'Görev Sistemi',
    async execute(message) {
        return message.reply({ embeds: [gorevEmbed(message.member, gorevDurumu(message.author.id))] });
    }
};
