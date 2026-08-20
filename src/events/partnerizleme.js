const db = require('croxydb');
const { EmbedBuilder } = require('discord.js');

module.exports = {
    name: 'messageCreate',
    async execute(message, client) {
        const settings = { trackPartners: true, ...(db.get(`settings_${message.guild?.id}`) || {}) };
        if (!settings.trackPartners) return;

        // Sadece hedeflenen botun (Ryusai: 1112836688843128903) mesajlarını dinle
        if (message.author.id !== '1112836688843128903') return;
        if (!message.embeds || message.embeds.length === 0) return;

        const embed = message.embeds[0];
        const description = embed.description || '';

        // Mesajın partner mesajı olup olmadığını kontrol et
        if (!description.includes('yeni bir partnerlik yaptı')) return;

        // 1. Etiketlenen Yetkilinin Discord ID'sini Çek (<@!ID> veya <@ID>)
        const userMentionMatch = description.match(/<@!?(\d+)>/);
        if (!userMentionMatch) return;
        const targetUserId = userMentionMatch[1];

        // 2. Embed İçindeki İstatistik Sayılarını Regex ile Ayıkla
        const gunlukMatch = description.match(/Günlük:\s*(\d+)/i);
        const haftalikMatch = description.match(/Haftalık:\s*(\d+)/i);
        const aylikMatch = description.match(/Aylık:\s*(\d+)/i);
        const toplamMatch = description.match(/Toplam:\s*(\d+)/i);
        const siralamaMatch = description.match(/Sıralaman:\s*#?(\d+)/i);

        const gunluk = gunlukMatch ? parseInt(gunlukMatch[1]) : 0;
        const haftalik = haftalikMatch ? parseInt(haftalikMatch[1]) : 0;
        const aylik = aylikMatch ? parseInt(aylikMatch[1]) : 0;
        const toplam = toplamMatch ? parseInt(toplamMatch[1]) : 0;
        const siralama = siralamaMatch ? siralamaMatch[1] : 'Belirsiz';

        // 3. Veritabanına Partner Sayacını Kaydet
        db.set(`partnerData_${targetUserId}`, {
            gunluk,
            haftalik,
            aylik,
            toplam,
            siralama,
            lastUpdate: Date.now()
        });

        // 4. Yetkilinin Siciline Otomatik Kayıt/Tebrik İşle
        const sicilNotu = `🤖 [Oto-Partner] Toplam: ${toplam} (Günlük: ${gunluk} | Haftalık: ${haftalik} | Aylık: ${aylik} | Sıra: #${siralama})`;
        
        db.push(`sicil_${targetUserId}`, {
            type: 'Tebrik',
            sebep: sicilNotu,
            by: '1112836688843128903 (Ryusai Bot)',
            date: new Date().toLocaleString('tr-TR')
        });

        console.log(`✅ [Oto-Sicil] <@${targetUserId}> kullanıcısının partner verisi okundu ve siciline işlendi. Toplam: ${toplam}`);
    },
};