/**
 * RM Autoservis — príjem objednávok na Vercelu (serverless funkcia)
 * ------------------------------------------------------------------
 * Náhrada za api/objednavka.php, ktoré na Verceli nebeží.
 * Frontend volá /api/objednavka.php, vercel.json to prepíše sem.
 *
 * Premenné prostredia (Vercel → Settings → Environment Variables):
 *   RESEND_API_KEY   – kľúč z resend.com (odosielanie e-mailov)
 *   MAIL_KOMU        – kam chodia objednávky   (napr. rmautoservis.sk@gmail.com)
 *   MAIL_ODOSIELATEL – odosielateľ na overenej doméne (napr. web@rmautoservis.sk)
 *   WEBHOOK_URL      – voliteľné: kópia objednávky do Make/Zapier/Slack
 *
 * Pozor: súborový systém Vercelu je dočasný — zálohu do CSV tu nerobíme.
 * Doručenie zabezpečuje e-mail (a voliteľne webhook).
 */

'use strict';

const RESEND_API_KEY = process.env.RESEND_API_KEY || '';
const KOMU = process.env.MAIL_KOMU || 'rmautoservis.sk@gmail.com';
const ODOSIELATEL = process.env.MAIL_ODOSIELATEL || '';
const WEBHOOK_URL = process.env.WEBHOOK_URL || '';

const esc = (s) =>
  String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

async function posliMail(riadky, sprava, replyTo) {
  if (!RESEND_API_KEY || !ODOSIELATEL) return { ok: false, dovod: 'chýba RESEND_API_KEY alebo MAIL_ODOSIELATEL' };

  const tabulka = Object.entries(riadky)
    .map(([k, v]) =>
      `<tr><td style="border-bottom:1px solid #eee;color:#666;padding:6px 10px 6px 0">${esc(k)}</td>` +
      `<td style="border-bottom:1px solid #eee;padding:6px 0"><b>${esc(v)}</b></td></tr>`)
    .join('');

  const html =
    `<div style="font:15px/1.6 Arial,sans-serif;color:#111">` +
    `<h2 style="margin:0 0 12px;font-size:18px;color:#0117fd">Nová objednávka z webu</h2>` +
    `<table style="border-collapse:collapse;font-size:14px">${tabulka}</table>` +
    `<p style="margin:16px 0 4px;color:#666;font-size:13px">Popis problému</p>` +
    `<p style="margin:0;white-space:pre-wrap">${sprava ? esc(sprava) : '—'}</p></div>`;

  const telo = {
    from: `RM Autoservis <${ODOSIELATEL}>`,
    to: [KOMU],
    subject: `Objednávka: ${riadky['Meno']}${riadky['Vozidlo'] !== '—' ? ' — ' + riadky['Vozidlo'] : ''}`,
    html
  };
  if (replyTo) telo.reply_to = replyTo;

  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(telo)
  });

  if (!r.ok) return { ok: false, dovod: `Resend ${r.status}: ${(await r.text()).slice(0, 200)}` };
  return { ok: true };
}

module.exports = async (req, res) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');

  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Povolená je iba metóda POST.' });
  }

  const d = typeof req.body === 'string' ? safeJson(req.body) : (req.body || {});
  if (!d) return res.status(400).json({ ok: false, error: 'Neplatné dáta.' });

  if (d.web) return res.status(200).json({ ok: true }); // honeypot — tvárime sa, že je to v poriadku

  const t = (k) => (typeof d[k] === 'string' ? d[k].trim() : '');
  const meno = t('meno');
  const telefon = t('telefon');
  const email = t('email');
  const cislice = telefon.replace(/\D/g, '');

  if (meno.length < 3 || meno.length > 80) {
    return res.status(422).json({ ok: false, error: 'Uveďte meno a priezvisko.' });
  }
  if (cislice.length < 9 || cislice.length > 15) {
    return res.status(422).json({ ok: false, error: 'Zadajte platné telefónne číslo.' });
  }
  if (email && !/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(email)) {
    return res.status(422).json({ ok: false, error: 'Zadajte platný e-mail.' });
  }
  if (!d.suhlas) {
    return res.status(422).json({ ok: false, error: 'Chýba súhlas so spracovaním údajov.' });
  }
  if (t('sprava').length > 3000) {
    return res.status(422).json({ ok: false, error: 'Popis je príliš dlhý.' });
  }

  const riadky = {
    'Meno': meno,
    'Telefón': telefon,
    'E-mail': email || '—',
    'Vozidlo': t('vozidlo') || '—',
    'Služba': t('sluzba') || '—',
    'Termín': t('termin') || 'neuvedený',
    'Prijaté': new Date().toLocaleString('sk-SK', { timeZone: 'Europe/Bratislava' })
  };

  const vysledky = await Promise.allSettled([
    posliMail(riadky, t('sprava'), email || null),
    WEBHOOK_URL
      ? fetch(WEBHOOK_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...riadky, popis: t('sprava') })
        })
      : Promise.resolve(null)
  ]);

  const mail = vysledky[0].status === 'fulfilled' ? vysledky[0].value : { ok: false, dovod: String(vysledky[0].reason) };
  const hook = vysledky[1].status === 'fulfilled' && vysledky[1].value && vysledky[1].value.ok;

  if (!mail.ok && !hook) {
    // Radšej chyba, ktorú zákazník uvidí, než ticho stratená objednávka.
    console.error('Objednávku sa nepodarilo doručiť:', mail.dovod, JSON.stringify(riadky));
    return res.status(500).json({
      ok: false,
      error: 'Odoslanie sa nepodarilo. Zavolajte nám prosím na 0915 720 937.'
    });
  }

  if (!mail.ok) console.warn('E-mail zlyhal, objednávka šla len webhookom:', mail.dovod);
  console.log('Nová objednávka:', riadky['Meno'], riadky['Telefón'], riadky['Služba']);

  return res.status(200).json({ ok: true });
};

function safeJson(s) {
  try { return JSON.parse(s || '{}'); } catch { return null; }
}
