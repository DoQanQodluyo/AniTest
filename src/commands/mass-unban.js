const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { yetkiliKontrolEt, modlogGonder, qdb } = require('../utils/moderationGuard');
const { ilerlemeBaslat } = require('../utils/progressReporter');
const IdManager = require('../utils/idManager');

const data = new SlashCommandBuilder()
    .setName('mass-unban')
    .setDescription('Birden fazla kullanıcının yasağını toplu olarak kaldırır')
    .addStringOption(opt => opt.setName('idler').setDescription('Virgülle ayrılmış kullanıcı ID listesi').setRequired(true))
    .addStringOption(opt => opt.setName('sebep').setDescription('Toplu unban sebebi').setRequired(false));

module.exports = {
    name: 'mass-unban',
    data: data.toJSON(),
    description: 'Birden fazla kullanıcının yasağını toplu olarak kaldırır',
    async execute(message, args) {
        const options = message.slashOptions || message.options;
        const member = message.member;
        const user = message.author || message.user;
        const guild = message.guild;

        const errorEmbed = (msg) => new EmbedBuilder().setColor('Red').setDescription(`❌ ${msg}`);

        if (!yetkiliKontrolEt(member, user)) {
            return message.reply({ embeds: [errorEmbed('Bu komutu kullanmak için yetkili olmalısınız.')], flags: 64 });
        }

        const rawInput = options?.getString?.('idler');
        const sebep = options?.getString?.('sebep') || 'Toplu Unban';

        if (!rawInput) {
            return message.reply({ embeds: [errorEmbed('Lütfen kullanıcı ID listesi belirtin.')], flags: 64 });
        }

        const targetIds = [...new Set(rawInput.split(',').map(s => s.trim().replace(/[<@!>]/g, '')).filter(Boolean))];

        if (!targetIds.length) {
            return message.reply({ embeds: [errorEmbed('Geçerli kullanıcı ID tespit edilemedi.')], flags: 64 });
        }

        const reporter = await ilerlemeBaslat(message.channel, '🕊️ Toplu Unban (Mass-Unban) İşlemi');

        let kaldirildi = 0;
        let bulunamadi = 0;
        let hatalilar = 0;

        for (let i = 0; i < targetIds.length; i++) {
            const targetId = targetIds[i];
            if (reporter) {
                await reporter.adim(`İşleniyor (${i + 1}/${targetIds.length}): \`${targetId}\`...\n✅ Unban: ${kaldirildi} | ⚠️ Yasaklı Değil: ${bulunamadi} | ❌ Hata: ${hatalilar}`);
            }

            try {
                await guild.bans.remove(targetId, sebep);
                kaldirildi++;

                const banId = await qdb.get(`ban_user_${targetId}`);
                if (banId) {
                    await IdManager.reindex('ban', parseInt(banId), async (oldId, newId, data) => {
                        if (data && data.userId) {
                            await qdb.set(`ban_user_${data.userId}`, newId.toString());
                        }
                        const itiraz = await qdb.get(`itiraz_${oldId}`);
                        if (itiraz) {
                            itiraz.banId = newId.toString();
                            await qdb.set(`itiraz_${newId}`, itiraz);
                            await qdb.delete(`itiraz_${oldId}`);
                        }
                    });
                    await qdb.delete(`ban_user_${targetId}`);
                }

                await modlogGonder(guild, message.client, {
                    islem: 'Mass-Unban',
                    hedef: { id: targetId, username: targetId },
                    yetkili: user,
                    sebep
                });
            } catch (err) {
                if (err.code === 10026 || err.message?.includes('Unknown Ban')) {
                    bulunamadi++;
                } else {
                    hatalilar++;
                }
            }

            await new Promise(r => setTimeout(r, 1000));
        }

        const sonucMetni = `Toplu unban işlemi tamamlandı.\n\n✅ **Unban Edilen:** ${kaldirildi}\n⚠️ **Zaten Yasaklı Olmayan:** ${bulunamadi}\n❌ **Hata Alınan:** ${hatalilar}\n📊 **Toplam ID:** ${targetIds.length}`;

        if (reporter) {
            await reporter.bitir(kaldirildi > 0, sonucMetni);
        } else {
            await message.reply({ embeds: [new EmbedBuilder().setColor(kaldirildi > 0 ? 'Green' : 'Orange').setDescription(sonucMetni)] });
        }
    }
};
