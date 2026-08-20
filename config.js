
require('dotenv').config();

module.exports = {
    // 🔒 .env'den çekilen hassas/ortam bilgileri
    TOKEN: process.env.TOKEN,
    BOT_OWNER_ID: process.env.BOT_OWNER_ID || process.env.SAHIP_ID,
    SAHIP_ID: process.env.SAHIP_ID || process.env.BOT_OWNER_ID,
    GUILD_ID: process.env.GUILD_ID,
    RAPOR_KANAL_ID: process.env.RAPOR_KANAL_ID,
    BOT_KANAL_ID: process.env.BOT_KANAL_ID || process.env.RAPOR_KANAL_ID,
    KURAL_HATIRLATMA_KANAL_ID: process.env.KURAL_HATIRLATMA_KANAL_ID,
    PARTNER_KANAL_ID: process.env.PARTNER_KANAL_ID || process.env.ONERI_KANAL_ID,
    YASA_MECLIS_KANAL_ID: process.env.YASA_MECLIS_KANAL_ID || '914191232253702184',
    SORUSTURMA_KARANTINA_ROL_ID: process.env.SORUSTURMA_KARANTINA_ROL_ID,
    ONERI_KANAL_ID: process.env.ONERI_KANAL_ID,
    YETKILI_ROL_ID: process.env.YETKILI_ROL_ID,
    YETKILI_ROL_IDLERI: (process.env.YETKILI_ROL_IDLERI || process.env.YETKILI_ROL_ID || '').split(',').map(id => id.trim()).filter(Boolean),
    GOREV_ROLU_ID: process.env.GOREV_ROLU_ID,
        PERMLEVEL_8_USERS: (process.env.PERMLEVEL_8_USERS || '').split(',').map(id => id.trim()).filter(Boolean),
    krizKelimeleri: (process.env.KRIZ_KELIMELERI || 'kriz,acil,tehdit,tartisma,kavga,şiddet').split(',').map(kelime => kelime.trim().toLocaleLowerCase('tr-TR')).filter(Boolean),
    KRIZ_MESAJ_LIMIT: Number(process.env.KRIZ_MESAJ_LIMIT) || 15,

    // ⚙️ Kanal ID'leri
    YETKILI_BOARD_KANAL_ID: process.env.YETKILI_BOARD_KANAL_ID || '1539045055787049041',
    UYE_BOARD_KANAL_ID: process.env.UYE_BOARD_KANAL_ID || '1539015858263822376',

    // 🎭 Rol ID'leri (Dizi yapısını koruduk)
    STAFF_ROLES: (process.env.STAFF_ROLES || '914213183802183761,914251874532753518,825700596383875102,1411668519921127535,911641521147768912,1411667942206083173,891404623473176576').split(',').map(id => id.trim()).filter(Boolean),
    
    HAFTANIN_ELEMANI_ROL_ID: process.env.HAFTANIN_ELEMANI_ROL_ID || '1539045463993356288',
    HAFTANIN_UYESI_ROL_ID: process.env.HAFTANIN_UYESI_ROL_ID || '1539045509879046265'
};