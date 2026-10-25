/**
 * The recitation player: an MCP App that get_recitation opens in hosts that
 * render them (Claude on the web and desktop), and that text-only clients
 * never see. One self-contained page, mcp/app/player.html, with the MCP Apps
 * client (mcp/app/client.min.js) and the mushaf's Arabic face put in it at
 * start: the host's sandbox may load nothing but the recordings themselves.
 */
'use strict';

const fs = require('fs');
const path = require('path');

const PLAYER_URI = 'ui://readqurantoday/player';
const MIME = 'text/html;profile=mcp-app';
const APP_DIR = path.join(__dirname, '..', 'app');
const FONT = path.join(__dirname, '..', '..', 'public', 'fonts', 'UthmanicHafs1Ver18.woff2');

let page = null;
function playerHtml() {
  if (!page) {
    page = fs.readFileSync(path.join(APP_DIR, 'player.html'), 'utf8')
      .replace('/*@@CLIENT@@*/', () => fs.readFileSync(path.join(APP_DIR, 'client.min.js'), 'utf8'))
      .replace('@@FONT@@', () => fs.readFileSync(FONT).toString('base64'));
  }
  return page;
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
  server.registerResource('player', PLAYER_URI, {
    title: 'Recitation player',
    description: 'Plays a surah, following each ayah in the Arabic as it is recited',
    mimeType: MIME,
  }, async () => ({
    contents: [{
      uri: PLAYER_URI,
      mimeType: MIME,
      text: playerHtml(),
      _meta: { ui: { csp: { resourceDomains: mediaOrigins(q) }, prefersBorder: false } },
    }],
  }));
}

/* What a tool sets to be shown in the player; the flat key is the one older hosts read */
const playerMeta = { ui: { resourceUri: PLAYER_URI }, 'ui/resourceUri': PLAYER_URI };

module.exports = { registerApp, playerMeta, PLAYER_URI };
