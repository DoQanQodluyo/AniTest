const config = require('../../config.js');
const db = require('croxydb');

/**
 * Yetki kontrol fonksiyonu.
 * @param {object} member - Botun erişmeye çalıştığı üye nesnesi.
 * @param {number} requiredPermLevel - Gerekli minimum yetki seviyesi (Örn: 8).
 * @returns {boolean} Yetki yeterliyse true döner.
 */
function getPermLevel(member, guild = member?.guild) {
    if (!member) return 0;
    if (member.id === config.BOT_OWNER_ID || member.id === config.SAHIP_ID || member.id === guild?.ownerId) return 10;
    if (member.permissions?.has('Administrator')) return 10;
    const roles = Array.isArray(config.YETKILI_ROL_IDLERI) ? config.YETKILI_ROL_IDLERI : [];
    if (member.roles?.cache?.some(role => roles.includes(role.id))) return 8;
    const stored = Number(db.get(`permLevel_${member.id}`) ?? db.get(`permlevel_${member.id}`));
    return Number.isFinite(stored) ? stored : 0;
}

function checkPermLevel(member, requiredPermLevel = 8, guild = member?.guild) {
    return getPermLevel(member, guild) >= Number(requiredPermLevel);
}

module.exports = { getPermLevel, checkPermLevel };