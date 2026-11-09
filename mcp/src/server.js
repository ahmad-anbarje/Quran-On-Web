/**
 * The public MCP server: readqurantoday.com/mcp, behind nginx.
 *
 *   node src/server.js            listens on MCP_HOST:MCP_PORT (127.0.0.1:8788)
 *
 * Stateless: every request is answered by a server made for it and dropped
 * after, so there are no sessions to keep, leak or clean up, and a restart
 * loses nothing. The Quran itself is read once, at start.
 *
 * It also serves the text files get_file links to, at /mcp/files/.
 *
 * Read-only and open to all, so the only guard needed is on volume: a
 * request body cap, and a per-address budget of requests a minute. nginx in
 * front has its own limit too; this one holds when the service is reached
 * any other way.
 */
'use strict';

const http = require('http');
const path = require('path');
const { StreamableHTTPServerTransport } = require('@modelcontextprotocol/sdk/server/streamableHttp.js');
const quran = require('./quran');
const { build } = require('./mcp');
const { serveFile } = require('./files');
const { feedbackUrl } = require('./feedback');
const { createStats, statsFile, keepArgs } = require('./stats');
const { createOrigin } = require('./origin');

const VERSION = require('../package.json').version;
const MAX_BODY = 64 * 1024;
// Generous per address: every reader of one assistant arrives from that company's few addresses
const PER_MINUTE = Number(process.env.MCP_PER_MINUTE || 600);
// And a ceiling over all of them together, so a flood cannot take the box
const TOTAL_PER_MINUTE = Number(process.env.MCP_TOTAL_PER_MINUTE || 6000);

/* Each tool call's answer read as it is sent, so the counts see what the reader got: a refusal, arguments the
   tool would not take (turned away before it runs), or an answer, and how long it all took */
function watch(res, body, who, tools, stats) {
  const calls = (Array.isArray(body) ? body : [body]).filter((m) => m && m.method === 'tools/call' && m.params
    && tools && tools.has(m.params.name));
  if (!calls.length) return;
  const t0 = performance.now(), out = [], write = res.write.bind(res), end = res.end.bind(res);
  const keep = (c) => { if (c && typeof c !== 'function') out.push(Buffer.from(c)); };
  res.write = (c, ...rest) => { keep(c); return write(c, ...rest); };
  res.end = (c, ...rest) => {
    keep(c);
    const ms = performance.now() - t0;
    let sent = [];
    try { sent = [].concat(JSON.parse(Buffer.concat(out).toString('utf8'))); } catch (e) { /* not an answer to read */ }
    for (const m of calls) {
      const reply = sent.find((x) => x && x.id === m.id);
      const r = !reply ? { isError: true, content: [{ type: 'text', text: 'no answer' }] }
        : reply.result || { isError: true, content: [{ type: 'text', text: (reply.error && reply.error.message) || 'error' }] };
      stats.outcome(m.params.name, m.params.arguments, r, ms, who, !!(stats.fromCard && stats.fromCard(m)));
    }
    return end(c, ...rest);
  };
}

function createServer(options = {}) {
  const root = options.root || path.join(__dirname, '..', '..');
  const q = quran.open(root);
  const perMinute = options.perMinute || PER_MINUTE;
  const totalPerMinute = options.totalPerMinute || TOTAL_PER_MINUTE;
  const stats = options.stats || createStats('statsFile' in options ? options.statsFile : statsFile(),
    { origin: options.origin || createOrigin({ fetch: !!options.fetchRanges }) });
  const reports = feedbackUrl(options);

  /* Requests a minute, by address; the map is swept as it goes, so it holds
     only the last minute's callers */
  const seen = new Map();
  let all = { since: 0, n: 0 };
  function allowed(ip) {
    const now = Date.now();
    if (now - all.since > 60_000) all = { since: now, n: 0 };
    if (++all.n > totalPerMinute) return false;
    let e = seen.get(ip);
    if (!e || now - e.since > 60_000) { e = { since: now, n: 0 }; seen.set(ip, e); }
    e.n++;
    if (seen.size > 10_000) {
      for (const [k, v] of seen) if (now - v.since > 60_000) seen.delete(k);
    }
    return e.n <= perMinute;
  }

  /* Open to pages on any site, so a developer can call it from a browser:
     nothing here is private and no request carries credentials */
  const CORS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Accept, Mcp-Protocol-Version, Mcp-Session-Id',
    'Access-Control-Max-Age': '86400',
  };

  function send(res, code, body, headers = {}) {
    res.writeHead(code, { 'Content-Type': 'application/json', ...headers });
    res.end(JSON.stringify(body));
  }

  const rpcError = (code, message) => ({ jsonrpc: '2.0', error: { code, message }, id: null });

  return http.createServer((req, res) => {
    const url = req.url.split('?')[0];
    for (const [k, v] of Object.entries(CORS)) res.setHeader(k, v);
    if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }

    if (url === '/health') return send(res, 200, { ok: true, version: VERSION });
    // The counts, for the admin page: nginx passes this only behind the admin password
    const ip = req.headers['x-real-ip'] || req.socket.remoteAddress;
    // Whoever opens the admin page is the site's owner today: their own calls are kept out of the readers'
    if (url === '/stats' && req.method === 'GET') {
      if (stats.setOwner && req.headers['x-real-ip']) stats.setOwner(ip);
      return send(res, 200, stats.snapshot(), { 'Cache-Control': 'no-store' });
    }
    const tooMany = () => stats.limited() || send(res, 429, rpcError(-32000, `Too many requests: ${perMinute} a minute`), { 'Retry-After': '60' });

    /* The files get_file links to, made as they are asked for */
    if (url.startsWith('/mcp/files/') && (req.method === 'GET' || req.method === 'HEAD')) {
      if (!allowed(ip)) return tooMany();
      if (serveFile(q, req, res)) return stats.file();
      return send(res, 404, { error: 'no such file; get_file with kind "data" lists them' });
    }
    /* The admin page's replay of a recent call (nginx passes it only behind the admin password): the same tool
       and choices asked again, the answer shown, nothing counted */
    const replay = url === '/replay' && req.method === 'POST';
    if (url !== '/mcp' && !replay) return send(res, 404, { error: 'not found; the MCP endpoint is /mcp' });

    /* Stateless: nothing to stream back on a GET, no session to DELETE */
    if (req.method !== 'POST') return send(res, 405, rpcError(-32000, 'Method not allowed'), { Allow: 'POST' });

    if (!allowed(ip)) return tooMany();

    let size = 0;
    const chunks = [];
    req.on('data', (c) => {
      size += c.length;
      if (size > MAX_BODY) { send(res, 413, rpcError(-32000, 'Request too large')); req.destroy(); return; }
      chunks.push(c);
    });
    req.on('end', async () => {
      if (res.headersSent) return;
      let body;
      try { body = JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch (e) {
        return send(res, 400, rpcError(-32700, 'Parse error'));
      }
      if (replay) {
        if (!body || typeof body.tool !== 'string' || !/^[a-z_]{1,40}$/.test(body.tool)) return send(res, 400, { error: 'a tool to replay' });
        body = { jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: body.tool, arguments: keepArgs(body.args) } };
      } else stats.message(body, { ip, country: req.headers['x-country'] });
      const who = replay ? { replay: true } : { ip, country: req.headers['x-country'] };
      const server = build(q, VERSION, { feedbackUrl: reports, stats });
      const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
      res.on('close', () => { transport.close(); server.close(); });
      if (stats.outcome) watch(res, body, who, server.toolNames, stats);
      try {
        await server.connect(transport);
        const answer = () => transport.handleRequest(req, res, body);
        await (stats.within ? stats.within(who, answer) : answer());
      } catch (e) {
        console.error(e);
        stats.error();
        if (!res.headersSent) send(res, 500, rpcError(-32603, 'Internal error'));
      }
    });
  });
}

if (require.main === module) {
  const host = process.env.MCP_HOST || '127.0.0.1';
  const port = Number(process.env.MCP_PORT || 8788);
  // Live: OpenAI's published ranges are read now and each day
  const server = createServer({ fetchRanges: true });
  server.requestTimeout = 15_000;
  server.headersTimeout = 10_000;
  server.listen(port, host, () => console.log(`mcp listening on ${host}:${port}`));
  const stop = () => server.close(() => process.exit(0));
  process.on('SIGTERM', stop);
  process.on('SIGINT', stop);
}

module.exports = { createServer };
