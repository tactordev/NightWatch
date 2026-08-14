const discord = require('discord.js');
const { emojis } = require('#utils/assets');
const { fetchUser } = require('#utils/member');
const { extractTime } = require('#utils/parsing');
const { saveModeration } = require('#utils/moderation');

module.exports = {
    name: 'timeout',
    description: 'Timeout a user',
    type: 'prefix',
    permissions: [discord.PermissionsBitField.Flags.MuteMembers, discord.PermissionsBitField.Flags.ModerateMembers, discord.PermissionsBitField.Flags.Administrator],
    async execute(client, message, initialResponse, args) {
        await message.delete().catch(() => {});

        const format = `timeout [user*] [duration*] [reason ? No reason provided.]`;

        if (args.length < 2) return await initialResponse.edit({
            content: `${emojis.error} Missing required arguments.\n-# ${format}`
        });

        const member = args[0];
        const raw = args.slice(1);

        const user = await fetchUser(member, message.guild);

        if (!user) return await initialResponse.edit({
            content: `${emojis.error} Invalid user provided: **${member}**.\n-# ${format}`
        });

        const data = extractTime(raw.join(' '));

        let rawDuration;
        let duration;
        let reason;

        if (data) {
            ({
                rawDuration,
                duration,
                reason
            } = data);
        }

        if (!rawDuration) return await initialResponse.edit({
            content: `${emojis.error} Invalid duration provided.\n-# ${format}`
        });

        try {
            await user.send({ content: `You have been timed out in **${message.guild.name}** for ${reason || "no reason provided."}`})
            await user.timeout(duration, reason || "No reason provided.");
        } catch {
            return await initialResponse.edit({
                content: `There was an error when trying to time out the user provided.`
            });
        }

        saveModeration(message.guild.id, user.user.id, "timeout", message.author, user.user, rawDuration, reason);

        return await initialResponse.edit({
            content: `${emojis.success} Successfully timed out **${user.user.username}** for **${rawDuration}** for **${reason?.length > 0 ? reason : "no reason provided."}**`
        });
    }
}