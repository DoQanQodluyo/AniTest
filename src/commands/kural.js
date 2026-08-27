// --- src/commands/kural.js ---
const { SlashCommandBuilder, EmbedBuilder, PermissionsBitField } = require('discord.js');
const db = require('croxydb');
const config = require('../../config.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('kural')
        .setDescription('Sunucu kurallarını yönetir ve görüntüler.')
        .addSubcommand(subcommand =>
            subcommand
                .setName('ekle')
                .setDescription('Yeni bir kural ekler (Sadece Yetkililer).')
                .addStringOption(option => option.setName('icerik').setDescription('Kural içeriği').setRequired(true))
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('sil')
                .setDescription('Mevcut bir kuralı siler (Sadece Yetkililer).')
                .addIntegerOption(option => option.setName('id').setDescription('Silinecek kuralın ID numarası').setRequired(true))
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('kitapcik')
                .setDescription('Sunucu kural kitapçığını görüntüler.')
        ),

    async execute(interaction, client) {
        const subCmd = interaction.options.getSubcommand();
        const isAdmin = interaction.member.permissions.has(PermissionsBitField.Flags.Administrator) || interaction.user.id === config.BOT_OWNER_ID;
        
        let kurallar = db.get(`kurallar_${interaction.guild.id}`) || [];

        if (subCmd === 'ekle') {
            if (!isAdmin) return interaction.reply({ content: '❌ Bu komutu sadece yöneticiler kullanabilir.', ephemeral: true });
            
            const icerik = interaction.options.getString('icerik');
            kurallar.push(icerik);
            db.set(`kurallar_${interaction.guild.id}`, kurallar);

            return interaction.reply({ content: `✅ Yeni kural eklendi. Toplam kural sayısı: ${kurallar.length}`, ephemeral: true });
        } 
        
        if (subCmd === 'sil') {
            if (!isAdmin) return interaction.reply({ content: '❌ Bu komutu sadece yöneticiler kullanabilir.', ephemeral: true });
            
            const id = interaction.options.getInteger('id');
            if (id < 1 || id > kurallar.length) {
                return interaction.reply({ content: '❌ Geçersiz kural ID numarası.', ephemeral: true });
            }

            // Remove rule at index (id - 1)
            kurallar.splice(id - 1, 1);
            db.set(`kurallar_${interaction.guild.id}`, kurallar);

            return interaction.reply({ content: `✅ ${id} numaralı kural başarıyla silindi ve ID'ler yeniden indekslendi.`, ephemeral: true });
        } 
        
        if (subCmd === 'kitapcik') {
            if (kurallar.length === 0) {
                return interaction.reply({ content: '📚 Sunucuda henüz belirlenmiş bir kural bulunmamaktadır.', ephemeral: true });
            }

            const kuralMetni = kurallar.map((k, index) => `**Madde ${index + 1}:** ${k}`).join('\n\n');

            const embed = new EmbedBuilder()
                .setTitle('📜 Sunucu Kural Kitapçığı')
                .setDescription(kuralMetni)
                .setColor('Gold')
                .setThumbnail(interaction.guild.iconURL())
                .setFooter({ text: `${interaction.guild.name} Anayasası`, iconURL: client.user.displayAvatarURL() })
                .setTimestamp();

            return interaction.reply({ embeds: [embed] });
        }
    }
};
