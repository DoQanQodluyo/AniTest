const { PermissionFlagsBits, SlashCommandBuilder } = require('discord.js');
const db = require('croxydb');
const { gorevDurumu, gorevEmbed } = require('../utils/taskHub');

module.exports = {
    name: 'gorev-katil',
    data: new SlashCommandBuilder().setName('gorev-katil').setDescription('Haftalık görev sistemine katılır.'),
    aliases: ['goreve-katil'], description: 'Görev rolünü alır ve haftalık görevleri başlatır.', usage: '/gorev-katil', category: 'Görev Sistemi',
    async execute(message, args, client) {
        const rol = client.config.GOREV_ROLU_ID && message.guild.roles.cache.get(client.config.GOREV_ROLU_ID);
        if (!rol) return message.reply('Görev rolü yapılandırılmamış.');
        try {
            await message.member.roles.add(rol, 'Haftalık görev sistemine katılım');
            db.set(`gorev_katilim_${message.guild.id}_${message.author.id}`, { kullaniciId: message.author.id, zaman: Date.now() });
            return message.reply({ embeds: [gorevEmbed(message.member, gorevDurumu(message.author.id))] });
        } catch (hata) { return message.reply(`Görev rolü verilemedi: ${hata.message}`); }
    }
};
