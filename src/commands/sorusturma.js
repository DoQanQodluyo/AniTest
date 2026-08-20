const { SlashCommandBuilder } = require('discord.js');
const { yetkiliMi, okuDosya, yazDosya, dosyaEmbed, dosyaButonlari, gecmisButonlari, adliKullaniciBildirimi, kanalGonder, sahipDm, rolleriDondur, rolleriIadeEt } = require('../utils/judicialSystem');
const { kayitId } = require('../utils/recordStore');

module.exports = {
    name: 'sorusturma',
    data: new SlashCommandBuilder()
        .setName('sorusturma')
        .setDescription('Soruşturma dosyalarını tek merkezden yönetir.')
        .addSubcommand(sub => sub.setName('ac').setDescription('Yeni dosya açar.')
            .addStringOption(o => o.setName('sorusturma-no').setDescription('Dosya numarası.').setRequired(true))
            .addUserOption(o => o.setName('sanik').setDescription('Baş sanık.').setRequired(true)))
        .addSubcommand(sub => sub.setName('kapat').setDescription('Dosyayı hükümle kapatır.')
            .addStringOption(o => o.setName('sorusturma-no').setDescription('Dosya numarası.').setRequired(true))
            .addStringOption(o => o.setName('hukum-metni').setDescription('Hüküm metni.').setRequired(true)))
        .addSubcommand(sub => sub.setName('ifade-ekle').setDescription('İfade veya delil ekler.')
            .addStringOption(o => o.setName('sorusturma-no').setDescription('Dosya numarası.').setRequired(true))
            .addStringOption(o => o.setName('ifade').setDescription('İfade metni.').setRequired(true)))
        .addSubcommand(sub => sub.setName('ifade-sil').setDescription('İfade veya delil siler.')
            .addStringOption(o => o.setName('sorusturma-no').setDescription('Dosya numarası.').setRequired(true))
            .addStringOption(o => o.setName('ifade-id').setDescription('Örnek: #1.').setRequired(true)))
        .addSubcommand(sub => sub.setName('sanik-ekle').setDescription('Ek sanık ekler.')
            .addStringOption(o => o.setName('sorusturma-no').setDescription('Dosya numarası.').setRequired(true))
            .addUserOption(o => o.setName('kullanici').setDescription('Sanık.').setRequired(true)))
        .addSubcommand(sub => sub.setName('sanik-sil').setDescription('Ek sanık siler.')
            .addStringOption(o => o.setName('sorusturma-no').setDescription('Dosya numarası.').setRequired(true))
            .addUserOption(o => o.setName('kullanici').setDescription('Sanık.').setRequired(true)))
        .addSubcommand(sub => sub.setName('dondur').setDescription('Baş sanığın rollerini dondurur.')
            .addStringOption(o => o.setName('sorusturma-no').setDescription('Dosya numarası.').setRequired(true)))
        .addSubcommand(sub => sub.setName('iade').setDescription('Baş sanığın rollerini iade eder.')
            .addStringOption(o => o.setName('sorusturma-no').setDescription('Dosya numarası.').setRequired(true))),
    aliases: [], category: 'Adli Sistem', description: 'Tüm soruşturma işlemlerini tek komutta toplar.', usage: '/sorusturma',
    async execute(message, args, client) {
        if (!yetkiliMi(message.member)) return message.reply('❌ Bu komut yalnızca yetkililere açıktır.');
        const action = message.slashOptions?.getSubcommand();
        const no = message.slashOptions?.getString('sorusturma-no');
        if (!action || !no) return message.reply('❌ İşlem ve soruşturma numarası zorunludur.');
        if (action === 'ac') {
            const sanik = message.slashOptions.getUser('sanik');
            if (!sanik || okuDosya(message.guild.id, no)) return message.reply('❌ Sanık eksik veya dosya numarası zaten kullanımda.');
            const dosya = yazDosya(message.guild.id, no, { numara: no, basSanik: sanik.id, saniklar: [sanik.id], ifadeler: [], durum: 'HÜKÜMSÜZ (Devam Ediyor)', acan: message.author.id, acanEtiket: message.author.tag, acilmaZamani: Date.now() });
            await adliKullaniciBildirimi(client, sanik, '⚖️ Hakkınızda soruşturma açıldı', `${no} numaralı soruşturma dosyasında sanık olarak yer alıyorsunuz.`);
            return message.reply({ embeds: [dosyaEmbed(dosya)], components: [dosyaButonlari(no, sanik.id)] });
        }
        const dosya = okuDosya(message.guild.id, no);
        if (!dosya) return message.reply('❌ Soruşturma dosyası bulunamadı.');
        if (action === 'kapat') {
            const hukum = message.slashOptions.getString('hukum-metni');
            if (!hukum) return message.reply('❌ Hüküm metni zorunludur.');
            dosya.durum = 'HÜKÜMLÜ (Kapatıldı)'; dosya.hukum = hukum; dosya.kapatan = message.author.id;
            const kayit = yazDosya(message.guild.id, no, dosya);
            const sanik = await message.guild.members.fetch(dosya.basSanik).catch(() => null);
            if (sanik) await adliKullaniciBildirimi(client, sanik, '⚖️ Soruşturma kapatıldı', `${no} numaralı dosya kapatıldı. Hüküm: ${hukum}`);
            const payload = { embeds: [dosyaEmbed(kayit)], components: [dosyaButonlari(no, dosya.basSanik)] };
            await kanalGonder(client, payload); await sahipDm(client, payload);
            return message.reply({ embeds: [dosyaEmbed(kayit)] });
        }
        if (action === 'ifade-ekle') {
            const ifade = message.slashOptions.getString('ifade');
            if (!ifade) return message.reply('❌ İfade metni zorunludur.');
            dosya.ifadeler.push({ id: kayitId('IFD'), metin: ifade, ekleyen: message.author.id, zaman: Date.now() });
        } else if (action === 'ifade-sil') {
            const ifadeId = message.slashOptions.getString('ifade-id');
            dosya.ifadeler = dosya.ifadeler.filter(ifade => ifade.id !== ifadeId);
        } else if (action === 'sanik-ekle' || action === 'sanik-sil') {
            const kullanici = message.slashOptions.getUser('kullanici');
            if (!kullanici) return message.reply('❌ Kullanıcı zorunludur.');
            if (action === 'sanik-ekle' && !dosya.saniklar.includes(kullanici.id)) dosya.saniklar.push(kullanici.id);
            if (action === 'sanik-sil' && kullanici.id !== dosya.basSanik) dosya.saniklar = dosya.saniklar.filter(id => id !== kullanici.id);
            const sanikMember = await message.guild.members.fetch(kullanici.id).catch(() => null);
            if (sanikMember) await adliKullaniciBildirimi(client, sanikMember, action === 'sanik-ekle' ? '⚖️ Soruşturmaya eklendiniz' : '⚖️ Soruşturmadan çıkarıldınız', `${no} numaralı soruşturma dosyasındaki durumunuz güncellendi.`);
        } else if (action === 'dondur' || action === 'iade') {
            const member = await message.guild.members.fetch(dosya.basSanik).catch(() => null);
            if (!member) return message.reply('❌ Baş sanık sunucuda bulunamadı.');
            if (action === 'dondur') { await rolleriDondur(member, dosya); dosya.yetkilerDonduruldu = true; }
            else if (!await rolleriIadeEt(member, dosya)) return message.reply('❌ Rol yedeği bulunamadı.');
            dosya.yetkilerDonduruldu = action === 'dondur';
            await adliKullaniciBildirimi(client, member, action === 'dondur' ? '🔴 Yetkileriniz donduruldu' : '🟢 Rolleriniz iade edildi', `${no} numaralı dosya kapsamında işlem yapıldı.`);
        }
        const kayit = yazDosya(message.guild.id, no, dosya);
        return message.reply({ embeds: [dosyaEmbed(kayit)], components: [dosyaButonlari(no, dosya.basSanik)] });
    }
};
