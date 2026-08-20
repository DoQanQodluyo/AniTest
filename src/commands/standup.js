const { EmbedBuilder, SlashCommandBuilder } = require('discord.js');
const config = require('../../config.js');
const { standupKontrolEt } = require('../utils/standupAssistant');

module.exports = {
    name: 'standup',
    data: new SlashCommandBuilder()
        .setName('standup')
        .setDescription('Günlük stand-up kontrolünü başlatır ve sonucu raporlar.')
        .addStringOption(option => option
            .setName('islem')
            .setDescription('Çalıştırılacak stand-up işlemi.')
            .setRequired(false)
            .addChoices({ name: 'Kontrolü başlat', value: 'kontrol' })),
    aliases: [],
    category: 'Yönetim',
    description: 'Yetkili listesini API üzerinden yeniler ve stand-up DM kontrolünü başlatır.',
    usage: '/standup islem:kontrol',
    async execute(message, args, client) {
        const isOwner = message.author.id === config.BOT_OWNER_ID || message.author.id === config.SAHIP_ID;
        const isAdmin = message.member?.permissions?.has('Administrator');
        const roles = Array.isArray(config.YETKILI_ROL_IDLERI) ? config.YETKILI_ROL_IDLERI : [];
        const isAuthorized = isOwner || isAdmin || message.member?.roles?.cache?.some(role => roles.includes(role.id));
        if (!isAuthorized) return message.reply('❌ Bu komut yalnızca yetkililere açıktır.');
        if (!message.guild) return message.reply('❌ Bu komut yalnızca sunucuda kullanılabilir.');
        const result = await standupKontrolEt(client, message.guild, { reason: 'Manuel slash kontrolü', forceReport: true });
        if (result?.skipped) return message.reply(`❌ Stand-up başlatılamadı: ${result.reason}`);
        const failed = result.filter(item => item.status === 'failed').length;
        return message.reply({
            embeds: [new EmbedBuilder()
                .setTitle('📋 Stand-up kontrolü tamamlandı')
                .setColor(failed ? 'Orange' : 'Green')
                .setDescription(`Toplam **${result.length}** kullanıcı kontrol edildi. Başarısız: **${failed}**. Ayrıntılar bot kanalına raporlandı.`)
                .setTimestamp()]
        });
    }
};