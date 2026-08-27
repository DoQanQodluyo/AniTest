// --- src/commands/duyuru.js ---
const { SlashCommandBuilder, EmbedBuilder, PermissionsBitField, ChannelType } = require('discord.js');
const config = require('../../config.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('duyuru')
        .setDescription('Sunucuda gelişmiş bir duyuru yayınlar.')
        .addStringOption(option => 
            option.setName('baslik')
                .setDescription('Duyuru başlığı')
                .setRequired(true))
        .addStringOption(option => 
            option.setName('mesaj')
                .setDescription('Duyuru içeriği')
                .setRequired(true))
        .addChannelOption(option => 
            option.setName('kanal')
                .setDescription('Duyurunun gönderileceği kanal')
                .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
                .setRequired(true))
        .addStringOption(option => 
            option.setName('etiket')
                .setDescription('Kimler etiketlensin?')
                .addChoices(
                    { name: 'Hiçbiri', value: 'none' },
                    { name: '@everyone', value: 'everyone' },
                    { name: '@here', value: 'here' }
                )
                .setRequired(false))
        .addRoleOption(option => 
            option.setName('rol')
                .setDescription('Sadece belirli bir role ping atmak isterseniz seçin')
                .setRequired(false)),

    async execute(interaction, client) {
        const isAdmin = interaction.member.permissions.has(PermissionsBitField.Flags.Administrator) || interaction.user.id === config.BOT_OWNER_ID;
        if (!isAdmin) {
            return interaction.reply({ content: '❌ Bu komutu sadece yöneticiler kullanabilir.', ephemeral: true });
        }

        const baslik = interaction.options.getString('baslik');
        const mesaj = interaction.options.getString('mesaj');
        const kanal = interaction.options.getChannel('kanal');
        const etiketSecimi = interaction.options.getString('etiket');
        const rolSecimi = interaction.options.getRole('rol');

        let pingContent = '';
        if (rolSecimi) {
            pingContent = `<@&${rolSecimi.id}>`;
        } else if (etiketSecimi === 'everyone') {
            pingContent = '@everyone';
        } else if (etiketSecimi === 'here') {
            pingContent = '@here';
        }

        const embed = new EmbedBuilder()
            .setTitle(`📢 ${baslik}`)
            .setDescription(mesaj)
            .setColor('Random')
            .setFooter({ text: `${interaction.guild.name} Yönetimi`, iconURL: interaction.guild.iconURL() })
            .setTimestamp();

        try {
            if (pingContent !== '') {
                await kanal.send({ content: pingContent, embeds: [embed] });
            } else {
                await kanal.send({ embeds: [embed] });
            }
            await interaction.reply({ content: `✅ Duyuru başarıyla ${kanal} kanalına gönderildi.`, ephemeral: true });
        } catch (error) {
            console.error('🔴 [Duyuru Hatası]', error);
            await interaction.reply({ content: '❌ Duyuru gönderilirken bir hata oluştu. Kanal izinlerini kontrol edin.', ephemeral: true });
        }
    }
};
