const { Client, GatewayIntentBits } = require("discord.js");
const {
    joinVoiceChannel,
    createAudioPlayer,
    createAudioResource,
    AudioPlayerStatus,
    getVoiceConnection,
    EndBehaviorType
} = require("@discordjs/voice");
const express = require("express");
const path = require("path");
const fs = require("fs");
const vosk = require("vosk");
const prism = require("prism-media");

vosk.setLogLevel(0);
const MODEL_PATH = "vosk-model-small-en-us-0.15";
if (!fs.existsSync(MODEL_PATH)) {
    console.error("Vosk model not found! Make sure it's downloaded and extracted.");
    process.exit(1);
}
const model = new vosk.Model(MODEL_PATH);

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildVoiceStates
    ]
});

let currentSpeaker = null;

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
                console.log("Intro finished, bot is now listening...");
            });

            const receiver = connection.receiver;
            receiver.speaking.on("start", (userId) => {
                if (currentSpeaker) return;
                const user = client.users.cache.get(userId);
                if (!user || user.bot) return;

                currentSpeaker = userId;
                console.log(`Now listening to ${user.username}`);

                const opusStream = receiver.subscribe(userId, {
                    end: { behavior: EndBehaviorType.AfterSilence, duration: 1000 }
                });

                const pcmStream = opusStream.pipe(new prism.opus.Decoder({
                    rate: 48000,
                    channels: 1,
                    frameSize: 960
                }));

                const recognizer = new vosk.Recognizer({ model: model, sampleRate: 48000 });

                pcmStream.on("data", (chunk) => {
                    if (recognizer.acceptWaveform(chunk)) {
                        const result = recognizer.result();
                        if (result.text) {
                            console.log(`[${user.username}] said: ${result.text}`);
                        }
                    }
                });

                pcmStream.on("end", () => {
                    console.log(`Stopped listening to ${user.username}`);
                    recognizer.free();
                    currentSpeaker = null;
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
                currentSpeaker = null;
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
