const { EmbedBuilder, SlashCommandBuilder } = require('discord.js');

function getMonthKey(date = new Date()) {
    return `${String(date.getUTCMonth() + 1).padStart(2, '0')}_${date.getUTCFullYear()}`;
}

function permLevelSekizMi(message, client, db) {
    const izinliKullanicilar = client.config.PERMLEVEL_8_USERS || [];
    const dbSeviyesi = db.get(`permLevel_${message.author.id}`) ?? db.get(`permlevel_${message.author.id}`);
    return Number(dbSeviyesi) === 8 || izinliKullanicilar.includes(message.author.id);
}

module.exports = {
    name: 'tesekkur-et',
    data: new SlashCommandBuilder()
        .setName('tesekkur-et')
        .setDescription('Bir kullanıcıya teşekkür gönderir.')
        .addUserOption(option => option
            .setName('kullanici')
            .setDescription('Teşekkür edilecek kullanıcı.')
            .setRequired(true))
        .addStringOption(option => option
            .setName('sebep')
            .setDescription('Teşekkür sebebi.')
            .setMaxLength(500)
            .setRequired(true)),
    aliases: ['tesekkur', 'teşekkür-et', 'kudos'],
    description: 'Bir kullanıcıya teşekkür gönderir ve aylık puanına ekler.',
    usage: '/tesekkur-et kullanici sebep',
    category: 'Genel',
    async execute(message, args, client, db) {
        if (!permLevelSekizMi(message, client, db)) {
            return message.reply('Bu komutu yalnızca permlevel 8 yetkisine sahip kullanıcılar kullanabilir.');
        }
        const receiver = message.mentions.users.first();
        const reason = args.slice(1).join(' ').trim();

        if (!receiver || !reason) {
            return message.reply('Kullanım: `/tesekkur-et kullanici sebep`');
        }

        if (receiver.id === message.author.id) {
            return message.reply('Kendinize teşekkür edemezsiniz.');
        }

        const monthKey = getMonthKey();
        const guildId = message.guild.id;
        const kudosKey = `kudos_${monthKey}_${receiver.id}`;
        const historyKey = `kudos_history_${guildId}`;
        const record = {
            senderId: message.author.id,
            receiverId: receiver.id,
            reason,
            timestamp: Date.now(),
            guildId,
            month: monthKey
        };

        db.add(kudosKey, 1);
        db.push(historyKey, record);

        const embed = new EmbedBuilder()
            .setTitle('👏 Mikro-Teşekkür Gönderildi')
            .setColor('Green')
            .setDescription(`<@${message.author.id}> kullanıcısı <@${receiver.id}> kullanıcısına teşekkür etti.`)
            .addFields({ name: 'Sebep', value: reason })
            .setFooter({ text: 'Teşekkür puanı bu ayın liderlik tablosuna işlendi.' })
            .setTimestamp();

        return message.reply({ embeds: [embed] });
    }
};