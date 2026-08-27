const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const db = require('croxydb');
const config = require('../../config.js');
const { yasaEmbed, yasaButonlari } = require('../utils/judicialSystem.js');
const IdManager = require('../utils/idManager');

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
    .setName('yasa')
    .setDescription('Yeni bir yasa tasarısını yetkili onayına sunar')
    .addStringOption(opt => opt.setName('baslik').setDescription('Tasarı başlığı').setRequired(true))
    .addStringOption(opt => opt.setName('icerik').setDescription('Tasarı içeriği').setRequired(true));

module.exports = {
    name: 'yasa',
    data: data.toJSON(),
    description: 'Yeni bir yasa tasarısını yetkili onayına sunar',
    async execute(message, args, client) {
        const options = message.slashOptions || message.options;
        const member = message.member;
        const user = message.author || message.user;
        const guild = message.guild;

        const errorEmbed = (msg) => new EmbedBuilder().setColor('Red').setDescription(`❌ ${msg}`);

        if (!yetkiliKontrolEt(member, user)) {
            return message.reply({ embeds: [errorEmbed('Bu komutu kullanmak için yetkili olmalısınız.')], flags: 64 });
        }

        const baslik = options.getString('baslik');
        const icerik = options.getString('icerik');

        const rawTasariId = await IdManager.generateId('yasa');
        const tasariId = rawTasariId.toString();
        const tasariObj = {
            id: tasariId,
            baslik,
            icerik,
            sunanId: user.id,
            kabul: [],
            red: [],
            aktif: true,
            tarih: new Date().toISOString()
        };

        db.set(`yasa_tasari_${guild.id}_${tasariId}`, tasariObj);

        const embed = yasaEmbed(tasariObj);
        const components = [yasaButonlari(tasariId)];

        const successEmbed = new EmbedBuilder().setColor('Gold').setDescription(`⚖️ **Yeni Yasa Tasarısı Sunuldu!** (ID: \`${tasariId}\`)`);
        return message.reply({ embeds: [successEmbed, embed], components });
    }
};
