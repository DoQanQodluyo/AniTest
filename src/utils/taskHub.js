const { EmbedBuilder } = require('discord.js');
const db = require('croxydb');

function haftaAnahtari(tarih = new Date()) {
    const kopya = new Date(tarih);
    const gun = kopya.getDay() || 7;
    kopya.setDate(kopya.getDate() - gun + 1);
    return `${kopya.getFullYear()}_${String(kopya.getMonth() + 1).padStart(2, '0')}_${String(kopya.getDate()).padStart(2, '0')}`;
}

function gorevlerOlustur(hafta) {
    const tohum = Number(hafta.replace(/_/g, '')) || 1;
    const hedefler = [25 + (tohum % 4) * 5, 5 + (tohum % 3), 3 + (tohum % 4)];
    return [
        { id: 'mesaj', baslik: 'Topluluk Katkısı', aciklama: `${hedefler[0]} geçerli mesaj gönder.`, hedef: hedefler[0], ilerleme: 0 },
        { id: 'ses', baslik: 'Sesli Etkinlik', aciklama: `${hedefler[1]} farklı ses oturumuna katıl.`, hedef: hedefler[1], ilerleme: 0 },
        { id: 'kriz', baslik: 'Topluluk Desteği', aciklama: `${hedefler[2]} kriz bildirimine yapıcı katkı sağla.`, hedef: hedefler[2], ilerleme: 0 }
    ];
}

function gorevSablonu(hafta) {
    const anahtar = `gorev_sablon_${hafta}`;
    let sablon = db.get(anahtar);
    if (!sablon) {
        sablon = gorevlerOlustur(hafta);
        db.set(anahtar, sablon);
    }
    return sablon;
}

function gorevDurumu(kullaniciId, tarih = new Date()) {
    const hafta = haftaAnahtari(tarih);
    const anahtar = `gorev_${hafta}_${kullaniciId}`;
    let durum = db.get(anahtar);
    if (!durum) {
        durum = { hafta, gorevler: JSON.parse(JSON.stringify(gorevSablonu(hafta))), olusturmaZamani: Date.now(), surum: 1 };
        db.set(anahtar, durum);
    }
    return durum;
}

function gorevIlerlemesi(kullaniciId, gorevId, miktar = 1) {
    const durum = gorevDurumu(kullaniciId);
    const gorev = durum.gorevler.find(kayit => kayit.id === gorevId);
    if (!gorev || gorev.tamamlandi) return;
    gorev.ilerleme = Math.min(gorev.hedef, gorev.ilerleme + miktar);
    gorev.tamamlandi = gorev.ilerleme >= gorev.hedef;
    db.set(`gorev_${durum.hafta}_${kullaniciId}`, durum);
}

function gorevEmbed(uye, durum) {
    return new EmbedBuilder()
        .setTitle(`🎯 Haftalık Görevler: ${uye.user.username}`)
        .setColor('Purple')
        .setDescription(durum.gorevler.map(gorev => `${gorev.tamamlandi ? '✅' : '▫️'} **${gorev.baslik}**\n${gorev.aciklama}\nİlerleme: **${gorev.ilerleme}/${gorev.hedef}**`).join('\n\n'))
        .setFooter({ text: `Hafta: ${durum.hafta}` })
        .setTimestamp();
}

async function gorevleriGeriYukle(guild, rolId) {
    if (!rolId) return 0;
    const rol = guild.roles.cache.get(rolId) || await guild.roles.fetch(rolId).catch(() => null);
    if (!rol) return 0;
    let yuklenen = 0;
    for (const uye of rol.members.values()) {
        gorevDurumu(uye.id);
        const katilimAnahtari = `gorev_katilim_${guild.id}_${uye.id}`;
        if (!db.get(katilimAnahtari)) {
            db.set(katilimAnahtari, { kullaniciId: uye.id, geriYuklendi: true, zaman: Date.now() });
        }
        yuklenen += 1;
    }
    return yuklenen;
}

module.exports = { haftaAnahtari, gorevSablonu, gorevDurumu, gorevIlerlemesi, gorevEmbed, gorevleriGeriYukle };
