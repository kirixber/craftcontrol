const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const recipes = require('../data/recipes.json');

function toId(q) { return q.toLowerCase().trim().replace(/\s+/g, '_'); }
function toDisplay(id) { return id.split('_').map(w => w[0].toUpperCase() + w.slice(1)).join(' '); }

const KEYS = Object.keys(recipes).filter(k => k !== '_comment');

function findMatch(query) {
  const id = toId(query);
  const queryWords = id.split('_').filter(w => w.length > 1);

  // 1. Exact
  if (KEYS.includes(id)) return { key: id, exact: true };

  // 2. Bidirectional: all query words in key AND all significant key words in query
  const strict = KEYS.filter(k => {
    const kWords = k.split('_').filter(w => w.length > 2);
    return queryWords.every(w => k.includes(w)) && kWords.every(w => id.includes(w));
  });
  if (strict.length === 1) return { key: strict[0], exact: false };
  if (strict.length > 1) return { key: strict.sort((a, b) => a.length - b.length)[0], exact: false };

  // 3. One-directional: all query words in key (only if unique result)
  const oneDir = KEYS.filter(k => queryWords.every(w => k.includes(w)));
  if (oneDir.length === 1) return { key: oneDir[0], exact: false };

  // 4. Single-word typo: levenshtein on individual words
  if (queryWords.length === 1) {
    const scored = KEYS.map(k => ({
      key: k,
      dist: Math.min(...k.split('_').map(kw => levenshtein(id, kw)))
    })).filter(x => x.dist <= 2).sort((a, b) => a.dist - b.dist);
    if (scored.length) return { key: scored[0].key, exact: false };
  }

  return null;
}

function levenshtein(a, b) {
  const dp = Array.from({ length: a.length + 1 }, (_, i) =>
    Array.from({ length: b.length + 1 }, (_, j) => i === 0 ? j : j === 0 ? i : 0)
  );
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++)
      dp[i][j] = a[i-1] === b[j-1] ? dp[i-1][j-1] : 1 + Math.min(dp[i-1][j], dp[i][j-1], dp[i-1][j-1]);
  return dp[a.length][b.length];
}

function getSuggestions(query, limit = 3) {
  const id = toId(query);
  const words = id.split('_').filter(w => w.length > 1);
  return KEYS
    .map(k => ({ key: k, score: words.filter(w => k.includes(w)).length }))
    .filter(x => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(x => x.key.replace(/_/g, ' '));
}

async function fetchWikiPage(itemId) {
  try {
    const title = itemId.split('_').map(w => w[0].toUpperCase() + w.slice(1)).join('_');
    const url = `https://minecraft.wiki/api.php?action=query&titles=${encodeURIComponent(title)}&prop=extracts|pageimages&explaintext=true&piprop=thumbnail&pithumbsize=128&format=json&origin=*`;
    const res = await fetch(url);
    const data = await res.json();
    const page = Object.values(data?.query?.pages)[0];
    if (page.missing !== undefined) return null;

    const extract = page.extract?.trim() || '';
    const paragraphs = extract.split('\n\n').filter(s => s.trim() && !s.startsWith('='));
    const intro = paragraphs[0]?.slice(0, 400) || null;
    const usageIdx = extract.search(/\n=+(usage|uses|obtaining)=+/i);
    let usage = null;
    if (usageIdx !== -1) {
      const after = extract.slice(usageIdx).split('\n\n').filter(s => s.trim() && !s.startsWith('='));
      if (after[0]) usage = after[0].slice(0, 300);
    }

    return {
      title: page.title, intro, usage,
      thumbnail: page.thumbnail?.source || null,
      url: `https://minecraft.wiki/w/${encodeURIComponent(page.title.replace(/ /g, '_'))}`
    };
  } catch { return null; }
}

function formatRecipe(recipe) {
  if (!recipe) return null;
  let text = '';
  if (recipe.shapeless) {
    text = `**Shapeless:** ${recipe.shapeless.map(i => `\`${i.replace(/_/g, ' ')}\``).join(' + ')}`;
  } else if (recipe.shaped) {
    text = recipe.shaped.map(row => {
      const cells = Array.isArray(row) ? row : [row];
      return cells.map(i => i ? `\`${i.replace(/_/g, ' ')}\`` : '▪️').join('  ');
    }).join('\n');
  }
  if (recipe.note) text += `\n> ⚠️ ${recipe.note}`;
  return text || null;
}

module.exports = {
  name: 'recipe',
  aliases: ['craft', 'r'],
  description: 'Show crafting recipe and info for any Minecraft item',
  data: new SlashCommandBuilder()
    .setName('recipe')
    .setDescription('Show crafting recipe and info for any Minecraft item')
    .addStringOption(option =>
      option.setName('item')
        .setDescription('The item name')
        .setRequired(true)),

  async execute(context, args) {
    const isInteraction = !!context.isChatInputCommand?.();
    const query = isInteraction ? context.options.getString('item') : args.join(' ');

    if (!query) {
      const msg = '❌ Usage: `*recipe <item>`\nExample: `*recipe diamond sword`';
      return isInteraction ? context.reply({ content: msg, ephemeral: true }) : context.reply(msg);
    }

    if (isInteraction) await context.deferReply();

    let checking;
    if (!isInteraction) {
      checking = await context.channel.send(`🔍 Looking up **${query}**...`);
    }

    try {
      const match = findMatch(query);
      const matchedId = match?.key || null;
      const recipe = matchedId !== null ? recipes[matchedId] : undefined;
      const itemId = toId(query);
      const displayName = toDisplay(matchedId || itemId);
      const wikiInfo = await fetchWikiPage(matchedId || itemId);

      if (recipe && matchedId) {
        const embed = new EmbedBuilder().setTitle(`🔨 ${displayName}`).setColor(0x8B5E3C);
        if (wikiInfo?.intro) embed.setDescription(wikiInfo.intro);
        if (wikiInfo?.thumbnail) embed.setThumbnail(wikiInfo.thumbnail);
        const rt = formatRecipe(recipe);
        if (rt) embed.addFields({ name: '📋 Crafting Recipe', value: rt });
        if (wikiInfo?.usage) embed.addFields({ name: '⚒️ Usage', value: wikiInfo.usage });
        if (wikiInfo?.url) embed.addFields({ name: '📖 Wiki', value: `[Read more](${wikiInfo.url})` });
        if (!match.exact) embed.setFooter({ text: `Showing results for "${displayName}" — did you mean this?` });
        
        if (isInteraction) {
          return await context.editReply({ content: null, embeds: [embed] });
        } else {
          if (checking) await checking.delete();
          return context.channel.send({ embeds: [embed] });
        }
      }

      if (recipe === null && matchedId) {
        const embed = new EmbedBuilder().setTitle(`❌ ${displayName} — Cannot be crafted`).setColor(0xff9900);
        if (wikiInfo?.intro) embed.setDescription(wikiInfo.intro);
        if (wikiInfo?.thumbnail) embed.setThumbnail(wikiInfo.thumbnail);
        embed.addFields({ name: '🗺️ How to obtain', value: 'Cannot be crafted in a crafting table. Obtained through mining, mob drops, chest loot, smelting, trading, or other in-game means.' });
        if (wikiInfo?.usage) embed.addFields({ name: '⚒️ Usage', value: wikiInfo.usage });
        if (wikiInfo?.url) embed.addFields({ name: '📖 Wiki', value: `[Read more](${wikiInfo.url})` });
        
        if (isInteraction) {
          return await context.editReply({ content: null, embeds: [embed] });
        } else {
          if (checking) await checking.delete();
          return context.channel.send({ embeds: [embed] });
        }
      }

      if (wikiInfo) {
        const embed = new EmbedBuilder().setTitle(`📖 ${wikiInfo.title}`).setColor(0x5b8731);
        if (wikiInfo.intro) embed.setDescription(wikiInfo.intro);
        if (wikiInfo.thumbnail) embed.setThumbnail(wikiInfo.thumbnail);
        if (wikiInfo.usage) embed.addFields({ name: '⚒️ Usage', value: wikiInfo.usage });
        embed.addFields(
          { name: '📖 Wiki', value: `[Read more](${wikiInfo.url})` },
          { name: '⚠️ Note', value: "Recipe data for this item isn't in my database yet. Check the wiki link above for crafting info." }
        );
        
        if (isInteraction) {
          return await context.editReply({ content: null, embeds: [embed] });
        } else {
          if (checking) await checking.delete();
          return context.channel.send({ embeds: [embed] });
        }
      }

      const suggestions = getSuggestions(query);
      const hint = suggestions.length ? `\n\nDid you mean:\n${suggestions.map(s => `• \`*recipe ${s}\``).join('\n')}` : '';
      const noFound = `❓ Couldn't find **${query}** in Minecraft.${hint}`;
      
      if (isInteraction) {
        await context.editReply(noFound);
      } else {
        if (checking) await checking.delete();
        context.reply(noFound);
      }

    } catch (err) {
      console.error('Recipe error:', err);
      const errMsg = '⚠️ Something went wrong. Try again later.';
      if (isInteraction) {
        await context.editReply(errMsg);
      } else {
        if (checking) try { await checking.delete(); } catch {}
        context.reply(errMsg);
      }
    }
  }
};
