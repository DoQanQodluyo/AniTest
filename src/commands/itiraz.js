const {
    SlashCommandBuilder,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    MessageFlags
} = require('discord.js');
const { yetkiliKontrolEt, modlogGonder, qdb } = require('../utils/moderationGuard');
const { sendUserDM } = require('../services/dmService');

const data = new SlashCommandBuilder()
    .setName('itiraz')
    .setDescription('Ban itirazı başlatır veya mevcut itiraz durumunu sorgular')
    .addSubcommand(sub =>
        sub.setName('baslat')
            .setDescription('Banınıza itiraz edin (Ban ID ile)')
            .addStringOption(opt =>
                opt.setName('ban_id')
                    .setDescription('Ban ID (örn: 1)')
                    .setRequired(true)
            )
    )
    .addSubcommand(sub =>
        sub.setName('durum')
            .setDescription('İtiraz veya ban durumunu sorgula')
            .addStringOption(opt =>
                opt.setName('ban_id')
                    .setDescription('Ban ID')
                    .setRequired(true)
            )
    )
    .addSubcommand(sub =>
        sub.setName('liste')
            .setDescription('Tüm bekleyen itirazları listeler (Yetkililer için)')
    );

module.exports = {
    name: 'itiraz',
    data: data.toJSON(),
    description: 'Ban itirazı başlatır veya mevcut itiraz durumunu sorgular',

    async execute(interaction) {
        const sub = interaction.options?.getSubcommand?.();

        const errorEmbed = (msg) => new EmbedBuilder().setColor('Red').setDescription(`❌ ${msg}`);
        const successEmbed = (msg) => new EmbedBuilder().setColor('Green').setDescription(`✅ ${msg}`);

        // ── BAŞLAT ──────────────────────────────────────────────────
        if (!sub || sub === 'baslat') {
            let banId = interaction.options?.getString('ban_id')?.trim();
            if (banId && banId.toUpperCase().startsWith('BAN-')) banId = banId.replace(/^BAN-/i, '');
            
            if (!banId || isNaN(banId)) {
                return interaction.editReply({ embeds: [errorEmbed('Lütfen geçerli bir Ban ID girin. (Örn: `1`)')] });
            }

            const mevcutItiraz = await qdb.get(`itiraz_${banId}`);
            if (mevcutItiraz) {
                const durumRenk = mevcutItiraz.durum === 'onaylandi' ? 0x2ecc71
                    : mevcutItiraz.durum === 'reddedildi' ? 0xe74c3c
                    : 0xf39c12;
                const durumText = {
                    beklemede: '⏳ Beklemede — Yetkililer inceliyor',
                    onaylandi: '✅ Onaylandı — Yasak kaldırıldı',
                    onaylandi_bekliyor: '🕐 Onaylandı — Sunucuya katılmayı bekliyoruz',
                    reddedildi: '❌ Reddedildi'
                }[mevcutItiraz.durum] || '❓ Bilinmiyor';

                const embed = new EmbedBuilder()
                    .setTitle(`⚖️ Mevcut İtiraz: ${banId}`)
                    .setColor(durumRenk)
                    .addFields(
                        { name: '📌 Durum', value: durumText, inline: false },
                        { name: '📝 İtiraz Metni', value: mevcutItiraz.metin || 'Belirtilmedi', inline: false },
                        { name: '📅 Başvuru Tarihi', value: mevcutItiraz.tarih ? `<t:${Math.floor(new Date(mevcutItiraz.tarih).getTime() / 1000)}:R>` : 'Bilinmiyor', inline: true }
                    )
                    .setTimestamp();

                if (mevcutItiraz.durum === 'beklemede') {
                    embed.setFooter({ text: '💡 İtirazınız zaten işlemde. Yetkililerin yanıtı için lütfen bekleyin.' });
                }

                return interaction.editReply({ embeds: [embed] });
            }

            const banData = await qdb.get(`ban_${banId}`)
                || await qdb.get(`ban_user_${interaction.user.id}`);

            if (!banData) {
                return interaction.editReply({
                    embeds: [errorEmbed(`\`${banId}\` kimlikli bir ban kaydı bulunamadı.\n💡 Ban ID'yi ban mesajından veya moderasyon kanalından öğrenebilirsiniz.`)]
                });
            }

            // Kişi başkasının banı için itiraz etmeye çalışıyor mu?
            if (banData.userId && banData.userId !== interaction.user.id) {
                const isYetkili = yetkiliKontrolEt(interaction.member, interaction.user);
                if (!isYetkili) {
                    return interaction.editReply({ embeds: [errorEmbed('Yalnızca kendi banınıza itiraz edebilirsiniz.')] });
                }
            }

            // İtiraz formunu modal olarak aç
            const modal = new ModalBuilder()
                .setCustomId(`itiraz_modal_${banId}`)
                .setTitle('⚖️ Ban İtiraz Formu');

            const sebepInput = new TextInputBuilder()
                .setCustomId('itiraz_gerekce')
                .setLabel('İtiraz Gerekçeniz')
                .setStyle(TextInputStyle.Paragraph)
                .setPlaceholder('Banın kaldırılması gerektiğini düşündüğünüz nedenleri detaylıca açıklayın...')
                .setMinLength(30)
                .setMaxLength(1000)
                .setRequired(true);

            const ek1 = new TextInputBuilder()
                .setCustomId('itiraz_ek_bilgi')
                .setLabel('Ek Bilgi (İsteğe Bağlı)')
                .setStyle(TextInputStyle.Short)
                .setPlaceholder('Varsa tanık, delil veya bağlam ekleyin')
                .setRequired(false);

            modal.addComponents(
                new ActionRowBuilder().addComponents(sebepInput),
                new ActionRowBuilder().addComponents(ek1)
            );

            await interaction.showModal(modal);
            return;
        }

        // ── DURUM ────────────────────────────────────────────────────
        if (sub === 'durum') {
            let banId = interaction.options.getString('ban_id').trim();
            if (banId && banId.toUpperCase().startsWith('BAN-')) banId = banId.replace(/^BAN-/i, '');

            const itiraz = await qdb.get(`itiraz_${banId}`);
            const banData = await qdb.get(`ban_${banId}`);

            if (!itiraz && !banData) {
                return interaction.editReply({ embeds: [errorEmbed(`\`${banId}\` kimlikli ban veya itiraz kaydı bulunamadı.`)] });
            }

            const durumRenk = itiraz?.durum === 'onaylandi' ? 0x2ecc71
                : itiraz?.durum === 'reddedildi' ? 0xe74c3c
                : 0xf39c12;

            const durumText = {
                beklemede: '⏳ Beklemede',
                onaylandi: '✅ Onaylandı — Yasak kaldırıldı',
                onaylandi_bekliyor: '🕐 Onaylandı — Sunucuya katılma bekleniyor',
                reddedildi: '❌ Reddedildi'
            }[itiraz?.durum] || '📋 İtiraz yok';

            const embed = new EmbedBuilder()
                .setTitle(`⚖️ Ban Kaydı: ${banId}`)
                .setColor(durumRenk)
                .addFields(
                    { name: '👤 Banlanan', value: banData?.hedefTag || banData?.userId || itiraz?.userTag || 'Bilinmiyor', inline: true },
                    { name: '👮 Banlayan', value: banData?.yetkiliTag || 'Bilinmiyor', inline: true },
                    { name: '💬 Ban Sebebi', value: banData?.sebep || 'Belirtilmedi', inline: false },
                    { name: '📅 Ban Tarihi', value: banData?.tarih ? `<t:${Math.floor(new Date(banData.tarih).getTime() / 1000)}:F>` : 'Bilinmiyor', inline: true },
                    { name: '📌 İtiraz Durumu', value: durumText, inline: true }
                )
                .setTimestamp();

            if (itiraz?.metin) {
                embed.addFields({ name: '📝 İtiraz Metni', value: itiraz.metin, inline: false });
            }

            // Eğer itiraz yoksa ve ban kaydı varsa başvuru butonu sun
            const rows = [];
            if (!itiraz && banData) {
                const banSahibiMi = banData.userId === interaction.user.id;
                const isYetkili = yetkiliKontrolEt(interaction.member, interaction.user);
                if (banSahibiMi || isYetkili) {
                    rows.push(new ActionRowBuilder().addComponents(
                        new ButtonBuilder()
                            .setCustomId(`itiraz_baslat_${banId}`)
                            .setLabel('⚖️ İtiraz Başlat')
                            .setStyle(ButtonStyle.Primary)
                    ));
                }
            }

            return interaction.editReply({ embeds: [embed], components: rows });
        }

        // ── LİSTE ───────────────────────────────────────────────────
        if (sub === 'liste') {
            if (!yetkiliKontrolEt(interaction.member, interaction.user)) {
                return interaction.editReply({ embeds: [errorEmbed('Bu komutu yalnızca yetkililer kullanabilir.')] });
            }

            const tumVeriler = await qdb.all();
            const itirazlar = Array.isArray(tumVeriler)
                ? tumVeriler.filter(item => item.id?.startsWith('itiraz_') && item.value?.durum === 'beklemede')
                : [];

            if (!itirazlar.length) {
                return interaction.editReply({ embeds: [successEmbed('Şu anda beklemede itiraz bulunmuyor.')] });
            }

            const embed = new EmbedBuilder()
                .setTitle(`📋 Bekleyen Ban İtirazları (${itirazlar.length})`)
                .setColor(0xf39c12)
                .setTimestamp();

            for (const item of itirazlar.slice(0, 10)) {
                const itiraz = item.value;
                embed.addFields({
                    name: `🆔 ${itiraz.banId}`,
                    value: `👤 <@${itiraz.userId}> • 📅 <t:${Math.floor(new Date(itiraz.tarih).getTime() / 1000)}:R>\n📝 ${itiraz.metin?.slice(0, 80)}${itiraz.metin?.length > 80 ? '…' : ''}`,
                    inline: false
                });
            }

            if (itirazlar.length > 10) {
                embed.setFooter({ text: `+${itirazlar.length - 10} daha fazla itiraz var. İtiraz kanalını kontrol edin.` });
            }

            const kanalId = await qdb.get('itiraz_kanal') || interaction.client.config?.ITIRAZ_KANAL_ID;
            if (kanalId) {
                embed.setFooter({ text: `İtiraz kanalı: <#${kanalId}>` });
            }

            return interaction.editReply({ embeds: [embed] });
        }
    }
};
