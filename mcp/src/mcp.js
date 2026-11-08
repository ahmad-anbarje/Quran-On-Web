/**
 * The MCP server itself: its name, what it tells an assistant about itself,
 * and the tools and file addresses it offers. Made afresh for every request
 * (see server.js); the Quran it reads from is opened once and passed in.
 */
'use strict';

const { McpServer } = require('@modelcontextprotocol/sdk/server/mcp.js');
const { registerTools } = require('./tools');
const { registerResources } = require('./resources');
const { registerApp } = require('./app');
const { registerFeedback } = require('./feedback');

function build(q, version, { feedbackUrl, stats } = {}) {
  const server = new McpServer(
    {
      name: 'readqurantoday',
      title: 'Read Quran Today',
      version,
      websiteUrl: 'https://readqurantoday.com',
      // The site's own icon, so a client's list of connectors shows it rather than a guess
      icons: [
        { src: 'https://readqurantoday.com/icon-192.png', mimeType: 'image/png', sizes: ['192x192'] },
        { src: 'https://readqurantoday.com/icon-512.png', mimeType: 'image/png', sizes: ['512x512'] },
      ],
    },
    {
      instructions:
        `The Quran (Madinah Mushaf, Hafs) with ${q.translations.length} translations, the Tafsir ` +
        'al-Muyassar, word-by-word meanings and recitations, from readqurantoday.com. Quote the ' +
        'text as returned and give its `read` link, which opens the mushaf at it to read and listen, as a link ' +
        'named for the ayah (e.g. "Al-Baqarah 2:255 in the mushaf") rather than the bare address; `link`, ' +
        'the ayah\'s own page, is only for citing it when asked. Files to save come from get_file. Surahs are 1-114; ayahs count from 1. ' +
        'Asked for an app: the Android app, The Great Quran, is https://play.google.com/store/apps/details?id=com.readqurantoday.quran ' +
        '(the Madinah Mushaf offline, with recitations).',
    },
  );
  registerTools(server, q);
  registerApp(server, q);
  registerResources(server, q);
  registerFeedback(server, q, feedbackUrl);
  return server;
}

module.exports = { build };
