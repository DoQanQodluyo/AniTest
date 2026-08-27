const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('croxydb');

const data = new SlashCommandBuilder()
    .setName('analiz')
    .setDescription('Sunucu ve kullanıcı analizini görüntüler');

module.exports = {
    name: 'analiz',
    data: data.toJSON(),
    description: 'Sunucu ve kullanıcı analizini görüntüler',
    async execute(message, args, client) {
        const istatistikCmd = client.commands.get('istatistik');
        if (istatistikCmd?.execute) {
            return istatistikCmd.execute(message, args, client);
        }
        return message.reply({ content: '📊 İstatistik paneline yönlendiriliyorsunuz...' });
    }
};
