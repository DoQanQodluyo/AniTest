const { EmbedBuilder, MessageFlags } = require('discord.js');
const db = require('croxydb');
const { oylamaButonlari } = require('../commands/anonim-oneri');
const { sendReport, sendErrorReport } = require('../utils/reportLogger');
const { yetkiliMi, okuDosya, yazDosya, dosyaEmbed, dosyaButonlari, dosyalariListele, kullaniciSoruşturmaGecmisi, rolleriDondur, rolleriIadeEt, adliKullaniciBildirimi, yasaAnahtari, yasaEmbed, yasaButonlari, sahipDm, kanalGonder } = require('../utils/judicialSystem');

async function gecmisButonuIsle(interaction) {
    const match = interaction.customId.match(/^(sorusturma|sicil)_gecmis_(\d+)$/);
    if (!match) return false;
    const userId = match[2];
    const title = match[1] === 'sorusturma' ? '⚖️ Soruşturma Geçmişi' : '📜 Sicil Geçmişi';
    const records = match[1] === 'sorusturma'
        ? kullaniciSoruşturmaGecmisi(interaction.guild.id, userId)
        : (db.get(`sicil_${userId}`) || []).map(record => ({ id: record.id || '#SIC-KAYIT', detay: `${record.type || 'Kayıt'}: ${record.sebep || 'Sebep yok'}`, tarih: record.date || 'Tarih yok' }));
    const description = records.length
        ? records.map(record => `**${record.id}** | ${record.detay}\n${record.tarih}`).join('\n\n').slice(0, 4000)
        : 'Kayıt bulunamadı.';
    await interaction.reply({ embeds: [new EmbedBuilder().setTitle(title).setColor('Blue').setDescription(description)], flags: MessageFlags.Ephemeral });
    return true;
}

async function adliButonuIsle(interaction, client) {
    const match = interaction.customId.match(/^(dondur|iade)_(.+)$/);
    if (!match) return false;
    if (!yetkiliMi(interaction.member)) {
        await interaction.reply({ content: 'Bu buton yalnızca yetkililer tarafından kullanılabilir.', flags: MessageFlags.Ephemeral });
        return true;
    }

    const [, islem, numara] = match;
    const dosya = okuDosya(interaction.guild.id, numara);
    if (!dosya) {
        await interaction.reply({ content: 'Soruşturma dosyası DB üzerinde bulunamadı.', flags: MessageFlags.Ephemeral });
        return true;
    }

    const sanik = await interaction.guild.members.fetch(dosya.basSanik).catch(() => null);
    if (!sanik) {
        await interaction.reply({ content: 'Baş sanık sunucuda bulunamadı.', flags: MessageFlags.Ephemeral });
        return true;
    }

    if (islem === 'dondur') {
        await rolleriDondur(sanik, dosya);
        dosya.yetkilerDonduruldu = true;
        yazDosya(interaction.guild.id, numara, dosya);
        await interaction.update({ embeds: [dosyaEmbed(dosya)], components: [dosyaButonlari(numara)] });
        await adliKullaniciBildirimi(client, sanik, '🔴 Yetkileriniz donduruldu', `${numara} numaralı soruşturma kapsamında yetkileriniz geçici olarak donduruldu.`);
        await kanalGonder(client, { content: `🔴 <@${sanik.id}> kullanıcısının yetkileri **${numara}** soruşturması için donduruldu.` });
    } else {
        const iadeEdildi = await rolleriIadeEt(sanik, dosya);
        if (!iadeEdildi) {
            await interaction.reply({ content: 'Bu dosya için yedeklenmiş rol bulunamadı.', flags: MessageFlags.Ephemeral });
            return true;
        }
        dosya.yetkilerDonduruldu = false;
        yazDosya(interaction.guild.id, numara, dosya);
        await interaction.update({ embeds: [dosyaEmbed(dosya)], components: [dosyaButonlari(numara)] });
        await adliKullaniciBildirimi(client, sanik, '🟢 Rolleriniz iade edildi', `${numara} numaralı soruşturma kapsamında yedeklenen rolleriniz iade edildi.`);
        await kanalGonder(client, { content: `🟢 <@${sanik.id}> kullanıcısına **${numara}** soruşturması kapsamındaki rolleri iade edildi.` });
    }
    return true;
}

async function yasaButonuIsle(interaction) {
    const match = interaction.customId.match(/^yasa_(kabul|red)_(.+)$/);
    if (!match) return false;
    if (!yetkiliMi(interaction.member)) {
        await interaction.reply({ content: 'Bu oylamaya yalnızca yetkililer katılabilir.', flags: MessageFlags.Ephemeral });
        return true;
    }
    const [, oy, tasariId] = match;
    const key = yasaAnahtari(interaction.guild.id, tasariId);
    const tasari = db.get(key);
    if (!tasari || tasari.aktif === false) {
        await interaction.reply({ content: 'Bu yasa tasarısı artık aktif değil.', flags: MessageFlags.Ephemeral });
        return true;
    }
    tasari.kabul = Array.isArray(tasari.kabul) ? tasari.kabul.filter(id => id !== interaction.user.id) : [];
    tasari.red = Array.isArray(tasari.red) ? tasari.red.filter(id => id !== interaction.user.id) : [];
    tasari[oy === 'kabul' ? 'kabul' : 'red'].push(interaction.user.id);
    db.set(key, tasari);
    await interaction.update({ embeds: [yasaEmbed(tasari)], components: [yasaButonlari(tasariId)] });
    return true;
}

async function anonimOylamayiIsle(interaction) {
    const customId = interaction.customId;
    const onayOylamasi = customId.startsWith('onay_voting_');
    const redOylamasi = customId.startsWith('red_voting_');
    if (!onayOylamasi && !redOylamasi) return false;

    const mesajId = customId.replace(onayOylamasi ? 'onay_voting_' : 'red_voting_', '');
    const veriAnahtari = `anonim_oylama_${mesajId}`;
    const oylama = db.get(veriAnahtari);

    if (!oylama || oylama.messageId !== mesajId) {
        await interaction.reply({
            content: 'Bu oylama kaydı bulunamadı veya artık geçerli değil.',
            flags: MessageFlags.Ephemeral
        });
        return true;
    }

    const kullaniciId = interaction.user.id;
    const evet = Array.isArray(oylama.evet) ? oylama.evet.filter(id => id !== kullaniciId) : [];
    const hayir = Array.isArray(oylama.hayir) ? oylama.hayir.filter(id => id !== kullaniciId) : [];

    if (onayOylamasi) evet.push(kullaniciId);
    if (redOylamasi) hayir.push(kullaniciId);

    const yeniOylama = {
        messageId: mesajId,
        evet: [...new Set(evet)],
        hayir: [...new Set(hayir)]
    };
    db.set(veriAnahtari, yeniOylama);

    const mevcutEmbed = interaction.message.embeds[0]
        ? EmbedBuilder.from(interaction.message.embeds[0])
        : new EmbedBuilder().setTitle('📮 Anonim Öneri / Şikayet');
    await interaction.update({
        embeds: [mevcutEmbed],
        components: [oylamaButonlari(mesajId, yeniOylama.evet.length, yeniOylama.hayir.length)]
    });
    return true;
}

function optionToArgument(option) {
    if (option.type === 1 || option.type === 2) return option.name;
    if (option.value === undefined || option.value === null) return null;
    if (option.type === 6) return `<@${option.value}>`;
    if (option.type === 7) return `<#${option.value}>`;
    if (option.type === 8) return `<@&${option.value}>`;
    if (option.type === 5) return option.value ? option.name : null;
    return String(option.value);
}

function collectArguments(options) {
    return options.flatMap(option => {
        const argument = optionToArgument(option);
        const nestedArguments = option.options ? collectArguments(option.options) : [];
        return argument === null ? nestedArguments : [argument, ...nestedArguments];
    });
}

function firstOption(interaction, getter, names) {
    for (const name of names) {
        const value = interaction.options[getter](name);
        if (value) return value;
    }
    return null;
}

module.exports = {
    name: 'interactionCreate',
    async execute(interaction, client) {
        if (interaction.isButton()) {
            if (await gecmisButonuIsle(interaction)) return;
            if (await adliButonuIsle(interaction, client)) return;
            if (await yasaButonuIsle(interaction)) return;
            const oylamaIslendi = await anonimOylamayiIsle(interaction);
            if (oylamaIslendi) return;
        }

        if (!interaction.isChatInputCommand()) return;

        const command = client.commands.get(interaction.commandName);
        if (!command || typeof command.execute !== 'function') return;

        if (interaction.commandName === 'trafik-analizi') {
            await interaction.deferReply();
        }

        const args = collectArguments(interaction.options.data);
        const mentionedUsers = ['kullanici', 'uye', 'hedef', 'lider']
            .map(name => interaction.options.getUser(name))
            .filter(Boolean);
        const targetUser = mentionedUsers[0] || null;
        const targetMember = firstOption(interaction, 'getMember', ['kullanici', 'uye', 'hedef', 'lider']);
        const targetChannel = firstOption(interaction, 'getChannel', ['kanal']);

        const respond = async payload => {
            const normalizedPayload = typeof payload === 'string'
                ? { embeds: [new EmbedBuilder().setColor('Blue').setDescription(payload)] }
                : payload;
            if (!interaction.replied && !interaction.deferred) {
                await interaction.reply(normalizedPayload);
                return interaction.fetchReply();
            }
            if (interaction.deferred && !interaction.replied) {
                await interaction.editReply(normalizedPayload);
                return interaction.fetchReply();
            }
            return interaction.followUp(normalizedPayload);
        };

        const updateProgress = async payload => {
            const normalizedPayload = typeof payload === 'string'
                ? { embeds: [new EmbedBuilder().setColor('Blue').setDescription(payload)] }
                : payload;
            if (interaction.deferred || interaction.replied) return interaction.editReply(normalizedPayload);
            await interaction.reply(normalizedPayload);
            return interaction.fetchReply();
        };

        const fakeMessage = {
            guild: interaction.guild,
            channel: { ...interaction.channel, send: respond },
            author: interaction.user,
            member: interaction.member,
            client,
            slashOptions: interaction.options,
            content: `/${interaction.commandName} ${args.join(' ')}`,
            mentions: {
                members: { first: () => targetMember },
                users: {
                    first: () => targetUser,
                    toJSON: () => mentionedUsers
                },
                channels: { first: () => targetChannel }
            },
            reply: respond
        };
        fakeMessage.progress = updateProgress;
        fakeMessage.updateProgress = updateProgress;

        try {
            await command.execute(fakeMessage, args, client, db);
            await sendReport(client, {
                title: '✅ Slash komutu çalıştırıldı',
                description: `**/${interaction.commandName}** komutu başarıyla tamamlandı.`,
                fields: [
                    { name: 'Kullanıcı', value: `<@${interaction.user.id}>`, inline: true },
                    { name: 'Sunucu', value: interaction.guild?.name || 'DM', inline: true },
                    { name: 'Argümanlar', value: args.join(' ') || 'Yok' }
                ]
            });
        } catch (error) {
            console.error(`[Slash Komut Hatası] (${interaction.commandName}):`, error);
            await sendErrorReport(client, `Slash komutu başarısız: ${interaction.commandName}`, error, [
                { name: 'Kullanıcı', value: `<@${interaction.user.id}>`, inline: true },
                { name: 'Sunucu', value: interaction.guild?.name || 'DM', inline: true }
            ]);
            const errorPayload = {
                embeds: [new EmbedBuilder().setColor('Red').setDescription('Komut çalıştırılırken bir hata oluştu.')],
                flags: MessageFlags.Ephemeral
            };
            if (interaction.replied || interaction.deferred) {
                await interaction.followUp(errorPayload);
            } else {
                await interaction.reply(errorPayload);
            }
        }
    }
};