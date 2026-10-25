/**
 * send_feedback: a reader's report of something wrong on the site (a
 * translation's typo, a recitation out of step, a broken link), sent from
 * the assistant they were asking to the same inbox as the site's own form.
 *
 * The one tool that does anything but read, so it says so: not read-only,
 * which has a client ask the reader before it runs, and a description that
 * keeps it to a report the reader asked for, in their words. It goes to the
 * feedback service (feedback/), which checks it as it checks any report and
 * holds all assistants' reports together to a budget of their own.
 *
 * Where there is no feedback service beside it (the Docker image), the tool
 * is not offered: MCP_FEEDBACK_URL set empty.
 */
'use strict';

const { z } = require('zod');
const { reply, fail } = require('./shared');

const DEFAULT_URL = 'http://127.0.0.1:8787/api/feedback';
const TIMEOUT = 5000;

function feedbackUrl(options) {
  if (options.feedbackUrl !== undefined) return options.feedbackUrl;
  return process.env.MCP_FEEDBACK_URL !== undefined ? process.env.MCP_FEEDBACK_URL : DEFAULT_URL;
}

function registerFeedback(server, q, url) {
  if (!url) return;

  server.registerTool('send_feedback', {
    title: 'Report a problem',
    description:
      'Send the reader\'s report to readqurantoday.com: a problem with the site\'s text, a translation, the tafsir ' +
      'or a recitation, or a suggestion. Only when the reader asks to report or suggest something; send what they ' +
      'said, in their words, and the ayah or reciter it is about. Never on your own initiative.',
    inputSchema: {
      kind: z.enum(['bug', 'suggestion', 'feature', 'other']).describe('"bug" for something wrong'),
      message: z.string().min(10).max(2000).describe('The report, in the reader\'s words'),
      surah: z.number().int().min(1).max(114).optional(),
      ayah: z.number().int().min(1).optional(),
      reciter: z.string().max(80).optional().describe('Reciter id, for a problem with a recitation'),
      email: z.string().email().max(254).optional().describe('Only if the reader gives it, for a reply'),
    },
    annotations: { title: 'Report a problem', readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
  }, async ({ kind, message, surah: s, ayah, reciter, email }) => {
    const info = s && q.surah(s);
    if (s && ayah && ayah > info.v) return fail(`Surah ${s} has ${info.v} ayahs.`);
    if (reciter && !q.recitation(reciter)) return fail(`No reciter "${reciter}"; list_reciters gives the ids.`);
    const about = s ? `\n\nAbout: ${ayah ? `${s}:${ayah}` : `surah ${s}`} (${info.en})${reciter ? `, ${reciter}` : ''}` : '';
    const body = {
      source: 'mcp',
      kind,
      message: message.trim() + about,
      ...(email ? { email } : {}),
      app: { ...(s ? { page: q.page(s, ayah || 1) } : {}), ...(reciter ? { reciter } : {}), browser: 'AI assistant (MCP)' },
    };
    let res;
    try {
      res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(TIMEOUT),
      });
    } catch (e) {
      return fail('The report could not be sent just now; the form on readqurantoday.com (Settings, Report an issue) takes it too.');
    }
    if (res.status === 429) return fail('Too many reports have come through assistants today; the form on readqurantoday.com takes it.');
    if (!res.ok) return fail('The report was not accepted: it may be too short or too long.');
    return reply({ sent: true, note: 'Thank you: the report reached the site\'s inbox.' });
  });
}

module.exports = { registerFeedback, feedbackUrl };
