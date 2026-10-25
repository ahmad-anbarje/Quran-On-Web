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

const VERSION = require('../package.json').version;
const MAX_BODY = 64 * 1024;
const PER_MINUTE = Number(process.env.MCP_PER_MINUTE || 60);

function createServer(options = {}) {
  const root = options.root || path.join(__dirname, '..', '..');
  const q = quran.open(root);
  const perMinute = options.perMinute || PER_MINUTE;
  const reports = feedbackUrl(options);

  /* Requests a minute, by address; the map is swept as it goes, so it holds
     only the last minute's callers */
  const seen = new Map();
  function allowed(ip) {
    const now = Date.now();
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

    const ip = req.headers['x-real-ip'] || req.socket.remoteAddress;
    const tooMany = () => send(res, 429, rpcError(-32000, `Too many requests: ${perMinute} a minute`), { 'Retry-After': '60' });

    /* The files get_file links to, made as they are asked for */
    if (url.startsWith('/mcp/files/') && (req.method === 'GET' || req.method === 'HEAD')) {
      if (!allowed(ip)) return tooMany();
      if (serveFile(q, req, res)) return;
      return send(res, 404, { error: 'no such file; get_file with kind "data" lists them' });
    }
    if (url !== '/mcp') return send(res, 404, { error: 'not found; the MCP endpoint is /mcp' });

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
      const server = build(q, VERSION, { feedbackUrl: reports });
      const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
      res.on('close', () => { transport.close(); server.close(); });
      try {
        await server.connect(transport);
        await transport.handleRequest(req, res, body);
      } catch (e) {
        console.error(e);
        if (!res.headersSent) send(res, 500, rpcError(-32603, 'Internal error'));
      }
    });
  });
}

if (require.main === module) {
  const host = process.env.MCP_HOST || '127.0.0.1';
  const port = Number(process.env.MCP_PORT || 8788);
  const server = createServer();
  server.requestTimeout = 15_000;
  server.headersTimeout = 10_000;
  server.listen(port, host, () => console.log(`mcp listening on ${host}:${port}`));
  const stop = () => server.close(() => process.exit(0));
  process.on('SIGTERM', stop);
  process.on('SIGINT', stop);
}

module.exports = { createServer };
