// --- src/commands/sicil.js ---
const { SlashCommandBuilder, EmbedBuilder, PermissionsBitField } = require('discord.js');
const db = require('croxydb');
const config = require('../../config.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('sicil')
        .setDescription('Kullanıcıların disiplin ve sicil kayıtlarını yönetir.')
        .addSubcommand(subcommand =>
            subcommand
                .setName('sorgula')
                .setDescription('Bir kullanıcının sicil geçmişini görüntüler.')
                .addUserOption(option => option.setName('kullanici').setDescription('Sorgulanacak kullanıcı').setRequired(true))
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('ekle')
                .setDescription('Bir kullanıcıya sicil kaydı ekler (Sadece Yetkililer).')
                .addUserOption(option => option.setName('kullanici').setDescription('Hedef kullanıcı').setRequired(true))
                .addStringOption(option => option.setName('ceza').setDescription('Uygulanan ceza türü').addChoices(
                    { name: 'Uyarı (Uyar)', value: 'Uyar' },
                    { name: 'Susturma (Mute)', value: 'Mute' },
                    { name: 'Yasaklama (Ban)', value: 'Ban' }
                ).setRequired(true))
                .addStringOption(option => option.setName('sebep').setDescription('Cezanın sebebi').setRequired(true))
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('temizle')
                .setDescription('Bir kullanıcının tüm sicil kayıtlarını siler (Sadece Yöneticiler).')
                .addUserOption(option => option.setName('kullanici').setDescription('Sicili temizlenecek kullanıcı').setRequired(true))
        ),

    async execute(interaction, client) {
        const subCmd = interaction.options.getSubcommand();
        const targetUser = interaction.options.getUser('kullanici');
        const dbKey = `sicil_${targetUser.id}`;
        
        // Yetki Kontrolleri
        const isAdmin = interaction.member.permissions.has(PermissionsBitField.Flags.Administrator) || interaction.user.id === config.BOT_OWNER_ID;
        
        // Mod rol kontrolü (kısmi yetki)
        let isStaff = isAdmin;
        if (!isStaff && config.YETKILI_ROL_IDLERI) {
            const yetkiliRolleri = config.YETKILI_ROL_IDLERI.split(',');
            for (const rolId of yetkiliRolleri) {
                if (interaction.member.roles.cache.has(rolId)) {
                    isStaff = true;
                    break;
                }
            }
        }

        if (subCmd === 'sorgula') {
            const sicilKayitlari = db.get(dbKey) || [];
            
            if (sicilKayitlari.length === 0) {
                return interaction.reply({ content: `✅ <@${targetUser.id}> isimli kullanıcının sicili temiz. Kayıt bulunamadı.`, ephemeral: true });
            }

            const embed = new EmbedBuilder()
                .setTitle(`📂 ${targetUser.username} - Sicil Dosyası`)
                .setColor('Orange')
                .setThumbnail(targetUser.displayAvatarURL())
                .setDescription(`Toplam **${sicilKayitlari.length}** adet kayıt bulundu.\nDetaylı inceleme için Web Dashboard'u kullanabilirsiniz.`);

            sicilKayitlari.slice(-5).forEach((kayit, index) => { // Sadece son 5 kaydı göster
                const tarih = new Date(kayit.tarih).toLocaleDateString('tr-TR');
                embed.addFields({
                    name: `${index + 1}. Kayıt - [${kayit.ceza}] - ${tarih}`,
                    value: `**Sebep:** ${kayit.sebep}\n**Yetkili:** ${kayit.yetkili}`
                });
            });

            return interaction.reply({ embeds: [embed] });
        }

        if (subCmd === 'ekle') {
            if (!isStaff) return interaction.reply({ content: '❌ Bu işlemi yalnızca yetkililer yapabilir.', ephemeral: true });
            
            const cezaTuru = interaction.options.getString('ceza');
            const sebep = interaction.options.getString('sebep');
            
            const sicilKayitlari = db.get(dbKey) || [];
            
            sicilKayitlari.push({
                tarih: new Date().toISOString(),
                sebep: sebep,
                ceza: cezaTuru,
                yetkili: interaction.user.tag
            });

            db.set(dbKey, sicilKayitlari);
            return interaction.reply({ content: `✅ <@${targetUser.id}> adlı kullanıcının dosyasına **[${cezaTuru}]** kaydı eklendi.` });
        }

        if (subCmd === 'temizle') {
            if (!isAdmin) return interaction.reply({ content: '❌ Sicil temizleme işlemini yalnızca üst düzey yöneticiler yapabilir.', ephemeral: true });
            
            db.delete(dbKey);
            return interaction.reply({ content: `🧹 <@${targetUser.id}> adlı kullanıcının tüm sicil geçmişi başarıyla silindi.` });
        }
    }
};
