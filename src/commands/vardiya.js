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
    .setName('vardiya')
    .setDescription('Vardiya devretme veya teslim alma işlemi')
    .addStringOption(opt => 
        opt.setName('islem')
            .setDescription('Devret veya Teslim Al')
            .setRequired(true)
            .addChoices(
                { name: 'Devret', value: 'devret' }, 
                { name: 'Teslim Al', value: 'teslim_al' }
            )
    );

module.exports = {
    name: 'vardiya',
    data: data.toJSON(),
    description: 'Vardiya devretme veya teslim alma işlemi',
    async execute(message, args, client) {
        const options = message.slashOptions || message.options;
        const member = message.member;
        const user = message.author || message.user;

        if (!yetkiliKontrolEt(member, user)) {
            return message.reply({ content: '❌ Bu komutu kullanmak için yetkili olmalısınız.', flags: 64 });
        }

        const islem = options?.getString?.('islem') || args[0];
        if (!islem) return message.reply({ content: '❌ Lütfen bir işlem seçin (devret/teslim_al).', flags: 64 });

        if (islem === 'devret') {
            db.set(`vardiya_aktif_${user.id}`, false);
            return message.reply({ content: '📋 Vardiyanız başarıyla **devredildi**.', flags: 64 });
        } else {
            db.set(`vardiya_aktif_${user.id}`, true);
            return message.reply({ content: '📋 Vardiya başarıyla **teslim alındı**.', flags: 64 });
        }
    }
};
