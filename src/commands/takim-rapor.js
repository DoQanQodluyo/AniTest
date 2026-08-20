const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType, SlashCommandBuilder } = require('discord.js');
const teamStore = require('../utils/teamStore');

module.exports = {
    name: 'takim-rapor',
    data: new SlashCommandBuilder()
        .setName('takim-rapor')
        .setDescription('Takımların aktivite ve sicil raporunu gösterir.')
        .addIntegerOption(option => option
            .setName('takim-numarasi')
            .setDescription('Raporlanacak takımın numarası.')
            .setMinValue(1)
            .setRequired(false)),
    aliases: ['trapor', 'takimrapor', 'team-report', 'takim-durum'],
    description: 'Takımların toplam aktivitesini, top 3 üyesini ve son 1 haftadaki sicil vukuatlarını raporlar.',
    usage: '/takim-rapor [takim-numarasi]',
    category: 'Takım Yönetimi',
    async execute(message, args, client, db) {
        const guild = message.guild;

        const loadingMsg = await message.reply('⏳ Takımların aktiflik verileri ve son 1 haftalık sicil kayıtları taranıyor...');

        // 1. TÜM SUNUCU ÜYELERİNİ DİSCORD API'DEN ÇEK
        await guild.members.fetch().catch(() => {});

        // 2. SUNUCUDAKİ TAKIM LİDERLERİNİ VE TAKIMLARI TESPİT ET
        const teamLeaders = teamStore.getLeaders(guild.id);

        if (teamLeaders.length === 0) {
            return loadingMsg.edit('❌ **Sistemde kayıtlı hiçbir takım bulunamadı.**\nLütfen önce liderleri veritabanına kaydedin veya takım oluşturun.');
        }

        // Son 7 günün zaman damgası (Sicil filtresi için)
        const sevenDaysAgoTs = Date.now() - (7 * 24 * 60 * 60 * 1000);

        // 3. HER BİR TAKIMIN VERİLERİNİ HESAPLA VE EMBED SAYFALARINI OLUŞTUR
        const teamPages = [];

        for (let index = 0; index < teamLeaders.length; index++) {
            const leaderId = teamLeaders[index];
            const teamNumber = index + 1; // #1, #2, #3...
            const teamName = teamStore.getTeamName(guild.id, leaderId);
            
            // Takım Üyeleri (Lider dahil)
            let rawMembers = teamStore.getMembers(guild.id, leaderId);
            if (!Array.isArray(rawMembers)) rawMembers = [];
            if (!rawMembers.includes(leaderId)) rawMembers.unshift(leaderId);

            let totalTeamMsg = 0;
            let totalTeamVoiceMs = 0;
            let totalTeamPoint = 0;
            let memberScoreList = [];
            let teamWeeklySicils = [];

            for (const memberId of rawMembers) {
                const member = guild.members.cache.get(memberId);
                const isBot = member?.user?.bot;
                if (isBot) continue;

                // Aktivite Verileri
                const msgCount = db.get(`chat_7d_${guild.id}_${memberId}`) || 0;
                const voiceMs = db.get(`voice_7d_${guild.id}_${memberId}`) || 0;
                const partnerCount = db.get(`partnerData_${memberId}`)?.haftalik || 0;
                const voiceMin = Math.floor(voiceMs / 60000);

                // Yetkili/Üye Puan Çarpanı
                const isStaff = member ? member.roles.cache.some(r => (client.config.STAFF_ROLES || []).includes(r.id)) : false;
                const memberPoint = isStaff 
                    ? (msgCount * 1) + (voiceMin * 1.5) + (partnerCount * 2)
                    : (msgCount * 1) + (voiceMin * 1);

                totalTeamMsg += msgCount;
                totalTeamVoiceMs += voiceMs;
                totalTeamPoint += memberPoint;

                if (memberPoint > 0 || msgCount > 0 || voiceMin > 0) {
                    memberScoreList.push({
                        id: memberId,
                        point: parseFloat(memberPoint.toFixed(1)),
                        msg: msgCount,
                        voiceMin: voiceMin
                    });
                }

                // Son 1 Haftalık Sicil Kayıtlarını Tara
                const userSicil = db.get(`sicil_${memberId}`) || [];
                userSicil.forEach(s => {
                    let isRecent = false;
                    if (s.timestamp && s.timestamp >= sevenDaysAgoTs) {
                        isRecent = true;
                    } else if (s.date) {
                        // Eğer tarih string kaydedildiyse son 7 günü kontrol et
                        const parsedDate = new Date(s.date).getTime();
                        if (!isNaN(parsedDate) && parsedDate >= sevenDaysAgoTs) isRecent = true;
                        else isRecent = true; // Tarih ayrıştırılamazsa güvenlik amacıyla göster
                    }

                    if (isRecent) {
                        teamWeeklySicils.push({
                            targetId: memberId,
                            type: s.type || 'Vukuat',
                            sebep: s.sebep || 'Sebep Belirtilmedi',
                            by: s.by || 'Sistem',
                            date: s.date || 'Son 7 Gün'
                        });
                    }
                });
            }

            // En Aktif Top 3 Üye
            memberScoreList.sort((a, b) => b.point - a.point);
            const top3Members = memberScoreList.slice(0, 3);

            let top3Text = "";
            if (top3Members.length > 0) {
                top3Text = top3Members.map((m, i) => 
                    `**#${i+1}** <@${m.id}> — **${m.point} Puan** (💬 \`${m.msg} mesaj\` | 🎙️ \`${m.voiceMin} dk\`)`
                ).join('\n');
            } else {
                top3Text = "Aktivite gösteren üye bulunmuyor.";
            }

            // Toplam Ses Süresi Saat / Dakika Dönüşümü
            const totalVoiceMin = Math.floor(totalTeamVoiceMs / 60000);
            const totalVoiceHours = Math.floor(totalVoiceMin / 60);
            const remainingVoiceMin = totalVoiceMin % 60;

            // Sicil Metni
            let sicilText = "";
            if (teamWeeklySicils.length > 0) {
                sicilText = teamWeeklySicils.slice(0, 5).map(s => 
                    `• <@${s.targetId}> — **[${s.type}]** \`${s.sebep}\` *(Ekleyen: ${s.by.includes('<@') ? s.by : `<@${s.by}>`})*`
                ).join('\n');
                if (teamWeeklySicils.length > 5) {
                    sicilText += `\n*...ve ${teamWeeklySicils.length - 5} adet daha vukuat kaydı var.*`;
                }
            } else {
                sicilText = "✅ Son 1 hafta içinde takım üyelerine işlenmiş hiçbir sicil/vukuat kaydı yok.";
            }

            // Embed Sayfası
            const embed = new EmbedBuilder()
                .setTitle(`🛡️ [Takım #${teamNumber}] ${teamName}`)
                .setColor('Blurple')
                .addFields(
                    { 
                        name: '👥 Takım Bilgisi', 
                        value: `• **Lider:** <@${leaderId}>\n• **Toplam Üye:** \`${rawMembers.length} Kişi\``, 
                        inline: true 
                    },
                    { 
                        name: '📊 Takım Toplam Aktivitesi (7 Günlük)', 
                        value: `• **Toplam Puan:** \`${totalTeamPoint.toFixed(1)}\` Puan\n• **Toplam Mesaj:** \`${totalTeamMsg}\` Mesaj\n• **Toplam Ses:** \`${totalVoiceHours}s ${remainingVoiceMin}dk\``, 
                        inline: true 
                    },
                    { 
                        name: '🏆 En Aktif İlk 3 Üye', 
                        value: top3Text, 
                        inline: false 
                    },
                    { 
                        name: '📜 Son 1 Haftadaki Takım Sicil / Vukuat Kayıtları', 
                        value: sicilText, 
                        inline: false 
                    }
                )
                .setFooter({ text: `Takım ${teamNumber} / ${teamLeaders.length} • Direkt gitmek için: !takim-rapor <no>` })
                .setTimestamp();

            teamPages.push(embed);
        }

        // 4. İSTENEN SAYFAYA JUMP ETME VEYA VARSAYILAN SAYFAYI AÇMA
        let targetPageIndex = 0;
        const requestedTeamNum = parseInt(args[0]);

        if (!isNaN(requestedTeamNum)) {
            if (requestedTeamNum < 1 || requestedTeamNum > teamPages.length) {
                return loadingMsg.edit(`❌ Geçersiz takım numarası! Lütfen **1 ile ${teamPages.length}** arasında bir numara girin.`);
            }
            targetPageIndex = requestedTeamNum - 1;
        }

        // Tek bir takım varsa butonlara gerek yok
        if (teamPages.length === 1) {
            return loadingMsg.edit({ content: null, embeds: [teamPages[0]] });
        }

        // 5. SAYFALAMA BUTONLARI (PREV / NEXT)
        let currentPage = targetPageIndex;

        const prevBtn = new ButtonBuilder()
            .setCustomId('team_prev')
            .setLabel('◀️ Önceki Takım')
            .setStyle(ButtonStyle.Primary)
            .setDisabled(currentPage === 0);

        const nextBtn = new ButtonBuilder()
            .setCustomId('team_next')
            .setLabel('Sonraki Takım ▶️')
            .setStyle(ButtonStyle.Primary)
            .setDisabled(currentPage === teamPages.length - 1);

        const row = new ActionRowBuilder().addComponents(prevBtn, nextBtn);

        const mainMsg = await loadingMsg.edit({ content: null, embeds: [teamPages[currentPage]], components: [row] });

        // Buton Dinleyici (Collector)
        const collector = mainMsg.createMessageComponentCollector({ componentType: ComponentType.Button, time: 180000 });

        collector.on('collect', async interaction => {
            if (interaction.user.id !== message.author.id) {
                return interaction.reply({ content: '❌ Bu menüyü sadece komutu çalıştıran kişi kontrol edebilir.', ephemeral: true });
            }

            if (interaction.customId === 'team_prev') currentPage--;
            else if (interaction.customId === 'team_next') currentPage++;

            prevBtn.setDisabled(currentPage === 0);
            nextBtn.setDisabled(currentPage === teamPages.length - 1);

            const updatedRow = new ActionRowBuilder().addComponents(prevBtn, nextBtn);
            await interaction.update({ embeds: [teamPages[currentPage]], components: [updatedRow] });
        });

        collector.on('end', () => {
            prevBtn.setDisabled(true);
            nextBtn.setDisabled(true);
            mainMsg.edit({ components: [new ActionRowBuilder().addComponents(prevBtn, nextBtn)] }).catch(() => {});
        });
    }
};