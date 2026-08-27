const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { hiyerarsiUygunMu, yetkiliKontrolEt, modlogGonder, qdb } = require('../utils/moderationGuard');
const IdManager = require('../utils/idManager');

const data = new SlashCommandBuilder()
    .setName('kick')
    .setDescription('Belirtilen kullanıcıyı sunucudan atar')
    .addUserOption(opt => opt.setName('kullanici').setDescription('Atılacak kullanıcı').setRequired(true))
    .addStringOption(opt => opt.setName('sebep').setDescription('Atılma sebebi').setRequired(true));

module.exports = {
    name: 'kick',
    data: data.toJSON(),
    description: 'Belirtilen kullanıcıyı sunucudan atar',
    async execute(message, args) {
        const options = message.slashOptions || message.options;
        const member = message.member;
        const user = message.author || message.user;
        const guild = message.guild;

        const errorEmbed = (msg) => new EmbedBuilder().setColor('Red').setDescription(`❌ ${msg}`);

        if (!yetkiliKontrolEt(member, user)) {
            return message.reply({ embeds: [errorEmbed('Bu komutu kullanmak için yetkili olmalısınız.')], flags: 64 });
        }

        const targetUser = options?.getUser?.('kullanici');
        const sebep = options?.getString?.('sebep');

        if (!targetUser || !sebep) {
            return message.reply({ embeds: [errorEmbed('Lütfen geçerli bir kullanıcı ve sebep girin.')], flags: 64 });
        }

        const targetMember = await guild.members.fetch(targetUser.id).catch(() => null);

        if (!targetMember) {
            return message.reply({ embeds: [errorEmbed('Kullanıcı sunucuda bulunamadı.')], flags: 64 });
        }

        if (!hiyerarsiUygunMu(member, targetMember)) {
            return message.reply({ embeds: [errorEmbed('Bu kullanıcının rolü sizinle eşit veya sizden yüksek olduğu için atamazsınız.')], flags: 64 });
        }

        const roller = targetMember.roles.cache
            .filter(r => r.id !== guild.id)
            .map(r => r.id);

        const rawKickId = await IdManager.generateId('kick');
        const kickId = rawKickId.toString();
        const kickRecord = {
            kickId,
            userId: targetUser.id,
            hedefId: targetUser.id,
            hedefTag: targetUser.tag || targetUser.username,
            yetkiliId: user.id,
            yetkiliTag: user.tag || user.username,
            sebep,
            tarih: new Date().toISOString(),
            roller,
            islemTuru: 'kick'
        };

        await qdb.set(`kick_${kickId}`, kickRecord);

        try {
            await targetMember.kick(sebep);
        } catch (err) {
            return message.reply({ embeds: [errorEmbed(`Kullanıcı atılırken hata oluştu: ${err.message}`)], flags: 64 });
        }

        await modlogGonder(guild, message.client, {
            islem: 'Kick',
            hedef: targetUser,
            yetkili: user,
            sebep
        });

        const successEmbed = new EmbedBuilder()
            .setColor('Green')
            .setDescription(`✅ **${targetUser.tag || targetUser.username}** kullanıcısı sunucudan atıldı. (ID: \`${kickId}\`)`);

        return message.reply({ embeds: [successEmbed], flags: 64 });
    }
};
