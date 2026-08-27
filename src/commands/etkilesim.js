const { SlashCommandBuilder } = require('discord.js');

const data = new SlashCommandBuilder()
    .setName('etkilesim')
    .setDescription('Etkileşim komutları paneline yönlendirir');

module.exports = {
    name: 'etkilesim',
    data: data.toJSON(),
    description: 'Etkileşim komutları paneline yönlendirir',
    async execute(message, args, client) {
        const yardimCmd = client.commands.get('yardim');
        if (yardimCmd?.execute) {
            return yardimCmd.execute(message, args, client);
        }
        return message.reply({ content: '🤝 Etkileşim için `/oneri`, `/tesekkur`, `/zaman-kapsulu` veya `/yardim` komutlarını kullanabilirsiniz.' });
    }
};
