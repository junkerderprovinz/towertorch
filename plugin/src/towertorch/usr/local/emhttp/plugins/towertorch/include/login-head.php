<?php
/* TowerTorch on Unraid's login page. scripts/login-hook adds one include line for this file just
   before </head> in .login.php and .set-password.php. Files below /plugins are not served before
   the login, so the stylesheet and the logo are written into the page. Nothing is written when
   ?towertorch=off was used or the stylesheet is missing, so the stock page always remains.

   The look comes from the cc.* settings the engine mirrors for every browser in config.json, so a
   browser that clears its storage, or one that never opened the interface, still gets it. */
(function () {
    $dir = '/usr/local/emhttp/plugins/towertorch';
    $switch = $_GET['towertorch'] ?? '';
    if ($switch === 'off') {
        echo "<script>document.cookie = 'towertorch_off=1; path=/; max-age=31536000; SameSite=Lax';</script>\n";
        return;
    }
    if ($switch === 'on') {
        echo "<script>document.cookie = 'towertorch_off=; path=/; max-age=0; SameSite=Lax';</script>\n";
    } elseif (!empty($_COOKIE['towertorch_off'])) {
        return;
    }
    $css = @file_get_contents("$dir/styles/login.css");
    if ($css === false) {
        return;
    }
    $logo = glob('/boot/config/plugins/towertorch/login-logo.*')[0] ?? "$dir/images/towertorch.png";
    $types = ['png' => 'image/png', 'jpg' => 'image/jpeg', 'webp' => 'image/webp', 'svg' => 'image/svg+xml'];
    $type = $types[strtolower(pathinfo($logo, PATHINFO_EXTENSION))] ?? 'image/png';
    $bytes = @file_get_contents($logo);
    $src = $bytes === false ? '' : "data:$type;base64," . base64_encode($bytes);

    echo '<style id="towertorch-login">' . "\n" . str_ireplace('</style', '<\/style', $css) . "\n</style>\n";
    echo '<script>' . "\n";
    $config = json_decode(@file_get_contents('/boot/config/plugins/towertorch/config.json') ?: '{}', true);
    $ui = array_filter($config['ui_settings'] ?? [], function ($v, $k) {
        return is_string($v) && preg_match('/^cc\.(theming|accent|badgeshape|rbmode|brand\.[a-z]+)$/', $k);
    }, ARRAY_FILTER_USE_BOTH);
    echo 'window.TT_LOGIN_LOGO = ' . json_encode($src) . ";\n";
    echo 'window.TT_LOGIN_UI = ' . json_encode((object) $ui, JSON_HEX_TAG | JSON_HEX_AMP) . ";\n";
    echo @file_get_contents("$dir/scripts/login.js") . "\n";
    echo "</script>\n";
})();
