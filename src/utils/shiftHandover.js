const { EmbedBuilder } = require('discord.js');
const db = require('croxydb');
const config = require('../../config.js');
const teamStore = require('./teamStore');

const SHIFT_KEY = 'current_shift_data';
const PREVIOUS_SHIFT_KEY = 'previous_shift_data';

function asArray(value) {
    return Array.isArray(value) ? value : [];
}

function asNumber(value) {
    const number = Number(value);
    return Number.isFinite(number) ? number : 0;
}

function findFirst(values, predicate) {
    return values.find(value => predicate(value));
}

function getTeamLeaders(guildId, allData) {
    return teamStore.getLeaders(guildId);
}

function getTeamMembers(guildId, leaderId) {
    return teamStore.getMembers(guildId, leaderId).length
        ? teamStore.getMembers(guildId, leaderId)
        : [String(leaderId)];
}

function getMemberMetric(allData, guildId, memberId, names) {
    const keys = [];
    names.forEach(name => {
        keys.push(`${name}_${guildId}_${memberId}`, `${name}_${memberId}`);
    });
    const key = findFirst(keys, candidate => allData[candidate] !== undefined || db.get(candidate) !== undefined);
    const value = key === undefined ? 0 : allData[key] ?? db.get(key);
    return asNumber(value === undefined ? 0 : value);
}

function getTaskProgress(task) {
    if (!task || typeof task !== 'object') return { tamamlanan: 0, toplam: 0, oran: 0 };
    const tamamlanan = asNumber(task.ilerleme ?? task.progress ?? task.completed ?? task.tamamlanan);
    const toplam = asNumber(task.hedef ?? task.target ?? task.toplam);
    const oran = task.tamamlandi === true || task.completed === true
        ? 100
        : toplam > 0 ? Math.min(100, (tamamlanan / toplam) * 100) : 0;
    return { tamamlanan, toplam, oran };
}

function getTasksForTeam(leaderId, members, allData) {
    const taskValues = [
        db.get(`team_tasks_${leaderId}`),
        allData[`team_tasks_${leaderId}`],
        allData[`team_tasks:${leaderId}`],
        db.get(`gorev_${new Date().toISOString().slice(0, 10).replaceAll('-', '_')}_${leaderId}`),
        db.get(`gorev_${new Date().toISOString().slice(0, 10)}_${leaderId}`)
    ];
    const rawTasks = findFirst(taskValues, value => Array.isArray(value) || (value && Array.isArray(value.gorevler)));
    if (Array.isArray(rawTasks)) return rawTasks;
    if (rawTasks?.gorevler) return rawTasks.gorevler;

    return members.flatMap(memberId => {
        const values = Object.entries(allData)
            .filter(([key]) => key.includes(memberId) && (key.startsWith('team_tasks') || key.startsWith('gorev_')))
            .map(([, value]) => value);
        return values.flatMap(value => Array.isArray(value) ? value : value?.gorevler || []);
    });
}

function collectTeamActivity(guildId) {
    const allData = db.all();
    const leaders = getTeamLeaders(guildId, allData);
    const teams = leaders.map(leaderId => {
        const members = getTeamMembers(guildId, leaderId);
        const tasks = getTasksForTeam(leaderId, members, allData);
        const mesajlar = members.reduce((total, memberId) => total + getMemberMetric(allData, guildId, memberId, ['chat_7d', 'api_chat_7d', 'team_messages']), 0);
        const sesDakika = Math.floor(members.reduce((total, memberId) => total + getMemberMetric(allData, guildId, memberId, ['voice_7d', 'team_voice']), 0) / 60000);
        const vukuatlar = members.reduce((total, memberId) => total + asArray(allData[`sicil_${memberId}`]).filter(kayit => {
            const zaman = Date.parse(kayit.date || kayit.tarih || '');
            return !zaman || zaman >= Date.now() - 24 * 60 * 60 * 1000;
        }).length, 0);
        const gorevler = tasks.map(getTaskProgress);
        const tamamlananGorev = gorevler.filter(task => task.oran >= 100).length;
        const gorevOrani = gorevler.length ? gorevler.reduce((total, task) => total + task.oran, 0) / gorevler.length : 0;

        return {
            liderId: String(leaderId),
            ad: String(teamStore.getTeamName(guildId, leaderId)),
            uyeler: members,
            mesajlar,
            sesDakika,
            vukuatlar,
            gorevler: { toplam: gorevler.length, tamamlanan: tamamlananGorev, oran: Number(gorevOrani.toFixed(2)) }
        };
    });

    return {
        guildId,
        takimlar: teams,
        toplam: {
            mesajlar: teams.reduce((total, team) => total + team.mesajlar, 0),
            sesDakika: teams.reduce((total, team) => total + team.sesDakika, 0),
            vukuatlar: teams.reduce((total, team) => total + team.vukuatlar, 0),
            gorevOrani: teams.length ? Number((teams.reduce((total, team) => total + team.gorevler.oran, 0) / teams.length).toFixed(2)) : 0
        }
    };
}

function yetkiliMi(member, userId) {
    const rolIdleri = Array.isArray(config.YETKILI_ROL_IDLERI) ? config.YETKILI_ROL_IDLERI : [];
    return userId === config.BOT_OWNER_ID || Boolean(member?.permissions?.has('Administrator')) || Boolean(member?.roles?.cache?.some(role => rolIdleri.includes(role.id)));
}

function metinSinirla(value, limit = 1024) {
    const text = String(value || 'Yok');
    return text.length > limit ? `${text.slice(0, limit - 3)}...` : text;
}

function vardiyaEmbed(data, baslik, renk = 'Blue') {
    const takimMetinleri = data.etkinlik?.takimlar?.map(team => `**${team.ad}** | Mesaj: ${team.mesajlar} | Ses: ${team.sesDakika} dk | Vukuat: ${team.vukuatlar} | Görev: %${team.gorevler.oran}`) || [];
    return new EmbedBuilder()
        .setTitle(baslik)
        .setColor(renk)
        .setDescription(metinSinirla(data.notlar || data.aciklama || 'Not bulunmuyor.'))
        .addFields(
            { name: 'Vukuatlar', value: metinSinirla(data.vukuatlar || 'Yok'), inline: false },
            { name: 'Toplam Etkinlik', value: `Mesaj: **${data.etkinlik?.toplam?.mesajlar || 0}**\nSes: **${data.etkinlik?.toplam?.sesDakika || 0} dakika**\nVukuat kaydı: **${data.etkinlik?.toplam?.vukuatlar || 0}**\nOrtalama görev: **%${data.etkinlik?.toplam?.gorevOrani || 0}**`, inline: true },
            { name: 'Takım Performansları', value: metinSinirla(takimMetinleri.join('\n') || 'Kayıtlı takım bulunamadı.'), inline: false },
            { name: 'Yetkili Sorumlulukları', value: metinSinirla(data.sorumluluklar || 'Belirtilmedi.'), inline: false }
        )
        .setFooter({ text: `Vardiya amiri: ${data.amirEtiketi || data.amirId || 'Bilinmiyor'}` })
        .setTimestamp(new Date(data.zaman || Date.now()));
}

async function ownerDm(client, payload) {
    if (!config.BOT_OWNER_ID) return false;
    const owner = await client.users.fetch(config.BOT_OWNER_ID).catch(() => null);
    if (!owner) return false;
    await owner.send(payload).catch(() => null);
    return true;
}

async function botChannelSend(client, payload) {
    if (!config.BOT_KANAL_ID) return false;
    const channel = await client.channels.fetch(config.BOT_KANAL_ID).catch(() => null);
    if (!channel?.isTextBased()) return false;
    await channel.send(payload).catch(() => null);
    return true;
}

module.exports = {
    SHIFT_KEY,
    PREVIOUS_SHIFT_KEY,
    collectTeamActivity,
    yetkiliMi,
    vardiyaEmbed,
    ownerDm,
    botChannelSend
};