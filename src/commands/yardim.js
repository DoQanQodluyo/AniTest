const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

const data = new SlashCommandBuilder()
    .setName('yardim')
    .setDescription('Botun tüm komutlarını ve modüllerini listeler');

module.exports = {
    name: 'yardim',
    data: data.toJSON(),
    description: 'Botun tüm komutlarını ve modüllerini listeler',
    async execute(message, args, client) {
        const embed = new EmbedBuilder()
            .setTitle('📜 AniTest Sistem Rehberi ve Komut Listesi')
            .setColor('Gold')
            .setDescription('Tüm komutlar işlevlerine göre modüler olarak ayrıştırılmıştır:')
            .addFields(
                { name: '🎯 Görev & Takım', value: '`/gorev` — Görev paneli\n`/takim` — Takım yönetimi (üye ekle/çıkar, isim)' },
                { name: '⚖️ Kurallar & Adalet', value: '`/kural` — Kural kitapçığı, kural ekle/sil (Auto-ID)\n`/yasa` — Yasa tasarısı sunma ve oylama' },
                { name: '📋 Yetkili & Vardiya', value: '`/yetkili` — Yetkili rol verme/alma\n`/vardiya` — Vardiya devret/teslim al\n`/sicil` — Sicil sorgulama\n`/rapor` — Faaliyet raporu' },
                { name: '📊 İstatistik & Kanal', value: '`/istatistik` — Sunucu ve kullanıcı istatistikleri\n`/gazete` — Haftalık gazete\n`/snipe` — Silinen mesajları görme\n`/duyuru` — Gelişmiş duyuru\n`/kriz` — Kriz modu yönetimi\n`/yonetim` — İzinli kanallar ve veri yönetimi' },
                { name: '🤝 Etkileşim & Sosyal', value: '`/oneri` — Anonim öneri gönder\n`/tesekkur` — Teşekkür / Kudos puanı\n`/zaman-kapsulu` — Geleceğe mesaj kilitle' }
            )
            .setFooter({ text: 'Discord.js Modüler Mimari | AniTest' })
            .setTimestamp();

        return message.reply({ embeds: [embed] });
    }
};
