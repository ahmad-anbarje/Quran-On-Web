/**
 * How much the MCP server is used, for the site's admin page (/admin/mcp/).
 *
 * Counts only: by UTC day, the calls, each tool's calls, the files fetched, the
 * errors, and the connections by the app that made them (the name a client
 * gives as it connects, such as "claude-ai"). No address and nothing asked is
 * kept, so the privacy page's word holds. Ninety days are kept.
 *
 * Saved to a file when one is given (MCP_STATS_FILE, or systemd's state
 * directory) once a minute and on the way down; otherwise held in memory only.
 */
'use strict';

const fs = require('fs');
const path = require('path');

const DAYS = 90;
const NAME = /^[\w .@/+-]{1,48}$/;     // what a client calls itself, kept only if it looks like a name

function createStats(file) {
  let days = {};
  if (file) {
    try { days = JSON.parse(fs.readFileSync(file, 'utf8')).days || {}; } catch (e) { /* first run */ }
  }
  let dirty = false;

  function today() {
    const key = new Date().toISOString().slice(0, 10);
    if (!days[key]) {
      days[key] = { calls: 0, tools: {}, clients: {}, files: 0, errors: 0, limited: 0 };
      const keep = Object.keys(days).sort().slice(-DAYS);
      for (const k of Object.keys(days)) if (!keep.includes(k)) delete days[k];
    }
    dirty = true;
    return days[key];
  }

  const bump = (map, key) => { map[key] = (map[key] || 0) + 1; };

  /* One JSON-RPC message, or a batch of them, as it arrives */
  function message(body) {
    for (const m of Array.isArray(body) ? body : [body]) {
      if (!m || typeof m !== 'object') continue;
      if (m.method === 'initialize') {
        const name = m.params && m.params.clientInfo && m.params.clientInfo.name;
        bump(today().clients, typeof name === 'string' && NAME.test(name) ? name : 'unnamed');
      } else if (m.method === 'tools/call') {
        const d = today();
        d.calls++;
        const tool = m.params && m.params.name;
        bump(d.tools, typeof tool === 'string' && NAME.test(tool) ? tool : 'other');
      }
    }
  }

  const file_ = () => { today().files++; };
  const error = () => { today().errors++; };
  const limited = () => { today().limited++; };

  function save() {
    if (!file || !dirty) return;
    dirty = false;
    try {
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file + '.tmp', JSON.stringify({ days }));
      fs.renameSync(file + '.tmp', file);
    } catch (e) { console.error('stats not saved:', e.message); }
  }

  if (file) {
    setInterval(save, 60_000).unref();
    for (const sig of ['SIGTERM', 'SIGINT']) process.once(sig, () => { save(); process.exit(0); });
  }

  return { message, file: file_, error, limited, save, snapshot: () => ({ days, kept: DAYS, saved: !!file }) };
}

/* Where to keep them: an explicit file, else systemd's state directory, else nowhere */
function statsFile() {
  if (process.env.MCP_STATS_FILE) return process.env.MCP_STATS_FILE;
  if (process.env.STATE_DIRECTORY) return path.join(process.env.STATE_DIRECTORY.split(':')[0], 'stats.json');
  return null;
}

module.exports = { createStats, statsFile };
