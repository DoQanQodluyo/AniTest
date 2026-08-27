// --- src/commands/mute.js ---
const { SlashCommandBuilder, EmbedBuilder, PermissionsBitField } = require('discord.js');
const db = require('croxydb');
const path = require('path');
const config = require(path.join(__dirname, '../../config.js'));

module.exports = {
    data: new SlashCommandBuilder()
        .setName('mute')
        .setDescription('Kullanıcıya zamanaşımı (mute/timeout) uygular.')
        .addUserOption(option => option.setName('kullanici').setDescription('Susturulacak kullanıcı').setRequired(true))
        .addIntegerOption(option => option.setName('dakika').setDescription('Süre (Dakika)').setRequired(true))
        .addStringOption(option => option.setName('sebep').setDescription('Susturma sebebi').setRequired(false)),

    async execute(interaction, client) {
        const isAdmin = interaction.member.permissions.has(PermissionsBitField.Flags.ModerateMembers) || 
                        interaction.member.permissions.has(PermissionsBitField.Flags.Administrator) || 
                        interaction.user.id === config.BOT_OWNER_ID;

        if (!isAdmin) {
            return interaction.reply({ content: '❌ Bu komutu kullanmak için `Üyeleri Yönet` yetkisine sahip olmalısınız.', ephemeral: true });
        }

        const targetUser = interaction.options.getUser('kullanici');
        const dakika = interaction.options.getInteger('dakika');
        const sebep = interaction.options.getString('sebep') || 'Sebep belirtilmedi';
        const member = await interaction.guild.members.fetch(targetUser.id).catch(() => null);

        if (!member) {
            return interaction.reply({ content: '❌ Kullanıcı bu sunucuda bulunamadı.', ephemeral: true });
        }

        if (!member.moderatable) {
            return interaction.reply({ content: '❌ Bu kullanıcıya zamanaşımı uygulamak için yetkim yetersiz.', ephemeral: true });
        }

        try {
            const ms = dakika * 60 * 1000;
            await member.timeout(ms, `${interaction.user.tag}: ${sebep}`);

            const sicilKey = `sicil_${targetUser.id}`;
            const sicil = db.get(sicilKey) || [];
            sicil.push({
                tarih: new Date().toISOString(),
                sebep: `${dakika} dakika - ${sebep}`,
                ceza: 'Mute',
                yetkili: interaction.user.tag
            });
            db.set(sicilKey, sicil);

            const embed = new EmbedBuilder()
                .setTitle('🔇 Kullanıcı Susturuldu (Timeout)')
                .setColor('Yellow')
                .addFields(
                    { name: 'Kullanıcı', value: `<@${targetUser.id}>`, inline: true },
                    { name: 'Süre', value: `${dakika} Dakika`, inline: true },
                    { name: 'Yetkili', value: `<@${interaction.user.id}>`, inline: true },
                    { name: 'Sebep', value: sebep, inline: false }
                )
                .setTimestamp();

            await interaction.reply({ embeds: [embed] });
        } catch (error) {
            console.error('🔴 [Mute Hatası]:', error);
            await interaction.reply({ content: '❌ Kullanıcı susturulurken bir hata oluştu.', ephemeral: true });
        }
    }
};
