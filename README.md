# RM Autoservis s.r.o. — prezentačný web

Jednostránkový web pre autoservis v Banskej Bystrici. Bez frameworkov, bez build procesu,
bez závislostí — nahráte na hosting a funguje.

```
rm/
├─ index.html              # celá stránka (obsah + SEO + štruktúrované dáta)
├─ assets/
│  ├─ css/style.css        # dizajn
│  ├─ js/main.js           # interakcie, validácia, „otvorené/zatvorené"
│  └─ img/                 # logo, fotka dielne, favicon, náhľad pre sociálne siete
├─ api/objednavka.php      # príjem objednávok (PHP hosting)
├─ server.js               # lokálny náhľad + Node varianta backendu
├─ .htaccess               # HTTPS, presmerovanie, cache, ochrana údajov
├─ robots.txt, sitemap.xml
```

---

## 1. Vizuálna identita

Farby sú **odobrané priamo z ich loga**, nie vymyslené:

| | Hex | Použitie |
|---|---|---|
| Firemná modrá | `#0117FD` | tlačidlá, odkazy, ikony, akcenty |
| Sivá z loga | `#8A8A8A` | doplnkové texty |
| Tmavomodrá | `#0A1030` | horná lišta, sekcia „Prečo my", pätička |
| Podklad | `#FFFFFF` / `#F5F6F9` | striedanie sekcií |

Písmo: **Barlow** + **Barlow Condensed** (Google Fonts) — hranatejší, technický charakter,
ktorý sedí k logu a k odvetviu.

---

## 2. Rýchly náhľad

```bash
node server.js          # → http://localhost:3000
```

Alebo stačí otvoriť `index.html` v prehliadači (formulár vtedy nebude odosielať).

---

## 3. Nasadenie na hosting (Websupport, WebHouse, Forpsi…)

1. Nahrajte celý obsah priečinka do `public_html/` (alebo `www/`).
2. V `api/objednavka.php` skontrolujte prvé riadky:
   ```php
   $KOMU        = 'rmautoservis.sk@gmail.com';   // kam chodia objednávky
   $ODOSIELATEL = 'web@rmautoservis.sk';         // musí byť schránka na vlastnej doméne
   ```
   > Odosielateľ z cudzej domény (gmail.com) skončí v spame — preto sa doručuje
   > z domény webu a gmail je len prijímateľ.
3. Zapnite HTTPS certifikát (Let's Encrypt býva v cene hostingu).
4. Otestujte formulár — objednávka musí prísť do e-mailu **a** zapísať sa
   do `api/objednavky.csv` (záloha, ktorú otvoríte v Exceli).

Web funguje aj bez PHP (Netlify, Vercel, GitHub Pages) — vtedy buď nasaďte `server.js`,
alebo formulár prepojte na službu typu Formspree (zmena jednej URL v `assets/js/main.js`).

---

## 4. Odkiaľ sú údaje a materiály

| Materiál | Zdroj | Poznámka |
|---|---|---|
| Logo (`assets/img/logo.png`) | profilová fotka ich FB stránky, orezané, pozadie odstránené | **vypýtať originál** (AI/EPS/SVG) pre tlač a väčšie veľkosti |
| Fotka dielne (`assets/img/dielna.jpg`) | titulná fotka ich FB stránky | pred spustením si dať potvrdiť súhlas s použitím |
| Otváracie hodiny Po–Pi 8:00–16:00 | ich profil na Nájdi-Servis.sk + Google | overené na dvoch zdrojoch |
| E-mail `rmautoservis.sk@gmail.com` | ich profil na Nájdi-Servis.sk | overiť, či je stále aktívny |
| IČO 53431022, vznik 26. 11. 2020 | obchodný register (FinStat) | |
| Recenzie a hodnotenie 4,9/5 (22) | verejný profil na Google, stav júl 2026 | dlhšie recenzie skrátené na časť zobrazenú v profile |
| Rozsah služieb | Google profil + Nájdi-Servis.sk | vrátane klimatizácie, odťahu a úpravy vozidiel |

---

## 5. Čo pred spustením ešte doplniť

| Miesto | Čo zmeniť |
|---|---|
| `index.html` — `canonical`, `og:url`, JSON-LD, `sitemap.xml`, `robots.txt` | skutočná doména (teraz zástupné `rmautoservis.sk`) |
| pätička | DIČ / IČ DPH, prípadne odkaz na ochranu osobných údajov |
| `api/objednavka.php` | potvrdiť e-mailové adresy |
| hodiny | ak majú obedňajšiu prestávku, upraviť tabuľku v `index.html` **a** objekt `HOURS` v `main.js` |

---

## 6. Čo si vypýtať od klienta

- **Originál loga** vo vektore — teraz je z Facebooku, na tlač a retina displeje to nestačí.
- **6–10 vlastných fotografií** dielne, tímu a rozrobených áut. Miesto na galériu je
  pripravené medzi sekciami „Ako to funguje" a „Recenzie".
- Potvrdenie otváracích hodín a e-mailu.
- Či robia aj náhradné vozidlo alebo prípravu na STK — dá sa pridať ako ďalšia karta služby.

---

## 7. Čo web obsahuje

- **SEO**: unikátny title/description, kanonická URL, Open Graph + náhľadový obrázok
  vo firemných farbách, `sitemap.xml`, `robots.txt`.
- **Štruktúrované dáta** (JSON-LD): `AutoRepair` s adresou, hodinami, hodnotením 4,9/5,
  IČO a katalógom 12 služieb + `FAQPage`. Google vďaka tomu môže zobraziť hviezdičky
  a rozbaľovacie otázky priamo vo výsledkoch vyhľadávania.
- **Živý stav prevádzky** — „Otvorené · dnes do 16:00" sa počíta z reálneho času,
  dnešný deň sa v tabuľke zvýrazní.
- **Formulár objednávky** — validácia na klientovi aj serveri, honeypot proti botom,
  limit 3 odoslania z jednej IP za hodinu, potvrdzovací e-mail zákazníkovi,
  záloha do CSV (objednávka sa nestratí, ani keď zlyhá pošta).
- **Prístupnosť**: klávesová navigácia, `prefers-reduced-motion`, kontrast textu,
  preskočenie na obsah, `aria` atribúty.
- **Mobil**: pevná spodná lišta „Zavolať / Objednať sa" — najkratšia cesta k telefonátu.
- Bez cookies a trackerov → žiadna cookie lišta a čistý GDPR štart.
