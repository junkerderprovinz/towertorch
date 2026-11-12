<?php
/*
 * Same-origin proxy from the Unraid WebGUI to the TowerTorch host
 * supervisor's unix-socket API. Only whitelisted path+method pairs are
 * forwarded; nothing else reaches the engine, and the engine itself never
 * exposes Docker create/exec/build. The browser never touches the Docker socket.
 */
$sock  = getenv('TT_SOCK') ?: '/var/run/towertorch.sock';
// state/stats: read-only; action: start|stop|restart|pause|unpause (the engine
// validates the container name against the live list and never exposes
// create/exec/build); plan/apply: the start-order plan. Nothing else is forwarded.
// vms: read-only VM list + current limits; vmlimits: apply CPU-pin/cap, RAM, bandwidth to
// one VM (the engine validates the name against the live libvirt domain list, uses only
// virsh --config/--live, and never virsh-defines/undefines/creates a domain).
// fortressstatus/fortresslog: the status report and log the apps of a fortress
// read. The engine answers them only on its socket, so this signed-in proxy is
// the one way in from a browser.
// maintenance/maintenancerun/maintenancestop: the maintenance plan and its run; fortressjoin
// takes the fortress phrase, which the engine turns into its keys and never keeps, and
// fortressleave takes TowerTorch out again.
$allow = ['state' => ['GET'], 'stats' => ['GET'], 'action' => ['POST'], 'limits' => ['GET', 'POST'], 'restartpolicy' => ['POST'], 'plan' => ['GET', 'PUT'], 'apply' => ['POST'], 'config' => ['GET', 'PUT'], 'vms' => ['GET'], 'vmlimits' => ['POST'],
          'fortressstatus' => ['GET'], 'fortresslog' => ['GET'],
          'maintenance' => ['GET', 'PUT'], 'maintenancerun' => ['POST'], 'maintenancestop' => ['POST'], 'fortressjoin' => ['POST'], 'fortressleave' => ['POST']];
$route = ['fortressstatus' => 'fortress/v1/status', 'fortresslog' => 'fortress/v1/log',
          'maintenancerun' => 'maintenance/run', 'maintenancestop' => 'maintenance/stop', 'fortressjoin' => 'fortress/join', 'fortressleave' => 'fortress/leave'];

$path   = isset($_GET['path']) ? preg_replace('/[^a-z]/', '', $_GET['path']) : '';
$method = $_SERVER['REQUEST_METHOD'];

header('Content-Type: application/json');

if (!isset($allow[$path]) || !in_array($method, $allow[$path], true)) {
    http_response_code(400);
    echo json_encode(['error' => 'not allowed']);
    exit;
}

// Forward only the query params each path explicitly needs (allowlist, like
// $allow) so no attacker-supplied param ever reaches the engine unfiltered.
// Each fortress parameter passes only in the shape the engine accepts.
$qallow = ['limits' => ['name'], 'fortressstatus' => ['lang'], 'fortresslog' => ['lang', 'after', 'limit'], 'maintenance' => ['lang']];
$qshape = ['lang' => '/^[A-Za-z]{1,8}(-[A-Za-z0-9]{1,8})*$/', 'after' => '/^[0-9]{1,20}$/', 'limit' => '/^[0-9]{1,3}$/'];
$extra = [];
if (isset($qallow[$path])) {
    foreach ($qallow[$path] as $k) {
        if (isset($_GET[$k]) && is_string($_GET[$k]) && (!isset($qshape[$k]) || preg_match($qshape[$k], $_GET[$k]))) {
            $extra[$k] = $_GET[$k];
        }
    }
}
$qs = http_build_query($extra);
$headers = ['Content-Type: application/json', 'Accept: application/json'];
if (isset($route[$path]) && isset($_SERVER['HTTP_ACCEPT_LANGUAGE'])) {
    $headers[] = 'Accept-Language: ' . substr(preg_replace('/[^A-Za-z0-9,;=.\- ]/', '', $_SERVER['HTTP_ACCEPT_LANGUAGE']), 0, 200);
}

$ch = curl_init();
curl_setopt_array($ch, [
    CURLOPT_UNIX_SOCKET_PATH => $sock,
    CURLOPT_URL            => 'http://localhost/api/' . (isset($route[$path]) ? $route[$path] : $path) . ($qs ? '?' . $qs : ''),
    CURLOPT_CUSTOMREQUEST  => $method,
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_TIMEOUT        => 900,
    CURLOPT_HTTPHEADER     => $headers,
]);
if ($method === 'PUT' || $method === 'POST') {
    curl_setopt($ch, CURLOPT_POSTFIELDS, file_get_contents('php://input'));
}

$resp = curl_exec($ch);
$code = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
$err  = curl_error($ch);
curl_close($ch);

if ($resp === false || $code === 0) {
    http_response_code(502);
    echo json_encode(['error' => 'engine unreachable: ' . $err]);
    exit;
}
http_response_code($code ?: 200);
echo $resp;
