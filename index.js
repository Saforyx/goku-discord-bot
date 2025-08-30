const { Client, GatewayIntentBits } = require("discord.js");
const { joinVoiceChannel, getVoiceConnection, EndBehaviorType } = require("@discordjs/voice");
const express = require("express");
const fs = require("fs");
const vosk = require("vosk");
const { Readable } = require("stream");

const MODEL_PATH = "vosk-model-small-en-us-0.15";
if (!fs.existsSync(MODEL_PATH)) {
    console.error("Vosk model not found, make sure it's unzipped.");
    process.exit(1);
}
vosk.setLogLevel(0);
const model = new vosk.Model(MODEL_PATH);

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
            console.log(`${newState.member.user.username} joined VC. Starting speech recognition...`);

            const connection = joinVoiceChannel({
                channelId: channel.id,
                guildId: channel.guild.id,
                adapterCreator: channel.guild.voiceAdapterCreator
            });

            const receiver = connection.receiver;
            receiver.speaking.on("start", (userId) => {
                const user = client.users.cache.get(userId);
                console.log(`Listening to ${user ? user.username : "Unknown user"}...`);

                const audioStream = receiver.subscribe(userId, {
                    end: { behavior: EndBehaviorType.AfterSilence, duration: 100 }
                });

                const rec = new vosk.Recognizer({ model: model, sampleRate: 48000 });
                const readable = new Readable().wrap(audioStream);

                readable.on("data", (chunk) => {
                    if (rec.acceptWaveform(chunk)) {
                        const result = rec.result();
                        if (result.text) {
                            console.log(`${user ? user.username : "User"} said: ${result.text}`);
                        }
                    }
                });

                readable.on("end", () => {
                    const final = rec.finalResult();
                    if (final.text) {
                        console.log(`${user ? user.username : "User"} (final): ${final.text}`);
                    }
                    rec.free();
                });
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
                console.log("Everyone left, bot disconnected.");
            }
        }
    }
});

const app = express();
app.get("/", (req, res) => res.send("Goku bot is alive!"));
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Web service running on port ${PORT}`));

client.login(process.env.DISCORD_TOKEN);
