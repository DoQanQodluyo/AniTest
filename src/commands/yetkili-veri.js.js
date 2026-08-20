const { EmbedBuilder, ChannelType, SlashCommandBuilder } = require('discord.js');

module.exports = {
    name: 'yetkili-veri',
    data: new SlashCommandBuilder()
        .setName('yetkili-veri')
        .setDescription('Yetkilinin canlı ve senkronize verilerini gösterir.')
        .addUserOption(option => option
            .setName('kullanici')
            .setDescription('Verisi gösterilecek yetkili.')
            .setRequired(false))
        .addBooleanOption(option => option
            .setName('yenile')
            .setDescription('Son 7 günlük mesaj verisini yeniden tarar.')
            .setRequired(false)),
    aliases: ['yetkiliveri', 'yveri', 'staff-data', 'senkron-veri'],
    description: 'Yetkilinin canlı bot gözlemi verisi ile geriye dönük API mesaj senkronizasyon verisini sunar.',
    usage: '/yetkili-veri [kullanici] [yenile]',
    category: 'Yetkili Sistemi',
    async execute(message, args, client, db) {
        const target = message.mentions.members.first() || message.member;
        const guild = message.guild;
        const forceRefresh = args.includes('yenile') || args.includes('tarama');

        let apiMsgCount = db.get(`api_chat_7d_${guild.id}_${target.id}`) || 0;

        // Manuel anlık derin tarama istendiyse veya DB'de API verisi henüz yoksa canlı tarama başlatır
        if (forceRefresh || db.get(`api_chat_7d_${guild.id}_${target.id}`) === undefined) {
            
            let statusEmbed = new EmbedBuilder()
                .setTitle('⏳ API Mesaj Senkronizasyonu Yapılıyor...')
                .setColor('Yellow')
                .setDescription(`**${target.user.tag}** kullanıcısının son 7 günlük mesaj geçmişi Discord API üzerinden taranıyor.\nLütfen bekleyin...`)
                .addFields({ name: '📊 Durum', value: '⏳ Kanallar hazırlanıyor...' });

            const progressMsg = await message.channel.send({ embeds: [statusEmbed] });

            const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
            
            await guild.channels.fetch().catch(() => {});
            const textChannels = Array.from(guild.channels.cache.filter(c => 
                c.type === ChannelType.GuildText && 
                c.permissionsFor(guild.members.me).has(['ViewChannel', 'ReadMessageHistory'])
            ).values());

            let totalChannels = textChannels.length;
            let processedChannels = 0;
            let userFoundApiMsgs = 0;

            // ⏱️ 2 SANİYEDE BİR MESAJI GÜNCELLEYEN ZAMANLAYICI (Rate limit güvenli)
            const updateInterval = setInterval(async () => {
                statusEmbed.setFields({
                    name: '⏳ İlerleme Durumu',
                    value: `• Taranan Kanal: \`${processedChannels} / ${totalChannels}\`\n• Tespit Edilen Mesaj: \`${userFoundApiMsgs}\` adet`
                });
                await progressMsg.edit({ embeds: [statusEmbed] }).catch(() => {});
            }, 2000);

            // Taramayı gerçekleştir
            for (const channel of textChannels) {
                let lastId = null;
                let fetching = true;

                while (fetching) {
                    const options = { limit: 100 };
                    if (lastId) options.before = lastId;

                    const fetched = await channel.messages.fetch(options).catch(() => null);
                    if (!fetched || fetched.size === 0) break;

                    for (const msg of fetched.values()) {
                        if (msg.createdTimestamp < sevenDaysAgo) {
                            fetching = false;
                            break;
                        }
                        if (msg.author.id === target.id) {
                            userFoundApiMsgs++;
                        }
                    }
                    lastId = fetched.last()?.id;
                }
                processedChannels++;
            }

            // Güncelleme intervalini temizle
            clearInterval(updateInterval);
            apiMsgCount = userFoundApiMsgs;
            db.set(`api_chat_7d_${guild.id}_${target.id}`, apiMsgCount);

            await progressMsg.delete().catch(() => {});
        }

        // 📊 VERİLERİ AÇIKLAMA VE SUNMA
        const liveDbMsgCount = db.get(`chat_7d_${guild.id}_${target.id}`) || 0;
        const voiceMs = db.get(`voice_7d_${guild.id}_${target.id}`) || 0;
        const partnerData = db.get(`partnerData_${target.id}`) || { haftalik: 0 };

        const voiceMin = Math.floor(voiceMs / 60000);
        const voiceHours = Math.floor(voiceMin / 60);
        const remainingVoiceMin = voiceMin % 60;

        // Puan hesaplamasında net API mesaj sayısı esas alınır
        const totalPoint = (apiMsgCount * 1) + (voiceMin * 1.5) + (partnerData.haftalik * 2);

        const resultEmbed = new EmbedBuilder()
            .setTitle(`📊 Yetkili Veri Raporu: ${target.user.username}`)
            .setColor('Blurple')
            .setThumbnail(target.user.displayAvatarURL({ dynamic: true }))
            .setDescription(`Aşağıda botun canlı gözlem verileri ile Discord API senkronize verileri ayrıştırılarak listelenmiştir.`)
            .addFields(
                { 
                    name: '🌐 API Taraması (Geriye Dönük Net Veri)', 
                    value: `💬 **7 Günlük Mesaj:** \`${apiMsgCount}\` Mesaj\n*(Discord API kanallarından taranan kesin sayı)*`, 
                    inline: false 
                },
                { 
                    name: '🤖 Bot Gözlemi (Canlı DB Kaydı)', 
                    value: `💬 **7 Günlük Mesaj:** \`${liveDbMsgCount}\` Mesaj\n🎙️ **7 Günlük Ses:** \`${voiceHours}s ${remainingVoiceMin}dk\` (\`${voiceMin}\` dk)\n🤝 **Haftalık Partner:** \`${partnerData.haftalik}\` Adet`, 
                    inline: false 
                },
                { 
                    name: '🏆 Senkronize Hesaplanan Puan', 
                    value: `**${totalPoint.toFixed(1)}** Puan *(API Mesaj + Ses + Partner)*`, 
                    inline: false 
                }
            )
            .setFooter({ text: 'Canlı taramayı zorlamak için: !yetkili-veri @kullanıcı yenile' })
            .setTimestamp();

        return message.channel.send({ embeds: [resultEmbed] });
    }
};