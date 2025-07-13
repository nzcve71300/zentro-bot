const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('invite-track')
    .setDescription('Check how many people you’ve invited'),

  async execute(interaction, client) {
    try {
      if (!interaction.deferred && !interaction.replied) {
        await interaction.deferReply();
      }

      const user = interaction.user;

      const invites = await new Promise((resolve, reject) => {
        client.db.get(
          `SELECT uses FROM invites WHERE guild_id = ? AND user_id = ?`,
          [interaction.guild.id, user.id],
          (err, row) => {
            if (err) reject(err);
            else resolve(row?.uses || 0);
          }
        );
      });

      const embed = new EmbedBuilder()
        .setColor('Red')
        .setTitle('🔥 Your Invite Stats')
        .setDescription(`You have invited **${invites}** user(s).`)
        .setThumbnail(user.displayAvatarURL())
        .setFooter({ text: 'Zentro powered by Emperor 2X' });

      if (!interaction.replied) {
        await interaction.editReply({ embeds: [embed] });
      }
    } catch (err) {
      console.error('❌ invite-track error:', err);

      if (!interaction.deferred && !interaction.replied) {
        await interaction.reply({
          content: 'Something went wrong. Try again later.',
          ephemeral: true
        });
      }
    }
  }
};
