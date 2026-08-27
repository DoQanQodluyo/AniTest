const { qdb } = require('./moderationGuard');
const db = require('croxydb');

/**
 * Otomatik artan ve silindiğinde kayan ID yönetim sistemi.
 */
class IdManager {
    /**
     * Yeni bir ID üretir (1'den başlar, sıralı artar).
     * @param {string} entityType - Kayıt türü (örn: 'ban', 'kick', 'gorev', 'yasa', 'sicil')
     * @returns {Promise<number>} - Yeni oluşturulan ID
     */
    static async generateId(entityType) {
        let count = (await qdb.get(`count_${entityType}`)) || 0;
        count++;
        await qdb.set(`count_${entityType}`, count);
        return count;
    }

    /**
     * Bir kayıt silindiğinde kendinden sonraki tüm kayıtların ID'sini 1 düşürür.
     * @param {string} entityType - Kayıt türü ('ban', 'kick', 'gorev', vb.)
     * @param {number} deletedId - Silinen ID numarası
     * @param {function} updateCallback - (eskiId, yeniId) => Promise<void> - Özel güncelleme işlemleri (itiraz, user link vb.)
     */
    static async reindex(entityType, deletedId, updateCallback = null) {
        let count = (await qdb.get(`count_${entityType}`)) || 0;
        if (deletedId > count || count === 0) return;

        // Silinen ID'den sonrakileri bir aşağı kaydır
        for (let i = deletedId + 1; i <= count; i++) {
            const data = await qdb.get(`${entityType}_${i}`);
            if (data) {
                // Objede id alanı varsa onu da güncelle
                if (data.id) data.id = i - 1;
                else if (data.banId) data.banId = i - 1;
                else if (data.kickId) data.kickId = i - 1;
                
                // Veriyi yeni anahtara taşı
                await qdb.set(`${entityType}_${i - 1}`, data);
                
                // Özel callback varsa çağır (örneğin ban_user_{id} güncellemesi için)
                if (updateCallback) {
                    await updateCallback(i, i - 1, data);
                }
            } else {
                // Eğer veri yoksa boşluk oluşmuş demektir, sadece callback çağır
                if (updateCallback) {
                    await updateCallback(i, i - 1, null);
                }
            }
        }

        // En son elemanı sil
        await qdb.delete(`${entityType}_${count}`);
        
        // Count'u güncelle
        await qdb.set(`count_${entityType}`, count - 1);
    }
}

module.exports = IdManager;
