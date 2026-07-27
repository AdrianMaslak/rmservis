/**
 * RM Autoservis — lokálny server na náhľad (a záložný backend bez PHP)
 * -------------------------------------------------------------------
 * Bez akýchkoľvek závislostí. Stačí Node 18+.
 *
 *   node server.js            → http://localhost:3000
 *   PORT=8080 node server.js
 *
 * Objednávky ukladá do api/objednavky.csv a voliteľne ich prepošle
 * na webhook (Make, Zapier, Slack, Formspree…) cez premennú WEBHOOK_URL.
 */

'use strict';

const http = require('http');
const fs   = require('fs');
const path = require('path');

const PORT    = process.env.PORT || 3000;
const ROOT    = __dirname;
const CSV     = path.join(ROOT, 'api', 'objednavky.csv');
const WEBHOOK = process.env.WEBHOOK_URL || '';

const TYPY = {
  '.html': 'text/html; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.js':   'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg':  'image/svg+xml',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.webp': 'image/webp',
  '.woff2':'font/woff2',
  '.xml':  'application/xml; charset=utf-8',
  '.txt':  'text/plain; charset=utf-8'
};

const json = (res, code, data) => {
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(data));
};

const csvBunka = (v) => `"${String(v == null ? '' : v).replace(/"/g, '""')}"`;

function ulozObjednavku(d, ip) {
  const kedy = new Date().toLocaleString('sk-SK');
  const novy = !fs.existsSync(CSV);
  fs.mkdirSync(path.dirname(CSV), { recursive: true });
  if (novy) {
    fs.writeFileSync(CSV, '﻿' + ['Dátum','Meno','Telefón','E-mail','Vozidlo','Služba','Termín','Popis','IP']
      .map(csvBunka).join(';') + '\n', 'utf8');
  }
  fs.appendFileSync(CSV, [kedy, d.meno, d.telefon, d.email, d.vozidlo, d.sluzba, d.termin, d.sprava, ip]
    .map(csvBunka).join(';') + '\n', 'utf8');
  return kedy;
}

function spracujObjednavku(req, res) {
  let telo = '';
  req.on('data', (ch) => {
    telo += ch;
    if (telo.length > 20000) { req.destroy(); }
  });
  req.on('end', async () => {
    let d;
    try { d = JSON.parse(telo || '{}'); }
    catch { return json(res, 400, { ok: false, error: 'Neplatné dáta.' }); }

    if (d.web) return json(res, 200, { ok: true });          // honeypot

    const meno    = (d.meno || '').trim();
    const telefon = (d.telefon || '').trim();
    const cislice = telefon.replace(/\D/g, '');

    if (meno.length < 3)  return json(res, 422, { ok: false, error: 'Uveďte meno a priezvisko.' });
    if (cislice.length < 9) return json(res, 422, { ok: false, error: 'Zadajte platné telefónne číslo.' });
    if (!d.suhlas)        return json(res, 422, { ok: false, error: 'Chýba súhlas so spracovaním údajov.' });

    const ip = (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').toString().split(',')[0];

    try {
      const kedy = ulozObjednavku(d, ip);
      console.log(`\n  ▸ Nová objednávka (${kedy})`);
      console.log(`    ${meno} · ${telefon} · ${d.vozidlo || '—'} · ${d.sluzba || '—'}`);

      if (WEBHOOK) {
        await fetch(WEBHOOK, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...d, prijate: kedy, ip })
        }).catch((e) => console.warn('    ! webhook zlyhal:', e.message));
      }
      json(res, 200, { ok: true });
    } catch (e) {
      console.error(e);
      json(res, 500, { ok: false, error: 'Objednávku sa nepodarilo uložiť.' });
    }
  });
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  if (req.method === 'POST' && /^\/api\/objednavka(\.php)?$/.test(url.pathname)) {
    return spracujObjednavku(req, res);
  }

  // statické súbory
  let rel = decodeURIComponent(url.pathname);
  if (rel.endsWith('/')) rel += 'index.html';
  const subor = path.join(ROOT, path.normalize(rel).replace(/^([/\\])+/, ''));

  if (!subor.startsWith(ROOT) || /objednavky\.csv$/.test(subor)) {
    res.writeHead(403); return res.end('403');
  }

  fs.readFile(subor, (err, buf) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
      return res.end('<h1>404 — stránka sa nenašla</h1><p><a href="/">Späť na úvod</a></p>');
    }
    res.writeHead(200, {
      'Content-Type': TYPY[path.extname(subor).toLowerCase()] || 'application/octet-stream',
      'Cache-Control': 'no-cache'
    });
    res.end(buf);
  });
});

server.listen(PORT, () => {
  console.log(`\n  RM Autoservis — náhľad beží na  http://localhost:${PORT}`);
  console.log(`  Objednávky sa ukladajú do        ${path.relative(ROOT, CSV)}`);
  if (WEBHOOK) console.log(`  Webhook                          ${WEBHOOK}`);
  console.log('  Ukončenie: Ctrl+C\n');
});
