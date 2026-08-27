const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
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
    .setName('sicil')
    .setDescription('Yetkili/kullanıcı sicil ve soruşturma geçmişini sorgular')
    .addUserOption(opt => opt.setName('kullanici').setDescription('Hedef kullanıcı').setRequired(true));

module.exports = {
    name: 'sicil',
    data: data.toJSON(),
    description: 'Yetkili/kullanıcı sicil ve soruşturma geçmişini sorgular',
    async execute(message, args, client) {
        const options = message.slashOptions || message.options;
        const member = message.member;
        const user = message.author || message.user;

        const errorEmbed = (msg) => new EmbedBuilder().setColor('Red').setDescription(`❌ ${msg}`);

        if (!yetkiliKontrolEt(member, user)) {
            return message.reply({ embeds: [errorEmbed('Bu komutu kullanmak için yetkili olmalısınız.')], flags: 64 });
        }

        const targetUser = options?.getUser?.('kullanici') || (message.mentions?.users?.first ? message.mentions.users.first() : null);
        if (!targetUser) return message.reply({ embeds: [errorEmbed('Lütfen bir kullanıcı belirtin.')], flags: 64 });

        const sicilList = db.get(`sicil_${targetUser.id}`) || [];
        const text = sicilList.length ? sicilList.map((s, i) => `**ID: ${i + 1}** - ${s.sebep || s}`).join('\n') : '*Temiz sicil kaydı.*';
        
        const sicilEmbed = new EmbedBuilder()
            .setColor('Blue')
            .setTitle(`📁 <@${targetUser.id}> Sicil Kayıtları`)
            .setDescription(text);

        return message.reply({ embeds: [sicilEmbed], flags: 64 });
    }
};
