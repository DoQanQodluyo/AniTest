const { 
    SlashCommandBuilder, 
    EmbedBuilder, 
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle, 
    StringSelectMenuBuilder, 
    StringSelectMenuOptionBuilder,
    PermissionFlagsBits
} = require('discord.js');
const db = require('croxydb');
const config = require('../../config.js');

function yetkiliKontrolEt(member, user) {
    if (!member && !user) return false;
    const userId = user?.id || member?.id;
    if (userId === config.BOT_OWNER_ID || userId === config.SAHIP_ID) return true;
    if (member?.permissions?.has(PermissionFlagsBits.Administrator)) return true;

    const izinliRoller = Array.isArray(config.YETKILI_ROL_IDLERI) ? config.YETKILI_ROL_IDLERI : [];
    if (member?.roles?.cache) {
        return member.roles.cache.some(role => izinliRoller.includes(role.id));
    }
    return false;
}

function kuralKitapcigiOlustur(seciliKategori, sayfa = 0) {
    const kurallar = db.get('kurallar_listesi') || [];
    
    const kategorilerSet = new Set(kurallar.map(r => r.kategori));
    kategorilerSet.add('Genel Kurallar');
    kategorilerSet.add('Vardiya Kuralları');
    kategorilerSet.add('Acil Durum / Ek Yasalar');

    const kategoriler = [...kategorilerSet];
    const aktifKategori = seciliKategori || kategoriler[0];

    const kategoriKurallari = kurallar.filter(r => r.kategori === aktifKategori);

    kategoriKurallari.sort((a, b) => {
        if (a.madde !== b.madde) return a.madde - b.madde;
        if (a.fikra !== b.fikra) return a.fikra - b.fikra;
        return String(a.bent).localeCompare(String(b.bent), undefined, { numeric: true });
    });

    const sayfaBoyutu = 5;
    const toplamSayfa = Math.max(1, Math.ceil(kategoriKurallari.length / sayfaBoyutu));
    const mevcutSayfa = Math.min(Math.max(0, sayfa), toplamSayfa - 1);

    const sayfadakiKurallar = kategoriKurallari.slice(mevcutSayfa * sayfaBoyutu, (mevcutSayfa + 1) * sayfaBoyutu);

    let aciklama = `**Seçili Kategori:** ${aktifKategori}\n**Sayfa:** ${mevcutSayfa + 1} / ${toplamSayfa}\n\n`;
    if (sayfadakiKurallar.length === 0) {
        aciklama += '*Bu kategoride henüz kayıtlı kural veya ek yasa bulunmamaktadır.*';
    } else {
        sayfadakiKurallar.forEach(k => {
            const ekYasaMetni = k.ekYasa ? ` (${k.tarih || ''} Tarihli Ek Yasa)` : '';
            aciklama += `• **Madde ${k.madde} - Fıkra ${k.fikra} (Bent ${k.bent}):** ${k.metin}${ekYasaMetni}\n\n`;
        });
    }

    const embed = new EmbedBuilder()
        .setTitle('📜 Yetkili Kural Kitapçığı (Hiyerarşik Anayasa)')
        .setColor('Gold')
        .setDescription(aciklama)
        .setFooter({ text: `Kategori İçi Kural Sayısı: ${kategoriKurallari.length} | AniTest` })
        .setTimestamp();

    const selectMenu = new StringSelectMenuBuilder()
        .setCustomId('kural_secim_kategori')
        .setPlaceholder('Kategori seçin...')
        .addOptions(
            kategoriler.map(kat => 
                new StringSelectMenuOptionBuilder()
                    .setLabel(kat)
                    .setValue(kat)
                    .setDefault(kat === aktifKategori)
            )
        );

    const oncekiButon = new ButtonBuilder()
        .setCustomId(`kural_sayfa_prev_${encodeURIComponent(aktifKategori)}_${mevcutSayfa}`)
        .setLabel('◀️ Önceki')
        .setStyle(ButtonStyle.Primary)
        .setDisabled(mevcutSayfa === 0);

    const sonrakiButon = new ButtonBuilder()
        .setCustomId(`kural_sayfa_next_${encodeURIComponent(aktifKategori)}_${mevcutSayfa}`)
        .setLabel('Sonraki ▶️')
        .setStyle(ButtonStyle.Primary)
        .setDisabled(mevcutSayfa >= toplamSayfa - 1);

    const satir1 = new ActionRowBuilder().addComponents(selectMenu);
    const satir2 = new ActionRowBuilder().addComponents(oncekiButon, sonrakiButon);

    return { embeds: [embed], components: [satir1, satir2] };
}

const data = new SlashCommandBuilder()
    .setName('kural')
    .setDescription('Kural kitapçığı görüntüleme, kural ekleme ve silme')
    .addSubcommand(sub =>
        sub.setName('kitapcik')
            .setDescription('Etkileşimli kural kitapçığını açar')
    )
    .addSubcommand(sub =>
        sub.setName('ekle')
            .setDescription('Yeni bir yetkili kuralı veya ek yasa ekler')
            .addStringOption(opt => opt.setName('kategori').setDescription('Kural kategorisi').setRequired(true))
            .addIntegerOption(opt => opt.setName('madde').setDescription('Madde numarası').setRequired(true))
            .addIntegerOption(opt => opt.setName('fikra').setDescription('Fıkra numarası').setRequired(true))
            .addStringOption(opt => opt.setName('bent').setDescription('Bent numarası / harfi').setRequired(true))
            .addStringOption(opt => opt.setName('metin').setDescription('Kural açıklaması ve metni').setRequired(true))
            .addBooleanOption(opt => opt.setName('ek_yasa').setDescription('Ek yasa mı? (Varsayılan: false)').setRequired(false))
    )
    .addSubcommand(sub =>
        sub.setName('sil')
            .setDescription('Bir kuralı siler ve takip eden bentleri otomatik kaydırır')
            .addStringOption(opt => opt.setName('id').setDescription('Silinecek kural ID (Örn: 2.3.4)').setRequired(true))
    );

module.exports = {
    name: 'kural',
    data: data.toJSON(),
    description: 'Kural kitapçığı görüntüleme, kural ekleme ve silme',
    kuralKitapcigiOlustur,
    async execute(message, args, client) {
        const options = message.slashOptions || message.options;
        const altKomut = options?.getSubcommand?.() || args[0];
        const member = message.member;
        const user = message.author || message.user;

        if (altKomut === 'ekle' || altKomut === 'sil') {
            if (!yetkiliKontrolEt(member, user)) {
                return message.reply({ content: '❌ Bu işlemi yapmak için yetkili olmalısınız.', flags: 64 });
            }
        }

        if (altKomut === 'ekle') {
            const kategori = options.getString('kategori');
            const madde = options.getInteger('madde');
            const fikra = options.getInteger('fikra');
            const bent = options.getString('bent');
            const metin = options.getString('metin');
            const isEkYasa = options.getBoolean('ek_yasa') || false;

            const bugunStr = new Date().toISOString().split('T')[0];
            const sonKategori = isEkYasa ? 'Acil Durum / Ek Yasalar' : kategori;
            const kuralId = `${madde}.${fikra}.${bent}`;

            const yeniKural = { id: kuralId, kategori: sonKategori, madde, fikra, bent, metin, ekYasa: isEkYasa, tarih: bugunStr };
            const kurallar = db.get('kurallar_listesi') || [];
            const idx = kurallar.findIndex(r => r.id === kuralId);
            if (idx !== -1) kurallar[idx] = yeniKural;
            else kurallar.push(yeniKural);

            db.set('kurallar_listesi', kurallar);
            db.add('weekly_new_rules_count', 1);

            return message.reply({ content: `✅ **[Kural ${kuralId}]** başarıyla kaydedildi.`, flags: 64 });
        }

        if (altKomut === 'sil') {
            const hedefId = (options?.getString?.('id') || '').trim();
            const kurallar = db.get('kurallar_listesi') || [];
            const idx = kurallar.findIndex(r => r.id === hedefId);

            if (idx === -1) return message.reply({ content: `❌ ID'si \`${hedefId}\` olan kural bulunamadı.`, flags: 64 });

            const silinen = kurallar[idx];
            kurallar.splice(idx, 1);

            if (!isNaN(Number(silinen.bent))) {
                kurallar.forEach(k => {
                    if (k.madde === silinen.madde && k.fikra === silinen.fikra && Number(k.bent) > Number(silinen.bent)) {
                        k.bent = String(Number(k.bent) - 1);
                        k.id = `${k.madde}.${k.fikra}.${k.bent}`;
                    }
                });
            }

            db.set('kurallar_listesi', kurallar);
            return message.reply({ content: `✅ Kural \`${hedefId}\` silindi ve sonraki bentler kaydırıldı.`, flags: 64 });
        }

        return message.reply(kuralKitapcigiOlustur());
    }
};
