const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const db = require('croxydb');
const config = require('../../config.js');

function yetkiliKontrolEt(member, user) {
    if (!member && !user) return false;
    const userId = user?.id || member?.id;
    if (userId === config.BOT_OWNER_ID || userId === config.SAHIP_ID) return true;
    if (member?.permissions?.has(PermissionFlagsBits.Administrator)) return true;

    const izinliRoller = Array.isArray(config.YETKILI_ROL_IDLERI) ? config.YETKILI_ROL_IDLERI : [];
    if (member?.roles?.cache) {
        return member.roles.cache.some(role => izinliRoller.includes(role.id));
    }
    return false;
}

const data = new SlashCommandBuilder()
    .setName('duyuru')
    .setDescription('Gelişmiş duyuru mesajı gönderir')
    .addChannelOption(opt => opt.setName('kanal').setDescription('Hedef kanal').setRequired(true))
    .addStringOption(opt => opt.setName('baslik').setDescription('Duyuru başlığı').setRequired(true))
    .addStringOption(opt => opt.setName('mesaj').setDescription('Duyuru açıklaması').setRequired(true))
    .addStringOption(opt => 
        opt.setName('ping_tipi')
            .setDescription('Ping tipi')
            .setRequired(true)
            .addChoices(
                { name: 'Everyone', value: 'Everyone' }, 
                { name: 'Rol', value: 'Rol' }, 
                { name: 'Yok', value: 'Yok' }
            )
    );

module.exports = {
    name: 'duyuru',
    data: data.toJSON(),
    description: 'Gelişmiş duyuru mesajı gönderir',
    async execute(message, args, client) {
        const options = message.slashOptions || message.options;
        const member = message.member;
        const user = message.author || message.user;

        if (!yetkiliKontrolEt(member, user)) {
            return message.reply({ content: '❌ Bu komutu kullanmak için yetkili olmalısınız.', flags: 64 });
        }

        const targetChannel = options.getChannel('kanal');
        const baslik = options.getString('baslik');
        const duyuruMesaji = options.getString('mesaj');
        const pingTipi = options.getString('ping_tipi');

        if (!targetChannel?.isTextBased()) {
            return message.reply({ content: '❌ Geçersiz kanal.', flags: 64 });
        }

        let content = '';
        if (pingTipi === 'Everyone') content = '@everyone';

        const { EmbedBuilder } = require('discord.js');
        const embed = new EmbedBuilder()
            .setTitle(`📢 ${baslik}`)
            .setColor('Gold')
            .setDescription(duyuruMesaji)
            .setFooter({ text: `Duyuran: ${user.tag || user.username}` })
            .setTimestamp();

        await targetChannel.send({ content: content || undefined, embeds: [embed] });
        return message.reply({ content: `✅ Duyuru <#${targetChannel.id}> kanalına gönderildi.`, flags: 64 });
    }
};
