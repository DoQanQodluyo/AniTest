const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const db = require('croxydb');
const config = require('../../config.js');
const { yavasModuUygula } = require('../utils/crisisGuard.js');

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
    .setName('kriz')
    .setDescription('Sunucu kriz modunu ve yavaş modu yönetir')
    .addStringOption(opt => 
        opt.setName('mod')
            .setDescription('Aç veya Kapat')
            .setRequired(true)
            .addChoices(
                { name: 'Aç', value: 'ac' }, 
                { name: 'Kapat', value: 'kapat' }
            )
    );

module.exports = {
    name: 'kriz',
    data: data.toJSON(),
    description: 'Sunucu kriz modunu ve yavaş modu yönetir',
    async execute(message, args, client) {
        const options = message.slashOptions || message.options;
        const member = message.member;
        const user = message.author || message.user;
        const guild = message.guild;

        if (!yetkiliKontrolEt(member, user)) {
            return message.reply({ content: '❌ Bu komutu kullanmak için yetkili olmalısınız.', flags: 64 });
        }

        const mod = options?.getString?.('mod') || args[0];
        if (!mod) return message.reply({ content: '❌ Lütfen mod seçin (ac/kapat).', flags: 64 });

        if (mod === 'ac') {
            db.set(`kriz_modu_${guild.id}`, true);
            await yavasModuUygula(guild, 10);
            return message.reply({ content: '🚨 **Kriz Modu AKTİF edildi!** Kanallarda 10 saniyelik yavaş mod uygulandı.', flags: 64 });
        } else {
            db.set(`kriz_modu_${guild.id}`, false);
            await yavasModuUygula(guild, 0);
            return message.reply({ content: '🟢 **Kriz Modu KAPATILDI.** Yavaş modlar kaldırıldı.', flags: 64 });
        }
    }
};
