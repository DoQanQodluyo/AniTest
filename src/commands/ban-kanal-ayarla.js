const { SlashCommandBuilder } = require('discord.js');
const { yetkiliKontrolEt, qdb } = require('../utils/moderationGuard');

const data = new SlashCommandBuilder()
    .setName('ban-kanal-ayarla')
    .setDescription('Moderasyon log kanalını ayarlar')
    .addChannelOption(opt => opt.setName('kanal').setDescription('Modlog kanalı').setRequired(true));

module.exports = {
    name: 'ban-kanal-ayarla',
    data: data.toJSON(),
    description: 'Moderasyon log kanalını ayarlar',
    async execute(message, args) {
        const options = message.slashOptions || message.options;
        const member = message.member;
        const user = message.author || message.user;

        if (!yetkiliKontrolEt(member, user)) {
            return message.reply({ content: '❌ Bu komutu kullanmak için yetkili olmalısınız.', flags: 64 });
        }

        const kanal = options?.getChannel?.('kanal');
        if (!kanal || !kanal.isTextBased()) {
            return message.reply({ content: '❌ Geçersiz yazı kanalı.', flags: 64 });
        }

        await qdb.set('modlog_kanal', kanal.id);
        return message.reply({ content: `✅ Moderasyon log kanalı <#${kanal.id}> olarak ayarlandı.`, flags: 64 });
    }
};
