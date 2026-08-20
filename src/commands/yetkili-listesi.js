const { EmbedBuilder, SlashCommandBuilder } = require('discord.js');
const teamStore = require('../utils/teamStore');

module.exports = {
    name: 'yetkili-listesi',
    data: new SlashCommandBuilder()
        .setName('yetkili-listesi')
        .setDescription('Sunucudaki yetkilileri takımlarına göre listeler.'),
    aliases: ['yetkililistesi', 'yetkililer', 'staff-list', 'ylist'],
    description: 'Sunucudaki tüm yetkilileri gruplarına göre listeler, grupsuz yetkilileri log kanalına ve DM ile yetkiliye bildirir.',
    usage: '/yetkili-listesi',
    category: 'Yetkili Sistemi',
    async execute(message, args, client, db) {
        const guild = message.guild;
        const LOG_CHANNEL_ID = '1539210618052280320';
        const staffRoleIds = client.config?.STAFF_ROLES || [];

        const loadingMsg = await message.reply('⏳ Sunucudaki yetkililer ve grup eşleşmeleri taranıyor...');

        // 1. TÜM SUNUCU ÜYELERİNİ ÇEK
        await guild.members.fetch().catch(() => {});

        // 2. YETKİLİ ROLÜNE SAHİP ÜYELERİ FİLTRELE (Botlar hariç)
        const staffMembers = guild.members.cache.filter(m => 
            !m.user.bot && m.roles.cache.some(r => staffRoleIds.includes(r.id))
        );

        if (staffMembers.size === 0) {
            return loadingMsg.edit('❌ Sunucuda ayarlanmış yetkili rollerine (`STAFF_ROLES`) sahip hiçbir üye bulunamadı.');
        }

        // 3. TAKIM / GRUP VERİLERİNİ DB'DEN ÇEK
        const teamLeaders = teamStore.getLeaders(guild.id);

        // ID -> Takım Adı eşleme haritası
        const userTeamMap = new Map();
        const teamsData = {}; // Takım Adı -> Üye Listesi

        for (const leaderId of teamLeaders) {
            const teamName = teamStore.getTeamName(guild.id, leaderId);
            let rawMembers = teamStore.getMembers(guild.id, leaderId);
            if (!Array.isArray(rawMembers)) rawMembers = [];
            if (!rawMembers.includes(leaderId)) rawMembers.unshift(leaderId);

            teamsData[teamName] = [];

            for (const mId of rawMembers) {
                userTeamMap.set(mId, teamName);
            }
        }

        // 4. YETKİLİLERİ GRUPLARA VEYA BAĞIMSIZ LİSTEYE AYIR
        const unassignedStaff = [];

        staffMembers.forEach(member => {
            const teamName = userTeamMap.get(member.id);
            if (teamName) {
                if (!teamsData[teamName]) teamsData[teamName] = [];
                teamsData[teamName].push(member);
            } else {
                unassignedStaff.push(member);
            }
        });

        // 5. ANA KANAL EMBED'İNİ OLUŞTUR
        const mainEmbed = new EmbedBuilder()
            .setTitle(`🛡️ ${guild.name} — Yetkili Kadrosu Listesi`)
            .setColor('Blurple')
            .setThumbnail(guild.iconURL({ dynamic: true }))
            .setFooter({ text: `Toplam Yetkili: ${staffMembers.size} | Sorgulayan: ${message.author.tag}` })
            .setTimestamp();

        // Gruplanmış Takımları Ekle
        for (const [teamName, members] of Object.entries(teamsData)) {
            if (members.length > 0) {
                const memberListText = members.map(m => `• <@${m.id}>`).join('\n');
                mainEmbed.addFields({
                    name: `👥 ${teamName} (${members.length})`,
                    value: memberListText.length > 1024 ? memberListText.slice(0, 1020) + '...' : memberListText,
                    inline: true
                });
            }
        }

        // Bağımsız Yetkilileri Embed'e Ekle
        if (unassignedStaff.length > 0) {
            const unassignedText = unassignedStaff.map(m => `• <@${m.id}>`).join('\n');
            mainEmbed.addFields({
                name: `⚠️ Bağımsız / Grupsuz Yetkililer (${unassignedStaff.length})`,
                value: unassignedText.length > 1024 ? unassignedText.slice(0, 1020) + '...' : unassignedText,
                inline: false
            });
        }

        await loadingMsg.edit({ content: null, embeds: [mainEmbed] });

        // 6. UYARI & İKAZ MEKANİZMASI (Grupsuz yetkili varsa çalışır)
        if (unassignedStaff.length > 0) {
            const warningEmbed = new EmbedBuilder()
                .setTitle('⚠️ Grupsuz / Bağımsız Yetkili İkazı')
                .setColor('Red')
                .setDescription(`Sunucuda bir takıma/gruba atanmamış **${unassignedStaff.length}** adet yetkili tespit edildi!`)
                .addFields({
                    name: '👤 Grupsuz Yetkili Listesi',
                    value: unassignedStaff.map(m => `• <@${m.id}> (\`${m.id}\`)`).join('\n')
                })
                .setFooter({ text: `Otomatik İkaz Sistemi • ${new Date().toLocaleTimeString('tr-TR')}` })
                .setTimestamp();

            // A) Bot Log Kanalına Gönder (1539210618052280320)
            const logChannel = client.channels.cache.get(LOG_CHANNEL_ID);
            if (logChannel) {
                await logChannel.send({ embeds: [warningEmbed] }).catch(() => {});
            }

            // B) Komutu Çalıştıran Yetkiliye Özel DM Gönder
            await message.author.send({ 
                content: '🔔 **Sunucudaki grupsuz yetkililer hakkında özel ikaz bildirimi:**',
                embeds: [warningEmbed] 
            }).catch(() => {
                // Eğer kullanıcının DM'i kapalıysa kanala küçük bir bilgilendirme geç
                message.channel.send(`⚠️ <@${message.author.id}> DM kutunuz kapalı olduğu için özel ikaz mesajı iletilemedi. Detaylar bot log kanalına aktarıldı.`).catch(() => {});
            });
        }
    }
};