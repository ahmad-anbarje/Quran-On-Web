/**
 * The MCP Apps: the recitation player, which get_recitation opens, and the
 * ayah card, which get_ayah opens, in hosts that render them (Claude on the
 * web and desktop, ChatGPT); text-only clients never see them. Each is one
 * self-contained page in mcp/app/, with the MCP Apps client
 * (mcp/app/client.min.js) and the mushaf's Arabic face put in it at start:
 * the host's sandbox may load nothing but the recordings and the page fonts.
 */
'use strict';

const fs = require('fs');
const path = require('path');

const PLAYER_URI = 'ui://readqurantoday/player';
const AYAH_URI = 'ui://readqurantoday/ayah';
const MIME = 'text/html;profile=mcp-app';
const APP_DIR = path.join(__dirname, '..', 'app');
const FONT = path.join(__dirname, '..', '..', 'public', 'fonts', 'UthmanicHafs1Ver18.woff2');

const pages = {};
function appHtml(file) {
  if (!pages[file]) {
    pages[file] = fs.readFileSync(path.join(APP_DIR, file), 'utf8')
      .replace('/*@@CLIENT@@*/', () => fs.readFileSync(path.join(APP_DIR, 'client.min.js'), 'utf8'))
      .replace('@@FONT@@', () => fs.readFileSync(FONT).toString('base64'));
  }
  return pages[file];
}

/* The recordings' host, and the site for the mushaf's page fonts: the origins the sandbox reaches */
function mediaOrigins(q) {
  const out = [];
  for (const u of [q.AUDIO, q.SITE]) {
    try { const o = new URL(u).origin; if (!out.includes(o)) out.push(o); } catch (e) { /* served alongside */ }
  }
  return out;
}

function registerApp(server, q) {
  const app = (name, uri, file, title, description) => server.registerResource(name, uri, { title, description, mimeType: MIME }, async () => ({
    contents: [{
      uri,
      mimeType: MIME,
      text: appHtml(file),
      _meta: { ui: { csp: { resourceDomains: mediaOrigins(q) }, prefersBorder: false } },
    }],
  }));
  app('player', PLAYER_URI, 'player.html', 'Recitation player', 'Plays a surah, following each ayah in the Arabic as it is recited');
  app('ayah', AYAH_URI, 'ayah.html', 'Ayah card', 'Ayahs as the mushaf prints them, with their translation, to read and hear');
}

/* What a tool sets to be shown in an app; the flat key is the one older hosts read */
const uiMeta = (uri) => ({ ui: { resourceUri: uri }, 'ui/resourceUri': uri });
const playerMeta = uiMeta(PLAYER_URI);
const ayahMeta = uiMeta(AYAH_URI);

module.exports = { registerApp, playerMeta, ayahMeta, PLAYER_URI, AYAH_URI };
