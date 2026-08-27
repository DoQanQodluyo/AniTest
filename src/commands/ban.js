const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');
const { hiyerarsiUygunMu, yetkiliKontrolEt, modlogGonder, qdb } = require('../utils/moderationGuard');
const { sendUserDM } = require('../services/dmService');
const IdManager = require('../utils/idManager');

const data = new SlashCommandBuilder()
    .setName('ban')
    .setDescription('Belirtilen kullanıcıyı sunucudan yasaklar')
    .addUserOption(opt => opt.setName('kullanici').setDescription('Yasaklanacak kullanıcı').setRequired(true))
    .addStringOption(opt => opt.setName('sebep').setDescription('Yasaklama sebebi').setRequired(true));

module.exports = {
    name: 'ban',
    data: data.toJSON(),
    description: 'Belirtilen kullanıcıyı sunucudan yasaklar',
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

        if (targetMember && !hiyerarsiUygunMu(member, targetMember)) {
            return message.reply({ embeds: [errorEmbed('Bu kullanıcının rolü sizinle eşit veya sizden yüksek olduğu için banlayamazsınız.')], flags: 64 });
        }

        const rawBanId = await IdManager.generateId('ban');
        const banId = rawBanId.toString();

        // Ban anında kullanıcıya itiraz butonlu DM gönderimi
        const embedDM = new EmbedBuilder()
            .setTitle(`🔨 ${guild.name} Sunucusundan Yasaklandınız`)
            .setColor('Red')
            .addFields(
                { name: '💬 Sebep', value: sebep },
                { name: '🆔 Ban ID', value: banId }
            )
            .setDescription('Aşağıdaki "İtiraz Et" butonuna tıklayarak yasağınız için itiraz formu doldurabilirsiniz.')
            .setTimestamp();

        const btnItiraz = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(`itiraz_baslat_${banId}`)
                .setLabel('⚖️ İtiraz Et')
                .setStyle(ButtonStyle.Primary)
        );

        await sendUserDM(guild, targetUser.id, { embeds: [embedDM], components: [btnItiraz] }, 'Ban Bildirimi & İtiraz');

        const roller = targetMember
            ? targetMember.roles.cache.filter(r => r.id !== guild.id).map(r => r.id)
            : [];

        const banRecord = {
            banId,
            userId: targetUser.id,
            userTag: targetUser.tag || targetUser.username,
            hedefId: targetUser.id,
            hedefTag: targetUser.tag || targetUser.username,
            yetkiliId: user.id,
            yetkiliTag: user.tag || user.username,
            sebep,
            tarih: new Date().toISOString(),
            roller,
            islemTuru: 'ban',
            itirazDurumu: 'Yok'
        };

        await qdb.set(`ban_${banId}`, banRecord);
        await qdb.set(`ban_user_${targetUser.id}`, banId); // user id mapping for unban lookup

        try {
            await guild.members.ban(targetUser.id, { reason: sebep });
        } catch (err) {
            return message.reply({ embeds: [errorEmbed(`Kullanıcı banlanırken bir hata oluştu: ${err.message}`)], flags: 64 });
        }

        await modlogGonder(guild, message.client, {
            islem: 'Ban',
            hedef: targetUser,
            yetkili: user,
            sebep,
            itirazDurumu: 'Bekleniyor / Yok'
        });

        const replyEmbed = new EmbedBuilder()
            .setTitle('🔨 Kullanıcı Yasaklandı')
            .setColor('Red')
            .addFields(
                { name: '👤 Yasaklanan Kullanıcı', value: `${targetUser.tag || targetUser.username} (\`${targetUser.id}\`)`, inline: true },
                { name: '👮 Yetkili', value: `<@${user.id}>`, inline: true },
                { name: '💬 Ban Sebebi', value: sebep, inline: false },
                { name: '🆔 Ban ID', value: `\`${banId}\``, inline: true }
            )
            .setFooter({ text: 'Banı kaldırmak için 2 Yetkili veya 1 Admin onayı gereklidir.' })
            .setTimestamp();

        const undoRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(`ban_geri_al_${banId}`)
                .setLabel('↩️ Banı Geri Al (0/2 Yetkili)')
                .setStyle(ButtonStyle.Danger)
        );

        return message.reply({ embeds: [replyEmbed], components: [undoRow] });
    }
};
