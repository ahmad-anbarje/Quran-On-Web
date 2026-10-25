/**
 * The MCP server itself: its name, what it tells an assistant about itself,
 * and the tools and file addresses it offers. Made afresh for every request
 * (see server.js); the Quran it reads from is opened once and passed in.
 */
'use strict';

const { McpServer } = require('@modelcontextprotocol/sdk/server/mcp.js');
const { registerTools } = require('./tools');
const { registerResources } = require('./resources');

function build(q, version) {
  const server = new McpServer(
    { name: 'readqurantoday', title: 'Read Quran Today', version },
    {
      instructions:
        `The Quran (Madinah Mushaf, Hafs) with ${q.translations.length} translations, the Tafsir ` +
        'al-Muyassar, word-by-word meanings and recitations, from readqurantoday.com. Quote the ' +
        'text as returned and give the link with it. Surahs are 1-114; ayahs count from 1.',
    },
  );
  registerTools(server, q);
  registerResources(server, q);
  return server;
}

module.exports = { build };
