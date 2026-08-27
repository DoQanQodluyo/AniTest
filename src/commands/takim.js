const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('croxydb');
const { yetkiliKontrolEt, qdb } = require('../utils/moderationGuard');

const data = new SlashCommandBuilder()
    .setName('takim')
    .setDescription('Ekip ve takım yönetim işlemleri')
    .addSubcommand(sub =>
        sub.setName('uye')
            .setDescription('Takıma üye ekler veya takımdan üye çıkarır (sadece yetkili rollüler eklenebilir)')
            .addStringOption(opt =>
                opt.setName('islem')
                    .setDescription('İşlem türü')
                    .setRequired(true)
                    .addChoices(
                        { name: 'Ekle', value: 'ekle' },
                        { name: 'Çıkar', value: 'cikar' }
                    )
            )
            .addUserOption(opt => opt.setName('kullanici').setDescription('Hedef kullanıcı').setRequired(true))
    )
    .addSubcommand(sub =>
        sub.setName('isim')
            .setDescription('Takım adını günceller')
            .addStringOption(opt => opt.setName('yeni_isim').setDescription('Yeni takım adı').setRequired(true))
    )
    .addSubcommand(sub =>
        sub.setName('rapor')
            .setDescription('Takım performans ve aktivite raporunu üretir')
    )
    .addSubcommand(sub =>
        sub.setName('lider-uyar')
            .setDescription('Takım liderine uyarı verir')
            .addUserOption(opt => opt.setName('lider').setDescription('Hedef takım lideri').setRequired(true))
            .addStringOption(opt => opt.setName('sebep').setDescription('Uyarı sebebi').setRequired(true))
    );

module.exports = {
    name: 'takim',
    data: data.toJSON(),
    description: 'Ekip ve takım yönetim işlemleri',
    async execute(message, args, client) {
        const options = message.slashOptions || message.options;
        const guild = message.guild;
        const user = message.author || message.user;

        // Komutu kullanan kişi yetkili mi?
        if (!yetkiliKontrolEt(message.member, user)) {
            return message.reply({ content: '❌ Bu komutu yalnızca yetkililer kullanabilir.', flags: 64 });
        }

        const config = client?.config || require('../../config.js');
        const izinliRoller = [
            ...(Array.isArray(config.YETKILI_ROL_IDLERI) ? config.YETKILI_ROL_IDLERI : []),
            ...(Array.isArray(config.STAFF_ROLES) ? config.STAFF_ROLES : [])
        ];

        const altKomut = options?.getSubcommand?.() || args[0];

        if (altKomut === 'uye') {
            const islem = options.getString('islem');
            const targetUser = options.getUser('kullanici');
            const targetMember = guild.members.cache.get(targetUser.id) || await guild.members.fetch(targetUser.id).catch(() => null);
            const teamMembers = db.get(`takim_uyeleri_${guild.id}`) || [];

            if (islem === 'ekle') {
                // Yetkili rolü kontrolü — yetkili rolü olmayan birini takıma ekleme
                if (targetMember) {
                    const hedefYetkiliRolVarMi = izinliRoller.some(rolId => targetMember.roles.cache.has(rolId));
                    if (!hedefYetkiliRolVarMi) {
                        return message.reply({
                            content: `❌ **<@${targetUser.id}>** kullanıcısının takıma eklenebilmesi için bir **yetkili rolü** olması gerekir.\nYetkili rolü olmayan üyeler takıma alınamaz.`,
                            flags: 64
                        });
                    }
                } else {
                    return message.reply({
                        content: `❌ **<@${targetUser.id}>** şu an sunucuda bulunmuyor. Sunucudaki yetkilileri takıma ekleyebilirsiniz.`,
                        flags: 64
                    });
                }

                if (!teamMembers.includes(targetUser.id)) {
                    teamMembers.push(targetUser.id);
                    db.set(`takim_uyeleri_${guild.id}`, teamMembers);
                    // quick.db'yi de güncelle
                    await qdb.set(`takim_uyeler_${guild.id}`, teamMembers).catch(() => null);
                    return message.reply({ content: `✅ <@${targetUser.id}> takıma başarıyla eklendi.`, flags: 64 });
                } else {
                    return message.reply({ content: `ℹ️ <@${targetUser.id}> zaten takım üyesi.`, flags: 64 });
                }
            } else {
                const newMembers = teamMembers.filter(id => id !== targetUser.id);
                db.set(`takim_uyeleri_${guild.id}`, newMembers);
                await qdb.set(`takim_uyeler_${guild.id}`, newMembers).catch(() => null);
                return message.reply({ content: `🔴 <@${targetUser.id}> takımdan çıkarıldı.`, flags: 64 });
            }
        }

        if (altKomut === 'isim') {
            const yeniIsim = options.getString('yeni_isim');
            db.set(`takim_adi_${guild.id}`, yeniIsim);
            return message.reply({ content: `✅ Takım adı **"${yeniIsim}"** olarak güncellendi.`, flags: 64 });
        }

        if (altKomut === 'rapor') {
            const takimAdi = db.get(`takim_adi_${guild.id}`) || 'AniTest Takımı';
            const uyeler = db.get(`takim_uyeleri_${guild.id}`) || [];

            // Üyelerin yetkili kontrolü — listeden yetkili rolü kalmamış olanları işaretle
            const uyeDetay = await Promise.all(uyeler.map(async id => {
                const m = guild.members.cache.get(id) || await guild.members.fetch(id).catch(() => null);
                const yetkiliMi = m ? izinliRoller.some(rolId => m.roles.cache.has(rolId)) : false;
                return `• <@${id}>${yetkiliMi ? '' : ' ⚠️ *[Yetkili rolü yok]*'}`;
            }));

            const uyeListesi = uyeDetay.length ? uyeDetay.join('\n') : '*Takımda henüz üye bulunmuyor.*';

            const embed = new EmbedBuilder()
                .setTitle(`🛡️ Takım Performans Raporu: ${takimAdi}`)
                .setColor('Blue')
                .addFields(
                    { name: '👥 Takım Üyeleri Sayısı', value: `**${uyeler.length}** Üye`, inline: true },
                    { name: '📋 Üye Kadrosu', value: uyeListesi, inline: false }
                )
                .setFooter({ text: '⚠️ işareti yetkili rolü olmayan üyeleri gösterir.' })
                .setTimestamp();

            return message.reply({ embeds: [embed] });
        }

        if (altKomut === 'lider-uyar') {
            const liderUser = options.getUser('lider');
            const sebep = options.getString('sebep');

            const uyarilar = db.get(`lider_uyari_${liderUser.id}`) || [];
            uyarilar.push({ sebep, tarih: new Date().toISOString().split('T')[0] });
            db.set(`lider_uyari_${liderUser.id}`, uyarilar);

            const embed = new EmbedBuilder()
                .setTitle('⚠️ Takım Liderine Uyarı Verildi')
                .setColor('Orange')
                .addFields(
                    { name: '👤 Takım Lideri', value: `<@${liderUser.id}>`, inline: true },
                    { name: '📝 Uyarı Sebebi', value: sebep, inline: false },
                    { name: '📊 Toplam Uyarı Sayısı', value: `**${uyarilar.length}**`, inline: true }
                )
                .setTimestamp();

            return message.reply({ embeds: [embed] });
        }

        return message.reply({ content: '❌ Geçersiz alt komut.', flags: 64 });
    }
};