const discord = require('discord.js');
const { emojis } = require('#utils/assets');
const { fetchUser } = require("#utils/member");
const { extractTime } = require("#utils/parsing");
const { saveModeration } = require('#utils/moderation');

module.exports = {
    name: 'ban',
    description: 'Ban a user',
    type: 'prefix',
    permissions: [discord.PermissionsBitField.Flags.BanMembers, discord.PermissionsBitField.Flags.Administrator],
    async execute(client, message, initialResponse, args) {
        await message.delete().catch(() => {});

        const format = `ban [user*] [duration ? indefinite] [reason ? No reason provided.]`;

        if (args.length < 1) {
            return await initialResponse.edit({
                content: `${emojis.error} Missing required arguments.\n-# ${format}`
            });
        }

        const member = args[0];
        const raw = args.slice(1);

        const user = await fetchUser(member, message.guild);

        if (!user) {
            return await initialResponse.edit({
                content: `${emojis.error} Invalid user provided: **${member}**.\n-# ${format}`
            });
        }

        const data = extractTime(raw.join(' '));

        let rawDuration;
        let duration;
        let reason;

        if (data) {
            ({ rawDuration, duration, reason } = data);
        }

        try {
            await user.send({ content: `You have been banned from **${message.guild.name}** for ${reason.length > 0 ? reason : "no reason provided."}`})
            await user.ban({ reason: reason || "No reason provided." });
        } catch {
            return await initialResponse.edit({
                content: `There was an error when trying to ban the user provided.`
            });
        }

        saveModeration(message.guild.id, user.user.id, "ban", message.author, user.user, rawDuration, reason);

        return await initialResponse.edit({
            content: `${emojis.success} Successfully banned **${user.user.username}** **${rawDuration ? `for ${rawDuration}` : "indefinitely"}** for **${reason?.length > 0 ? reason : "no reason provided."}**`
        });
    }
}