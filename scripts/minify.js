/**
 * The reader's scripts and stylesheets, minified beside their sources:
 * public/js/app.js -> public/js/app.min.js, public/css/style.css -> style.min.css.
 *
 * The sources are written to be read, and half their weight is the comments
 * saying why: 122 KB over the wire for the lot, 53 KB minified. The pages ask
 * for the .min files (build-pages.js points them there); the sources stay the
 * ones to edit.
 *
 * Each file on its own, not bundled: they are the same scripts in the same
 * order, sharing the same globals, only smaller. A stylesheet stays in its own
 * folder, so its url(../fonts/...) still finds the fonts.
 *
 * esbuild is a dev dependency. Where it is not installed (the Docker image
 * builds the pages without installing anything) the committed .min files are
 * left as they are; CI, which has it, fails a push whose .min files are stale.
 */
'use strict';

const fs = require('fs');
const path = require('path');

const PUBLIC = path.join(__dirname, '..', 'public');

/* Browsers as old as the reader is meant to open in */
const TARGET = ['es2017', 'chrome61', 'safari11', 'firefox60'];

const SOURCES = [
  ...fs.readdirSync(path.join(PUBLIC, 'js')).filter((f) => f.endsWith('.js') && !f.endsWith('.min.js')).map((f) => `js/${f}`),
  'css/style.css', 'css/recite.css', 'css/fonts.css',
];

function minName(file) { return file.replace(/\.(js|css)$/, '.min.$1'); }

/** Writes the .min files and returns how many changed, or null without esbuild. */
function build() {
  let esbuild;
  try { esbuild = require('esbuild'); } catch (e) { return null; }
  let changed = 0;
  for (const file of SOURCES) {
    const src = fs.readFileSync(path.join(PUBLIC, file), 'utf8');
    const out = esbuild.transformSync(src, {
      loader: file.endsWith('.css') ? 'css' : 'js',
      minify: true,
      target: TARGET,
      legalComments: 'none',
    }).code;
    const dest = path.join(PUBLIC, minName(file));
    const was = fs.existsSync(dest) ? fs.readFileSync(dest, 'utf8') : null;
    if (was !== out) { fs.writeFileSync(dest, out); changed++; }
  }
  return changed;
}

module.exports = { build, minName, SOURCES };
