/**
 * Where a call comes from, by the address it comes from: the assistants that run in the cloud
 * publish the ranges they call out of, so a call from one of them is that assistant's, whatever
 * name it gives. Anthropic's are fixed; OpenAI's are a file it keeps current, read once a day.
 *
 * https://platform.claude.com/docs/en/api/ip-addresses
 * https://developers.openai.com/api/docs/guides/ip-addresses
 */
'use strict';

const ANTHROPIC = ['160.79.104.0/21', '153.61.208.0/20'];
const OPENAI_URL = 'https://openai.com/chatgpt-connectors.json';
const DAY = 24 * 60 * 60 * 1000;

/* An IPv4 address as one number; IPv4 written as IPv6 (::ffff:a.b.c.d) too; anything else null */
function toInt(ip) {
  const m = /^(?:::ffff:)?(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/i.exec(String(ip || ''));
  if (!m) return null;
  const p = m.slice(1).map(Number);
  if (p.some((x) => x > 255)) return null;
  return ((p[0] << 24) >>> 0) + (p[1] << 16) + (p[2] << 8) + p[3];
}

function parse(cidr) {
  const [a, b] = String(cidr).split('/');
  const base = toInt(a), bits = Number(b);
  if (base === null || !Number.isInteger(bits) || bits < 0 || bits > 32) return null;
  const mask = bits === 0 ? 0 : (~0 << (32 - bits)) >>> 0;
  return [(base & mask) >>> 0, mask];
}

const within = (n, list) => list.some(([base, mask]) => ((n & mask) >>> 0) === base);

/* origin(ip) is 'claude', 'chatgpt' or null; fetch: false keeps OpenAI's list empty (tests) */
function createOrigin({ fetch: load = true } = {}) {
  const anthropic = ANTHROPIC.map(parse);
  let openai = [];
  async function refresh() {
    try {
      const r = await fetch(OPENAI_URL, { signal: AbortSignal.timeout(10_000) });
      const list = ((await r.json()).prefixes || []).map((p) => p && p.ipv4Prefix && parse(p.ipv4Prefix)).filter(Boolean);
      if (list.length) openai = list;
    } catch (e) { /* the last list stands */ }
  }
  if (load) { refresh(); setInterval(refresh, DAY).unref(); }
  const origin = (ip) => {
    const n = toInt(ip);
    if (n === null) return null;
    if (within(n, anthropic)) return 'claude';
    if (within(n, openai)) return 'chatgpt';
    return null;
  };
  origin.ranges = (list) => { openai = list.map(parse).filter(Boolean); };   // for tests
  return origin;
}

module.exports = { createOrigin, parse, toInt };
