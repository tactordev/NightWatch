const discord = require('discord.js');
const { emojis } = require('#utils/assets');
const { fetchUser } = require("#utils/member");
const { extractTime } = require("#utils/parsing");
const { saveModeration } = require('#utils/moderation');

module.exports = {
    name: 'unban',
    description: 'Revoke a user\'s ban',
    type: 'prefix',
    permissions: [discord.PermissionsBitField.Flags.BanMembers, discord.PermissionsBitField.Flags.Administrator],
    async execute(client, message, initialResponse, args) {
        await message.delete().catch(() => {});

        const format = `unban [user_id*] [reason ? No reason provided.]`;

        if (args.length < 1) {
            return await initialResponse.edit({
                content: `${emojis.error} Missing required arguments.\n-# ${format}`
            });
        }

        let member;
        const raw = args[0];
        if (raw.includes("<@")) {
            member = raw.split("<@")[1].split(">")[0];
        } else {
            member = args[0];
        }

        let reason;
        try {
            reason = args.slice(1).join(" ");
        } catch {
            reason = "No reason provided.";
        }

        if (!member) {
            return await initialResponse.edit({
                content: `${emojis.error} Invalid user id provided: **${member}**.\n-# ${format}`
            });
        }

        try {
            await message.guild.bans.remove(member, reason);
        } catch (err) {
            if (err.code === discord.RESTJSONErrorCodes.UnknownBan) {
                return await initialResponse.edit({
                    content: `This user is not banned.`
                });
            }

            console.warn(err);
            return await initialResponse.edit({
                content: `There was an error when trying to unban the user provided.`
            });
        }

        saveModeration(message.guild.id, member, "unban", message.author, "no username", Infinity, reason);

        return await initialResponse.edit({
            content: `${emojis.success} Successfully unbanned **${member}** for **${reason}**`
        });
    }
}