const discord = require('discord.js');
const { emojis } = require('#utils/assets');
const { fetchUser } = require('#utils/member');
const { saveModeration } = require('#utils/moderation');

module.exports = {
    name: 'warn',
    description: 'Warn a user',
    type: 'prefix',
    permissions: [discord.PermissionsBitField.Flags.ModerateMembers, discord.PermissionsBitField.Flags.Administrator],
    async execute(client, message, initialResponse, args) {
        await message.delete().catch(() => {});

        const format = `warn [user*] [reason*]`;

        if (args.length < 2) {
            return await initialResponse.edit({
                content: `${emojis.error} Missing required arguments.\n-# ${format}`
            });
        }

        const member = args[0];
        const reason = args.slice(1).join(" ");

        const user = await fetchUser(member, message.guild);

        if (!user) return await initialResponse.edit({
            content: `${emojis.error} Invalid user provided: **${member}**.\n-# ${format}`
        });

        try {
            await user.send({ content: `You have been warned in **${message.guild.name}** for ${reason}`})
        } catch {
            return await initialResponse.edit({
                content: `There was an error when trying to warn the user provided.`
            });
        }
        saveModeration(message.guild.id, user.user.id, "warning", message.author, user.user, Infinity, reason);

        return await initialResponse.edit({
            content: `${emojis.success} Successfully warned **${user.user.username}** for **${reason}**`
        });
    }
}