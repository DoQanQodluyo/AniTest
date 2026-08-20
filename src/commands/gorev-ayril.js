const { SlashCommandBuilder } = require('discord.js');
const db = require('croxydb');

module.exports = {
    name: 'gorev-ayril',
    data: new SlashCommandBuilder().setName('gorev-ayril').setDescription('Haftalık görev sisteminden ayrılır.'),
    aliases: ['gorevden-ayril'], description: 'Görev rolünü alır ve katılım kaydını kaldırır.', usage: '/gorev-ayril', category: 'Görev Sistemi',
    async execute(message, args, client) {
        const rol = client.config.GOREV_ROLU_ID && message.guild.roles.cache.get(client.config.GOREV_ROLU_ID);
        try {
            if (rol) await message.member.roles.remove(rol, 'Haftalık görev sisteminden ayrılma');
            db.delete(`gorev_katilim_${message.guild.id}_${message.author.id}`);
            return message.reply('Haftalık görev sisteminden ayrıldınız.');
        } catch (hata) { return message.reply(`Görev rolü alınamadı: ${hata.message}`); }
    }
};
