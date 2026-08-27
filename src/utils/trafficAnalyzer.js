const { AttachmentBuilder, EmbedBuilder } = require('discord.js');
const { ChartJSNodeCanvas } = require('chartjs-node-canvas');
const db = require('croxydb');
const { ilerlemeBaslat } = require('./progressReporter');

const chartCanvas = new ChartJSNodeCanvas({ width: 800, height: 400, backgroundColour: '#111827' });

function saatAnahtari(tarih = new Date()) {
    return `${tarih.getFullYear()}_${String(tarih.getMonth() + 1).padStart(2, '0')}_${String(tarih.getDate()).padStart(2, '0')}_${String(tarih.getHours()).padStart(2, '0')}`;
}

function trafikArtir(tur, guildId, miktar = 1, tarih = new Date(), kanalId = 'genel') {
    if (!guildId || !Number.isFinite(miktar) || miktar <= 0) return;
    db.add(`traffic_${saatAnahtari(tarih)}_${guildId}_${kanalId}_${tur}`, miktar);
}

function istatistikHesapla(degerler) {
    const liste = degerler.map(Number).filter(Number.isFinite);
    if (!liste.length) return { toplam: 0, ortalama: 0, medyan: 0, varyans: 0, standartSapma: 0, mod: [], pikler: [] };
    const sirali = [...liste].sort((a, b) => a - b);
    const toplam = sirali.reduce((a, b) => a + b, 0);
    const ortalama = toplam / sirali.length;
    const medyan = sirali.length % 2 ? sirali[(sirali.length - 1) / 2] : (sirali[sirali.length / 2 - 1] + sirali[sirali.length / 2]) / 2;
    const varyans = sirali.reduce((a, b) => a + (b - ortalama) ** 2, 0) / sirali.length;
    const frekans = new Map();
    sirali.forEach(sayi => frekans.set(sayi, (frekans.get(sayi) || 0) + 1));
    const enYuksek = Math.max(...frekans.values());
    return { toplam, ortalama, medyan, varyans, standartSapma: Math.sqrt(varyans), mod: enYuksek > 1 ? [...frekans.entries()].filter(([, sayi]) => sayi === enYuksek).map(([sayi]) => sayi) : [], pikler: sirali.slice(-3).reverse() };
}

function veriTopla(guildId) {
    const saatlik = Array.from({ length: 24 }, () => 0);
    const gunluk = Array.from({ length: 7 }, () => 0);
    const veriKanallari = {};
    const simdi = Date.now();
    const tumVeriler = db.all();
    for (const [anahtar, deger] of Object.entries(tumVeriler)) {
        const yeni = anahtar.match(/^traffic_(\d{4})_(\d{2})_(\d{2})_(\d{2})_([^_]+)_([^_]+)_(mesaj|ses)$/);
        const eski = anahtar.match(/^traffic_(\d{4})_(\d{2})_(\d{2})_(\d{2})_([^_]+)_(mesaj|ses)$/);
        const parcalar = yeni || eski;
        if (!parcalar || parcalar[5] !== guildId) continue;
        const [, yil, ay, gun, saat] = parcalar;
        const kanalId = yeni ? parcalar[6] : 'genel';
        const tarih = new Date(Number(yil), Number(ay) - 1, Number(gun), Number(saat));
        if (simdi - tarih.getTime() > 28 * 24 * 60 * 60 * 1000 || tarih.getTime() > simdi) continue;
        const miktar = Number(deger) || 0;
        saatlik[Number(saat)] += miktar;
        gunluk[tarih.getDay() === 0 ? 6 : tarih.getDay() - 1] += miktar;
        if (!veriKanallari[kanalId]) veriKanallari[kanalId] = { saatlik: Array(24).fill(0), gunluk: Array(7).fill(0) };
        veriKanallari[kanalId].saatlik[Number(saat)] += miktar;
        veriKanallari[kanalId].gunluk[tarih.getDay() === 0 ? 6 : tarih.getDay() - 1] += miktar;
    }
    return { saatlik, gunluk, kanallar: veriKanallari };
}

async function apiVerisiTopla(guild, kanalId = null, ilerleme = null) {
    const saatlik = Array.from({ length: 24 }, () => 0);
    const gunluk = Array.from({ length: 7 }, () => 0);
    const kanallar = {};
    const baslangic = Date.now() - 28 * 24 * 60 * 60 * 1000;
    const hedefKanallar = guild.channels.cache.filter(kanal =>
        kanal.isTextBased() && !kanal.isThread() && kanal.messages?.fetch && (!kanalId || kanal.id === kanalId)
    );
    let tarananMesaj = 0;
    let tarananKanal = 0;
    if (ilerleme) await ilerleme(`⏳ API taraması başladı. **${hedefKanallar.size}** kanal kuyruğa alındı.`);
    for (const kanal of hedefKanallar.values()) {
        let oncekiMesajId = null;
        let devam = true;
        while (devam) {
            const secenekler = { limit: 100 };
            if (oncekiMesajId) secenekler.before = oncekiMesajId;
            const mesajlar = await kanal.messages.fetch(secenekler).catch(() => null);
            if (!mesajlar || mesajlar.size === 0) break;
            for (const mesaj of mesajlar.values()) {
                if (mesaj.createdTimestamp < baslangic) {
                    devam = false;
                    break;
                }
                if (mesaj.author.bot || mesaj.createdTimestamp > Date.now()) continue;
                const tarih = new Date(mesaj.createdTimestamp);
                saatlik[tarih.getHours()] += 1;
                gunluk[tarih.getDay() === 0 ? 6 : tarih.getDay() - 1] += 1;
                if (!kanallar[kanal.id]) kanallar[kanal.id] = { saatlik: Array(24).fill(0), gunluk: Array(7).fill(0) };
                kanallar[kanal.id].saatlik[tarih.getHours()] += 1;
                kanallar[kanal.id].gunluk[tarih.getDay() === 0 ? 6 : tarih.getDay() - 1] += 1;
                tarananMesaj += 1;
            }
            oncekiMesajId = mesajlar.last()?.id;
            if (ilerleme) await ilerleme(`🔎 **${kanal.name}** taranıyor... **${tarananMesaj}** mesaj doğrulandı.`);
            if (mesajlar.size < 100) break;
        }
        tarananKanal += 1;
        if (ilerleme) await ilerleme(`✅ Kanal ilerlemesi: **${tarananKanal}/${hedefKanallar.size}** | Mesaj: **${tarananMesaj}**`);
    }
    return { saatlik, gunluk, kanallar, tarananMesaj, kaynak: 'Discord API' };
}

function yuzdelikEsikleri(degerler) {
    const sirali = degerler.map(Number).filter(Number.isFinite).sort((a, b) => a - b);
    if (!sirali.length) return { dusuk: 0, yuksek: 0 };
    const yuzdelik = oran => sirali[Math.min(sirali.length - 1, Math.floor((sirali.length - 1) * oran))];
    return { dusuk: yuzdelik(0.25), yuksek: yuzdelik(0.75) };
}

function sonDortHaftaAnalizi(guildId) {
    const veri = veriTopla(guildId);
    const saatlik = istatistikHesapla(veri.saatlik);
    const gunluk = istatistikHesapla(veri.gunluk);
    const yogunSaat = veri.saatlik.indexOf(Math.max(...veri.saatlik));
    const yogunGun = veri.gunluk.indexOf(Math.max(...veri.gunluk));
    return {
        toplam: saatlik.toplam,
        yogunSaat: `${String(yogunSaat).padStart(2, '0')}:00 (${veri.saatlik[yogunSaat]} etkileşim)`,
        yogunGun: ['Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi', 'Pazar'][yogunGun] || 'Veri yok',
        istatistik: saatlik,
        gunlukIstatistik: gunluk
    };
}

function trendHesapla(degerler) {
    const hareketliOrtalama = degerler.map((_, index) => {
        const pencere = degerler.slice(Math.max(0, index - 2), index + 1);
        return pencere.reduce((a, b) => a + b, 0) / pencere.length;
    });
    const orta = Math.ceil(degerler.length / 2);
    const ilk = degerler.slice(0, orta).reduce((a, b) => a + b, 0);
    const son = degerler.slice(Math.floor(degerler.length / 2)).reduce((a, b) => a + b, 0);
    return { hareketliOrtalama, yuzde: ilk ? ((son - ilk) / ilk) * 100 : son ? 100 : 0 };
}

async function grafikOlustur(tur, veri, esikler = yuzdelikEsikleri(tur === 'gunluk' ? veri.gunluk : veri.saatlik)) {
    const etiketler = tur === 'gunluk' ? ['Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi', 'Pazar'] : Array.from({ length: 24 }, (_, i) => `${String(i).padStart(2, '0')}:00`);
    const degerler = tur === 'gunluk' ? veri.gunluk : veri.saatlik;
    const trend = trendHesapla(degerler);
    const buffer = await chartCanvas.renderToBuffer({ type: 'line', data: { labels: etiketler, datasets: [{ label: 'Etkileşim', data: degerler, borderColor: '#38bdf8', backgroundColor: 'rgba(56,189,248,.2)', fill: true, tension: .35 }, { label: 'Hareketli Ortalama', data: trend.hareketliOrtalama, borderColor: '#fbbf24', borderDash: [6, 4], fill: false, tension: .35 }, { label: 'Düşük sınır (%25)', data: degerler.map(() => esikler.dusuk), borderColor: '#22c55e', borderDash: [3, 5], pointRadius: 0, fill: false }, { label: 'Yüksek sınır (%75)', data: degerler.map(() => esikler.yuksek), borderColor: '#ef4444', borderDash: [3, 5], pointRadius: 0, fill: false }] }, options: { responsive: false, plugins: { legend: { labels: { color: '#f8fafc' } } }, scales: { x: { ticks: { color: '#cbd5e1' }, grid: { color: '#334155' } }, y: { beginAtZero: true, ticks: { color: '#cbd5e1' }, grid: { color: '#334155' } } } } });
    return { attachment: new AttachmentBuilder(buffer, { name: 'trafik-analizi.png' }), trend };
}

async function analizPaketiOlustur(guildId, tur = 'saatlik', kanalId = null) {
    const veri = veriTopla(guildId);
    const kanalVerisi = kanalId ? veri.kanallar[kanalId] : null;
    const analizVerisi = kanalVerisi || veri;
    const grafikTuru = tur === 'gunluk' ? 'gunluk' : 'saatlik';
    const degerler = grafikTuru === 'gunluk' ? analizVerisi.gunluk : analizVerisi.saatlik;
    const istatistik = istatistikHesapla(degerler);
    const esikler = yuzdelikEsikleri(degerler);
    const grafik = await grafikOlustur(grafikTuru, analizVerisi, esikler);
    const embed = new EmbedBuilder()
        .setTitle(`📈 Trafik Analizi: ${tur}${kanalId ? ` | <#${kanalId}>` : ''}`)
        .setColor('Blue')
        .setImage('attachment://trafik-analizi.png')
        .addFields(
            { name: 'Toplam / Ortalama', value: `${istatistik.toplam} / ${istatistik.ortalama.toFixed(2)}`, inline: true },
            { name: 'Medyan', value: istatistik.medyan.toFixed(2), inline: true },
            { name: 'Standart Sapma / Varyans', value: `${istatistik.standartSapma.toFixed(2)} / ${istatistik.varyans.toFixed(2)}`, inline: true },
            { name: 'Mod / Pik Değerler', value: `${istatistik.mod.join(', ') || 'Yok'} / ${istatistik.pikler.join(', ') || 'Yok'}`, inline: false },
            { name: 'Trend Skoru', value: `${grafik.trend.yuzde.toFixed(2)}%`, inline: true },
            { name: 'Analiz Kapsamı', value: kanalId ? 'Seçilen kanal' : 'Tüm sunucu', inline: true },
            { name: 'Yoğunluk Sınıfları', value: `🔵 Düşük: alt %25 (${esikler.dusuk})\n🟡 Orta: %25-%75\n🔴 Yüksek: üst %25 (${esikler.yuksek})`, inline: false },
            { name: 'Veri Kaynağı', value: 'Öncelik: Discord API | Komut doğrudan API taraması kullanır.', inline: false }
        )
        .setFooter({ text: 'Son 4 haftanın saatlik verileri' })
        .setTimestamp();
    return { embeds: [embed], files: [grafik.attachment] };
}

async function apiOncelikliAnalizPaketiOlustur(guild, tur = 'saatlik', kanalId = null, ilerleme = null) {
    let veri;
    try {
        veri = await apiVerisiTopla(guild, kanalId, ilerleme);
        if (!veri.tarananMesaj) throw new Error('API mesaj verisi bulunamadı.');
    } catch (hata) {
        if (ilerleme) await ilerleme('⚠️ Discord API verisi alınamadı. croxydb fallback analizi hazırlanıyor...');
        const paket = await analizPaketiOlustur(guild.id, tur, kanalId);
        paket.embeds[0].addFields({ name: 'Veri Kaynağı', value: `Discord API erişilemedi; croxydb fallback kullanıldı. (${hata.message.slice(0, 120)})` });
        return paket;
    }
    const analizTuru = tur === 'gunluk' ? 'gunluk' : 'saatlik';
    const kanalVerisi = kanalId ? veri.kanallar[kanalId] : null;
    const analizVerisi = kanalVerisi || veri;
    const degerler = analizTuru === 'gunluk' ? analizVerisi.gunluk : analizVerisi.saatlik;
    const istatistik = istatistikHesapla(degerler);
    const esikler = yuzdelikEsikleri(degerler);
    const grafik = await grafikOlustur(analizTuru, analizVerisi, esikler);
    const embed = new EmbedBuilder().setTitle(`📊 API Trafik Analizi: ${tur}`).setColor('Blue').setImage('attachment://trafik-analizi.png').addFields(
        { name: 'Toplam / Ortalama', value: `${istatistik.toplam} / ${istatistik.ortalama.toFixed(2)}`, inline: true },
        { name: 'Medyan', value: istatistik.medyan.toFixed(2), inline: true },
        { name: 'Sapma / Varyans', value: `${istatistik.standartSapma.toFixed(2)} / ${istatistik.varyans.toFixed(2)}`, inline: true },
        { name: 'Yoğunluk', value: `🟢 Düşük alt %25: ${esikler.dusuk}\n🟡 Orta %25-%75\n🔴 Yüksek üst %25: ${esikler.yuksek}`, inline: false },
        { name: 'Trend Skoru', value: `${grafik.trend.yuzde.toFixed(2)}%`, inline: true },
        { name: 'API Verisi', value: `${veri.tarananMesaj} mesaj, son 28 gün`, inline: true }
    ).setFooter({ text: 'Öncelikli kaynak: Discord API' }).setTimestamp();
    return { embeds: [embed], files: [grafik.attachment] };
}

async function analizRaporuGonder(client, guild, tur = 'saatlik') {
    const kanal = client.config.BOT_KANAL_ID && (guild.channels.cache.get(client.config.BOT_KANAL_ID) || await guild.channels.fetch(client.config.BOT_KANAL_ID).catch(() => null));
    if (!kanal?.isTextBased()) return null;
    const reporter = await ilerlemeBaslat(kanal, '📈 Trafik Analiz Raporu');

    if (reporter) await reporter.adim('Trafik verisi toplanıyor...');

    const callback = reporter ? async (metin) => reporter.adim(metin) : null;

    let paket;
    try {
        paket = await apiOncelikliAnalizPaketiOlustur(guild, tur, null, callback);
    } catch (error) {
        if (reporter) await reporter.hata('Trafik Analizi', error);
        throw error;
    }

    if (reporter) await reporter.adim('Grafik oluşturuluyor...');

    const res = await kanal.send(paket);

    if (reporter) await reporter.bitir(true, 'Trafik analizi raporu başarıyla oluşturuldu ve kanala gönderildi.');
    return res;
}

module.exports = { saatAnahtari, trafikArtir, veriTopla, apiVerisiTopla, sonDortHaftaAnalizi, istatistikHesapla, yuzdelikEsikleri, grafikOlustur, analizPaketiOlustur, apiOncelikliAnalizPaketiOlustur, analizRaporuGonder };
