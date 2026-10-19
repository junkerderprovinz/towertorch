<?php
/*
 * Reads Community Applications' local template cache so the Apps-tab card can show
 * a download count and last-updated month without a per-app round trip. CA shows
 * these only in its Info popup, fetched per app, but it caches the whole catalog in
 * one file for its own use.
 *
 * That cache is PHP serialize()'d despite its .json extension. When CA is missing,
 * has no cache yet or changes the format, the answer is an empty map, so the stat
 * line disappears from the cards and the Apps tab keeps working.
 */
header('Content-Type: application/json');

$path = '/tmp/community.applications/tempFiles/templates_new.json';
if (!is_file($path) || !is_readable($path)) {
    echo '{}';
    exit;
}

$raw = file_get_contents($path);
$data = $raw !== false ? @unserialize($raw, ['allowed_classes' => false]) : false;
if (!is_array($data)) {
    echo '{}';
    exit;
}

// Keyed exactly like .ca_holder's own data-appname/data-repository attributes,
// so the frontend can look a card up with no extra normalisation.
$out = [];
foreach ($data as $tmpl) {
    if (!is_array($tmpl) || empty($tmpl['Name']) || empty($tmpl['RepoName'])) {
        continue;
    }
    $downloads = isset($tmpl['downloads']) ? (int) $tmpl['downloads'] : null;
    $lastUpdate = isset($tmpl['LastUpdate']) ? (int) $tmpl['LastUpdate'] : null;
    if ($downloads === null && $lastUpdate === null) {
        continue;
    }
    $out[$tmpl['Name'] . '|' . $tmpl['RepoName']] = ['d' => $downloads, 'u' => $lastUpdate];
}
echo json_encode($out);
