const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const db = require('croxydb');
const config = require('../../config.js');

function yetkiliKontrolEt(member, user) {
    if (!member && !user) return false;
    const userId = user?.id || member?.id;
    if (userId === config.BOT_OWNER_ID || userId === config.SAHIP_ID) return true;
    if (member?.permissions?.has(PermissionFlagsBits.Administrator)) return true;

    const izinliRoller = Array.isArray(config.YETKILI_ROL_IDLERI) ? config.YETKILI_ROL_IDLERI : [];
    if (member?.roles?.cache) {
        return member.roles.cache.some(role => izinliRoller.includes(role.id));
    }
    return false;
}

const data = new SlashCommandBuilder()
    .setName('yonetim')
    .setDescription('Sistem tarafından takip edilen izinli kanalları ve verileri yönetir')
    .addSubcommand(sub =>
        sub.setName('kanal')
            .setDescription('Sistem tarafından takip edilen izinli kanalları yönetir')
            .addStringOption(opt => opt.setName('islem').setDescription('Ekle veya Çıkar').setRequired(true).addChoices({ name: 'Ekle', value: 'ekle' }, { name: 'Çıkar', value: 'cikar' }))
            .addChannelOption(opt => opt.setName('kanal').setDescription('Hedef kanal').setRequired(true))
    )
    .addSubcommand(sub =>
        sub.setName('veri-sil')
            .setDescription('Sadece Kurucu: Veritabanındaki eski/tüm verileri temizler')
            .addStringOption(opt => opt.setName('tur').setDescription('Temizlenecek veri türü').setRequired(true).addChoices({ name: 'Tüm Veriler', value: 'tumu' }, { name: 'Gazete Verileri', value: 'gazete' }, { name: 'Snipe Kayıtları', value: 'snipe' }))
    );

module.exports = {
    name: 'yonetim',
    data: data.toJSON(),
    description: 'Sistem tarafından takip edilen izinli kanalları ve verileri yönetir',
    async execute(message, args, client) {
        const options = message.slashOptions || message.options;
        const member = message.member;
        const user = message.author || message.user;
        const guild = message.guild;

        if (!yetkiliKontrolEt(member, user)) {
            return message.reply({ content: '❌ Bu komutu kullanmak için yetkili olmalısınız.', flags: 64 });
        }

        const altKomut = options?.getSubcommand?.() || args[0];

        if (altKomut === 'kanal') {
            const islem = options.getString('islem');
            const targetChannel = options.getChannel('kanal');
            const allowedChannels = db.get(`allowedChannels_${guild.id}`) || [];

            if (islem === 'ekle') {
                if (!allowedChannels.includes(targetChannel.id)) {
                    allowedChannels.push(targetChannel.id);
                    db.set(`allowedChannels_${guild.id}`, allowedChannels);
                }
                return message.reply({ content: `✅ <#${targetChannel.id}> izinli kanallar listesine eklendi.`, flags: 64 });
            } else {
                const newChannels = allowedChannels.filter(id => id !== targetChannel.id);
                db.set(`allowedChannels_${guild.id}`, newChannels);
                return message.reply({ content: `🔴 <#${targetChannel.id}> izinli kanallar listesinden çıkarıldı.`, flags: 64 });
            }
        }

        if (altKomut === 'veri-sil') {
            if (user.id !== config.BOT_OWNER_ID && user.id !== config.SAHIP_ID) {
                return message.reply({ content: '❌ Bu işlemi sadece Bot Sahibi gerçekleştirebilir.', flags: 64 });
            }

            const tur = options.getString('tur');
            if (tur === 'tumu') {
                db.clear();
                return message.reply({ content: '🧹 **Tüm veritabanı sıfırlandı!**', flags: 64 });
            } else if (tur === 'gazete') {
                const allData = db.all() || {};
                for (const key in allData) {
                    if (key.startsWith('gazete_')) db.delete(key);
                }
                return message.reply({ content: '🧹 **Gazete verileri temizlendi.**', flags: 64 });
            } else if (tur === 'snipe') {
                const allData = db.all() || {};
                for (const key in allData) {
                    if (key.startsWith('snipe_list_')) db.delete(key);
                }
                return message.reply({ content: '🧹 **Snipe kayıtları temizlendi.**', flags: 64 });
            }
        }

        return message.reply({ content: '❌ Geçersiz alt komut.', flags: 64 });
    }
};
