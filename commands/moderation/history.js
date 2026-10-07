const discord = require('discord.js');
const { emojis } = require('#utils/assets');
const { getVictimModerations, getAgentModerations } = require('#utils/moderation');

const PER_PAGE = 5;

const cache = new Map();

const chunkArray = (array, chunkSize) => {
    const chunks = [];
    for (let i = 0; i < array.length; i += chunkSize) {
        chunks.push(array.slice(i, i + chunkSize));
    }
    return chunks;
};

const getModerations = async (guildId, victim, agent) => {
    const vicModerations = victim ? await getVictimModerations(guildId, victim.id) : [];
    const agtModerations = agent ? await getAgentModerations(guildId, agent.id) : [];

    let total = [...vicModerations, ...agtModerations];

    if (victim && agent) {
        total = total.filter(mod => mod.victim === victim.id && mod.agent === agent.id);
    }

    return total;
};

const genEmbed = (interaction, page, data) => {
    const embed = new discord.EmbedBuilder()
        .setTitle(`Moderation History`)
        .setAuthor({ name: interaction.user.tag, iconURL: interaction.user.displayAvatarURL() });

    if (data.length === 0) {
        embed.setDescription(`> No moderation history found.`);
        return embed;
    }

    const pages = chunkArray(data, PER_PAGE);
    const items = pages[page] || [];

    embed.setFooter({ text: `Page ${page + 1}/${pages.length}  •  Total Records: ${data.length}` });

    items.forEach(mod => {
        embed.addFields({
            name: `**${mod.timestamp}**`,
            value: `> **Type:** ${mod.type}\n> **Agent:** <@${mod.agent}>\n> **Victim:** <@${mod.victim}>\n> **Duration:** ${!mod.duration ? "indefinite" : mod.duration}\n> **Reason:** ${mod.reason}`
        });
    });

    return embed;
};


const genComponents = (page, data, disabled = null) => {
    const total = Math.ceil(data.length / PER_PAGE) || 1;

    const prev = new discord.ButtonBuilder()
        .setCustomId('button:history:prev')
        .setEmoji(emojis.leftchevron)
        .setStyle(discord.ButtonStyle.Primary)
        .setDisabled(disabled ?? page === 0);

    const refresh = new discord.ButtonBuilder()
        .setCustomId('button:history:refresh')
        .setEmoji(emojis.refresh)
        .setStyle(discord.ButtonStyle.Secondary)
        .setDisabled(disabled ?? false);

    const next = new discord.ButtonBuilder()
        .setCustomId('button:history:next')
        .setEmoji(emojis.rightchevron)
        .setStyle(discord.ButtonStyle.Primary)
        .setDisabled(disabled ?? page >= total - 1);

    return new discord.ActionRowBuilder().addComponents(prev, refresh, next);
}


module.exports = {
    type: "sub",
    name: "history",
    data: new discord.SlashCommandSubcommandBuilder()
        .setName("history")
        .setDescription("View someone's moderation history.")
        .addUserOption(option => option.setName("victim").setDescription("The person whose history you wish to view."))
        .addUserOption(option => option.setName("agent").setDescription("The person who issues the moderation.")),

    async execute(interaction) {

        const victim = interaction.options.getUser("victim");
        const agent = interaction.options.getUser("agent");

        if (!victim && !agent) {
            return await interaction.editReply({
                content: `Neither a victim nor an agent was provided.`
            });
        }

        const totalModerations = await getModerations(interaction.guild.id, victim, agent);
        const embed = genEmbed(interaction, 0, totalModerations);
        const buttons = genComponents(0, totalModerations);

        const response = await interaction.editReply({
            content: null,
            embeds: [embed],
            components: [buttons]
        });

        cache.set(response.id, {
            ownerId: interaction.user.id,
            victim,
            agent,
            currentPage: 0,
            data: totalModerations
        });

        return;
    },

    interactions: {
        "button:history:prev": async (interaction) => {
            const cached = cache.get(interaction.message.id);
            if (!cached) {
                return await interaction.reply({
                    content: `${emojis.error} This interaction has expired.`,
                    flags: discord.MessageFlags.Ephemeral
                });
            }

            if (interaction.user.id !== cached.ownerId) {
                return await interaction.reply({
                    content: `> ${emojis.error} This is not your interaction.`,
                    flags: discord.MessageFlags.Ephemeral
                });
            }

            cached.currentPage = Math.max(0, cached.currentPage - 1);

            return await interaction.update({
                embeds: [genEmbed(interaction, cached.currentPage, cached.data)],
                components: [genComponents(cached.currentPage, cached.data)]
            });
        },
        "button:history:refresh": async (interaction) => {
            const cached = cache.get(interaction.message.id);
            if (!cached) {

                return await interaction.reply({
                    content: `> ${emojis.error} This interaction has expired.`,
                    flags: discord.MessageFlags.Ephemeral
                });
            }

            if (interaction.user.id !== cached.ownerId) {
                return await interaction.reply({
                    content: `${emojis.error} This is not your interaction.`,
                    flags: discord.MessageFlags.Ephemeral
                });
            }

            cached.data = await getModerations(interaction.guild.id, cached.victim, cached.agent);
            const total = Math.ceil(cached.data.length / PER_PAGE) || 1;
            if (cached.currentPage >= total) cached.currentPage = Math.max(0, total - 1);

            return await interaction.update({
                embeds: [genEmbed(interaction, cached.currentPage, cached.data)],
                components: [genComponents(cached.currentPage, cached.data)]
            });
        },
        "button:history:next": async (interaction) => {
            const cached = cache.get(interaction.message.id);
            if (!cached) {

                return await interaction.reply({
                    content: `> ${emojis.error} This interaction has expired.`,
                    flags: discord.MessageFlags.Ephemeral
                });
            }

            if (interaction.user.id !== cached.ownerId) {
                return await interaction.reply({
                    content: `${emojis.error} This is not your interaction.`,
                    flags: discord.MessageFlags.Ephemeral
                });
            }

            const total = Math.ceil(cached.data.length / PER_PAGE) || 1;
            cached.currentPage = Math.min(total - 1, cached.currentPage + 1);

            return await interaction.update({
                embeds: [genEmbed(interaction, cached.currentPage, cached.data)],
                components: [genComponents(cached.currentPage, cached.data)]
            });
        }
    }
};