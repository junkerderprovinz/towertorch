<?php
/*
 * The logo on the login page. GET returns whether one is stored and its data URL, POST with a
 * file field named logo stores it, POST with clear=1 removes it. The file sits on the flash
 * next to the plugin's other settings, where include/login-head.php reads it. Unraid checks the
 * csrf_token of every POST before this file runs.
 */
header('Content-Type: application/json');
header('Cache-Control: no-store');

const DIR = '/boot/config/plugins/towertorch';
const MAX_BYTES = 1048576;
const TYPES = ['png' => 'image/png', 'jpg' => 'image/jpeg', 'webp' => 'image/webp', 'svg' => 'image/svg+xml'];

function stored(): ?string {
    return glob(DIR . '/login-logo.*')[0] ?? null;
}

function removeStored(): void {
    foreach (glob(DIR . '/login-logo.*') as $old) {
        @unlink($old);
    }
}

function extension(string $bytes): ?string {
    if (strncmp($bytes, "\x89PNG\r\n\x1a\n", 8) === 0) return 'png';
    if (strncmp($bytes, "\xff\xd8\xff", 3) === 0) return 'jpg';
    if (strncmp($bytes, 'RIFF', 4) === 0 && substr($bytes, 8, 4) === 'WEBP') return 'webp';
    if (preg_match('/^\s*(<\?xml[^>]*\?>\s*)?(<!--.*?-->\s*)*<svg[\s>]/is', $bytes)) return 'svg';
    return null;
}

function fail(int $status, string $message): void {
    http_response_code($status);
    echo json_encode(['ok' => false, 'error' => $message]);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    if (!empty($_POST['clear'])) {
        removeStored();
        echo json_encode(['ok' => true, 'has' => false]);
        exit;
    }
    $upload = $_FILES['logo'] ?? null;
    if (!$upload || $upload['error'] !== UPLOAD_ERR_OK || $upload['size'] > MAX_BYTES) {
        fail(400, 'upload');
    }
    $bytes = file_get_contents($upload['tmp_name']);
    $ext = $bytes === false ? null : extension($bytes);
    if ($ext === null) {
        fail(415, 'type');
    }
    removeStored();
    if (!is_dir(DIR) && !mkdir(DIR, 0777, true)) {
        fail(500, 'write');
    }
    if (file_put_contents(DIR . "/login-logo.$ext", $bytes) === false) {
        fail(500, 'write');
    }
}

$file = stored();
if ($file === null) {
    echo json_encode(['ok' => true, 'has' => false]);
    exit;
}
$ext = pathinfo($file, PATHINFO_EXTENSION);
echo json_encode(['ok' => true, 'has' => true, 'src' => 'data:' . (TYPES[$ext] ?? 'image/png') . ';base64,' . base64_encode(file_get_contents($file))]);
