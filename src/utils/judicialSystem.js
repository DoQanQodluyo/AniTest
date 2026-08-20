const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const db = require('croxydb');
const config = require('../../config.js');
const { alanlariEmbedlereBol } = require('./embedPaginator');
const { kullaniciyaBildirim } = require('./userNotifier');
const { kayitId } = require('./recordStore');

function dosyaAnahtari(guildId, numara) {
    return `sorusturma_${guildId}_${String(numara).trim()}`;
}

function aktifDurumAnahtari(guildId, numara) {
    return `sorusturma_active_status_${guildId}_${String(numara).trim()}`;
}

function aktifOzetAnahtari(guildId) {
    return `sorusturma_active_${guildId}`;
}

function yasaAnahtari(guildId, tasariId) {
    return `yasa_tasarisi_${guildId}_${tasariId}`;
}

function yetkiliMi(member) {
    const roller = Array.isArray(config.YETKILI_ROL_IDLERI) ? config.YETKILI_ROL_IDLERI : [];
    return Boolean(member?.roles?.cache?.some(role => roller.includes(role.id)));
}

function okuDosya(guildId, numara) {
    const key = dosyaAnahtari(guildId, numara);
    const dosya = db.get(key);
    if (!dosya || typeof dosya !== 'object') return dosya;
    let changed = false;
    if (!dosya.id) {
        dosya.id = kayitId('SOR');
        changed = true;
    }
    if (!Array.isArray(dosya.ifadeler)) {
        dosya.ifadeler = [];
        changed = true;
    }
    dosya.ifadeler.forEach(ifade => {
        if (!ifade.id || /^#\d+$/.test(ifade.id)) {
            ifade.id = kayitId('IFD');
            changed = true;
        }
    });
    if (changed) db.set(key, dosya);
    return dosya;
}

function dosyalariListele(guildId) {
    return Object.entries(db.all())
        .filter(([key, value]) => key.startsWith(`sorusturma_${guildId}_`) && value && typeof value === 'object' && value.numara)
        .map(([, value]) => value);
}

function kullaniciSoruşturmaGecmisi(guildId, userId) {
    return dosyalariListele(guildId)
        .filter(dosya => Array.isArray(dosya.saniklar) && dosya.saniklar.includes(userId))
        .map(dosya => ({
            id: dosya.id,
            tip: 'Soruşturma',
            tarih: dosya.guncellenmeZamani || dosya.acilmaZamani || Date.now(),
            baslik: dosya.numara,
            detay: `${dosya.durum} | ${dosya.hukum || 'Hüküm bekliyor.'}`
        }));
}

function aktifMi(dosya) {
    return !String(dosya?.durum || '').startsWith('HÜKÜMLÜ') && dosya?.kapatilmaZamani == null;
}

function aktifDurumlariSenkronizeEt(guildId) {
    const dosyalar = dosyalariListele(guildId);
    const aktifler = dosyalar.filter(aktifMi);
    const aktifHarita = {};
    for (const dosya of dosyalar) {
        const durum = aktifMi(dosya) ? 1 : 0;
        db.set(aktifDurumAnahtari(guildId, dosya.numara), durum === 1 ? 1 : '0');
        if (durum) aktifHarita[dosya.numara] = dosya.id;
    }
    db.set(aktifOzetAnahtari(guildId), {
        toplam: aktifler.length,
        dosyalar: aktifHarita,
        guncellenmeZamani: Date.now()
    });
    return { toplam: aktifler.length, dosyalar: aktifler };
}

function yazDosya(guildId, numara, dosya) {
    const record = { id: dosya.id || kayitId('SOR'), ...dosya, guncellenmeZamani: Date.now() };
    db.set(dosyaAnahtari(guildId, numara), record);
    db.set(aktifDurumAnahtari(guildId, numara), aktifMi(record) ? 1 : '0');
    aktifDurumlariSenkronizeEt(guildId);
    const kayit = db.get(dosyaAnahtari(guildId, numara));
    if (!kayit) throw new Error('Soruşturma dosyası DB doğrulamasından geçmedi.');
    return kayit;
}

function metin(value, limit = 1024) {
    const text = String(value || 'Yok');
    return text.length > limit ? `${text.slice(0, limit - 3)}...` : text;
}

function dosyaEmbedleri(dosya) {
    const saniklar = dosya.saniklar.map(id => `<@${id}>`).join(', ') || 'Sanık yok';
    const ifadeler = dosya.ifadeler.map(ifade => `**${ifade.id}** <@${ifade.ekleyen}>: ${ifade.metin}`).join('\n') || 'İfade veya delil bulunmuyor.';
    return alanlariEmbedlereBol({
        title: `⚖️ Soruşturma Dosyası: ${dosya.numara}`,
        color: dosya.durum.startsWith('HÜKÜMLÜ') ? 'Red' : 'Orange',
        fields: [
            { name: 'Durum', value: dosya.durum, inline: true },
            { name: 'Baş sanık', value: `<@${dosya.basSanik}>`, inline: true },
            { name: 'Sanıklar', value: metin(saniklar), inline: false },
            { name: 'İfadeler / Deliller', value: metin(ifadeler), inline: false },
            { name: 'Hüküm', value: metin(dosya.hukum || 'Henüz karar verilmedi.'), inline: false }
        ],
        footer: `Açan: ${dosya.acanEtiket || dosya.acan}`
    });
}

function dosyaEmbed(dosya) {
    return dosyaEmbedleri(dosya)[0];
}

function dosyaButonlari(numara, userId) {
    const buttons = [
        new ButtonBuilder().setCustomId(`dondur_${numara}`).setLabel('Yetkilerini Dondur').setEmoji('🔴').setStyle(ButtonStyle.Danger),
        new ButtonBuilder().setCustomId(`iade_${numara}`).setLabel('İtibar İadesi').setEmoji('🟢').setStyle(ButtonStyle.Success)
    ];
    if (userId) buttons.push(
        new ButtonBuilder().setCustomId(`sorusturma_gecmis_${userId}`).setLabel('Soruşturma Geçmişi').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId(`sicil_gecmis_${userId}`).setLabel('Sicil Geçmişi').setStyle(ButtonStyle.Primary)
    );
    return new ActionRowBuilder().addComponents(buttons);
}

function gecmisButonlari(userId) {
    return new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`sorusturma_gecmis_${userId}`).setLabel('Soruşturma Geçmişi').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId(`sicil_gecmis_${userId}`).setLabel('Sicil Geçmişi').setStyle(ButtonStyle.Primary)
    );
}

async function sahipDm(client, payload) {
    if (!config.BOT_OWNER_ID) return;
    const owner = await client.users.fetch(config.BOT_OWNER_ID).catch(() => null);
    await owner?.send(payload).catch(() => null);
}

async function kanalGonder(client, payload) {
    if (!config.BOT_KANAL_ID) return;
    const channel = await client.channels.fetch(config.BOT_KANAL_ID).catch(() => null);
    if (channel?.isTextBased()) await channel.send(payload).catch(() => null);
}

async function rolleriDondur(member, dosya) {
    const roleIds = member.roles.cache.filter(role => role.id !== member.guild.id && role.editable).map(role => role.id);
    db.set(`sorusturma_roller_${member.guild.id}_${dosya.numara}`, { memberId: member.id, roleIds, zaman: Date.now() });
    await member.roles.remove(roleIds, `Soruşturma ${dosya.numara} yetki dondurma`).catch(() => {});
    const quarantine = config.SORUSTURMA_KARANTINA_ROL_ID && member.guild.roles.cache.get(config.SORUSTURMA_KARANTINA_ROL_ID);
    if (quarantine) await member.roles.add(quarantine, `Soruşturma ${dosya.numara} karantina`).catch(() => {});
    return roleIds;
}

async function rolleriIadeEt(member, dosya) {
    const backup = db.get(`sorusturma_roller_${member.guild.id}_${dosya.numara}`);
    if (!backup) return false;
    const quarantine = config.SORUSTURMA_KARANTINA_ROL_ID && member.guild.roles.cache.get(config.SORUSTURMA_KARANTINA_ROL_ID);
    if (quarantine) await member.roles.remove(quarantine, `Soruşturma ${dosya.numara} itibar iadesi`).catch(() => {});
    const roles = backup.roleIds.map(id => member.guild.roles.cache.get(id)).filter(Boolean);
    if (roles.length) await member.roles.add(roles, `Soruşturma ${dosya.numara} itibar iadesi`).catch(() => {});
    db.delete(`sorusturma_roller_${member.guild.id}_${dosya.numara}`);
    return true;
}

async function adliKullaniciBildirimi(client, member, baslik, aciklama) {
    return kullaniciyaBildirim(client, member.user || member, baslik, aciklama, [{ name: 'Soruşturma', value: String(member.id) }]);
}

function yasaEmbed(tasari) {
    return new EmbedBuilder()
        .setTitle(`🏛️ Yasa Tasarısı: ${tasari.baslik}`)
        .setColor('Blue')
        .setDescription(tasari.detaylar)
        .addFields(
            { name: 'Sunan', value: `<@${tasari.sunan}>`, inline: true },
            { name: 'Kabul', value: String(tasari.kabul.length), inline: true },
            { name: 'Ret', value: String(tasari.red.length), inline: true }
        )
        .setFooter({ text: 'Oy değiştirmek için diğer butona basabilirsiniz.' })
        .setTimestamp(new Date(tasari.zaman));
}

function yasaButonlari(id) {
    return new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`yasa_kabul_${id}`).setLabel('Kabul Et').setEmoji('✅').setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId(`yasa_red_${id}`).setLabel('Reddet').setEmoji('❌').setStyle(ButtonStyle.Danger)
    );
}

module.exports = { dosyaAnahtari, aktifDurumAnahtari, aktifOzetAnahtari, yasaAnahtari, yetkiliMi, okuDosya, dosyalariListele, kullaniciSoruşturmaGecmisi, aktifMi, aktifDurumlariSenkronizeEt, yazDosya, dosyaEmbed, dosyaEmbedleri, dosyaButonlari, gecmisButonlari, sahipDm, kanalGonder, rolleriDondur, rolleriIadeEt, adliKullaniciBildirimi, yasaEmbed, yasaButonlari };