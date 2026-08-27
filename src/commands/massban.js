const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { hiyerarsiUygunMu, yetkiliKontrolEt, modlogGonder, qdb } = require('../utils/moderationGuard');
const { ilerlemeBaslat } = require('../utils/progressReporter');
const IdManager = require('../utils/idManager');

const data = new SlashCommandBuilder()
    .setName('massban')
    .setDescription('Birden fazla kullanıcıyı toplu olarak yasaklar')
    .addStringOption(opt => opt.setName('kullanicilar').setDescription('Virgülle ayrılmış kullanıcı ID veya mention listesi').setRequired(true))
    .addStringOption(opt => opt.setName('sebep').setDescription('Toplu ban sebebi').setRequired(true));

module.exports = {
    name: 'massban',
    data: data.toJSON(),
    description: 'Birden fazla kullanıcıyı toplu olarak yasaklar',
    async execute(message, args) {
        const options = message.slashOptions || message.options;
        const member = message.member;
        const user = message.author || message.user;
        const guild = message.guild;

        const errorEmbed = (msg) => new EmbedBuilder().setColor('Red').setDescription(`❌ ${msg}`);
        const successEmbed = (msg) => new EmbedBuilder().setColor('Green').setDescription(`✅ ${msg}`);

        if (!yetkiliKontrolEt(member, user)) {
            return message.reply({ embeds: [errorEmbed('Bu komutu kullanmak için yetkili olmalısınız.')], flags: 64 });
        }

        const rawInput = options?.getString?.('kullanicilar');
        const sebep = options?.getString?.('sebep');

        if (!rawInput || !sebep) {
            return message.reply({ embeds: [errorEmbed('Lütfen kullanıcı listesi ve sebep belirtin.')], flags: 64 });
        }

        const targetIds = [...new Set(rawInput.split(',').map(s => s.trim().replace(/[<@!>]/g, '')).filter(Boolean))];

        if (!targetIds.length) {
            return message.reply({ embeds: [errorEmbed('Geçerli kullanıcı ID tespit edilemedi.')], flags: 64 });
        }

        const reporter = await ilerlemeBaslat(message.channel, '🔨 Toplu Ban (Massban) İşlemi');

        let banlandilar = 0;
        let atlandilar = 0;
        let hatalilar = 0;

        for (let i = 0; i < targetIds.length; i++) {
            const targetId = targetIds[i];
            if (reporter) {
                await reporter.adim(`İşleniyor (${i + 1}/${targetIds.length}): \`${targetId}\`...\n✅ Banlanan: ${banlandilar} | ⚠️ Atlanan: ${atlandilar} | ❌ Hata: ${hatalilar}`);
            }

            const targetMember = await guild.members.fetch(targetId).catch(() => null);

            if (targetMember && !hiyerarsiUygunMu(member, targetMember)) {
                atlandilar++;
                continue;
            }

            const roller = targetMember
                ? targetMember.roles.cache.filter(r => r.id !== guild.id).map(r => r.id)
                : [];

            const targetUser = targetMember?.user || { id: targetId, username: targetId };
            
            const rawBanId = await IdManager.generateId('ban');
            const banId = rawBanId.toString();

            const banRecord = {
                banId,
                userId: targetId,
                hedefId: targetId,
                hedefTag: targetUser.tag || targetUser.username,
                yetkiliId: user.id,
                sebep: `[Massban] ${sebep}`,
                tarih: new Date().toISOString(),
                roller,
                islemTuru: 'ban',
                itirazDurumu: 'Yok'
            };

            await qdb.set(`ban_${banId}`, banRecord);
            await qdb.set(`ban_user_${targetId}`, banId);

            try {
                await guild.members.ban(targetId, { reason: `[Massban] ${sebep}` });
                banlandilar++;

                await modlogGonder(guild, message.client, {
                    islem: 'Massban',
                    hedef: targetUser,
                    yetkili: user,
                    sebep: `[Massban] ${sebep}`
                });
            } catch (err) {
                hatalilar++;
            }

            await new Promise(r => setTimeout(r, 1000));
        }

        const sonucMetni = `Toplu ban işlemi tamamlandı.\n\n✅ **Banlanan:** ${banlandilar}\n⚠️ **Hiyerarşi/Bulunamadı Atlanan:** ${atlandilar}\n❌ **Hata Alınan:** ${hatalilar}\n📊 **Toplam ID:** ${targetIds.length}`;

        if (reporter) {
            await reporter.bitir(banlandilar > 0, sonucMetni);
        } else {
            await message.reply({ embeds: [new EmbedBuilder().setColor(banlandilar > 0 ? 'Green' : 'Orange').setDescription(sonucMetni)] });
        }
    }
};
