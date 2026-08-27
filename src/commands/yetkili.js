const { 
    SlashCommandBuilder, 
    PermissionFlagsBits
} = require('discord.js');
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
    .setName('yetkili')
    .setDescription('Yetkili rol atama ve alma işlemleri')
    .addSubcommand(sub =>
        sub.setName('ver')
            .setDescription('Belirtilen kullanıcıya görev/yetkili rolü atar')
            .addUserOption(opt => opt.setName('kullanici').setDescription('Hedef kullanıcı').setRequired(true))
            .addRoleOption(opt => opt.setName('rol').setDescription('Verilecek rol').setRequired(true))
    )
    .addSubcommand(sub =>
        sub.setName('al')
            .setDescription('Belirtilen kullanıcıdan görev/yetkili rolünü alır')
            .addUserOption(opt => opt.setName('kullanici').setDescription('Hedef kullanıcı').setRequired(true))
            .addRoleOption(opt => opt.setName('rol').setDescription('Alınacak rol').setRequired(true))
    );

module.exports = {
    name: 'yetkili',
    data: data.toJSON(),
    description: 'Yetkili rol atama ve alma işlemleri',
    async execute(message, args, client) {
        const options = message.slashOptions || message.options;
        const member = message.member;
        const user = message.author || message.user;

        if (!yetkiliKontrolEt(member, user)) {
            return message.reply({ content: '❌ Bu komutu kullanmak için yetkili olmalısınız.', flags: 64 });
        }

        const altKomut = options?.getSubcommand?.() || args[0];

        if (altKomut === 'ver' || altKomut === 'gorev-ver') {
            const targetMember = options?.getMember?.('kullanici');
            const targetRole = options?.getRole?.('rol');
            if (!targetMember || !targetRole) return message.reply({ content: '❌ Kullanıcı veya rol bulunamadı.', flags: 64 });

            await targetMember.roles.add(targetRole);
            return message.reply({ content: `✅ <@${targetMember.id}> kullanıcısına <@&${targetRole.id}> rolü verildi.`, flags: 64 });
        }

        if (altKomut === 'al' || altKomut === 'gorev-al') {
            const targetMember = options?.getMember?.('kullanici');
            const targetRole = options?.getRole?.('rol');
            if (!targetMember || !targetRole) return message.reply({ content: '❌ Kullanıcı veya rol bulunamadı.', flags: 64 });

            await targetMember.roles.remove(targetRole);
            return message.reply({ content: `✅ <@${targetMember.id}> kullanıcısından <@&${targetRole.id}> rolü alındı.`, flags: 64 });
        }

        return message.reply({ content: '❌ Geçersiz alt komut. Kullanım: `/yetkili ver` veya `/yetkili al`', flags: 64 });
    }
};
