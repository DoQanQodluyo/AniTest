const { SlashCommandBuilder } = require('discord.js');
const db = require('croxydb');
const config = require('../../config.js');
const { yetkiliMi, yasaAnahtari, yasaEmbed, yasaButonlari } = require('../utils/judicialSystem');

module.exports = {
    name: 'yasa-tasarisi-sun',
    data: new SlashCommandBuilder().setName('yasa-tasarisi-sun').setDescription('Yetkili yasa meclisine yeni tasarı sunar.')
        .addStringOption(option => option.setName('baslik').setDescription('Tasarı başlığı.').setRequired(true))
        .addStringOption(option => option.setName('detaylar').setDescription('Tasarı detayları.').setRequired(true)),
    aliases: [], category: 'Yasa Meclisi', description: 'Yetkililerin oyuna yasa tasarısı sunar.', usage: '/yasa-tasarisi-sun',
    async execute(message, args, client) {
        if (!yetkiliMi(message.member)) return message.reply('❌ Bu komut yalnızca yapılandırılmış yetkililere açıktır.');
        const baslik = message.slashOptions.getString('baslik');
        const detaylar = message.slashOptions.getString('detaylar');
        const id = `${Date.now()}_${message.author.id}`;
        const tasari = { id, guildId: message.guild.id, baslik, detaylar, sunan: message.author.id, kabul: [], red: [], zaman: Date.now(), aktif: true };
        db.set(yasaAnahtari(message.guild.id, id), tasari);
        const kanal = await client.channels.fetch(config.YASA_MECLIS_KANAL_ID).catch(() => null);
        if (!kanal?.isTextBased()) return message.reply('❌ Yasa meclisi kanalı bulunamadı.');
        const gonderi = await kanal.send({ embeds: [yasaEmbed(tasari)], components: [yasaButonlari(id)] });
        db.set(yasaAnahtari(message.guild.id, id), { ...tasari, messageId: gonderi.id, channelId: kanal.id });
        return message.reply('✅ Yasa tasarısı meclis kanalına sunuldu.');
    }
};