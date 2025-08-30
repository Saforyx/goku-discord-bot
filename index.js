const { Client, GatewayIntentBits } = require("discord.js");
const { joinVoiceChannel, createAudioPlayer, createAudioResource, AudioPlayerStatus } = require("@discordjs/voice");
const fs = require("fs");
require("dotenv").config();

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

const player = createAudioPlayer();

client.on("voiceStateUpdate", (oldState, newState) => {
    const user = newState.member;
    if (!user || user.user.bot) return;

    const channel = newState.channel;
    if (channel && channel.members.filter(m => !m.user.bot).size === 1) {
        console.log(`User ${user.user.tag} joined ${channel.name}. Goku is joining!`);
        const connection = joinVoiceChannel({
            channelId: channel.id,
            guildId: channel.guild.id,
            adapterCreator: channel.guild.voiceAdapterCreator
        });

        if (fs.existsSync("goku.mp3")) {
            console.log("Playing goku.mp3...");
            const resource = createAudioResource("goku.mp3");
            player.play(resource);
            connection.subscribe(player);
        } else {
            console.log("No goku.mp3 file found!");
        }
    }

    if (oldState.channel && oldState.channel.members.filter(m => !m.user.bot).size === 0) {
        console.log(`Everyone left ${oldState.channel.name}. Goku is leaving.`);
        const conn = oldState.guild.members.me.voice.connection;
        if (conn) conn.destroy();
    }
});

player.on(AudioPlayerStatus.Playing, () => {
    console.log("Audio is now playing.");
});

player.on(AudioPlayerStatus.Idle, () => {
    console.log("Audio finished playing.");
});

client.on("ready", () => {
    console.log(`Logged in as ${client.user.tag}!`);
});

client.login(process.env.DISCORD_TOKEN);
