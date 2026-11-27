<?php
/*
 * Where TowerTorch's updates stand, asked of Unraid's own plugin manager, so the Info tab and the
 * Plugins tab never disagree. A GET reads the installed plugin file and the newest one Unraid's
 * last check left in /tmp/plugins; a POST runs that check first, as "Check for updates" on the
 * Plugins tab does.
 */
$tool = '/usr/local/emhttp/plugins/dynamix.plugin.manager/scripts/plugin';
$plg = 'towertorch.plg';
$latest = "/tmp/plugins/$plg";

header('Content-Type: application/json');
header('Cache-Control: no-store');

$method = $_SERVER['REQUEST_METHOD'];
if ($method !== 'GET' && $method !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'not allowed']);
    exit;
}

function plg_version($tool, $file) {
    if (!is_file($file)) return null;
    $out = [];
    exec(escapeshellarg($tool) . ' version ' . escapeshellarg($file) . ' 2>/dev/null', $out, $rc);
    $v = $rc === 0 && $out ? trim(end($out)) : '';
    return $v === '' ? null : $v;
}

if ($method === 'POST') {
    $out = [];
    exec('timeout 60 ' . escapeshellarg($tool) . ' check ' . escapeshellarg($plg) . ' 2>&1', $out, $rc);
    if ($rc !== 0) {
        $why = '';
        foreach ($out as $line) if (strpos($line, 'plugin: ') === 0 && strpos($line, 'checking:') === false) $why = substr($line, 8);
        http_response_code(502);
        echo json_encode(['error' => $why !== '' ? $why : 'check failed']);
        exit;
    }
    clearstatcache();
}

echo json_encode([
    'installed' => plg_version($tool, "/var/log/plugins/$plg"),
    'latest'    => plg_version($tool, $latest),
    'checkedAt' => is_file($latest) ? filemtime($latest) : null,
]);
