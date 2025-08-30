const { Client, GatewayIntentBits } = require("discord.js");
const { joinVoiceChannel, createAudioPlayer, createAudioResource, AudioPlayerStatus, getVoiceConnection } = require("@discordjs/voice");
const express = require("express");
const path = require("path");

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildVoiceStates
    ]
});

client.once("ready", () => {
    console.log(`Logged in as ${client.user.tag}`);
});

client.on("voiceStateUpdate", (oldState, newState) => {
    const channel = newState.channel || oldState.channel;
    if (!channel) return;

    if (newState.channelId && !oldState.channelId && newState.member.id !== client.user.id) {
        const nonBotMembers = channel.members.filter(m => !m.user.bot);
        if (nonBotMembers.size === 1) {
            const connection = joinVoiceChannel({
                channelId: channel.id,
                guildId: channel.guild.id,
                adapterCreator: channel.guild.voiceAdapterCreator
            });

            const player = createAudioPlayer();
            const resource = createAudioResource(path.join(__dirname, "goku.mp3"));
            player.play(resource);
            connection.subscribe(player);

            player.on(AudioPlayerStatus.Idle, () => {
                console.log("Intro finished, bot staying in channel.");
            });
        }
    }

    if (oldState.channelId && !newState.channelId) {
        const voiceChannel = oldState.channel;
        const nonBotMembers = voiceChannel.members.filter(m => !m.user.bot);
        if (nonBotMembers.size === 0) {
            const connection = getVoiceConnection(voiceChannel.guild.id);
            if (connection) {
                connection.destroy();
                console.log("Everyone left, bot disconnected. Ready for next join cycle.");
            }
        }
    }
});

const app = express();
app.get("/", (req, res) => res.send("Goku bot is alive!"));
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Web service running on port ${PORT}`));

client.login(process.env.DISCORD_TOKEN);
