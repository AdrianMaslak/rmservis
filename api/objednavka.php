<?php
/**
 * RM Autoservis — príjem objednávok z webu
 * ----------------------------------------
 * Funguje na bežnom PHP hostingu (7.4+). Bez závislostí.
 *  • validácia na strane servera
 *  • honeypot + jednoduchý rate-limit proti spamu
 *  • odoslanie e-mailu do servisu (+ potvrdenie zákazníkovi)
 *  • záloha do CSV, aby sa žiadna objednávka nestratila
 */

declare(strict_types=1);

/* ═══════════ NASTAVENIE ═══════════ */

$KOMU        = 'rmautoservis.sk@gmail.com';   // ← kam chodia objednávky
$ODOSIELATEL = 'web@rmautoservis.sk';         // ← musí byť adresa na vlastnej doméne
$NAZOV       = 'RM Autoservis s.r.o.';
$LOG         = __DIR__ . '/objednavky.csv';   // záloha (chráňte cez .htaccess)
$LIMIT_MIN   = 3;                             // max. počet odoslaní z jednej IP
$LIMIT_OKNO  = 3600;                          // …za tento počet sekúnd

/* ═══════════ HLAVIČKY ═══════════ */

header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');

function odpoved(int $kod, array $data): void {
    http_response_code($kod);
    echo json_encode($data, JSON_UNESCAPED_UNICODE);
    exit;
}

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    odpoved(405, ['ok' => false, 'error' => 'Povolená je iba metóda POST.']);
}

/* ═══════════ VSTUP ═══════════ */

$raw = file_get_contents('php://input') ?: '';
$in  = json_decode($raw, true);
if (!is_array($in)) { $in = $_POST; }          // fallback pre klasické odoslanie formulára

$pole = static function (string $k) use ($in): string {
    $v = $in[$k] ?? '';
    if (!is_scalar($v)) return '';
    // odstránenie riadkových zlomov z hlavičkových polí rieši validácia nižšie
    return trim((string) $v);
};

$meno    = $pole('meno');
$telefon = $pole('telefon');
$email   = $pole('email');
$vozidlo = $pole('vozidlo');
$sluzba  = $pole('sluzba');
$termin  = $pole('termin');
$sprava  = $pole('sprava');
$suhlas  = $pole('suhlas');
$honey   = $pole('web');

/* ═══════════ ANTISPAM ═══════════ */

if ($honey !== '') {                            // bot vyplnil skryté pole
    odpoved(200, ['ok' => true]);               // tvárime sa, že je všetko v poriadku
}

$ip   = $_SERVER['REMOTE_ADDR'] ?? '0.0.0.0';
$stop = sys_get_temp_dir() . '/rm_rate_' . md5($ip) . '.json';
$teraz = time();
$zaznamy = [];
if (is_file($stop)) {
    $zaznamy = json_decode((string) file_get_contents($stop), true) ?: [];
    $zaznamy = array_values(array_filter($zaznamy, static fn($t) => ($teraz - (int) $t) < $LIMIT_OKNO));
}
if (count($zaznamy) >= $LIMIT_MIN) {
    odpoved(429, ['ok' => false, 'error' => 'Príliš veľa požiadaviek. Skúste to neskôr alebo zavolajte na 0915 720 937.']);
}

/* ═══════════ VALIDÁCIA ═══════════ */

$chyby = [];

if (mb_strlen($meno) < 3 || mb_strlen($meno) > 80) {
    $chyby[] = 'Uveďte meno a priezvisko.';
}
$cislice = preg_replace('/\D/', '', $telefon) ?? '';
if (strlen($cislice) < 9 || strlen($cislice) > 15) {
    $chyby[] = 'Zadajte platné telefónne číslo.';
}
if ($email !== '' && !filter_var($email, FILTER_VALIDATE_EMAIL)) {
    $chyby[] = 'Zadajte platný e-mail.';
}
if ($suhlas === '' || $suhlas === '0' || $suhlas === 'false') {
    $chyby[] = 'Chýba súhlas so spracovaním údajov.';
}
if (mb_strlen($sprava) > 3000) {
    $chyby[] = 'Popis je príliš dlhý.';
}
// zabránenie vloženiu hlavičiek cez jednoriadkové polia
foreach ([$meno, $telefon, $email, $vozidlo, $sluzba, $termin] as $riadok) {
    if (preg_match('/[\r\n]/', $riadok)) { $chyby[] = 'Neplatný vstup.'; break; }
}

if ($chyby) {
    odpoved(422, ['ok' => false, 'error' => implode(' ', $chyby)]);
}

/* ═══════════ ZOSTAVENIE SPRÁVY ═══════════ */

$cist = static fn(string $s): string => htmlspecialchars($s, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
$kedy = date('j. n. Y H:i');

$riadky = [
    'Meno'      => $meno,
    'Telefón'   => $telefon,
    'E-mail'    => $email !== '' ? $email : '—',
    'Vozidlo'   => $vozidlo !== '' ? $vozidlo : '—',
    'Služba'    => $sluzba !== '' ? $sluzba : '—',
    'Termín'    => $termin !== '' ? $termin : 'neuvedený',
    'Prijaté'   => $kedy,
];

$text = "NOVÁ OBJEDNÁVKA Z WEBU\n" . str_repeat('=', 40) . "\n\n";
foreach ($riadky as $k => $v) { $text .= str_pad($k . ':', 12) . $v . "\n"; }
$text .= "\nPopis problému:\n" . ($sprava !== '' ? $sprava : '—') . "\n";

$html = '<div style="font:15px/1.6 Arial,sans-serif;color:#111">'
      . '<h2 style="margin:0 0 4px;font-size:18px">Nová objednávka z webu</h2>'
      . '<p style="margin:0 0 16px;color:#666;font-size:13px">' . $cist($kedy) . '</p>'
      . '<table cellpadding="6" style="border-collapse:collapse;font-size:14px">';
foreach ($riadky as $k => $v) {
    $hodnota = $cist($v);
    if ($k === 'Telefón') { $hodnota = '<a href="tel:' . $cist(preg_replace('/\s/', '', $v)) . '">' . $hodnota . '</a>'; }
    if ($k === 'E-mail' && $email !== '') { $hodnota = '<a href="mailto:' . $cist($email) . '">' . $hodnota . '</a>'; }
    $html .= '<tr><td style="border-bottom:1px solid #eee;color:#666">' . $cist($k) . '</td>'
           . '<td style="border-bottom:1px solid #eee"><b>' . $hodnota . '</b></td></tr>';
}
$html .= '</table><p style="margin:16px 0 4px;color:#666;font-size:13px">Popis problému</p>'
       . '<p style="margin:0;white-space:pre-wrap">' . ($sprava !== '' ? $cist($sprava) : '—') . '</p></div>';

$hranica = 'rm' . bin2hex(random_bytes(12));
$telo = "--$hranica\r\nContent-Type: text/plain; charset=UTF-8\r\n\r\n$text\r\n"
      . "--$hranica\r\nContent-Type: text/html; charset=UTF-8\r\n\r\n$html\r\n--$hranica--";

$hlavicky = [
    'From: ' . mb_encode_mimeheader($NAZOV, 'UTF-8') . " <$ODOSIELATEL>",
    'MIME-Version: 1.0',
    "Content-Type: multipart/alternative; boundary=\"$hranica\"",
];
if ($email !== '') { $hlavicky[] = "Reply-To: $email"; }

$predmet = mb_encode_mimeheader('Objednávka: ' . $meno . ($vozidlo !== '' ? ' — ' . $vozidlo : ''), 'UTF-8');
$odoslane = @mail($KOMU, $predmet, $telo, implode("\r\n", $hlavicky));

/* ═══════════ ZÁLOHA DO CSV ═══════════ */

$novy = !is_file($LOG);
if ($f = @fopen($LOG, 'a')) {
    if (flock($f, LOCK_EX)) {
        if ($novy) {
            fwrite($f, "\xEF\xBB\xBF");        // BOM, aby Excel zobrazil diakritiku
            fputcsv($f, ['Dátum', 'Meno', 'Telefón', 'E-mail', 'Vozidlo', 'Služba', 'Termín', 'Popis', 'IP', 'Odoslaný e-mail'], ';');
        }
        fputcsv($f, [$kedy, $meno, $telefon, $email, $vozidlo, $sluzba, $termin, $sprava, $ip, $odoslane ? 'áno' : 'nie'], ';');
        fflush($f);
        flock($f, LOCK_UN);
    }
    fclose($f);
}

$zaznamy[] = $teraz;
@file_put_contents($stop, json_encode($zaznamy));

/* ═══════════ POTVRDENIE ZÁKAZNÍKOVI ═══════════ */

if ($email !== '') {
    $potvrdenie = "Dobrý deň, {$meno},\n\n"
        . "ďakujeme za vašu požiadavku. Prijali sme ju {$kedy} a ozveme sa vám počas otváracích hodín\n"
        . "(pondelok – piatok, 8:00 – 16:00).\n\n"
        . "Zhrnutie:\n"
        . "  Vozidlo: " . ($vozidlo !== '' ? $vozidlo : '—') . "\n"
        . "  Služba:  " . ($sluzba !== '' ? $sluzba : '—') . "\n"
        . "  Termín:  " . ($termin !== '' ? $termin : 'dohodneme telefonicky') . "\n\n"
        . "Ak potrebujete niečo doplniť, zavolajte na 0915 720 937.\n\n"
        . "RM Autoservis s.r.o.\nZvolenská cesta 3760/95, 974 05 Banská Bystrica\n";

    @mail(
        $email,
        mb_encode_mimeheader('Prijali sme vašu objednávku — RM Autoservis', 'UTF-8'),
        $potvrdenie,
        implode("\r\n", [
            'From: ' . mb_encode_mimeheader($NAZOV, 'UTF-8') . " <$ODOSIELATEL>",
            'MIME-Version: 1.0',
            'Content-Type: text/plain; charset=UTF-8',
        ])
    );
}

/* Objednávka je uložená v CSV aj vtedy, keď hosting nedoručí e-mail —
   preto hlásime úspech a prípadné zlyhanie pošty riešime v logu. */
odpoved(200, ['ok' => true, 'mail' => $odoslane]);
