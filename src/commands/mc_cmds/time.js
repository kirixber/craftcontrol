const { SlashCommandBuilder } = require('discord.js');
const { rconCommand } = require('../../utils/rcon');
const { resolveServer } = require('../../utils/resolveServer');
const { canManageSMP } = require('../../utils/permissions');

module.exports = {
  name: 'time',
  aliases: [],
  description: 'Set or query server time (admin only)',
  data: new SlashCommandBuilder()
    .setName('time')
    .setDescription('Set or query server time (admin only)')
    .addStringOption(option => 
        option.setName('action')
            .setDescription('Set or query time')
            .setRequired(true)
            .addChoices(
                { name: 'set', value: 'set' },
                { name: 'query', value: 'query' },
                { name: 'add', value: 'add' },
            ))
    .addStringOption(option => option.setName('value').setDescription('The time value (e.g., day, night, 1000, daytime)').setRequired(true))
    .addStringOption(option => option.setName('server').setDescription('The server to run the command on')),

  async execute(context, args) {
    const isInteraction = context.isChatInputCommand?.();
    if (isInteraction) await context.deferReply();

    const action = isInteraction ? context.options.getString('action') : args[0];
    const value = isInteraction ? context.options.getString('value') : args[1];
    const serverArg = isInteraction ? context.options.getString('server') : args.slice(-1)[0];

    if (!isInteraction && !action) {
      return context.reply('❌ Usage: `*time <set|query|add> <value> [server]`\nExamples: `*time set day` `*time set night`');
    }

    const server = await resolveServer(context, isInteraction ? (serverArg ? [serverArg] : []) : args.slice(-1), 0);
    if (!server) return;

    if (!await canManageSMP(context.member, server.server_name)) {
      const msg = '❌ You need SMP Manager permissions.';
      return isInteraction ? context.editReply(msg) : context.reply(msg);
    }

    if (!server.rcon_host) {
      const msg = '❌ RCON not configured for this server. Re-run `*setup`.';
      return isInteraction ? context.editReply(msg) : context.reply(msg);
    }

    let command;
    if (isInteraction) {
      command = `time ${action} ${value}`;
    } else {
      command = `time ${args.join(' ')}`;
    }

    try {
      const res = await rconCommand(server, command);
      const replyMsg = `✅ \`${res.replace(/§./g, '')}\``;
      return isInteraction ? context.editReply(replyMsg) : context.reply(replyMsg);
    } catch {
      const errorMsg = '⚠️ Could not connect to server via RCON.';
      return isInteraction ? context.editReply(errorMsg) : context.reply(errorMsg);
    }
  }
};
