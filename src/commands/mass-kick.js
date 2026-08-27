const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { hiyerarsiUygunMu, yetkiliKontrolEt, modlogGonder, qdb } = require('../utils/moderationGuard');
const { ilerlemeBaslat } = require('../utils/progressReporter');
const IdManager = require('../utils/idManager');

const data = new SlashCommandBuilder()
    .setName('mass-kick')
    .setDescription('Birden fazla kullanıcıyı toplu olarak atar')
    .addStringOption(opt => opt.setName('kullanicilar').setDescription('Virgülle ayrılmış kullanıcı ID veya mention listesi').setRequired(true))
    .addStringOption(opt => opt.setName('sebep').setDescription('Toplu atma sebebi').setRequired(true));

module.exports = {
    name: 'mass-kick',
    data: data.toJSON(),
    description: 'Birden fazla kullanıcıyı toplu olarak atar',
    async execute(message, args) {
        const options = message.slashOptions || message.options;
        const member = message.member;
        const user = message.author || message.user;
        const guild = message.guild;

        const errorEmbed = (msg) => new EmbedBuilder().setColor('Red').setDescription(`❌ ${msg}`);

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

        const reporter = await ilerlemeBaslat(message.channel, '👢 Toplu Kick (Mass-Kick) İşlemi');

        let atildilar = 0;
        let atlandilar = 0;
        let hatalilar = 0;

        for (let i = 0; i < targetIds.length; i++) {
            const targetId = targetIds[i];
            if (reporter) {
                await reporter.adim(`İşleniyor (${i + 1}/${targetIds.length}): \`${targetId}\`...\n✅ Atılan: ${atildilar} | ⚠️ Atlanan: ${atlandilar} | ❌ Hata: ${hatalilar}`);
            }

            const targetMember = await guild.members.fetch(targetId).catch(() => null);

            if (!targetMember || !hiyerarsiUygunMu(member, targetMember)) {
                atlandilar++;
                continue;
            }

            const roller = targetMember.roles.cache
                .filter(r => r.id !== guild.id)
                .map(r => r.id);

            const rawKickId = await IdManager.generateId('kick');
            const kickId = rawKickId.toString();

            const kickRecord = {
                kickId,
                userId: targetId,
                hedefId: targetId,
                hedefTag: targetMember.user.tag || targetMember.user.username,
                yetkiliId: user.id,
                sebep: `[Mass-Kick] ${sebep}`,
                tarih: new Date().toISOString(),
                roller,
                islemTuru: 'kick'
            };

            await qdb.set(`kick_${kickId}`, kickRecord);

            try {
                await targetMember.kick(`[Mass-Kick] ${sebep}`);
                atildilar++;

                await modlogGonder(guild, message.client, {
                    islem: 'Mass-Kick',
                    hedef: targetMember.user,
                    yetkili: user,
                    sebep: `[Mass-Kick] ${sebep}`
                });
            } catch (err) {
                hatalilar++;
            }

            await new Promise(r => setTimeout(r, 1000));
        }

        const sonucMetni = `Toplu kick işlemi tamamlandı.\n\n✅ **Atılan:** ${atildilar}\n⚠️ **Hiyerarşi/Bulunamadı Atlanan:** ${atlandilar}\n❌ **Hata Alınan:** ${hatalilar}\n📊 **Toplam ID:** ${targetIds.length}`;

        if (reporter) {
            await reporter.bitir(atildilar > 0, sonucMetni);
        } else {
            await message.reply({ embeds: [new EmbedBuilder().setColor(atildilar > 0 ? 'Green' : 'Orange').setDescription(sonucMetni)] });
        }
    }
};
