const { EmbedBuilder } = require('discord.js');
const db = require('croxydb');
const { ilerlemeBaslat } = require('./progressReporter');

function haftaninAraligi(tarih = new Date()) {
    const bugun = new Date(tarih);
    const gun = bugun.getDay();
    const buPazartesi = new Date(bugun);
    buPazartesi.setHours(0, 0, 0, 0);
    buPazartesi.setDate(bugun.getDate() - (gun === 0 ? 6 : gun - 1));

    const baslangic = new Date(buPazartesi);
    baslangic.setDate(baslangic.getDate() - 7);
    const bitis = new Date(buPazartesi);
    return { baslangic, bitis, anahtar: `${baslangic.getFullYear()}_${String(baslangic.getMonth() + 1).padStart(2, '0')}_${String(baslangic.getDate()).padStart(2, '0')}` };
}

function tarihMetni(tarih) {
    return tarih.toLocaleDateString('tr-TR');
}

function temizIcerik(icerik) {
    return icerik.toLocaleLowerCase('tr-TR').replace(/\s+/g, ' ').trim();
}

function spamDegilMesaj(message, sonMesajlar) {
    if (message.author.bot) return false;
        const icerik = temizIcerik(message.content || '');
        if (!icerik || icerik.startsWith('/')) return false;
    if (icerik.length < 4) return false;

    const kullaniciMesajlari = sonMesajlar.get(message.author.id) || [];
    const son = kullaniciMesajlari[kullaniciMesajlari.length - 1];
    if (son && son.icerik === icerik && message.createdTimestamp - son.zaman <= 60000) return false;
    if (icerik.length <= 12 && son && message.createdTimestamp - son.zaman <= 15000) return false;

    kullaniciMesajlari.push({ icerik, zaman: message.createdTimestamp });
    while (kullaniciMesajlari.length > 5) kullaniciMesajlari.shift();
    sonMesajlar.set(message.author.id, kullaniciMesajlari);
    return true;
}

async function temizMesajlariTara(guild, baslangic, bitis) {
    const sayaclar = new Map();
        const sonMesajlar = new Map();
        const kanallar = guild.channels.cache.filter(channel =>
            channel.isTextBased() && !channel.isThread() && channel.messages?.fetch
        );

    for (const kanal of kanallar.values()) {
        let sonId = null;
        let devam = true;
        while (devam) {
            const secenekler = { limit: 100 };
            if (sonId) secenekler.before = sonId;
            const mesajlar = await kanal.messages.fetch(secenekler).catch(() => null);
            if (!mesajlar || mesajlar.size === 0) break;

            for (const mesaj of mesajlar.values()) {
                if (mesaj.createdTimestamp < baslangic.getTime()) {
                    devam = false;
                    break;
                }
                if (mesaj.createdTimestamp >= bitis.getTime()) continue;
                if (!spamDegilMesaj(mesaj, sonMesajlar)) continue;
                sayaclar.set(mesaj.author.id, (sayaclar.get(mesaj.author.id) || 0) + 1);
            }

            sonId = mesajlar.last()?.id;
            if (mesajlar.size < 100) break;
        }
    }
    return sayaclar;
}

function sayisalDeger(deger) {
    const sayi = Number(deger);
    return Number.isFinite(sayi) && sayi > 0 ? sayi : 0;
}

function kayitHaftaIcindeMi(kayit, baslangic, bitis) {
    const zaman = kayit?.timestamp || kayit?.createdTimestamp || kayit?.createdAt || kayit?.date;
    if (!zaman) return false;
    const tarih = new Date(zaman).getTime();
    return Number.isFinite(tarih) && tarih >= baslangic.getTime() && tarih < bitis.getTime();
}

function personelIslemPuani(kullaniciId, guildId, tumVeriler, baslangic, bitis) {
    const anahtarlar = [
        `staffOperations_${guildId}_${kullaniciId}`,
        `staff_operations_${guildId}_${kullaniciId}`,
        `modLogs_${kullaniciId}`
    ];
    let mod = 0;
    let bilet = 0;
    let ceza = 0;
    for (const anahtar of anahtarlar) {
        const kayitlar = tumVeriler[anahtar];
        if (!Array.isArray(kayitlar)) continue;
        for (const kayit of kayitlar) {
            if (!kayitHaftaIcindeMi(kayit, baslangic, bitis)) continue;
            const islem = String(kayit.action || kayit.type || kayit.islem || '').toLocaleLowerCase('tr-TR');
            if (islem.includes('ticket') || islem.includes('bilet')) bilet += 1;
            else if (islem.includes('ceza') || islem.includes('mute') || islem.includes('ban')) ceza += 1;
            else mod += 1;
        }
    }
    const ticketAnahtarlari = [
        `ticketResolved_${guildId}_${kullaniciId}`,
        `ticket_resolved_${guildId}_${kullaniciId}`,
        `tickets_resolved_${guildId}_${kullaniciId}`
    ];
    for (const anahtar of ticketAnahtarlari) bilet += sayisalDeger(tumVeriler[anahtar]);

    const rating = sayisalDeger(
        tumVeriler[`rating_${guildId}_${kullaniciId}`] ??
        tumVeriler[`reyting_${guildId}_${kullaniciId}`] ??
        tumVeriler[`staffRating_${guildId}_${kullaniciId}`]
    );
    return { mod, bilet, ceza, rating, ham: mod * 3 + bilet * 4 + ceza * 2 };
}

function personelSkorlari(guild, mesajSayaclari, tumVeriler, config, baslangic, bitis) {
    const roller = config.STAFF_ROLES || [];
    const skorlar = [];
        for (const uye of guild.members.cache.values()) {
            if (uye.user.bot || !uye.roles.cache.some(rol => roller.includes(rol.id))) continue;
            const apiMesaj = mesajSayaclari.get(uye.id) || 0;
            const islemler = personelIslemPuani(uye.id, guild.id, tumVeriler, baslangic, bitis);
            skorlar.push({ id: uye.id, apiMesaj, islemler, hamApi: apiMesaj, hamIslem: islemler.ham });
    }

    const enYuksekApi = Math.max(1, ...skorlar.map(skor => skor.hamApi));
    const enYuksekIslem = Math.max(1, ...skorlar.map(skor => skor.hamIslem));
    return skorlar.map(skor => {
        const apiYuzde = (skor.hamApi / enYuksekApi) * 100;
        const islemYuzde = (skor.hamIslem / enYuksekIslem) * 100;
        return { ...skor, apiYuzde, islemYuzde, puan: Number((apiYuzde * 0.5 + islemYuzde * 0.5).toFixed(2)) };
    }).sort((a, b) => b.puan - a.puan);
}

function uyeSkorlari(guild, mesajSayaclari) {
    return [...guild.members.cache.values()]
        .filter(uye => !uye.user.bot)
        .map(uye => ({ id: uye.id, mesaj: mesajSayaclari.get(uye.id) || 0 }))
        .filter(skor => skor.mesaj > 0)
        .sort((a, b) => b.mesaj - a.mesaj);
}

async function rolDevri(guild, rolId, kazananId, etiket) {
    const sonuc = { eski: [], yeni: null, hatalar: [] };
    if (!rolId) return sonuc;
    const rol = guild.roles.cache.get(rolId) || await guild.roles.fetch(rolId).catch(() => null);
    if (!rol) return { ...sonuc, hatalar: [`${etiket} rolü bulunamadı.`] };

    for (const uye of rol.members.values()) {
        try {
            await uye.roles.remove(rol, `${etiket} haftalık rol devri`);
            sonuc.eski.push(uye.id);
        } catch (hata) {
            sonuc.hatalar.push(`${etiket} rolü ${uye.id} kullanıcısından alınamadı: ${hata.message}`);
        }
    }
    if (kazananId) {
        const kazanan = await guild.members.fetch(kazananId).catch(() => null);
        if (kazanan) {
            try {
                await kazanan.roles.add(rol, `${etiket} haftalık rol devri`);
                sonuc.yeni = kazananId;
            } catch (hata) {
                sonuc.hatalar.push(`${etiket} rolü ${kazananId} kullanıcısına verilemedi: ${hata.message}`);
            }
        }
    }
    return sonuc;
}

function liderlikMetni(skorlar, tur) {
    if (!skorlar.length) return 'Kayıtlı doğrulanmış aktivite bulunamadı.';
    return skorlar.slice(0, 5).map((skor, index) => {
        if (tur === 'uye') return `**${index + 1}.** <@${skor.id}> — **${skor.mesaj} doğrulanmış mesaj**`;
        return `**${index + 1}.** <@${skor.id}> — **${skor.puan} reyting**\n└ API: ${skor.apiMesaj} mesaj | İşlem: ${skor.islemler.ham} puan`;
    }).join('\n');
}

async function haftalikSkorboarduKesinlestir(client, guild, options = {}) {
    const { baslangic, bitis, anahtar } = haftaninAraligi(options.tarih || new Date());
    const tamamlanmaAnahtari = `weekly_scoreboard_completed_${guild.id}_${anahtar}`;
    if (!options.zorla && db.get(tamamlanmaAnahtari)) return { atlandi: true, anahtar };

    const config = client.config;
    const raporKanali = config.BOT_KANAL_ID
        ? (guild.channels.cache.get(config.BOT_KANAL_ID) || await guild.channels.fetch(config.BOT_KANAL_ID).catch(() => null))
        : null;
    const reporter = await ilerlemeBaslat(raporKanali, '📊 Haftalık Skorbord Kesinleştirme');

    if (reporter) await reporter.adim('Skorlar hesaplanıyor...');

    if (guild.members.cache.size === 0) {
        await guild.members.fetch().catch(hata => {
            console.warn(`[Skorboard] Üye listesi yenilenemedi, mevcut cache kullanılacak: ${hata.message}`);
        });
    }

    const mesajSayaclari = await temizMesajlariTara(guild, baslangic, bitis);
    const tumVeriler = db.all();
    const uyeSkorlariSonuc = uyeSkorlari(guild, mesajSayaclari);
    const yetkiliSkorlariSonuc = personelSkorlari(guild, mesajSayaclari, tumVeriler, config, baslangic, bitis);

    if (reporter) await reporter.adim('Roller güncelleniyor...');

    const uyeKazanan = uyeSkorlariSonuc[0]?.id || null;
    const yetkiliKazanan = yetkiliSkorlariSonuc[0]?.id || null;
    const uyeRolDevri = await rolDevri(guild, config.HAFTANIN_UYESI_ROL_ID, uyeKazanan, 'Haftanın Üyesi');
    const yetkiliRolDevri = await rolDevri(guild, config.HAFTANIN_ELEMANI_ROL_ID, yetkiliKazanan, 'Haftanın Yetkilisi');

    if (reporter) await reporter.adim('Arşive kaydediliyor...');

    const raporEmbed = new EmbedBuilder()
        .setTitle(`📊 Haftalık Skorbord Raporu: ${guild.name}`)
        .setColor('Gold')
        .setDescription(`Tarih aralığı: **${tarihMetni(baslangic)} - ${tarihMetni(new Date(bitis.getTime() - 1))}**`)
        .addFields(
            { name: '🏆 Üye İlk 5', value: liderlikMetni(uyeSkorlariSonuc, 'uye') },
            { name: '👑 Yetkili İlk 5', value: liderlikMetni(yetkiliSkorlariSonuc, 'yetkili') },
            { name: '🔁 Rol Devir Teslimi', value: `Haftanın Üyesi eski sahipler: ${uyeRolDevri.eski.length ? uyeRolDevri.eski.map(id => `<@${id}>`).join(', ') : 'Yok'}\nYeni sahip: ${uyeRolDevri.yeni ? `<@${uyeRolDevri.yeni}>` : 'Kazanan yok.'}\n\nHaftanın Yetkilisi eski sahipler: ${yetkiliRolDevri.eski.length ? yetkiliRolDevri.eski.map(id => `<@${id}>`).join(', ') : 'Yok'}\nYeni sahip: ${yetkiliRolDevri.yeni ? `<@${yetkiliRolDevri.yeni}>` : 'Kazanan yok.'}` }
        )
        .setTimestamp();

    if (!raporKanali?.isTextBased()) throw new Error('BOT_KANAL_ID kanalı bulunamadı veya yazılabilir değil.');
    const raporMesaji = await raporKanali.send({ embeds: [raporEmbed] });

    for (const [kanalId, baslik, skorlar, renk] of [
        [config.UYE_BOARD_KANAL_ID, '🏆 Haftanın Üyeleri', uyeSkorlariSonuc, 'Green'],
        [config.YETKILI_BOARD_KANAL_ID, '👑 Haftanın Yetkilileri', yetkiliSkorlariSonuc, 'Gold']
    ]) {
        const kanal = kanalId ? guild.channels.cache.get(kanalId) : null;
        if (!kanal?.isTextBased()) continue;
        const rolDevri = baslik.includes('Üye') ? uyeRolDevri : yetkiliRolDevri;
        const rolMetni = rolDevri.yeni ? `<@&${baslik.includes('Üye') ? config.HAFTANIN_UYESI_ROL_ID : config.HAFTANIN_ELEMANI_ROL_ID}> verilen kişi: <@${rolDevri.yeni}>` : 'Bu hafta rol verilemedi.';
        const embed = new EmbedBuilder().setTitle(baslik).setColor(renk).setDescription(liderlikMetni(skorlar, baslik.includes('Üye') ? 'uye' : 'yetkili')).addFields({ name: '🎖️ Haftanın Rolü', value: rolMetni }).setFooter({ text: `Doğrulanmış hafta: ${anahtar}` }).setTimestamp();
        const mesajAnahtari = `weekly_board_message_${guild.id}_${anahtar}_${kanalId}`;
        const eskiMesajId = db.get(mesajAnahtari);
        let mesaj = eskiMesajId ? await kanal.messages.fetch(eskiMesajId).catch(() => null) : null;
        if (mesaj) await mesaj.edit({ embeds: [embed] });
        else { mesaj = await kanal.send({ embeds: [embed] }); db.set(mesajAnahtari, mesaj.id); }
    }

    db.set(`weekly_scoreboard_${guild.id}_${anahtar}`, {
        anahtar,
        baslangic: baslangic.toISOString(),
        bitis: bitis.toISOString(),
        uye: uyeSkorlariSonuc.slice(0, 5),
        yetkili: yetkiliSkorlariSonuc.slice(0, 5),
        raporMesajId: raporMesaji.id,
        tamamlanmaZamani: Date.now()
    });
    db.set(tamamlanmaAnahtari, true);

    if (reporter) {
        await reporter.bitir(true, `Haftalık skorbord başarıyla kesinleştirildi! (${anahtar})\n\nTarih aralığı: **${tarihMetni(baslangic)} - ${tarihMetni(new Date(bitis.getTime() - 1))}**`);
    }

    return { atlandi: false, anahtar, raporMesajId: raporMesaji.id };
}

module.exports = { haftalikSkorboarduKesinlestir, haftaninAraligi };
