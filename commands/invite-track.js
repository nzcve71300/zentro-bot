const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('invite-track')
    .setDescription('Check how many invites someone has')
    .addUserOption(option =>
      option.setName('user').setDescription('Select a user to check')
    ),

  async execute(interaction, client) {
    const user = interaction.options.getUser('user') || interaction.user;

    try {
      // ✅ Only defer if not already handled
      if (!interaction.deferred && !interaction.replied) {
        await interaction.deferReply();
      }

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
        .setTitle('🔥 Invite Tracker')
        .setDescription(`**${user.tag}** has invited **${invites}** user(s).`)
        .setThumbnail(user.displayAvatarURL())
        .setFooter({ text: 'Zentro powered by Emperor 2X' });

      // ✅ Only respond if not already done
      if (!interaction.replied) {
        await interaction.editReply({ embeds: [embed] });
      }
    } catch (err) {
      console.error('❌ Final fatal error in /invite-track:', err);

      // Failsafe: only reply if possible
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({
          content: 'Something went wrong. Try again later.',
          ephemeral: true
        });
      }
    }
  }
};
