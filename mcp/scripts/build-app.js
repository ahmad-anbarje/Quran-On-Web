/**
 * Bundles the MCP Apps client for the player into mcp/app/client.min.js.
 *
 *   node mcp/scripts/build-app.js
 *
 * Run after changing mcp/app/client.js or the ext-apps version. The result is
 * committed, so the server and its deploys need neither esbuild nor ext-apps.
 */
'use strict';

const path = require('path');
const fs = require('fs');

const ROOT = path.join(__dirname, '..', '..');
// esbuild is the site's own dev dependency; ext-apps is the MCP server's
const esbuild = require(path.join(ROOT, 'node_modules', 'esbuild'));

const out = path.join(__dirname, '..', 'app', 'client.min.js');
esbuild.buildSync({
  entryPoints: [path.join(__dirname, '..', 'app', 'client.js')],
  bundle: true,
  minify: true,
  format: 'iife',
  platform: 'browser',
  target: 'es2020',
  nodePaths: [path.join(__dirname, '..', 'node_modules')],
  outfile: out,
  legalComments: 'none',
});
// Inlined into a <script>: a "</script" inside a string would end it early
const js = fs.readFileSync(out, 'utf8').replace(/<\/script/gi, '<\\/script');
fs.writeFileSync(out, js);
console.log(`mcp/app/client.min.js  ${Math.round(js.length / 1024)} KB`);
