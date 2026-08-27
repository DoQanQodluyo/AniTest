// --- config.js ---
require('dotenv').config();

const PORT = parseInt(process.env.SERVER_PORT || process.env.PORT || 16362, 10);

const rawRoles = process.env.YETKILI_ROL_IDLERI || process.env.YETKILI_ROL_ID;
const staffRoles = Array.isArray(rawRoles)
    ? rawRoles
    : (typeof rawRoles === 'string' ? rawRoles.split(',').map(r => r.trim()).filter(Boolean) : []);

const rawStaffRoles = process.env.STAFF_ROLES;
const genericStaffRoles = Array.isArray(rawStaffRoles)
    ? rawStaffRoles
    : (typeof rawStaffRoles === 'string' ? rawStaffRoles.split(',').map(r => r.trim()).filter(Boolean) : []);

const config = {
    // 🔒 Temel Bot ve Kimlik Doğrulama Bilgileri
    TOKEN: process.env.BOT_TOKEN || process.env.TOKEN || '',
    BOT_TOKEN: process.env.BOT_TOKEN || process.env.TOKEN || '',
    CLIENT_ID: process.env.CLIENT_ID || '849715489067237437',
    CLIENT_SECRET: process.env.CLIENT_SECRET || '',
    GUILD_ID: process.env.GUILD_ID || '825457217599307776',
    BOT_OWNER_ID: process.env.BOT_OWNER_ID || process.env.SAHIP_ID || '782215331765813258',
    SAHIP_ID: process.env.SAHIP_ID || process.env.BOT_OWNER_ID || '782215331765813258',

    // 🌐 Web Dashboard ve Port Ayarları (0.0.0.0 Pterodactyl Docker uyumlu)
    PORT: PORT,
    REDIRECT_URI: process.env.REDIRECT_URI || `http://78.154.103.8:${PORT}/auth/callback`,
    DASHBOARD_URL: process.env.DASHBOARD_URL || `http://78.154.103.8:${PORT}`,
    COOKIE_SECRET: process.env.COOKIE_SECRET || 'anibot_secure_session_token_2026',

    // 📢 Kanal ID'leri
    DUYURU_KANAL_ID: process.env.DUYURU_KANAL_ID || '914191232253702184',
    RAPOR_KANAL_ID: process.env.RAPOR_KANAL_ID || '1539210618052280320',
    BOT_KANAL_ID: process.env.BOT_KANAL_ID || process.env.RAPOR_KANAL_ID || '1539210618052280320',
    ONERI_KANAL_ID: process.env.ONERI_KANAL_ID || '914191232253702184',
    PARTNER_KANAL_ID: process.env.PARTNER_KANAL_ID || process.env.ONERI_KANAL_ID || '914191232253702184',
    YASA_MECLIS_KANAL_ID: process.env.YASA_MECLIS_KANAL_ID || '914191232253702184',
    KURAL_HATIRLATMA_KANAL_ID: process.env.KURAL_HATIRLATMA_KANAL_ID || '',
    BAN_LOG_KANAL_ID: process.env.BAN_LOG_KANAL_ID || '',
    ITIRAZ_KANAL_ID: process.env.ITIRAZ_KANAL_ID || '',
    YETKILI_BOARD_KANAL_ID: process.env.YETKILI_BOARD_KANAL_ID || '1539045055787049041',
    UYE_BOARD_KANAL_ID: process.env.UYE_BOARD_KANAL_ID || '1539015858263822376',

    // 🎭 Rol ID'leri (Dizilere dönüştürülmüş)
    YETKILI_ROL_ID: process.env.YETKILI_ROL_ID || '911641521147768912',
    YETKILI_ROL_IDLERI: staffRoles.length > 0 ? staffRoles : ['911641521147768912', '825700596383875102', '1411668519921127535', '1411669092691214388', '914251874532753518', '914213183802183761', '891404623473176576'],
    STAFF_ROLES: genericStaffRoles.length > 0 ? genericStaffRoles : ['914213183802183761', '914251874532753518', '825700596383875102', '1411668519921127535', '911641521147768912', '1411667942206083173', '891404623473176576'],
    GOREV_ROLU_ID: process.env.GOREV_ROLU_ID || '1539380060505772092',
    SORUSTURMA_KARANTINA_ROL_ID: process.env.SORUSTURMA_KARANTINA_ROL_ID || '',
    HAFTANIN_ELEMANI_ROL_ID: process.env.HAFTANIN_ELEMANI_ROL_ID || '1539045463993356288',
    HAFTANIN_UYESI_ROL_ID: process.env.HAFTANIN_UYESI_ROL_ID || '1539045509879046265',
    PERMLEVEL_8_USERS: (process.env.PERMLEVEL_8_USERS || '').split(',').map(s => s.trim()).filter(Boolean),

    // ⚡ Kriz / Filtre Ayarları
    krizKelimeleri: (process.env.KRIZ_KELIMELERI || 'kriz,acil,tehdit,tartisma,kavga,siddet,kufur').split(',').map(k => k.trim().toLocaleLowerCase('tr-TR')).filter(Boolean),
    KRIZ_MESAJ_LIMIT: Number(process.env.KRIZ_MESAJ_LIMIT) || 5
};

// Geliştirme ortamı için güvenli uyarılar (Fatal exit engellendi)
const criticalKeys = [
    { key: 'TOKEN', label: 'Bot Token (BOT_TOKEN veya TOKEN)' },
    { key: 'CLIENT_SECRET', label: 'OAuth2 Client Secret (CLIENT_SECRET)' }
];

for (const { key, label } of criticalKeys) {
    if (!config[key] || config[key] === 'YOUR_BOT_TOKEN_HERE' || config[key] === 'YOUR_OAUTH2_CLIENT_SECRET_HERE') {
        console.warn(`⚠️ [Yapılandırma Uyarısı] ${label} henüz ayarlanmamış. .env dosyasından tanımlayabilirsiniz.`);
    }
}

module.exports = Object.freeze(config);