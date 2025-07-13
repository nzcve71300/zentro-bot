const { Client, GatewayIntentBits, Partials, Collection } = require('discord.js');
const fs = require('fs');
require('dotenv').config();
const sqlite3 = require('sqlite3').verbose();

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildInvites
  ],
  partials: [Partials.GuildMember],
});

client.commands = new Collection();
const commandFiles = fs.readdirSync('./commands').filter(file => file.endsWith('.js'));
for (const file of commandFiles) {
  const command = require(`./commands/${file}`);
  client.commands.set(command.data.name, command);
}

// SQLite setup
client.db = new sqlite3.Database('./invites.db', err => {
  if (err) return console.error(err);
  client.db.run(`CREATE TABLE IF NOT EXISTS invites (
    guild_id TEXT,
    user_id TEXT,
    uses INTEGER DEFAULT 0,
    PRIMARY KEY (guild_id, user_id)
  )`);
});

// Invite cache
const invitesCache = new Map();

client.on('ready', async () => {
  console.log(`🔥 Logged in as ${client.user.tag}`);
  for (const [guildId, guild] of client.guilds.cache) {
    const invites = await guild.invites.fetch();
    invitesCache.set(guild.id, invites);
  }
});

client.on('guildMemberAdd', async member => {
  const newInvites = await member.guild.invites.fetch();
  const oldInvites = invitesCache.get(member.guild.id);
  const inviteUsed = newInvites.find(i => {
    const old = oldInvites.get(i.code);
    return old && i.uses > old.uses;
  });

  const inviter = inviteUsed?.inviter;
  if (inviter) {
    client.db.run(`
      INSERT INTO invites (guild_id, user_id, uses)
      VALUES (?, ?, 1)
      ON CONFLICT(guild_id, user_id)
      DO UPDATE SET uses = uses + 1
    `, [member.guild.id, inviter.id]);
  }

  invitesCache.set(member.guild.id, newInvites);
});

client.on('guildMemberRemove', async member => {
  const audit = await member.guild.fetchAuditLogs({ type: 20 }).catch(() => null); // Member Kick
  const kicked = audit?.entries.first()?.target?.id === member.id;

  if (!kicked) {
    // Assume this was a normal leave, subtract from inviter
    // No perfect way to track which invite they joined from, but we subtract anyway to deter fakes
    client.db.each(`
      SELECT user_id, uses FROM invites WHERE guild_id = ? ORDER BY uses DESC
    `, [member.guild.id], (err, row) => {
      if (!row) return;
      // Can’t trace exactly who invited them, so we assume fairness.
      // You can remove this if you only want additive tracking.
      client.db.run(`
        UPDATE invites SET uses = MAX(uses - 1, 0)
        WHERE guild_id = ? AND user_id = ?
      `, [member.guild.id, row.user_id]);
    });
  }
});

client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;
  const command = client.commands.get(interaction.commandName);
  if (command) {
    try {
      await command.execute(interaction, client);
    } catch (err) {
      console.error(err);
    }
  }
});

client.login(process.env.TOKEN);
