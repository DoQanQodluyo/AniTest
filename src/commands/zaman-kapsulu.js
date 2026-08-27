const { SlashCommandBuilder } = require('discord.js');
const db = require('croxydb');

const data = new SlashCommandBuilder()
    .setName('zaman-kapsulu')
    .setDescription('Geleceğe kilitli zaman kapsülü bırakır')
    .addStringOption(opt => opt.setName('tarih').setDescription('Bitiş tarihi (YYYY-MM-DD)').setRequired(true))
    .addStringOption(opt => opt.setName('mesaj').setDescription('Kapsül mesajı').setRequired(true))
    .addChannelOption(opt => opt.setName('kanal').setDescription('Kapsülün açılacağı kanal (Varsayılan: geçerli kanal)').setRequired(false));

module.exports = {
    name: 'zaman-kapsulu',
    data: data.toJSON(),
    description: 'Geleceğe kilitli zaman kapsülü bırakır',
    async execute(message, args, client) {
        const options = message.slashOptions || message.options;
        const user = message.author || message.user;
        const tarih = options.getString('tarih');
        const mesaj = options.getString('mesaj');
        const hedefKanal = options?.getChannel?.('kanal');

        if (!/^\d{4}-\d{2}-\d{2}$/.test(tarih)) {
            return message.reply({ content: '❌ Geçersiz tarih formatı. Lütfen `YYYY-MM-DD` formatını kullanın. (Örn: 2026-12-31)', flags: 64 });
        }

        const hedefTarih = new Date(tarih + 'T00:00:00Z');
        if (isNaN(hedefTarih.getTime()) || hedefTarih <= new Date()) {
            return message.reply({ content: '❌ Lütfen gelecekte bir tarih girin.', flags: 64 });
        }

        const channelId = hedefKanal?.id || message.channel?.id || message.channelId;
        const kapsulObj = {
            userId: user.id,
            mesaj,
            tarih,
            channelId,
            acildi: false,
            olusturulma: new Date().toISOString()
        };

        const tumKapsuller = db.get('zaman_kapsulleri') || [];
        tumKapsuller.push(kapsulObj);
        db.set('zaman_kapsulleri', tumKapsuller);

        return message.reply({ content: `⏳ **Zaman Kapsülünüz Kilitlendi!** Kapsülünüz **${tarih}** tarihinde <#${channelId}> kanalında açılacak.`, flags: 64 });
    }
};
