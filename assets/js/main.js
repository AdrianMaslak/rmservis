/* ══════════════════════════════════════════
   RM Autoservis — interakcie
   Bez závislostí, všetko degraduje bezpečne.
   ══════════════════════════════════════════ */
(function () {
  'use strict';

  /* Otváracie hodiny — [otvorenie, zatvorenie] v minútach od polnoci.
     null = zatvorené. Index 0 = nedeľa (Date.getDay()). */
  var HOURS = {
    0: null,
    1: [8 * 60, 16 * 60],
    2: [8 * 60, 16 * 60],
    3: [8 * 60, 16 * 60],
    4: [8 * 60, 16 * 60],
    5: [8 * 60, 16 * 60],
    6: null
  };

  var DNI = ['nedeľu', 'pondelok', 'utorok', 'stredu', 'štvrtok', 'piatok', 'sobotu'];
  var $  = function (s, c) { return (c || document).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ─── mobilné menu ─── */
  var burger = $('#burger');
  var nav = $('#nav');
  if (burger && nav) {
    var closeNav = function () {
      nav.classList.remove('is-open');
      burger.setAttribute('aria-expanded', 'false');
      document.body.classList.remove('is-locked');
    };
    burger.addEventListener('click', function () {
      var open = nav.classList.toggle('is-open');
      burger.setAttribute('aria-expanded', String(open));
      document.body.classList.toggle('is-locked', open);
    });
    $$('#nav a').forEach(function (a) { a.addEventListener('click', closeNav); });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && nav.classList.contains('is-open')) { closeNav(); burger.focus(); }
    });
  }

  /* ─── jemné odhalenie pri scrollovaní ─── */
  var rvs = $$('.rv');
  if ('IntersectionObserver' in window && !reduce) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); }
      });
    }, { rootMargin: '0px 0px -6% 0px', threshold: 0.06 });
    rvs.forEach(function (el) { io.observe(el); });
  } else {
    rvs.forEach(function (el) { el.classList.add('in'); });
  }

  /* ─── otvorené / zatvorené ─── */
  function fmt(mins) {
    var h = Math.floor(mins / 60), m = mins % 60;
    return h + ':' + (m < 10 ? '0' + m : m);
  }
  function nextOpenDay(from) {
    for (var i = 1; i <= 7; i++) {
      var d = (from + i) % 7;
      if (HOURS[d]) return { day: d, hours: HOURS[d] };
    }
    return null;
  }
  function updateStatus() {
    var now = new Date();
    var day = now.getDay();
    var mins = now.getHours() * 60 + now.getMinutes();
    var today = HOURS[day];
    var open = !!today && mins >= today[0] && mins < today[1];
    var text;

    if (open) {
      text = 'Otvorené · dnes do ' + fmt(today[1]);
    } else if (today && mins < today[0]) {
      text = 'Zatvorené · otvárame dnes o ' + fmt(today[0]);
    } else {
      var nx = nextOpenDay(day);
      text = nx ? 'Zatvorené · otvárame v ' + DNI[nx.day] + ' o ' + fmt(nx.hours[0]) : 'Zatvorené';
    }

    $$('[data-status]').forEach(function (el) {
      el.classList.toggle('is-open', open);
      el.classList.toggle('is-closed', !open);
    });
    var t1 = $('#statusText'), t2 = $('#statusText2');
    if (t1) t1.textContent = text;
    if (t2) t2.textContent = open ? 'Práve otvorené' : 'Práve zatvorené';

    $$('.hours tr').forEach(function (tr) {
      tr.classList.toggle('is-today', tr.getAttribute('data-day') === String(day));
    });
  }
  updateStatus();
  setInterval(updateStatus, 60000);

  /* ─── formulár objednávky ─── */
  var form = $('#form');
  if (form) {
    var btn = $('#submitBtn');
    var msg = $('#formMsg');
    var TEL_RE = /^(\+?\d[\d\s/()-]{7,17})$/;
    var MAIL_RE = /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i;

    var setErr = function (input, text) {
      var fld = input.closest('.fld');
      if (!fld) return;
      fld.classList.toggle('is-bad', !!text);
      var e = fld.querySelector('[data-err]');
      if (e) e.textContent = text || '';
    };

    var validate = function () {
      var ok = true;
      var meno = form.meno, tel = form.telefon, mail = form.email, suhlas = form.suhlas;

      if (meno.value.trim().length < 3) { setErr(meno, 'Prosím, uveďte meno a priezvisko.'); ok = false; }
      else setErr(meno, '');

      var digits = tel.value.replace(/\D/g, '');
      if (!TEL_RE.test(tel.value.trim()) || digits.length < 9) {
        setErr(tel, 'Zadajte platné telefónne číslo.'); ok = false;
      } else setErr(tel, '');

      if (mail.value.trim() && !MAIL_RE.test(mail.value.trim())) {
        setErr(mail, 'Zadajte platný e-mail alebo pole nechajte prázdne.'); ok = false;
      } else setErr(mail, '');

      var sErr = form.querySelector('[data-err="suhlas"]');
      if (!suhlas.checked) {
        sErr.textContent = 'Bez súhlasu vám, žiaľ, nemôžeme odpovedať.';
        sErr.classList.add('is-bad'); ok = false;
      } else { sErr.textContent = ''; sErr.classList.remove('is-bad'); }

      return ok;
    };

    ['meno', 'telefon', 'email'].forEach(function (n) {
      var f = form[n];
      f.addEventListener('blur', function () { if (f.value.trim()) validate(); });
      f.addEventListener('input', function () {
        var fld = f.closest('.fld');
        if (fld && fld.classList.contains('is-bad')) validate();
      });
    });

    var show = function (kind, text) {
      msg.className = 'form__msg ' + kind;
      msg.textContent = text;
    };

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      msg.className = 'form__msg';

      if (!validate()) {
        var bad = form.querySelector('.fld.is-bad input, .fld.is-bad textarea');
        if (bad) bad.focus();
        return;
      }

      var data = {};
      new FormData(form).forEach(function (v, k) { data[k] = typeof v === 'string' ? v.trim() : v; });
      data.stranka = location.href;

      btn.classList.add('is-loading');
      $('.btn__label', btn).textContent = 'Odosielam…';

      fetch('api/objednavka.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify(data)
      })
        .then(function (r) {
          return r.json().catch(function () { throw new Error('bad-response'); })
            .then(function (j) { if (!r.ok || !j.ok) throw new Error(j.error || 'server'); return j; });
        })
        .then(function () {
          form.reset();
          show('ok', 'Ďakujeme! Vašu požiadavku sme prijali. Ozveme sa vám počas otváracích hodín.');
        })
        .catch(function () {
          show('bad', 'Odoslanie sa nepodarilo. Zavolajte nám prosím na 0915 720 937 — vybavíme to hneď.');
        })
        .finally(function () {
          btn.classList.remove('is-loading');
          $('.btn__label', btn).textContent = 'Odoslať objednávku';
          msg.scrollIntoView({ block: 'nearest', behavior: reduce ? 'auto' : 'smooth' });
        });
    });

    /* najskorší možný termín = zajtra */
    var termin = form.termin;
    if (termin) {
      var t = new Date(); t.setDate(t.getDate() + 1);
      termin.min = t.toISOString().slice(0, 10);
    }
  }

  /* ─── rok v pätičke ─── */
  var rok = $('#rok');
  if (rok) rok.textContent = new Date().getFullYear();
})();
