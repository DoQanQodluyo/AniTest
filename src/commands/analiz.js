// --- src/commands/analiz.js ---
const { SlashCommandBuilder, EmbedBuilder, PermissionsBitField } = require('discord.js');
const db = require('croxydb');
const config = require('../../config.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('analiz')
        .setDescription('Gelişmiş sunucu veri analizi, gazete ve snipe özellikleri.')
        .addSubcommand(subcommand =>
            subcommand
                .setName('sunucu')
                .setDescription('Sunucunun genel istatistiklerini gösterir.')
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('gazete')
                .setDescription('Haftalık sunucu gazetesini anında basar (Sadece Yetkililer).')
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('snipe')
                .setDescription('Bu kanalda son silinen mesajı gösterir.')
        ),

    async execute(interaction, client) {
        const subCmd = interaction.options.getSubcommand();
        const isAdmin = interaction.member.permissions.has(PermissionsBitField.Flags.Administrator) || interaction.user.id === config.BOT_OWNER_ID;

        if (subCmd === 'sunucu') {
            const guild = interaction.guild;
            const ramUsageMB = (process.memoryUsage().rss / 1024 / 1024).toFixed(2);
            const totalMembers = guild.memberCount;
            const onlineMembers = guild.members.cache.filter(m => m.presence?.status === 'online' || m.presence?.status === 'dnd' || m.presence?.status === 'idle').size;

            const embed = new EmbedBuilder()
                .setTitle(`📊 ${guild.name} Analiz Raporu`)
                .setColor('Blue')
                .addFields(
                    { name: '👥 Üye Sayısı', value: `Toplam: ${totalMembers}\nÇevrimiçi: ${onlineMembers}`, inline: true },
                    { name: '🤖 Bot RAM', value: `${ramUsageMB} MB`, inline: true },
                    { name: '📅 Sunucu Kuruluş', value: `<t:${Math.floor(guild.createdTimestamp / 1000)}:R>`, inline: false }
                )
                .setThumbnail(guild.iconURL())
                .setTimestamp();

            return interaction.reply({ embeds: [embed] });
        }

        if (subCmd === 'gazete') {
            if (!isAdmin) return interaction.reply({ content: '❌ Bu komutu sadece yöneticiler kullanabilir.', ephemeral: true });
            
            await interaction.deferReply({ ephemeral: false });
            await this.gazeteBasimiYap(client, interaction.guild, interaction.channelId);
            return interaction.editReply('🗞️ Haftalık gazete başarıyla basıldı!');
        }

        if (subCmd === 'snipe') {
            const snipeData = db.get(`snipe_${interaction.channelId}`);
            if (!snipeData) {
                return interaction.reply({ content: '🕵️ Bu kanalda silinmiş bir mesaj bulunamadı.', ephemeral: true });
            }

            const embed = new EmbedBuilder()
                .setTitle('🔫 Snipe Yakaladı!')
                .setAuthor({ name: snipeData.authorTag, iconURL: snipeData.authorAvatar })
                .setDescription(snipeData.content || '*Mesaj içeriği yok (sadece ek/görsel olabilir)*')
                .setColor('Red')
                .setFooter({ text: `Mesaj ${new Date(snipeData.timestamp).toLocaleString('tr-TR')} tarihinde silinmiş.` });

            return interaction.reply({ embeds: [embed] });
        }
    },

    async gazeteBasimiYap(client, guild, channelId) {
        const channel = client.channels.cache.get(channelId) || await client.channels.fetch(channelId).catch(() => null);
        if (!channel || !channel.isTextBased()) return;

        const haftalikYeniKurallar = db.get('weekly_new_rules_count') || 0;
        const haftalikBanlanan = db.get('weekly_ban_count') || 0;
        const haftalikOneri = db.get('weekly_suggestion_count') || 0;
        
        const embed = new EmbedBuilder()
            .setTitle(`🗞️ ${guild.name} Haftalık Gazetesi`)
            .setDescription('Sunucumuzda bu hafta yaşanan önemli gelişmeler:')
            .setColor('DarkVividPink')
            .addFields(
                { name: '📜 Anayasa Değişiklikleri', value: `Bu hafta **${haftalikYeniKurallar}** yeni yasa/kural eklendi.`, inline: false },
                { name: '⚖️ Adalet Sarayı', value: `Bu hafta **${haftalikBanlanan}** kişi sunucudan uzaklaştırıldı.`, inline: false },
                { name: '💡 Toplum Önerileri', value: `Bu hafta **${haftalikOneri}** yeni öneri sunuldu.`, inline: false }
            )
            .setFooter({ text: 'Daha fazlası için Web Dashboard panelini ziyaret edin.', iconURL: guild.iconURL() })
            .setTimestamp();

        await channel.send({ content: '@everyone 📰 Yeni gazete sayımız çıktı!', embeds: [embed] }).catch(() => null);
    }
};
