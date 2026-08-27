const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { yetkiliKontrolEt, modlogGonder, qdb } = require('../utils/moderationGuard');
const IdManager = require('../utils/idManager');

const data = new SlashCommandBuilder()
    .setName('unban')
    .setDescription('Yasaklı bir kullanıcının banını kaldırır')
    .addStringOption(opt => opt.setName('id').setDescription('Banı kaldırılacak kullanıcı ID').setRequired(true))
    .addStringOption(opt => opt.setName('sebep').setDescription('Ban kaldırma sebebi').setRequired(false));

module.exports = {
    name: 'unban',
    data: data.toJSON(),
    description: 'Yasaklı bir kullanıcının banını kaldırır',
    async execute(message, args) {
        const options = message.slashOptions || message.options;
        const member = message.member;
        const user = message.author || message.user;
        const guild = message.guild;

        const errorEmbed = (msg) => new EmbedBuilder().setColor('Red').setDescription(`❌ ${msg}`);
        const successEmbed = (msg) => new EmbedBuilder().setColor('Green').setDescription(`✅ ${msg}`);

        if (!yetkiliKontrolEt(member, user)) {
            return message.reply({ embeds: [errorEmbed('Bu komutu kullanmak için yetkili olmalısınız.')], flags: 64 });
        }

        const targetId = options?.getString?.('id')?.trim();
        const sebep = options?.getString?.('sebep') || 'Sebep belirtilmedi';

        if (!targetId) {
            return message.reply({ embeds: [errorEmbed('Lütfen geçerli bir kullanıcı ID girin.')], flags: 64 });
        }

        const banList = await guild.bans.fetch().catch(() => null);
        const bannedUser = banList?.get(targetId);

        if (!bannedUser) {
            return message.reply({ embeds: [errorEmbed('Bu kullanıcı sunucuda yasaklı değil.')], flags: 64 });
        }

        try {
            await guild.bans.remove(targetId, sebep);
        } catch (err) {
            return message.reply({ embeds: [errorEmbed(`Ban kaldırılırken hata oluştu: ${err.message}`)], flags: 64 });
        }

        const banId = await qdb.get(`ban_user_${targetId}`);
        if (banId) {
            // Re-index trigger
            await IdManager.reindex('ban', parseInt(banId), async (oldId, newId, data) => {
                if (data && data.userId) {
                    await qdb.set(`ban_user_${data.userId}`, newId.toString());
                }
                const itiraz = await qdb.get(`itiraz_${oldId}`);
                if (itiraz) {
                    itiraz.banId = newId.toString();
                    await qdb.set(`itiraz_${newId}`, itiraz);
                    await qdb.delete(`itiraz_${oldId}`);
                }
            });
            await qdb.delete(`ban_user_${targetId}`);
        }

        await modlogGonder(guild, message.client, {
            islem: 'Unban',
            hedef: bannedUser.user,
            yetkili: user,
            sebep
        });

        return message.reply({ embeds: [successEmbed(`**${bannedUser.user.tag || bannedUser.user.username}** (${targetId}) kullanıcısının yasağı kaldırıldı.`)], flags: 64 });
    }
};
