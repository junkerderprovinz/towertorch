<?php
/*
 * What the disk tiles on /Main show beyond Unraid's own table: the SMART verdict, the power-on
 * hours, the wear of a solid-state disk and the temperature thresholds, keyed by device (sde,
 * nvme0n1). Everything comes from files emhttp already keeps, the SMART report it caches per
 * disk among them, so a request never runs smartctl and never wakes a sleeping disk.
 *
 * The verdict follows the Dashboard's: a failed self-assessment is a failure, a raw count above
 * zero on one of the watched attributes is a warning, and a warning the person acknowledged in
 * Unraid stays quiet. A disk without a report is left out, and the tiles drop the SMART chip.
 */
header('Content-Type: application/json');

$state = getenv('CC_EMHTTP') ?: '/var/local/emhttp';
$cfgFile = getenv('CC_DYNAMIX_CFG') ?: '/boot/config/plugins/dynamix/dynamix.cfg';
$defFile = getenv('CC_DYNAMIX_DEFAULT') ?: '/usr/local/emhttp/plugins/dynamix/default.cfg';

function ini($file, $sections = true) {
    $v = is_file($file) ? @parse_ini_file($file, $sections) : false;
    return is_array($v) ? $v : [];
}

$display = array_merge(ini($defFile)['display'] ?? [], ini($cfgFile)['display'] ?? []);
$num = function ($k, $d) use ($display) { return isset($display[$k]) && is_numeric($display[$k]) ? (int) $display[$k] : $d; };
$hot = $num('hot', 45);
$max = $num('max', 55);
$hotSsd = $num('hotssd', 60);
$maxSsd = $num('maxssd', 70);

$acks = ini("$state/monitor.ini")['smart'] ?? [];
$watched = array_map('intval', explode('|', '5|187|188|197|198'));

function smart($file, $ack, $watched) {
    if (!is_file($file)) return null;
    $text = (string) @file_get_contents($file);
    $out = ['smart' => 'ok', 'tip' => ''];
    if (preg_match('/^SMART.+:\s*([A-Z]+)/m', $text, $m) && in_array($m[1], ['FAILED', 'NOK'], true)) {
        $out['smart'] = 'fail';
    }
    $found = [];
    foreach (preg_split('/\R/', $text) as $line) {
        $f = preg_split('/\s+/', trim($line));
        if (count($f) < 10 || !preg_match('/^\d+$/', $f[0])) continue;
        $id = (int) $f[0];
        $raw = (int) preg_replace('/\D.*$/', '', $f[9]);
        $failing = strpos($f[8], 'FAILING_NOW') !== false;
        if ($id === 9) $out['hours'] = $raw;
        if (in_array($id, [177, 231, 233], true) && preg_match('/^\d+$/', $f[3])) $out['wear'] = max(0, 100 - (int) $f[3]);
        if ($failing || (in_array($id, $watched, true) && $raw > 0)) $found[] = str_replace('_', ' ', $f[1]) . ': ' . ($failing ? $f[8] : $raw);
    }
    if (!isset($out['hours']) && preg_match('/^Power On Hours:\s*([\d,.]+)/m', $text, $m)) $out['hours'] = (int) str_replace([',', '.'], '', $m[1]);
    if (preg_match('/^Percentage Used:\s*(\d+)%/m', $text, $m)) $out['wear'] = (int) $m[1];
    if ($out['smart'] === 'ok' && $found && !$ack) {
        $out['smart'] = 'warn';
        $out['tip'] = implode("\n", $found);
    }
    return $out;
}

$out = [];
$add = function ($disk, $smartName) use (&$out, $state, $acks, $watched, $hot, $max, $hotSsd, $maxSsd) {
    $dev = $disk['device'] ?? '';
    if ($dev === '' || isset($out[$dev])) return;
    $ssd = ($disk['rotational'] ?? '1') === '0';
    $own = function ($k) use ($disk) { return isset($disk[$k]) && is_numeric($disk[$k]) && $disk[$k] >= 0 ? (int) $disk[$k] : null; };
    $row = ['hot' => $own('hotTemp') ?? ($ssd ? $hotSsd : $hot), 'max' => $own('maxTemp') ?? ($ssd ? $maxSsd : $max)];
    $s = $smartName !== '' ? smart("$state/smart/$smartName", !empty($acks["$smartName.ack"]), $watched) : null;
    $out[$dev] = $s ? array_merge($row, $s) : $row;
};
foreach (ini("$state/disks.ini") as $disk) $add($disk, $disk['name'] ?? '');
foreach (ini("$state/devs.ini") as $disk) $add($disk, $disk['name'] ?? ($disk['device'] ?? ''));

echo json_encode((object) $out);
