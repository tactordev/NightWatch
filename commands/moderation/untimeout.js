const discord = require('discord.js');
const { emojis } = require('#utils/assets');
const { fetchUser } = require('#utils/member');
const { extractTime } = require('#utils/parsing');
const { saveModeration } = require('#utils/moderation');

module.exports = {
    name: 'untimeout',
    description: 'Revmote the timeout from a user',
    type: 'prefix',
    permissions: [discord.PermissionsBitField.Flags.MuteMembers, discord.PermissionsBitField.Flags.ModerateMembers, discord.PermissionsBitField.Flags.Administrator],
    async execute(client, message, initialResponse, args) {
        await message.delete().catch(() => {});

        const format = `untimeout [user*] [reason ? No reason provided.]`;

        if (args.length < 1) return await initialResponse.edit({
            content: `${emojis.error} Missing required arguments.\n-# ${format}`
        });

        const member = args[0];
        let reason;
        try {
            reason = args.slice(1).join(" ");
        } catch {
            reason = "No reason provided.";
        }

        const user = await fetchUser(member, message.guild);

        if (!user) return await initialResponse.edit({
            content: `${emojis.error} Invalid user provided: **${member}**.\n-# ${format}`
        });
        

        try {
            await user.send({ content: `You have been untimed out in **${message.guild.name}** for ${reason}`})
            await user.timeout(null, reason);
        } catch {
            return await initialResponse.edit({
                content: `There was an error when trying to remove the time out from the user provided.`
            });
        }

        saveModeration(message.guild.id, user.user.id, "untimeout", message.author, user.user, Infinity, reason);

        return await initialResponse.edit({
            content: `${emojis.success} Successfully removed the timed out from **${user.user.username}** for **${reason}**`
        });
    }
}