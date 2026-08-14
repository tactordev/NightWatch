require('dotenv').config();

const { REST, Routes, SlashCommandBuilder, Client, Collection, Events, GatewayIntentBits, MessageFlags, PermissionsBitField } = require("discord.js");
const fs = require("fs");
const path = require("path");
const Color = require("./utils/text-color");

const config = JSON.parse(fs.readFileSync("./data/config.json"));

// discord bot token
const TOKEN = process.env.TOKEN;
const clientId = process.env.CLIENT_ID;

// client setup
const client = new Client(
    {
        intents: [
            GatewayIntentBits.Guilds,
            GatewayIntentBits.GuildMessages,
            GatewayIntentBits.MessageContent,
            GatewayIntentBits.GuildMembers
        ]
    }
);

let emojiAssets;

// collections to add cmds to
client.prefixCmds = new Collection();
client.slashCmds = new Collection();
client.subcommandHandlers = new Collection();
client.componentHandlers = new Collection();

const CUSTOM_ROLE_PERMISSION_KEYS = {
    ban: "ban",
    kick: "kick",
    timeout: "timeout",
    warn: "warn",
    "sessions.start": "sessionManagement",
    "sessions.vote": "sessionManagement",
    "sessions.boost": "sessionManagement",
    "sessions.assistance": "sessionManagement",
    "utility.setup": "botManagement"
};

const getConfig = () => {
    try {
        return JSON.parse(fs.readFileSync(path.join(__dirname, "data", "config.json"), "utf8"));
    } catch {
        return null;
    }
};

const getCustomRolePermissionKeys = (commandName, dotNotation) => {
    const keys = new Set();

    if (CUSTOM_ROLE_PERMISSION_KEYS[commandName]) keys.add(CUSTOM_ROLE_PERMISSION_KEYS[commandName]);
    if (CUSTOM_ROLE_PERMISSION_KEYS[dotNotation]) keys.add(CUSTOM_ROLE_PERMISSION_KEYS[dotNotation]);

    return [...keys];
};

const hasAllowedRoles = (member, config, permissionKeys) => {
    if (!permissionKeys.length) return true;
    if (member.permissions?.has(PermissionsBitField.Flags.Administrator)) return true;

    return permissionKeys.every((key) => {
        const roleIds = config?.rolePermissions?.[key] ?? [];
        if (!roleIds.length) return true;

        return roleIds.some((roleId) => member.roles?.cache?.has(roleId));
    });
};

// fetching cmds
const fetchCmd = (location) => {
    fs.readdirSync(`${location}`).map((item) => {
        if (!item.endsWith(".js") && !fs.statSync(path.join(location, item)).isDirectory()) {
            return;
        }

        if (item.endsWith(".js")) { // possible command file
            const command = require(path.join(location, item));

            const full = `${location}${path.sep}${item}`;
            const commandsDir = path.join(__dirname, 'commands');
            const relative = path.relative(commandsDir, full);
            const withoutExtension = relative.slice(0, -path.extname(relative).length);
            const dotNotation = withoutExtension.split(path.sep).join('.');

            command.customRolePermissionKeys = getCustomRolePermissionKeys(command.name, dotNotation);

            if (!command.type || (!(command.name) && !(command.data)) || !command.execute) {
                return console.warn(`${Color.orange}[Skipping]${Color.reset} ${Color.blue}${relative}${Color.reset} as it is missing an attribute of 'type', 'name' or 'data', 'execute'`);
            }

            // register component handlers
            if (command.interactions) {
                for (const [id, callback] of Object.entries(command.interactions)) {
                    if (id.startsWith("ignore:")) continue;

                    client.componentHandlers.set(id, callback);
                }
            }

            // register commands
            switch (command.type) {
                case 'prefix':
                    console.log(`${Color.yellow}[Loading]${Color.reset} ${Color.blue}${relative}${Color.reset} as prefix command.`);
                    return client.prefixCmds.set(command.name, command);
                case 'slash':
                    console.log(`${Color.yellow}[Loading]${Color.reset} ${Color.blue}${relative}${Color.reset} as slash command.`);
                    return client.slashCmds.set(command.data.name, command);
                case 'sub':
                    console.log(`${Color.yellow}[Loading]${Color.reset} ${Color.blue}${relative}${Color.reset} as subcommand.`);
                    return client.subcommandHandlers.set(dotNotation, command);
                default:
                    return console.warn(`${Color.orange}[Skipping]${Color.reset} ${Color.blue}${location}/${item}${Color.reset} as it is has an unknown command type.`);
            }
        } else { // possible sub command files / grouped commands
            return fetchCmd(`${location}${path.sep}${item}`);
        }
    });

}
const commandsPath = path.join(__dirname, "commands");
fetchCmd(commandsPath);
console.log(`${Color.green}[Commands Loaded]${Color.reset}\n\n`);

// register slash commands
const registerCommands = async () => {
    const commandsPath = path.join(__dirname, 'commands');
    const slashCommands = [];
    const subcommandParents = new Map();

    function loadCommands(dir) {
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
            const fullPath = path.join(dir, entry.name);

            if (entry.isDirectory()) {
                loadCommands(fullPath);
                continue;
            }

            if (!entry.name.endsWith('.js')) continue;

            const command = require(fullPath);

            if (!command.type || (!command.name && !command.data) || !command.execute) {
                console.warn(`Skipping ${fullPath} as it is missing 'type', 'name' or 'data', or 'execute'.`);
                continue;
            }

            if (command.type === 'prefix') continue;

            if (command.type === 'slash') {
                if (!command.data?.name) continue;
                slashCommands.push(command.data);
                continue;
            }

            if (command.type === 'sub') {
                if (!command.data?.name) continue;

                const relative = path.relative(commandsPath, fullPath);
                const parts = relative.split(path.sep);
                const parentName = parts[0];

                if (!subcommandParents.has(parentName)) {
                    const parentCommand = new SlashCommandBuilder()
                        .setName(parentName)
                        .setDescription(`Commands for ${parentName}`);

                    subcommandParents.set(parentName, parentCommand);
                    slashCommands.push(parentCommand);
                }

                const currentParent = subcommandParents.get(parentName);
                const updatedParent = currentParent.addSubcommand(command.data);

                if (updatedParent !== currentParent) {
                    subcommandParents.set(parentName, updatedParent);
                    const parentIndex = slashCommands.indexOf(currentParent);
                    if (parentIndex !== -1) {
                        slashCommands[parentIndex] = updatedParent;
                    }
                }
            }
        }
    }

    loadCommands(commandsPath);

    const rest = new REST().setToken(TOKEN);

    try {
        console.log(`${Color.yellow}[Refreshing]${Color.reset} ${slashCommands.length} application (/) commands.`);

        const data = await rest.put(
            Routes.applicationCommands(clientId),
            { body: slashCommands.map(cmd => cmd.toJSON()) }
        );

        console.log(`${Color.green}[Reloaded]${Color.reset} ${data.length} application (/) commands.\n\n\n`);
    } catch (error) {
        console.error("Error registering slash commands:", error);
    }
};

// upload emojis
async function syncAssets(client) {
    const config = path.join(__dirname, "data", "config.json");
    const assets = path.join(__dirname, "assets");

    const configObj = JSON.parse(fs.readFileSync(config, "utf-8"));

    if (!configObj.assets) {
        configObj.assets = {};
    }

    const rest = new REST().setToken(TOKEN);

    console.log(`${Color.yellow}[Assets]${Color.reset} Fetching emojis...`)

    const emojis = await rest.get(
        Routes.applicationEmojis(client.application.id)
    );

    const existing = new Map(
        emojis.items.map((emoji => [emoji.name, emoji]))
    );

    const files = fs.readdirSync(assets).filter(file => file.endsWith(".png"));

    for (const file of files) {
        const name = path.parse(file).name;

        if (existing.has(name)) {
            const emoji = existing.get(name);

            configObj.assets[name] = {
                id: emoji.id,
                name: emoji.name
            };

            console.log(`${Color.yellow}[Asset Loaded]${Color.reset} ${name}`);
            continue;
        }

        const image = fs.readFileSync(path.join(assets, file));
        const uploaded = await rest.post(
            Routes.applicationEmojis(client.application.id),
            {
                body: {
                    name,
                    image: `data:image/png;base64,${image.toString("base64")}`
                }
            }
        );

        configObj.assets[name] = {
            id: uploaded.id,
            name: uploaded.name
        };

    }

    for (const emojiName of Object.keys(configObj.assets)) {
        if (!files.some(file => path.parse(file).name === emojiName)) {
            delete configObj.assets[emojiName];
        }
    }

    fs.writeFileSync(
        config,
        JSON.stringify(configObj, null, 2)
    );

    console.log(`${Color.green}[Assets Synced]${Color.reset}.`)
}
// command handling
client.on(Events.InteractionCreate, async interaction => {

    if (interaction.isChatInputCommand()) {
        const config = getConfig();
        const command = client.slashCmds.get(interaction.commandName);
        if (command) {
            const agent = interaction.member;

            const fixedAllowed = !command.permissions?.length || command.permissions.some((permission) => agent.permissions.has(permission));
            const customAllowed = hasAllowedRoles(agent, config, command.customRolePermissionKeys ?? []);

            if (!fixedAllowed && !customAllowed) {
                return await interaction.reply({
                    content: `${emojiAssets.error} Missing permissions.`,
                    flags: MessageFlags.Ephemeral
                });
            }

            if (!command.noAutoResponse) await interaction.reply({
                content: `> ${emojiAssets.loading}`,
                flags: MessageFlags.Ephemeral
            });
            await command.execute(interaction, client);
        } else {
            const group = interaction.options.getSubcommandGroup(false);
            const subcommand = interaction.options.getSubcommand(false);

            let key;
            if (group) {
                key = `${interaction.commandName}.${group}`;
            } else if (subcommand) {
                key = `${interaction.commandName}.${subcommand}`;
            }

            if (!key) return await interaction.reply({ content: `Command not found.`, flags: MessageFlags.Ephemeral });

            const handler = client.subcommandHandlers.get(key);
            if (handler) {
                const agent = interaction.member;

                const fixedAllowed = !handler.permissions?.length || handler.permissions.some((permission) => agent.permissions.has(permission));
                const customAllowed = hasAllowedRoles(agent, config, handler.customRolePermissionKeys ?? []);

                if (!fixedAllowed && !customAllowed) {
                    return await interaction.reply({
                        content: `${emojiAssets.error} Missing permissions.`,
                        flags: MessageFlags.Ephemeral
                    });
                }

                const initialResponse = !handler.noAutoResponse ? await interaction.reply({
                    content: `-# ${emojiAssets.loading}`,
                    flags: MessageFlags.Ephemeral
                }) : null;

                await handler.execute(interaction, initialResponse);
            } else {
                return await interaction.reply({ content: `Command handler not found.`, flags: MessageFlags.Ephemeral });
            }
        }
    } else if (interaction.isButton() || interaction.isModalSubmit() || interaction.isAnySelectMenu()) {
        const raw = interaction.customId;
        const id = raw.split("-")[0];
        const options = raw.split("-").slice(1);

        const handler = client.componentHandlers.get(id, options);

        if (handler) {
            await handler(interaction, options, client);
        } else {
            return await interaction.reply({
                content: `${emojiAssets.error} Component handler not found.\n-# Try resending the command.`,
                flags: MessageFlags.Ephemeral
            });
        }
    }
});


client.on(Events.MessageCreate, async message => {
    if (message.author.bot) return;
    if (message.content[0] === ".") {
        const args = message.content.slice(1).trim().split(/ +/);
        const name = args.shift().toLowerCase();
        const command = client.prefixCmds.get(name);

        if (!command) return;

        const config = getConfig();
        const agent = message.member;

        const fixedAllowed = !command.permissions?.length || command.permissions.some((permission) => agent.permissions.has(permission));
        const customAllowed = hasAllowedRoles(agent, config, command.customRolePermissionKeys ?? []);

        if (!fixedAllowed && !customAllowed) {
            return await message.reply({
                content: `${emojiAssets.error} Missing permissions.`
            });
        }

        const initialResponse = await message.reply({
            content: `-# ${emojiAssets.loading}`
        });
        await command.execute(client, message, initialResponse, args);
    }
});

// on ready
client.once(Events.ClientReady, async (client) => {
    await registerCommands();
    await syncAssets(client);

    const { emojis } = require('#utils/assets');
    emojiAssets = emojis;

    client.user.setStatus('dnd');
    client.user.setActivity({ type: 3, name: 'Tactor Development'});
    return console.log(`\n\n${Color.green}[Ready]${Color.reset} Logged in as ${Color.blue}${client.user.tag}${Color.reset}`);
});



// bot start
client.login(TOKEN);