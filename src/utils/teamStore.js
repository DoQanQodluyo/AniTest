const db = require('croxydb');

const RETRY_COUNT = 3;

function uniqueIds(values) {
    return [...new Set((Array.isArray(values) ? values : []).map(String).filter(Boolean))];
}

function read(key, fallback = null) {
    try {
        const value = db.get(key);
        return value === undefined || value === null ? fallback : value;
    } catch (error) {
        console.error(`[Takım DB] Okuma başarısız: ${key}`, error);
        return fallback;
    }
}

function write(key, value) {
    let lastError;
    for (let attempt = 1; attempt <= RETRY_COUNT; attempt++) {
        try {
            db.set(key, value);
            const saved = db.get(key);
            if (JSON.stringify(saved) === JSON.stringify(value)) return true;
            lastError = new Error(`Yazma doğrulanamadı (deneme ${attempt})`);
        } catch (error) {
            lastError = error;
        }
    }
    throw new Error(`[Takım DB] ${key} yazılamadı: ${lastError?.message || 'Bilinmeyen hata'}`);
}

function remove(key) {
    try {
        db.delete(key);
        if (read(key, undefined) !== undefined) throw new Error('Silme doğrulanamadı');
        return true;
    } catch (error) {
        throw new Error(`[Takım DB] ${key} silinemedi: ${error.message}`);
    }
}

function getLeader(guildId, userId) {
    return Boolean(read(`teamLeader_${guildId}_${userId}`, false) || read(`teamLeader_${userId}`, false));
}

function getLeaders(guildId) {
    const stored = read(`teamLeaders_${guildId}`, []);
    const allData = typeof db.all === 'function' ? db.all() : {};
    const legacy = Object.keys(allData)
        .filter(key => key.startsWith('teamLeader_') && allData[key] === true)
        .map(key => key.slice('teamLeader_'.length))
        .filter(id => id !== guildId && !id.startsWith(`${guildId}_`));
    return uniqueIds([...stored, ...legacy]);
}

function getMembers(guildId, leaderId) {
    const canonical = read(`team_members_${guildId}_${leaderId}`, null);
    const legacy = read(`teamMembers_${leaderId}`, null);
    const old = read(`team_${leaderId}`, null);
    return uniqueIds(canonical || legacy || old || []).concat(getLeader(guildId, leaderId) ? [] : []);
}

function getTeamName(guildId, leaderId) {
    return read(`team_stats_${guildId}_${leaderId}`, {})?.name
        || read(`teamName_${guildId}_${leaderId}`, null)
        || read(`teamName_${leaderId}`, null)
        || `<@${leaderId}> Takımı`;
}

function saveLeader(guildId, leaderId) {
    const leaders = getLeaders(guildId).concat(leaderId);
    write(`teamLeader_${guildId}_${leaderId}`, true);
    write(`teamLeader_${leaderId}`, true);
    write(`teamLeaders_${guildId}`, uniqueIds(leaders));
    if (!read(`team_members_${guildId}_${leaderId}`, null)) write(`team_members_${guildId}_${leaderId}`, []);
    if (!read(`team_stats_${guildId}_${leaderId}`, null)) write(`team_stats_${guildId}_${leaderId}`, { leaderId: String(leaderId), name: `<@${leaderId}> Takımı`, updatedAt: Date.now() });
    return true;
}

function removeLeader(guildId, leaderId) {
    write(`teamLeaders_${guildId}`, getLeaders(guildId).filter(id => id !== String(leaderId)));
    remove(`teamLeader_${guildId}_${leaderId}`);
    remove(`teamLeader_${leaderId}`);
    return true;
}

function saveMembers(guildId, leaderId, members) {
    const normalized = uniqueIds(members);
    write(`team_members_${guildId}_${leaderId}`, normalized);
    write(`teamMembers_${leaderId}`, normalized);
    write(`team_${leaderId}`, normalized);
    normalized.forEach(memberId => write(`userTeam_${memberId}`, String(leaderId)));
    return normalized;
}

function removeMember(guildId, leaderId, memberId) {
    const normalized = getMembers(guildId, leaderId).filter(id => id !== String(memberId));
    saveMembers(guildId, leaderId, normalized);
    if (read(`userTeam_${memberId}`, null) === String(leaderId)) remove(`userTeam_${memberId}`);
    return normalized;
}

function forceAssignMember(guildId, leaderId, memberId) {
    const normalizedLeaderId = String(leaderId);
    const normalizedMemberId = String(memberId);
    for (const currentLeaderId of getLeaders(guildId)) {
        if (currentLeaderId === normalizedLeaderId) continue;
        const currentMembers = getMembers(guildId, currentLeaderId);
        if (currentMembers.includes(normalizedMemberId)) {
            saveMembers(guildId, currentLeaderId, currentMembers.filter(id => id !== normalizedMemberId));
        }
    }

    const targetMembers = getMembers(guildId, normalizedLeaderId);
    if (!targetMembers.includes(normalizedMemberId)) targetMembers.push(normalizedMemberId);
    saveMembers(guildId, normalizedLeaderId, targetMembers);
    if (read(`userTeam_${normalizedMemberId}`, null) !== normalizedLeaderId) {
        write(`userTeam_${normalizedMemberId}`, normalizedLeaderId);
    }
    return targetMembers;
}

function saveName(guildId, leaderId, name) {
    const stats = read(`team_stats_${guildId}_${leaderId}`, {});
    const updated = { ...stats, leaderId: String(leaderId), name, updatedAt: Date.now() };
    write(`team_stats_${guildId}_${leaderId}`, updated);
    write(`teamName_${guildId}_${leaderId}`, name);
    write(`teamName_${leaderId}`, name);
    return name;
}

module.exports = {
    read,
    write,
    remove,
    getLeader,
    getLeaders,
    getMembers,
    getTeamName,
    saveLeader,
    removeLeader,
    saveMembers,
    removeMember,
    forceAssignMember,
    saveName
};