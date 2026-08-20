const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType, SlashCommandBuilder } = require('discord.js');
const { kullaniciyaBildirim } = require('../utils/userNotifier');
const { kayitId } = require('../utils/recordStore');
const { kullaniciSoruşturmaGecmisi } = require('../utils/judicialSystem');

module.exports = {
    name: 'sicil',
    data: new SlashCommandBuilder()
        .setName('sicil')
        .setDescription('Kullanıcıların sicil kayıtlarını görüntüler ve yönetir.')
        .addSubcommand(subcommand => subcommand
            .setName('bak')
            .setDescription('Bir kullanıcının sicil geçmişini görüntüler.')
            .addUserOption(option => option
                .setName('kullanici')
                .setDescription('Sicili görüntülenecek kullanıcı.')
                .setRequired(true)))
        .addSubcommand(subcommand => subcommand
            .setName('isle')
            .setDescription('Bir kullanıcıya sicil kaydı ekler.')
            .addUserOption(option => option
                .setName('kullanici')
                .setDescription('Kayıt eklenecek kullanıcı.')
                .setRequired(true))
            .addStringOption(option => option
                .setName('tur')
                .setDescription('Sicil kaydının türü.')
                .setRequired(true)
                .addChoices(
                    { name: 'Tebrik', value: 'tebrik' },
                    { name: 'Uyarı', value: 'uyari' },
                    { name: 'Ceza', value: 'ceza' },
                    { name: 'Yetersizlik', value: 'yetersizlik' }
                ))
            .addStringOption(option => option
                .setName('sebep')
                .setDescription('Sicil kaydının sebebi.')
                .setRequired(true)))
        .addSubcommand(subcommand => subcommand
            .setName('sil')
            .setDescription('Bir sicil kaydını numarasıyla siler.')
            .addUserOption(option => option
                .setName('kullanici')
                .setDescription('Sicil kaydı silinecek kullanıcı.')
                .setRequired(true))
            .addIntegerOption(option => option
                .setName('kayit-numarasi')
                .setDescription('Silinecek sicil kaydının numarası.')
                .setMinValue(1)
                .setRequired(true))),
    aliases: ['sicil-bak', 'vukuat', 'sicil-kayit'],
    description: 'Kullanıcıların sicil kayıtlarını görüntüler, ekler veya siler.',
    usage: '/sicil <bak|isle|sil> kullanici [tur|kayit-numarasi] [sebep]',
    category: 'Yönetim',
    async execute(message, args, client, db) {
        const islem = args[0]?.toLowerCase();
        const targetUser = message.mentions.users.first();

        if (!islem) {
            return message.reply('❌ **Kullanım:**\n`!sicil bak @kullanici` - Sicil/Vukuat geçmişini okur.\n`!sicil isle @kullanici <tebrik/uyari/ceza/yetersizlik> <sebep>` - Kayıt ekler.\n`!sicil sil @kullanici <kayıt_numarası>` - Numarası verilen kaydı siler.');
        }

        // =============================================================
        // 1. SİCİL BAK (Sayfalamalı, En Yeni Baştan, Embed Limit Korumalı)
        // =============================================================
        if (islem === 'bak') {
            if (!targetUser) return message.reply('❌ Lütfen siciline bakmak istediğiniz kullanıcıyı etiketleyin: `!sicil bak @kullanici`');

            const rawSicil = db.get(`sicil_${targetUser.id}`) || [];
            let sicilDegisti = false;
            rawSicil.forEach(item => {
                if (item && !item.id) {
                    item.id = kayitId('SIC');
                    sicilDegisti = true;
                }
            });
            if (sicilDegisti) db.set(`sicil_${targetUser.id}`, rawSicil);
            const investigationHistory = kullaniciSoruşturmaGecmisi(message.guild.id, targetUser.id);
            if (rawSicil.length === 0 && investigationHistory.length === 0) {
                const emptyEmbed = new EmbedBuilder()
                    .setTitle(`📜 ${targetUser.tag} - Sicil ve Vukuat Kaydı`)
                    .setColor('Green')
                    .setDescription('✅ Bu kullanıcının sistemde kayıtlı hiçbir sicil/vukuat kaydı bulunmamaktadır.')
                    .setThumbnail(targetUser.displayAvatarURL({ dynamic: true }))
                    .setTimestamp();
                return message.channel.send({ embeds: [emptyEmbed] });
            }

            // Orijinal indeks numaralarını koruyarak geriye doğru sırala (En yeni en üstte)
            const formattedList = rawSicil.map((item, index) => ({
                originalNo: index + 1,
                recordId: item.id || `#SIC-${index + 1}`,
                type: item.type || 'Belirtilmedi',
                sebep: item.sebep || 'Sebep girilmedi',
                by: item.by || 'Sistem',
                date: item.date || 'Tarih yok'
            })).concat(investigationHistory.map(item => ({
                originalNo: 0,
                recordId: item.id,
                type: item.tip,
                sebep: item.detay,
                by: 'Sistem',
                date: new Date(item.tarih).toLocaleString('tr-TR')
            }))).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

            // Embed limitini (4096 Karakter) aşmamak için sayfalara böl (Her sayfada 5 kayıt)
            const ITEMS_PER_PAGE = 5;
            const pages = [];

            for (let i = 0; i < formattedList.length; i += ITEMS_PER_PAGE) {
                const currentChunk = formattedList.slice(i, i + ITEMS_PER_PAGE);
                let pageDescription = "";

                currentChunk.forEach(item => {
                    const isTebrik = item.type.toLowerCase() === 'tebrik';
                    const icon = isTebrik ? '✅' : '⚠️';
                    
                    pageDescription += `**${item.recordId}** ${icon} **Tür:** \`${item.type}\`\n` +
                                      `📝 **Sebep:** ${item.sebep}\n` +
                                      `👤 **Ekleyen:** ${item.by.includes('<@') ? item.by : `<@${item.by}>`}\n` +
                                      `📅 **Tarih:** ${item.date}\n` +
                                      `───────────────────────────────\n`;
                });

                const pageEmbed = new EmbedBuilder()
                    .setTitle(`📜 ${targetUser.username} - Sicil & Vukuat Geçmişi`)
                    .setColor('Orange')
                    .setThumbnail(targetUser.displayAvatarURL({ dynamic: true }))
                    .setDescription(pageDescription)
                    .setFooter({ 
                        text: `Kullanıcı ID: ${targetUser.id} | Sayfa ${Math.floor(i / ITEMS_PER_PAGE) + 1} / ${Math.ceil(formattedList.length / ITEMS_PER_PAGE)}` 
                    })
                    .setTimestamp();

                pages.push(pageEmbed);
            }

            let currentPage = 0;

            // Tek sayfa varsa butonsuz direkt gönder
            if (pages.length === 1) {
                return message.channel.send({ embeds: [pages[0]] });
            }

            // Sayfalama Ok Tuşları (◀️ / ▶️)
            const prevBtn = new ButtonBuilder()
                .setCustomId('prev_page')
                .setEmoji('◀️')
                .setStyle(ButtonStyle.Primary)
                .setDisabled(true);

            const nextBtn = new ButtonBuilder()
                .setCustomId('next_page')
                .setEmoji('▶️')
                .setStyle(ButtonStyle.Primary)
                .setDisabled(false);

            const row = new ActionRowBuilder().addComponents(prevBtn, nextBtn);
            const msg = await message.channel.send({ embeds: [pages[currentPage]], components: [row] });

            const collector = msg.createMessageComponentCollector({
                componentType: ComponentType.Button,
                time: 120000 // 2 Dakika sonra butonlar deaktif olur
            });

            collector.on('collect', async interaction => {
                if (interaction.user.id !== message.author.id) {
                    return interaction.reply({ content: '❌ Bu butonları sadece komutu yazan kişi kullanabilir.', ephemeral: true });
                }

                if (interaction.customId === 'prev_page') {
                    currentPage--;
                } else if (interaction.customId === 'next_page') {
                    currentPage++;
                }

                // Butonların aktiflik durumunu güncelle
                prevBtn.setDisabled(currentPage === 0);
                nextBtn.setDisabled(currentPage === pages.length - 1);

                const updatedRow = new ActionRowBuilder().addComponents(prevBtn, nextBtn);
                await interaction.update({ embeds: [pages[currentPage]], components: [updatedRow] });
            });

            collector.on('end', () => {
                prevBtn.setDisabled(true);
                nextBtn.setDisabled(true);
                const disabledRow = new ActionRowBuilder().addComponents(prevBtn, nextBtn);
                msg.edit({ components: [disabledRow] }).catch(() => {});
            });

            return;
        }

        // =============================================================
        // 2. SİCİL SİL (Numarayla Olay Kaldırma)
        // =============================================================
        if (islem === 'sil') {
            if (!message.member.permissions.has('Administrator') && !db.get(`teamLeader_${message.author.id}`)) {
                return message.reply('❌ Sicilden kayıt silmek için Yönetici veya Takım Lideri olmalısınız.');
            }

            if (!targetUser) return message.reply('❌ Kullanımı: `!sicil sil @kullanici <kayıt_numarası>`');
            const indexToRemove = parseInt(args[2]);

            if (isNaN(indexToRemove) || indexToRemove <= 0) {
                return message.reply('❌ Lütfen silinecek geçerli bir kayıt numarası girin! Örn: `!sicil sil @kullanici 1`');
            }

            let sicilList = db.get(`sicil_${targetUser.id}`) || [];

            if (sicilList.length === 0) {
                return message.reply('❌ Bu kullanıcının zaten hiç sicil kaydı yok.');
            }

            if (indexToRemove > sicilList.length) {
                return message.reply(`❌ Geçersiz kayıt numarası! Bu kullanıcının toplam **${sicilList.length}** adet kaydı var.`);
            }

            // Numaraya göre kaydı listeden çıkar (1 tabanlı indeksi 0 tabanlı indekse çevirir)
            const removedItem = sicilList.splice(indexToRemove - 1, 1)[0];

            // Güncellenmiş listeyi veritabanına kaydet
            db.set(`sicil_${targetUser.id}`, sicilList);
            await kullaniciyaBildirim(message.client, targetUser, '🗑️ Sicil kaydınız kaldırıldı', `${indexToRemove} numaralı sicil kaydınız kaldırıldı.`, [{ name: 'Tür', value: removedItem.type || 'Belirtilmedi' }]);

            const deleteEmbed = new EmbedBuilder()
                .setTitle('🗑️ Sicil Kaydı Silindi')
                .setColor('Red')
                .setDescription(`**${targetUser.tag}** kullanıcısının **[#${indexToRemove}]** numaralı kaydı başarıyla silindi.`)
                .addFields(
                    { name: 'Silinen Tür', value: removedItem.type || 'Belirtilmedi', inline: true },
                    { name: 'Silinen Sebep', value: removedItem.sebep || 'Belirtilmedi', inline: true }
                )
                .setFooter({ text: `İşlemi Yapan: ${message.author.tag}` })
                .setTimestamp();

            return message.channel.send({ embeds: [deleteEmbed] });
        }

        // =============================================================
        // 3. SİCİL İŞLE (Tebrik / Uyarı / Ceza / Yetersizlik Ekleme)
        // =============================================================
        if (islem === 'isle') {
            if (!targetUser) return message.reply('❌ Kullanım: `!sicil isle @kullanici <tebrik/uyari/ceza/yetersizlik> <sebep>`');
            
            const isLeader = db.get(`teamLeader_${message.author.id}`);
            const isTargetInMyTeam = db.get(`userTeam_${targetUser.id}`) === message.author.id;
            
            if (!isLeader && !message.member.permissions.has('Administrator')) return message.reply('❌ Sadece takım liderleri veya adminler sicil işleyebilir.');
            if (!isTargetInMyTeam && !message.member.permissions.has('Administrator')) return message.reply('❌ Sadece kendi takım üyelerinize sicil işleyebilirsiniz.');

            const tur = args[2];
            const sebep = args.slice(3).join(' ');

            if (!['tebrik', 'uyari', 'ceza', 'yetersizlik'].includes(tur?.toLowerCase())) {
                return message.reply('❌ Geçerli türler: `tebrik`, `uyari`, `ceza`, `yetersizlik`');
            }
            if (!sebep) return message.reply('❌ Lütfen bir sebep belirtin!');

            const formattedType = tur.charAt(0).toUpperCase() + tur.slice(1).toLowerCase();

            db.push(`sicil_${targetUser.id}`, { 
                id: kayitId('SIC'),
                type: formattedType, 
                sebep: sebep, 
                by: message.author.id,
                date: new Date().toLocaleString('tr-TR', { timeZone: 'Europe/Istanbul' })
            });

            await kullaniciyaBildirim(message.client, targetUser, '📋 Sicilinize yeni kayıt işlendi', `${formattedType} türünde yeni bir kayıt işlendi.`, [{ name: 'Sebep', value: sebep }]);

            const currentCount = (db.get(`sicil_${targetUser.id}`) || []).length;
            return message.reply(`📝 **${targetUser.tag}** kullanıcısının siciline başarıyla **[#${currentCount}]** numaralı **${formattedType}** kaydı eklendi.`);


db.push(`modLogs_${message.author.id}`, {
    action: 'Sicil Isleme / Mute / Ban',
    targetId: targetUser.id,
    reason: sebep,
    date: new Date().toLocaleDateString('tr-TR')
});



        }
    }
};