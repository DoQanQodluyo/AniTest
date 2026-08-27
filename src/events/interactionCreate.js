const { EmbedBuilder, MessageFlags, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const db = require('croxydb');
const { sendReport, sendErrorReport } = require('../utils/reportLogger');
const { yetkiliMi, okuDosya, yazDosya, dosyaEmbed, dosyaButonlari, kullaniciSoruşturmaGecmisi, rolleriDondur, rolleriIadeEt, adliKullaniciBildirimi, yasaAnahtari, yasaEmbed, yasaButonlari, kanalGonder } = require('../utils/judicialSystem');

function oylamaButonlari(mesajId, evetSayi = 0, hayirSayi = 0) {
    return new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`onay_voting_${mesajId}`)
            .setLabel(`✅ Destekle (${evetSayi})`)
            .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
            .setCustomId(`red_voting_${mesajId}`)
            .setLabel(`❌ Reddet (${hayirSayi})`)
            .setStyle(ButtonStyle.Danger)
    );
}

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
            if (interaction.customId.startsWith('btn_gorev_')) {
                const userId = interaction.user.id;
                const db = require('croxydb');
                if (interaction.customId === 'btn_gorev_katil') {
                    db.set(`gorevli_${userId}`, true);
                    const gorevCmd = client.commands.get('gorev');
                    const payload = gorevCmd?.gorevPaneliOlustur?.(interaction.user, interaction.guild) || { content: '✅ Göreve katıldınız!' };
                    await interaction.update(payload);
                    return;
                }
                if (interaction.customId === 'btn_gorev_ayril') {
                    db.set(`gorevli_${userId}`, false);
                    const gorevCmd = client.commands.get('gorev');
                    const payload = gorevCmd?.gorevPaneliOlustur?.(interaction.user, interaction.guild) || { content: '🔴 Görevden ayrıldınız.' };
                    await interaction.update(payload);
                    return;
                }
                if (interaction.customId === 'btn_gorev_durum') {
                    const puan = db.get(`gorev_puan_${userId}`) || 0;
                    const durum = db.get(`gorevli_${userId}`) ? '🟢 **Aktif Görevde**' : '🔴 **Görevde Değil**';
                    return interaction.reply({ content: `📊 **Görev Durumunuz:** ${durum}\n⭐ **Toplam Puan:** ${puan}`, flags: 64 });
                }
                if (interaction.customId === 'btn_gorev_liste') {
                    const allData = db.all() || {};
                    const activeDutyUsers = [];
                    for (const key in allData) {
                        if (key.startsWith('gorevli_') && allData[key] === true) {
                            activeDutyUsers.push(key.replace('gorevli_', ''));
                        }
                    }
                    const listStr = activeDutyUsers.length ? activeDutyUsers.map(id => `• <@${id}>`).join('\n') : '*Şu anda aktif görevde kimse bulunmuyor.*';
                    return interaction.reply({ content: `📋 **Aktif Görevli Listesi (${activeDutyUsers.length}):**\n\n${listStr}`, flags: 64 });
                }
            }
            if (interaction.customId.startsWith('kural_sayfa_')) {
                const kuralCmd = client.commands.get('kural');
                if (kuralCmd?.kuralKitapcigiOlustur) {
                    const parcalar = interaction.customId.split('_');
                    const islem = parcalar[2];
                    const kategori = decodeURIComponent(parcalar[3]);
                    let sayfa = parseInt(parcalar[4], 10);
                    if (islem === 'prev') sayfa -= 1;
                    if (islem === 'next') sayfa += 1;
                    const payload = kuralCmd.kuralKitapcigiOlustur(kategori, sayfa);
                    await interaction.update(payload);
                    return;
                }
            }
            if (interaction.customId.startsWith('ban_geri_al_')) {
                const { qdb, yetkiliKontrolEt, adminMi, modlogGonder } = require('../utils/moderationGuard');
                
                const errorEmbed = (msg) => new EmbedBuilder().setColor('Red').setDescription(`❌ ${msg}`);

                if (!yetkiliKontrolEt(interaction.member, interaction.user)) {
                    await interaction.reply({ embeds: [errorEmbed('Bu butonu yalnızca ban yetkisi/yetkili rolü olan kullanıcılar kullanabilir.')], flags: MessageFlags.Ephemeral });
                    return;
                }

                const banId = interaction.customId.replace('ban_geri_al_', '');
                const banRecord = await qdb.get(`ban_${banId}`);

                if (!banRecord) {
                    await interaction.reply({ embeds: [errorEmbed('Bu ban kaydı veritabanında bulunamadı veya daha önce kaldırılmış.')], flags: MessageFlags.Ephemeral });
                    return;
                }

                const userId = banRecord.userId;
                const isAdmin = adminMi(interaction.member, interaction.user);

                if (isAdmin) {
                    await interaction.guild.bans.remove(userId, `[Geri Al - Admin Onayi: ${interaction.user.tag}]`).catch(() => null);

                    const { rolleriGeriYukle } = require('../utils/moderationGuard');
                    const rolSonuc = await rolleriGeriYukle(interaction.guild, userId);
                    const durumMetni = (!rolSonuc.basarili && rolSonuc.beklemede) ? 'onaylandi_bekliyor' : 'onaylandi';

                    const banKaydi = await qdb.get(`ban_${banId}`) || banRecord;
                    await qdb.set(`ban_${userId}`, { ...banKaydi, durum: durumMetni });
                    await qdb.delete(`ban_user_${userId}`);

                    await modlogGonder(interaction.guild, client, {
                        islem: 'Ban Geri Alindi (Admin)',
                        hedef: { id: userId, username: banRecord.userTag || userId },
                        yetkili: interaction.user,
                        sebep: `Admin onayi ile ban geri alindi. ${durumMetni === 'onaylandi_bekliyor' ? 'Roller sunucuya katilinca verilecek.' : `${rolSonuc.eklenen} rol geri verildi.`}`
                    });

                    const { sendUserDMEmbed } = require('../services/dmService');
                    const { EmbedBuilder: EB4 } = require('discord.js');
                    const dmEmbed = new EB4()
                        .setTitle('✅ Yasaginiz Kaldirildi!')
                        .setColor(0x2ecc71)
                        .setDescription(`**${interaction.guild.name}** sunucusundaki yasaginiz bir yetkili tarafindan kaldirildi. Sunucuya tekrar katilabilirsiniz!`)
                        .addFields({ name: '🆔 Ban ID', value: `\`${banId}\``, inline: true })
                        .setTimestamp();
                    await sendUserDMEmbed(client, userId, dmEmbed, 'Ban Geri Al - Admin');

                    await interaction.update({
                        embeds: [new EmbedBuilder().setColor('Green').setDescription(`🟢 **Ban Geri Alindi!** <@${userId}> kullanicisinin yasagi Admin <@${interaction.user.id}> tarafindan kaldirildi.`)],
                        components: []
                    });
                    return;
                }

                let onaylar = await qdb.get(`ban_undo_approvals_${banId}`) || [];
                if (onaylar.includes(interaction.user.id)) {
                    await interaction.reply({ embeds: [new EmbedBuilder().setColor('Orange').setDescription('⚠️ Bu banın kaldırılması için zaten oy verdiniz.')], flags: MessageFlags.Ephemeral });
                    return;
                }

                onaylar.push(interaction.user.id);
                await qdb.set(`ban_undo_approvals_${banId}`, onaylar);

                if (onaylar.length >= 2) {
                    await interaction.guild.bans.remove(userId, `[Geri Al - 2 Yetkili Onayi: ${onaylar.join(', ')}]`).catch(() => null);

                    const { rolleriGeriYukle } = require('../utils/moderationGuard');
                    const rolSonuc2 = await rolleriGeriYukle(interaction.guild, userId);
                    const durumMetni2 = (!rolSonuc2.basarili && rolSonuc2.beklemede) ? 'onaylandi_bekliyor' : 'onaylandi';

                    const banKaydi2 = await qdb.get(`ban_${banId}`) || banRecord;
                    await qdb.set(`ban_${userId}`, { ...banKaydi2, durum: durumMetni2 });
                    await qdb.delete(`ban_user_${userId}`);
                    await qdb.delete(`ban_undo_approvals_${banId}`);

                    await modlogGonder(interaction.guild, client, {
                        islem: 'Ban Geri Alindi (2 Yetkili)',
                        hedef: { id: userId, username: banRecord.userTag || userId },
                        yetkili: interaction.user,
                        sebep: `2 Yetkili onayi ile ban geri alindi. ${durumMetni2 === 'onaylandi_bekliyor' ? 'Roller sunucuya katilinca verilecek.' : `${rolSonuc2.eklenen} rol geri verildi.`}`
                    });

                    const { sendUserDMEmbed } = require('../services/dmService');
                    const { EmbedBuilder: EB5 } = require('discord.js');
                    const dmEmbed2 = new EB5()
                        .setTitle('✅ Yasaginiz Kaldirildi!')
                        .setColor(0x2ecc71)
                        .setDescription(`**${interaction.guild.name}** sunucusundaki yasaginiz 2 yetkili onayi ile kaldirildi. Sunucuya tekrar katilabilirsiniz!`)
                        .addFields({ name: '🆔 Ban ID', value: `\`${banId}\``, inline: true })
                        .setTimestamp();
                    await sendUserDMEmbed(client, userId, dmEmbed2, 'Ban Geri Al - 2 Yetkili');

                    await interaction.update({
                        embeds: [new EmbedBuilder().setColor('Green').setDescription(`🟢 **Ban Geri Alindi!** <@${userId}> kullanicisinin yasagi 2 Yetkili onayi ile kaldirildi.`)],
                        components: []
                    });
                } else {
                    const yeniRow = new ActionRowBuilder().addComponents(
                        new ButtonBuilder()
                            .setCustomId(`ban_geri_al_${banId}`)
                            .setLabel(`↩️ Banı Geri Al (${onaylar.length}/2 Yetkili)`)
                            .setStyle(ButtonStyle.Danger)
                    );

                    await interaction.update({ components: [yeniRow] });
                    await interaction.followUp({ content: `✅ Banı geri alma talebiniz alındı. (Şu anki onay: **${onaylar.length}/2** yetkili veya 1 Admin)`, flags: MessageFlags.Ephemeral });
                }
                return;
            }

            if (interaction.customId.startsWith('itiraz_baslat_')) {
                const banId = interaction.customId.replace('itiraz_baslat_', '');
                const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');
                const modal = new ModalBuilder()
                    .setCustomId(`itiraz_modal_${banId}`)
                    .setTitle('⚖️ Ban İtiraz Formu');

                const inputGerekce = new TextInputBuilder()
                    .setCustomId('itiraz_gerekce')
                    .setLabel('İtiraz Gerekçeniz')
                    .setStyle(TextInputStyle.Paragraph)
                    .setPlaceholder('Neden banınızın kaldırılması gerektiğini açıklayın...')
                    .setRequired(true);

                modal.addComponents(new ActionRowBuilder().addComponents(inputGerekce));
                await interaction.showModal(modal);
                return;
            }

            if (interaction.customId.startsWith('itiraz_onayla_') || interaction.customId.startsWith('itiraz_reddet_')) {
                const { qdb, modlogGonder, yetkiliKontrolEt } = require('../utils/moderationGuard');
                
                const errorEmbed = (msg) => new EmbedBuilder().setColor('Red').setDescription(`❌ ${msg}`);

                if (!yetkiliKontrolEt(interaction.member, interaction.user)) {
                    await interaction.reply({ embeds: [errorEmbed('Bu işlemi yalnızca yetkililer yapabilir.')], flags: MessageFlags.Ephemeral });
                    return;
                }

                const isOnay = interaction.customId.startsWith('itiraz_onayla_');
                const banId = interaction.customId.replace(isOnay ? 'itiraz_onayla_' : 'itiraz_reddet_', '');

                const itiraz = await qdb.get(`itiraz_${banId}`);
                const banData = await qdb.get(`ban_${banId}`);
                const userId = itiraz?.userId || banData?.userId;

                if (isOnay) {
                    if (userId) {
                        await interaction.guild.bans.remove(userId, `[İtiraz Kabul] ${interaction.user.tag}`).catch(() => null);
                        await qdb.delete(`ban_user_${userId}`);
                    }

                    const { rolleriGeriYukle } = require('../utils/moderationGuard');
                    const rolSonuc = await rolleriGeriYukle(interaction.guild, userId);

                    let durumMetni = 'onaylandi';
                    let modlogDetay = 'İtiraz onaylandı, yasağı kaldırıldı.';

                    if (!rolSonuc.basarili && rolSonuc.beklemede) {
                        durumMetni = 'onaylandi_bekliyor';
                        modlogDetay = 'İtiraz onaylandı, kullanıcı sunucuya tekrar katılınca rolleri otomatik geri verilecek.';
                    } else if (rolSonuc.basarili) {
                        modlogDetay = `İtiraz onaylandı, ${rolSonuc.eklenen} rol geri verildi.`;
                        if (rolSonuc.basarisizRoller?.length) {
                            modlogDetay += ` (Eklenemeyen roller [bot yetkisi yetersiz/silinmiş]: ${rolSonuc.basarisizRoller.join(', ')})`;
                        }
                    }

                    if (itiraz) {
                        itiraz.durum = durumMetni;
                        await qdb.set(`itiraz_${banId}`, itiraz);
                    }

                    const banKaydi = await qdb.get(`ban_${userId}`) || await qdb.get(`ban_${banId}`);
                    if (banKaydi) {
                        await qdb.set(`ban_${userId}`, { ...banKaydi, durum: durumMetni });
                    }

                    await modlogGonder(interaction.guild, client, {
                        islem: 'Ban İtirazı Kabul Edildi',
                        hedef: { id: userId, username: itiraz?.userTag || userId },
                        yetkili: interaction.user,
                        sebep: modlogDetay
                    });

                    const { sendUserDMEmbed } = require('../services/dmService');
                    if (userId) {
                        const { EmbedBuilder: EB3 } = require('discord.js');
                        const kabulEmbed = new EB3()
                            .setTitle('✅ Ban İtirazınız Kabul Edildi!')
                            .setColor(0x2ecc71)
                            .setDescription(`**${interaction.guild.name}** sunucusundaki ban itirazınız kabul edildi ve yasağınız kaldırıldı.\n\nSunucuya tekrar katılabilirsiniz!`)
                            .addFields(
                                { name: '🆔 Ban ID', value: `\`${banId}\``, inline: true },
                                { name: '📅 Karar Tarihi', value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: true }
                            )
                            .setTimestamp();
                        await sendUserDMEmbed(client, userId, kabulEmbed, 'İtiraz Kabul');
                    }

                    await interaction.update({
                        content: `✅ **İtiraz Onaylandı!** <@${userId}> yasağı kaldırıldı.\nℹ️ ${modlogDetay}`,
                        embeds: interaction.message.embeds,
                        components: []
                    });
                } else {
                    if (itiraz) {
                        itiraz.durum = 'reddedildi';
                        await qdb.set(`itiraz_${banId}`, itiraz);
                    }

                    const { sendUserDMEmbed } = require('../services/dmService');
                    if (userId) {
                        const { EmbedBuilder: EB2 } = require('discord.js');
                        const redEmbed = new EB2()
                            .setTitle('❌ Ban İtirazınız Reddedildi')
                            .setColor(0xe74c3c)
                            .setDescription(`**${interaction.guild.name}** sunucusundaki ban itirazınız yetkililerce incelenmiş ve **reddedilmiştir**.`)
                            .addFields(
                                { name: '🆔 Ban ID', value: `\`${banId}\``, inline: true },
                                { name: '📅 Karar Tarihi', value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: true }
                            )
                            .setFooter({ text: 'Hatalı bir karar olduğunu düşünüyorsanız sunucu yönetimiyle iletişime geçin.' })
                            .setTimestamp();
                        await sendUserDMEmbed(client, userId, redEmbed, 'İtiraz Red');
                    }

                    await interaction.update({
                        content: `❌ **İtiraz Reddedildi.**`,
                        embeds: interaction.message.embeds,
                        components: []
                    });
                }
                return;
            }

            if (await gecmisButonuIsle(interaction)) return;
            if (await adliButonuIsle(interaction, client)) return;
            if (await yasaButonuIsle(interaction)) return;
            const oylamaIslendi = await anonimOylamayiIsle(interaction);
            if (oylamaIslendi) return;
        }

        if (interaction.isModalSubmit()) {
            if (interaction.customId.startsWith('itiraz_modal_')) {
                const banId = interaction.customId.replace('itiraz_modal_', '');
                const gerekce = interaction.fields.getTextInputValue('itiraz_gerekce');
                const ekBilgi = interaction.fields.getTextInputValue?.('itiraz_ek_bilgi') || '';
                const { qdb } = require('../utils/moderationGuard');
                const config = require('../../config.js');

                // Mükerrer itiraz kontrolü
                const mevcutItiraz = await qdb.get(`itiraz_${banId}`);
                if (mevcutItiraz && mevcutItiraz.durum === 'beklemede') {
                    await interaction.reply({ embeds: [new EmbedBuilder().setColor('Orange').setDescription('⏳ Bu Ban ID için zaten bekleyen bir itirazınız var. Yetkililerin değerlendirmesini bekleyin.')], flags: MessageFlags.Ephemeral });
                    return;
                }

                const banData = await qdb.get(`ban_${banId}`);

                const itirazObj = {
                    banId,
                    userId: interaction.user.id,
                    userTag: interaction.user.tag || interaction.user.username,
                    metin: gerekce,
                    ekBilgi: ekBilgi || null,
                    durum: 'beklemede',
                    tarih: new Date().toISOString()
                };

                await qdb.set(`itiraz_${banId}`, itirazObj);

                const kanalId = await qdb.get('itiraz_kanal') || config.ITIRAZ_KANAL_ID || config.RAPOR_KANAL_ID || config.BAN_LOG_KANAL_ID;
                if (kanalId) {
                    const itirazKanal = client.channels.cache.get(kanalId) || await client.channels.fetch(kanalId).catch(() => null);
                    if (itirazKanal?.isTextBased()) {
                        const fields = [
                            { name: '👤 Başvuran', value: `<@${interaction.user.id}> (\`${interaction.user.tag || interaction.user.username}\`)`, inline: true },
                            { name: '🆔 Ban ID', value: `\`${banId}\``, inline: true },
                        ];

                        if (banData) {
                            fields.push(
                                { name: '📅 Ban Tarihi', value: banData.tarih ? `<t:${Math.floor(new Date(banData.tarih).getTime() / 1000)}:F>` : 'Bilinmiyor', inline: true },
                                { name: '💬 Ban Sebebi', value: banData.sebep || 'Belirtilmedi', inline: false }
                            );
                        }

                        fields.push({ name: '📝 İtiraz Gerekçesi', value: gerekce, inline: false });
                        if (ekBilgi) {
                            fields.push({ name: '📎 Ek Bilgi', value: ekBilgi, inline: false });
                        }

                        const embed = new EmbedBuilder()
                            .setTitle(`⚖️ Yeni Ban İtirazı`)
                            .setDescription(`Ban ID: \`${banId}\``)
                            .setColor('Yellow')
                            .addFields(fields)
                            .setThumbnail(interaction.user.displayAvatarURL({ dynamic: true }))
                            .setTimestamp()
                            .setFooter({ text: 'Onaylamak için ✅, reddetmek için ❌ butonunu kullanın.' });

                        const row = new ActionRowBuilder().addComponents(
                            new ButtonBuilder().setCustomId(`itiraz_onayla_${banId}`).setLabel('✅ Onayla & Unban').setStyle(ButtonStyle.Success),
                            new ButtonBuilder().setCustomId(`itiraz_reddet_${banId}`).setLabel('❌ Reddet').setStyle(ButtonStyle.Danger)
                        );

                        await itirazKanal.send({ embeds: [embed], components: [row] }).catch(() => null);
                    }
                }

                await interaction.reply({
                    embeds: [new EmbedBuilder()
                        .setTitle('✅ İtirazınız Alındı')
                        .setColor(0x2ecc71)
                        .setDescription(`**${interaction.guild?.name || 'Sunucu'}** yetkililerine itirazınız iletildi.\n\nDeğerlendirildiğinde DM ile bilgilendirileceksiniz.`)
                        .addFields(
                            { name: '🆔 Ban ID', value: `\`${banId}\``, inline: true },
                            { name: '📌 Durum', value: '⏳ Beklemede', inline: true },
                            { name: '📅 Başvuru', value: `<t:${Math.floor(Date.now() / 1000)}:R>`, inline: true }
                        )
                        .setTimestamp()
                    ],
                    flags: MessageFlags.Ephemeral
                });
                return;
            }
        }

        if (interaction.isStringSelectMenu()) {
            if (interaction.customId === 'kural_secim_kategori') {
                const kuralCmd = client.commands.get('kural');
                if (kuralCmd?.kuralKitapcigiOlustur) {
                    const seciliKategori = interaction.values[0];
                    const payload = kuralCmd.kuralKitapcigiOlustur(seciliKategori, 0);
                    await interaction.update(payload);
                    return;
                }
            }
        }

        if (!interaction.isChatInputCommand()) return;

        const command = client.commands.get(interaction.commandName);
        if (!command || typeof command.execute !== 'function') return;

        const longRunningCommands = ['ban', 'unban', 'kick', 'massban', 'mass-unban', 'mass-kick', 'trafik-analizi', 'istatistik', 'rapor'];
        if (longRunningCommands.includes(interaction.commandName)) {
            await interaction.deferReply().catch(() => {});
        }

        const args = collectArguments(interaction.options.data);
        const mentionedUsers = ['kullanici', 'uye', 'hedef', 'lider']
            .map(name => interaction.options.getUser(name))
            .filter(Boolean);
        const targetUser = mentionedUsers[0] || null;
        const targetMember = firstOption(interaction, 'getMember', ['kullanici', 'uye', 'hedef', 'lider']);
        const targetChannel = firstOption(interaction, 'getChannel', ['kanal']);

        const normalizePayload = payload => {
            if (typeof payload === 'string') {
                return { embeds: [new EmbedBuilder().setColor('Blue').setDescription(payload)] };
            }
            if (payload && payload.content && !payload.embeds) {
                const isError = payload.content.includes('❌');
                const isSuccess = payload.content.includes('✅') || payload.content.includes('🟢');
                const isWarning = payload.content.includes('⚠️');
                const color = isError ? 'Red' : (isSuccess ? 'Green' : (isWarning ? 'Orange' : 'Blue'));
                
                // Remove prefix emojis if they exist at the start of the string
                const cleanContent = payload.content.replace(/^[❌✅🟢⚠️]\s*/, '');
                
                return { ...payload, content: '', embeds: [new EmbedBuilder().setColor(color).setDescription(cleanContent)] };
            }
            return payload;
        };

        const respond = async payload => {
            const normalizedPayload = normalizePayload(payload);
            const isAcknowledged = interaction.deferred || interaction.replied;
            
            if (isAcknowledged) {
                return interaction.editReply(normalizedPayload);
            }
            return interaction.reply(normalizedPayload);
        };

        const updateProgress = async payload => {
            const normalizedPayload = normalizePayload(payload);
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
            if (!interaction.replied) {
                if (interaction.deferred) {
                    await interaction.editReply(errorPayload);
                } else {
                    await interaction.reply(errorPayload);
                }
            }
        }
    }
};