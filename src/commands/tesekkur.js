const { SlashCommandBuilder } = require('discord.js');
const db = require('croxydb');

const data = new SlashCommandBuilder()
    .setName('tesekkur')
    .setDescription('Bir kullanıcıya teşekkür eder (Kudos puanı kazandırır)')
    .addUserOption(opt => opt.setName('kullanici').setDescription('Teşekkür edilecek üye').setRequired(true))
    .addStringOption(opt => opt.setName('sebep').setDescription('Teşekkür sebebi').setRequired(true));

module.exports = {
    name: 'tesekkur',
    data: data.toJSON(),
    description: 'Bir kullanıcıya teşekkür eder (Kudos puanı kazandırır)',
    async execute(message, args, client) {
        const options = message.slashOptions || message.options;
        const targetUser = options?.getUser?.('kullanici');
        const sebep = options?.getString?.('sebep');
        const user = message.author || message.user;

        if (!targetUser || !sebep) return message.reply({ content: '❌ Lütfen teşekkür edilecek kullanıcıyı ve sebebini girin.', flags: 64 });
        if (targetUser.id === user.id) return message.reply({ content: '❌ Kendinize teşekkür edemezsiniz.', flags: 64 });

        db.add(`kudos_${targetUser.id}`, 1);
        const { EmbedBuilder } = require('discord.js');
        const embed = new EmbedBuilder()
            .setTitle('👏 Teşekkür & Kudos Puanı!')
            .setColor('Green')
            .setDescription(`<@${user.id}>, <@${targetUser.id}> kullanıcısına teşekkür etti!`)
            .addFields({ name: '💬 Sebep', value: sebep })
            .setTimestamp();

        return message.reply({ embeds: [embed] });
    }
};
