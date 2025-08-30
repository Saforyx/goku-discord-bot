const { Client, GatewayIntentBits } = require("discord.js");
const { joinVoiceChannel, createAudioPlayer, createAudioResource, AudioPlayerStatus } = require("@discordjs/voice");
require("dotenv").config();

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildVoiceStates,
    ],
});

let connection;

client.on("ready", () => {
    console.log(`Logged in as ${client.user.tag}`);
});

client.on("voiceStateUpdate", (oldState, newState) => {
    if (!oldState.channelId && newState.channelId) {
        const channel = newState.channel;
        if (channel.name === "General" && !connection) {
            connection = joinVoiceChannel({
                channelId: channel.id,
                guildId: channel.guild.id,
                adapterCreator: channel.guild.voiceAdapterCreator,
            });

            const player = createAudioPlayer();
            const resource = createAudioResource("goku.mp3");
            connection.subscribe(player);
            player.play(resource);

            player.on(AudioPlayerStatus.Idle, () => {
                console.log("Finished playing Goku's line, staying in VC.");
            });
        }
    }

    if (oldState.channelId && !newState.channelId) {
        const channel = oldState.channel;
        if (channel && channel.members.filter(m => !m.user.bot).size === 0) {
            console.log("Everyone left, disconnecting...");
            connection.destroy();
            connection = null;
        }
    }
});

client.login(process.env.DISCORD_TOKEN);
