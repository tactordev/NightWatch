const discord = require('discord.js');
const { emojis } = require('#utils/assets');
const { fetchUser } = require('#utils/member');
const { saveModeration } = require('#utils/moderation');

module.exports = {
    name: 'kick',
    description: 'Kick a user',
    type: 'prefix',
    permissions: [discord.PermissionsBitField.Flags.KickMembers, discord.PermissionsBitField.Flags.Administrator],
    async execute(client, message, initialResponse, args) {
        await message.delete().catch(() => {});

        const format = `kick [user*] [reason ? No reason provided.]`;

        if (args.length < 1) {
            return await initialResponse.edit({
                content: `${emojis.error} Missing required arguments.\n-# ${format}`
            });
        }

        const member = args[0];
        const reason = args.length > 1 ? args.slice(1).join(" ") : "No reason provided.";

        const user = await fetchUser(member, message.guild);

        if (!user) return await initialResponse.edit({
            content: `${emojis.error} Invalid user provided: **${member}**.\n-# ${format}`
        });

        try {
            await user.send({ content: `You have been kicked from **${message.guild.name}**.`})
            await user.kick(reason);
        } catch {
            return await initialResponse.edit({
                content: `There was an error when trying to kick the user provided.`
            });
        }

        saveModeration(message.guild.id, user.user.id, "kick", message.author, user.user, Infinity, reason);

        return await initialResponse.edit({
            content: `${emojis.success} Successfully kicked **${user.user.username}** for **${reason}**`
        });
    }
}