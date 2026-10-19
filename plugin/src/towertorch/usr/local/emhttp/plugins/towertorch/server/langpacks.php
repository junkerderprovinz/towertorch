<?php
/*
 * Lists the language packs in Community Applications' local template cache (the
 * file castats.php reads), filtered to the "Language:" category. Unraid's official
 * packs (github.com/unraid/language-templates) are ordinary CA catalog entries, and
 * listing them lets the Display Settings dropdown offer every available pack, not
 * only the installed ones the native <select> shows.
 *
 * Whether a pack is installed is left to the frontend, which reads the native
 * <select>'s option values; deciding it here would duplicate CA's directory scan
 * and could drift from it.
 */
header('Content-Type: application/json');

$path = '/tmp/community.applications/tempFiles/templates_new.json';
if (!is_file($path) || !is_readable($path)) {
    echo '[]';
    exit;
}

$raw = file_get_contents($path);
$data = $raw !== false ? @unserialize($raw, ['allowed_classes' => false]) : false;
if (!is_array($data)) {
    echo '[]';
    exit;
}

$out = [];
foreach ($data as $tmpl) {
    if (!is_array($tmpl) || empty($tmpl['LanguagePack']) || empty($tmpl['TemplateURL'])) {
        continue;
    }
    $cat = isset($tmpl['Category']) ? $tmpl['Category'] : '';
    if (strpos($cat, 'Language:') === false) {
        continue;
    }
    $out[] = [
        'code' => $tmpl['LanguagePack'],                                  // e.g. "de_DE" - matches the native <select>'s option value
        'name' => isset($tmpl['Language']) ? $tmpl['Language'] : $tmpl['Name'],       // e.g. "German"
        'local' => isset($tmpl['LanguageLocal']) ? $tmpl['LanguageLocal'] : '',       // e.g. "Deutsch"
        'templateUrl' => $tmpl['TemplateURL'],
    ];
}
usort($out, function ($a, $b) { return strcasecmp($a['name'], $b['name']); });
echo json_encode($out);
