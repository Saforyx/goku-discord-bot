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
const { Deepgram } = require("@deepgram/sdk");
require("dotenv").config();

// Deepgram client
const deepgram = new Deepgram(process.env.DEEPGRAM_API_KEY);

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildMessages
    ]
});

// Dragon Ball Vocabulary
const dragonBallTerms = [
    "goku", "vegeta", "piccolo", "gohan", "trunks", "frieza",
    "kamehameha", "kaioken", "spirit bomb", "ultra instinct",
    "dragon ball", "super saiyan", "beerus", "majin buu",
    "final flash", "destructo disk", "fusion", "cell", "android"
];

// Helper: fuzzy match Dragon Ball terms
function correctDragonBallTerms(text) {
    let corrected = text;
    for (const term of dragonBallTerms) {
        const regex = new RegExp(term.replace(" ", "\\s?"), "i");
        if (regex.test(text)) {
            corrected = corrected.replace(regex, term);
        }
    }
    return corrected;
}

client.once("ready", () => {
    console.log(`Logged in as ${client.user.tag}`);
});

client.on("voiceStateUpdate", (oldState, newState) => {
    const channel = newState.channel || oldState.channel;
    if (!channel) return;

    // When first human joins
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
            receiver.speaking.on("start", async (userId) => {
                const user = client.users.cache.get(userId);
                if (!user || user.bot) return;

                console.log(`Started listening to ${user.username}`);

                const audioStream = receiver.subscribe(userId, {
                    end: { behavior: EndBehaviorType.AfterSilence, duration: 1000 }
                });

                // Create Deepgram live transcription session
                const deepgramLive = await deepgram.transcription.live({
                    model: "nova",
                    smart_format: true
                });

                audioStream.on("data", (chunk) => {
                    deepgramLive.send(chunk);
                });

                audioStream.on("end", () => {
                    deepgramLive.finish();
                    console.log(`Stopped listening to ${user.username}`);
                });

                // Handle Deepgram messages
                deepgramLive.on("message", (dgMessage) => {
                    const data = JSON.parse(dgMessage);
                    if (data.type === "Results") {
                        const transcript = data.channel.alternatives[0].transcript;
                        if (transcript) {
                            const fixedText = correctDragonBallTerms(transcript);
                            console.log(`[${user.username}] said: ${fixedText}`);

                            const textChannel = client.channels.cache.find(c => c.name === "audio-transcription");
                            if (textChannel) {
                                textChannel.send(`[${user.username}] said: ${fixedText}`);
                            }
                        }
                    }
                });

                deepgramLive.on("close", () => {
                    console.log("Deepgram connection closed");
                });

                deepgramLive.on("error", (err) => {
                    console.error("Deepgram error:", err);
                });
            });
        }
    }

    // When everyone leaves
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

// Keep Render alive with web service
const app = express();
app.get("/", (req, res) => res.send("Goku bot is alive!"));
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Web service running on port ${PORT}`));

client.login(process.env.DISCORD_TOKEN);
