const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

function toWikiTitle(query) {
  return query.split(' ').map(w => w[0].toUpperCase() + w.slice(1)).join('_');
}

async function getPageInfo(title) {
  const url = `https://minecraft.wiki/api.php?action=query&titles=${encodeURIComponent(title)}&prop=extracts|pageimages&explaintext=true&piprop=thumbnail&pithumbsize=256&format=json&origin=*`;
  const res = await fetch(url);
  const data = await res.json();
  const page = Object.values(data?.query?.pages)[0];
  if (page.missing !== undefined) return null;

  const extract = page.extract?.trim() || '';
  const paragraphs = extract.split('\n\n').filter(s => s.trim() && !s.startsWith('=='));

  return {
    title: page.title,
    intro: paragraphs[0]?.slice(0, 500) || null,
    url: `https://minecraft.wiki/w/${encodeURIComponent(page.title.replace(/ /g, '_'))}`,
    thumbnail: page.thumbnail?.source || null,
  };
}

async function searchWiki(query) {
  // Add "Minecraft" to avoid snapshot/version page results
  const searchUrl = `https://minecraft.wiki/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&srnamespace=0&srlimit=5&format=json&origin=*`;
  const res = await fetch(searchUrl);
  const data = await res.json();
  return (data?.query?.search || []).filter(r =>
    // Filter out version/snapshot pages
    !/^\d+w\d+[a-z]$|^Java Edition \d|^Bedrock Edition \d|^Education Edition/i.test(r.title)
  );
}

module.exports = {
  name: 'wiki',
  aliases: ['w'],
  description: 'Search the Minecraft Wiki',
  data: new SlashCommandBuilder()
    .setName('wiki')
    .setDescription('Search the Minecraft Wiki')
    .addStringOption(option =>
      option.setName('query')
        .setDescription('The search term')
        .setRequired(true)),

  async execute(context, args) {
    const isInteraction = !!context.isChatInputCommand?.();
    const query = isInteraction ? context.options.getString('query') : args.join(' ');

    if (!query) {
      const msg = '❌ Usage: `*wiki <query>`\nExample: `*wiki silk touch`';
      return isInteraction ? context.reply({ content: msg, ephemeral: true }) : context.reply(msg);
    }

    if (isInteraction) await context.deferReply();

    let searching;
    if (!isInteraction) {
      searching = await context.channel.send(`🔍 Searching wiki for **${query}**...`);
    }

    try {
      // First try direct title lookup (most accurate)
      const directTitle = toWikiTitle(query);
      let info = await getPageInfo(directTitle);

      // Fall back to search if direct lookup fails
      if (!info) {
        const results = await searchWiki(query);
        if (!results.length) {
          const noResults = `❓ No wiki results found for **${query}**. Try a more specific term.`;
          if (isInteraction) return context.editReply(noResults);
          if (searching) await searching.delete();
          return context.reply(noResults);
        }
        info = await getPageInfo(results[0].title);

        if (!info) {
          const loadError = `❓ Couldn't load the wiki page for **${query}**.`;
          if (isInteraction) return context.editReply(loadError);
          if (searching) await searching.delete();
          return context.reply(loadError);
        }

        // Show other results as suggestions if we used search
        if (results.length > 1) {
          const others = results.slice(1, 4).map(r =>
            `[${r.title}](https://minecraft.wiki/w/${encodeURIComponent(r.title.replace(/ /g, '_'))})`
          );
          info.related = others;
        }
      }

      const embed = new EmbedBuilder()
        .setTitle(`📖 ${info.title}`)
        .setURL(info.url)
        .setColor(0x5b8731)
        .setDescription(info.intro || 'No description available.');

      if (info.thumbnail) embed.setThumbnail(info.thumbnail);
      if (info.related?.length) {
        embed.addFields({ name: '🔎 Related pages', value: info.related.join(' • ') });
      }

      embed.setFooter({ text: 'minecraft.wiki • Use /recipe <item> for crafting recipes' });
      
      if (isInteraction) {
        await context.editReply({ content: null, embeds: [embed] });
      } else {
        if (searching) await searching.delete();
        context.channel.send({ embeds: [embed] });
      }

    } catch (err) {
      console.error('Wiki error:', err);
      const errMsg = '⚠️ Something went wrong. Try again later.';
      if (isInteraction) {
        await context.editReply(errMsg);
      } else {
        if (searching) try { await searching.delete(); } catch {}
        context.reply(errMsg);
      }
    }
  }
};
