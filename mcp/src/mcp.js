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

function build(q, version, { feedbackUrl } = {}) {
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
        'text as returned and give the link with it: `link` is the ayah\'s page, `read` opens the mushaf at it ' +
        'to read and listen. Files to save come from get_file. Surahs are 1-114; ayahs count from 1.',
    },
  );
  registerTools(server, q);
  registerApp(server, q);
  registerResources(server, q);
  registerFeedback(server, q, feedbackUrl);
  return server;
}

module.exports = { build };
