const { Client, GatewayIntentBits } = require("discord.js");
const { joinVoiceChannel, createAudioPlayer, createAudioResource, AudioPlayerStatus } = require("@discordjs/voice");
require("dotenv").config();

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildVoiceStates
  ]
});

client.on("ready", () => {
  console.log(`Logged in as ${client.user.tag}!`);
});

client.on("messageCreate", async (msg) => {
  if (msg.content === "!goku join") {
    const channel = msg.member?.voice.channel;

    if (!channel) {
      msg.reply("You need to join a voice channel first!");
      return;
    }

    const connection = joinVoiceChannel({
      channelId: channel.id,
      guildId: channel.guild.id,
      adapterCreator: channel.guild.voiceAdapterCreator,
      selfDeaf: false,
    });

    msg.channel.send("I'm here!");

    try {
      const player = createAudioPlayer();
      const resource = createAudioResource("goku.mp3");
      connection.subscribe(player);

      player.play(resource);

      player.on(AudioPlayerStatus.Idle, () => {
        console.log("Finished playing Goku's voice line.");
      });
    } catch (err) {
      console.error("Error playing audio:", err);
    }
  }
});

client.login(process.env.DISCORD_TOKEN);
