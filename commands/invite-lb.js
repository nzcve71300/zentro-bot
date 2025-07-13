const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('invite-lb')
    .setDescription('Show the top 10 inviters in this server'),

  async execute(interaction, client) {
    await interaction.deferReply(); // Prevent timeout

    const topUsers = await new Promise((resolve, reject) => {
      client.db.all(
        `SELECT user_id, uses FROM invites
         WHERE guild_id = ?
         ORDER BY uses DESC
         LIMIT 10`,
        [interaction.guild.id],
        (err, rows) => {
          if (err) return reject(err);
          resolve(rows);
        }
      );
    });

    const leaderboard = await Promise.all(topUsers.map(async (row, i) => {
      try {
        const user = await interaction.guild.members.fetch(row.user_id);
        return `**#${i + 1}** – ${user.user.tag}: **${row.uses}** invites`;
      } catch {
        return null; // Skip if user is gone
      }
    }));

    const embed = new EmbedBuilder()
      .setColor('Orange')
      .setTitle('🔥 Top Inviters')
      .setDescription(leaderboard.filter(Boolean).join('\n') || 'No invites yet.')
      .setThumbnail(interaction.guild.iconURL())
      .setFooter({ text: 'Zentro powered by Emperor 2X' });

    await interaction.editReply({ embeds: [embed] });
  }
};
