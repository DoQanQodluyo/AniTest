const db = require('croxydb');
const config = require('../../config.js');
const { sendReport } = require('./reportLogger');
const { ilerlemeBaslat } = require('./progressReporter');

const sorular = [
    '1. Dün ne yaptın?',
    '2. Bugün ne yapacaksın?',
    '3. Önünde bir engel var mı?',
    '4. Yenilik önerin veya şikayetin var mı?'
];
const aktifOturumlar = new Set();

function gunAnahtari(date = new Date()) {
    return `${date.getFullYear()}_${String(date.getMonth() + 1).padStart(2, '0')}_${String(date.getDate()).padStart(2, '0')}`;
}

function gunlukAnahtar(date) { return `standup_daily_${gunAnahtari(date)}`; }
function tamamlanmaAnahtari(date, id) { return `standup_completed_${gunAnahtari(date)}_${id}`; }
function bekleyenAnahtari(date, id) { return `standup_pending_${gunAnahtari(date)}_${id}`; }

function yetkiliMi(member) {
    const roles = Array.isArray(config.YETKILI_ROL_IDLERI) ? config.YETKILI_ROL_IDLERI : [];
    return Boolean(
        member?.roles?.cache?.some(role => roles.includes(role.id))
        || member?.permissions?.has('Administrator')
        || member?.id === config.BOT_OWNER_ID
        || member?.id === config.SAHIP_ID
    );
}

function saatDokuzGecti(date = new Date()) {
    return date.getHours() >= 9;
}

function sonucMetni(result) {
    if (result.status === 'sent') return `✅ Gönderildi\nSebep: ${result.reason}`;
    if (result.status === 'active') return `⏳ Oturum açık\nSebep: ${result.reason}`;
    if (result.status === 'completed') return `☑️ Daha önce tamamlandı\nSebep: ${result.reason}`;
    return `❌ Gönderilemedi\nSebep: ${result.reason}`;
}

async function sonuclariRaporla(client, guild, results, baslik = 'Kontrol') {
    if (!results.length) return;
    await sendReport(client, {
        title: `📋 Stand-up ${baslik} Raporu`,
        description: `${guild.name} için API üye kontrolü tamamlandı.`,
        color: results.some(result => result.status === 'failed') ? 'Red' : 'Blue',
        channelId: config.BOT_KANAL_ID,
        fields: results.map(result => ({
            name: result.tag || result.id,
            value: sonucMetni(result),
            inline: false
        }))
    });
}

async function uyeStandupBaslat(client, member, guild, date) {
    const sessionKey = `${guild.id}:${member.id}`;
    if (aktifOturumlar.has(sessionKey)) return { id: member.id, tag: member.user.tag, status: 'active', reason: 'Aktif oturum yanıt bekliyor.' };
    if (db.get(tamamlanmaAnahtari(date, member.id))) return { id: member.id, tag: member.user.tag, status: 'completed', reason: 'Bugünkü yanıtlar daha önce kaydedildi.' };

    aktifOturumlar.add(sessionKey);
    const pendingKey = bekleyenAnahtari(date, member.id);
    let state = db.get(pendingKey) || { questionIndex: 0, answers: [] };
    try {
        const dm = await member.createDM();
        await dm.send('📋 Günlük stand-up başladı. Soruları sırayla yanıtlayın; her soru için 10 dakikanız var.');
        while (state.questionIndex < sorular.length) {
            await dm.send(sorular[state.questionIndex]);
            const messages = await dm.awaitMessages({
                filter: message => message.author.id === member.id && !message.author.bot,
                max: 1,
                time: 600000,
                errors: ['time']
            });
            const answer = messages.first()?.content?.trim();
            if (!answer) throw new Error('Boş yanıt alındı.');
            state.answers[state.questionIndex] = answer.slice(0, 1024);
            state.questionIndex += 1;
            db.set(pendingKey, state);
        }
        db.set(tamamlanmaAnahtari(date, member.id), { tamamlandi: true, zaman: Date.now(), cevaplar: state.answers });
        db.delete(pendingKey);
        await dm.send('✅ Stand-up yanıtların kaydedildi. Teşekkürler.');
        return { id: member.id, tag: member.user.tag, status: 'sent', reason: 'Dört soru DM üzerinden gönderildi ve yanıtlar kaydedildi.' };
    } catch (error) {
        let reason = error.code === 50007
            ? 'Kullanıcının DM kutusu kapalı.'
            : error.message || 'Bilinmeyen hata.';
        if (error.name === 'Error' || error.size === 0 || error instanceof Map) {
            reason = 'Zaman aşımı: 10 dakika içinde yanıt verilmedi.';
        }
        return { id: member.id, tag: member.user.tag, status: 'failed', reason };
    } finally {
        aktifOturumlar.delete(sessionKey);
    }
}

async function standupKontrolEt(client, guild, options = {}) {
    const now = new Date();
    if (!saatDokuzGecti(now)) return { skipped: true, reason: 'Saat 09:00 olmadı.' };
    if (!client.isReady?.()) return { skipped: true, reason: 'Discord API bağlantısı hazır değil.' };

    const channelId = config.BOT_KANAL_ID;
    const channel = channelId
        ? (guild.channels.cache.get(channelId) || await guild.channels.fetch(channelId).catch(() => null))
        : null;
    const reporter = await ilerlemeBaslat(channel, '📋 Günlük Stand-up Kontrolü');

    const dailyKey = gunlukAnahtar(now);
    const previousDaily = db.get(dailyKey);
    const daily = previousDaily || { guildId: guild.id, startedAt: Date.now(), results: {} };
    if (daily.guildId !== guild.id) daily.guildId = guild.id;

    if (reporter) await reporter.adim("Üye listesi API'den çekiliyor...");

    let members;
    try {
        members = await guild.members.fetch();
    } catch (error) {
        if (reporter) await reporter.hata('API üye kontrolü', error);
        await sonuclariRaporla(client, guild, [{ id: 'api', tag: 'API üye kontrolü', status: 'failed', reason: `Üye listesi alınamadı: ${error.message}` }], 'API Hatası');
        return { skipped: true, reason: error.message };
    }

    const eligible = [...members.values()].filter(member => !member.user.bot && yetkiliMi(member));
    if (!eligible.length) {
        const result = { id: 'none', tag: 'Yetkili listesi', status: 'failed', reason: 'YETKILI_ROL_IDLERI rollerine sahip uygun kullanıcı bulunamadı.' };
        if (reporter) await reporter.hata('Yetkili Listesi', new Error(result.reason));
        if (options.report !== false) await sonuclariRaporla(client, guild, [result], options.reason || 'Kontrol');
        return [result];
    }

    if (reporter) await reporter.adim(`${eligible.length} kullanıcı uygun, DM gönderiliyor...`);

    const results = [];
    const logLines = [];
    let sentCount = 0;
    let failedCount = 0;
    let pendingCount = 0;

    for (const member of eligible) {
        const previous = daily.results[member.id];
        if (previous && previous.status !== 'active') {
            results.push(previous);
            if (previous.status === 'sent' || previous.status === 'completed') sentCount++;
            else failedCount++;
            logLines.push(`${previous.status === 'sent' || previous.status === 'completed' ? '☑️' : '❌'} **${previous.tag || previous.id}**: ${previous.reason}`);
            continue;
        }
        if (previous?.status === 'active') delete daily.results[member.id];
        const activeResult = { id: member.id, tag: member.user.tag, status: 'active', reason: 'DM oturumu başlatıldı; yanıt bekleniyor.' };
        results.push(activeResult);
        pendingCount++;

        uyeStandupBaslat(client, member, guild, now).then(async result => {
            if (result.status === 'active') return;
            const latest = db.get(dailyKey) || { ...daily, results: {} };
            latest.results[member.id] = result;
            latest.lastCheckedAt = Date.now();
            db.set(dailyKey, latest);

            if (result.status === 'sent' || result.status === 'completed') {
                sentCount++;
                logLines.push(`✅ **${result.tag || result.id}**: Yanıtlar kaydedildi.`);
            } else {
                failedCount++;
                logLines.push(`❌ **${result.tag || result.id}**: ${result.reason}`);
            }

            if (reporter) {
                await reporter.adim(`${eligible.length} kullanıcıdan ${logLines.length} tanesi sonuçlandı...\n\n${logLines.join('\n')}`);
            }
            await sonuclariRaporla(client, guild, [result], 'Kullanıcı Sonucu');
        }).catch(async error => {
            const result = { id: member.id, tag: member.user.tag, status: 'failed', reason: error.message || 'Stand-up oturumu başarısız.' };
            const latest = db.get(dailyKey) || { ...daily, results: {} };
            latest.results[member.id] = result;
            db.set(dailyKey, latest);
            failedCount++;
            logLines.push(`❌ **${member.user.tag || member.id}**: ${result.reason}`);
            if (reporter) {
                await reporter.adim(`${eligible.length} kullanıcıdan ${logLines.length} tanesi sonuçlandı...\n\n${logLines.join('\n')}`);
            }
            await sonuclariRaporla(client, guild, [result], 'Kullanıcı Hatası');
        });
    }

    daily.lastCheckedAt = Date.now();
    daily.memberCount = eligible.length;
    db.set(gunlukAnahtar(now), daily);

    if (reporter && pendingCount === 0) {
        await reporter.bitir(true, `Tamamlandı: ${sentCount} gönderildi/kaydedildi, ${failedCount} başarısız.\n\n${logLines.join('\n')}`);
    }

    if (options.report !== false && (!previousDaily || options.forceReport)) {
        await sonuclariRaporla(client, guild, results, options.reason || 'Kontrol');
    }
    return results;
}

function standupOturumuAktifMi(userId) {
    return [...aktifOturumlar].some(key => key.endsWith(`:${userId}`));
}

module.exports = { standupKontrolEt, standupOturumuAktifMi, gunAnahtari, saatDokuzGecti };
