// The Info tab's coffee, PayPal and crypto buttons open their windows in the page, the way
// ShipLog's and FireSquire's do: TowerTorch windows with the appeal, Buy Me a Coffee's widget,
// PayPal's buttons under the house's own controls, and an address with a QR code per network.
// A middle or modified click still reaches the hosted page, and nothing from a payment provider
// loads before its window opens.
const fs = require('fs');
const path = require('path');
const DIR = path.join(__dirname, '..', 'src', 'towertorch', 'usr', 'local', 'emhttp', 'plugins', 'towertorch');
const read = (rel) => fs.readFileSync(path.join(DIR, rel), 'utf8');
const settings = read('scripts/settings.js'), give = read('scripts/give.js'), css = read('styles/give.css'), page = read('TowerTorch.page');

let pass = 0, fail = 0;
const ok = (name, cond, extra) => { cond ? (pass++, console.log('  PASS  ' + name)) : (fail++, console.log('  FAIL  ' + name + (extra ? '  -> ' + extra : ''))); };

console.log('\nThe settings page loads the windows before the page that uses them');
{
  const at = (s) => page.indexOf(s);
  ok('give.js runs deferred before settings.js', at("scripts/give.js')?>\"></script>") > 0 && at("scripts/give.js')") < at("scripts/settings.js')") && /<script defer src="<\?autov\('\/plugins\/towertorch\/scripts\/give\.js'\)\?>"><\/script>/.test(page));
  ok('its sheet is linked with the page', /<link type="text\/css" rel="stylesheet" href="<\?autov\('\/plugins\/towertorch\/styles\/give\.css'\)\?>">/.test(page));
  ok('the QR library is vendored where give.js asks for it', fs.existsSync(path.join(DIR, 'vendor', 'qrcode.js')) && /s\.src = "\/plugins\/towertorch\/vendor\/qrcode\.js"/.test(give));
  ok('it offers the three windows', /window\.CCGive = \{ coffee: openCoffee, paypal: openPaypal, crypto: openCrypto \};/.test(give));
}

console.log('\nThe give buttons open them');
{
  const row = settings.slice(settings.indexOf('var give = el("div", "cc-rbtn-rows cc-set-give")'), settings.indexOf('cAbout.appendChild(give);'));
  ok('coffee, PayPal and crypto each name their window', /open: G\.coffee \}/.test(row) && /open: G\.paypal \}/.test(row) && /open: G\.crypto \}/.test(row));
  ok('each keeps its hosted page as its address', ['buymeacoffee.com/junkerderprovinz"', 'hosted_button_id=76FVV52TKXTUS"', 'github.io/junkerderprovinz/"'].every((u) => row.includes(u)));
  const btn = settings.slice(settings.indexOf('function readmeBtn(o)'), settings.indexOf('function downloadBugReport'));
  ok('a button with a window says so to assistive technology', /if \(o\.open\) \{\s*b\.setAttribute\("aria-haspopup", "dialog"\);/.test(btn));
  ok('a middle or modified click still opens the hosted page', /if \(e\.button \|\| e\.ctrlKey \|\| e\.metaKey \|\| e\.shiftKey \|\| e\.altKey\) return;/.test(btn));
  ok('a plain click opens the window and stays on the page', /e\.preventDefault\(\); e\.stopPropagation\(\);\s*o\.open\(b\);/.test(btn));
  ok('the buttons keep their look', !/cc-rbtn/.test(css));
}

console.log('\nThey are TowerTorch windows');
{
  ok('the window component carries them', /el\("div", "cc-win cc-dlg cc-give " \+ o\.cls\)/.test(give) && /window\.CCTheme\.modal\(win, \{ opener: o\.opener, focus: into, onDismiss:/.test(give));
  ok('every way out runs the window\'s own clean-up', /onDismiss: function \(\) \{ if \(o\.onClose\) o\.onClose\(\); h\.close\(\); \}/.test(give));
  ok('the title is a window title badge', /win\.appendChild\(el\("div", "cc-win-title", o\.title\)\);/.test(give));
  ok('the appeal and the payment sentence speak both languages', /el\("p", "cc-win-text", T\("Wirf deinem Ritter[^"]+", "Toss a coin to your knight[^"]+"\)\)/.test(give));
  ok('the controls are spans the house makes pressable, out of reach of Unraid\'s button look', /function control\(cls, text\) \{ return window\.CCTheme\.pressable\(el\("span", cls, text\)\); \}/.test(give) && !/el\("button"/.test(give));
  ok('a picked option takes the accent, or its rainbow position', /var\(--cc-rb-c, var\(--cc-rbaccent, var\(--cc-accent, #FCC419\)\)\)/.test(css) && /C\.rbColor\(i, get\("cc\.accent", "#FCC419"\)\)/.test(give));
}

console.log('\nNothing from a provider loads before its window opens');
{
  const top = give.slice(0, give.indexOf('function openWindow'));
  ok('no outside script or frame at load', !/createElement\("(script|iframe)"\)|el\("iframe"\)/.test(top));
  ok('the coffee frame is the widget, the one page Buy Me a Coffee lets be framed', /f\.src = COFFEE_WIDGET;/.test(give) && /buymeacoffee\.com\/widget\/page\/junkerderprovinz/.test(give));
  ok('PayPal loads in its own namespace per kind of donation', /var ns = recurring \? "ccPaypalRecurring" : "ccPaypalOnce";/.test(give) && /s\.setAttribute\("data-namespace", ns\);/.test(give));
  ok('a one-off gift is marked as a donation', /category: "DONATION"/.test(give));
  ok('a half-typed amount keeps PayPal from opening', /onClick: function \(d, actions\) \{ return amount\(\) \? actions\.resolve\(\) : actions\.reject\(\); \}/.test(give));
}

console.log('\nThe crypto window');
{
  ok('the code is black on white in every theme', /bg\.setAttribute\("fill", "#ffffff"\)/.test(give) && /path\.setAttribute\("fill", "#000000"\)/.test(give) && /\.cc-give-qr \{[^}]*background: #fff;/.test(css));
  ok('a new coin starts on its own first network', /coin = c; net = c\.networks\[0\]; show\(\);/.test(give));
  ok('the address is shown whole', /addr\.textContent = net\.address;/.test(give) && !/address\.slice|address\.substr/.test(give));
  ok('XRP says no tag is needed', /address: XRP, notag: true/.test(give) && /note\.hidden = !net\.notag;/.test(give));
  ok('a coin mark wears its coin colour at rest and the tile ink when lit or picked', /b\.style\.setProperty\("--cc-give-mark", c\.rest \|\| c\.tile\[0\]\);/.test(give) && /\.cc-give-coinmark \{[^}]*color: var\(--cc-give-mark\);/.test(css) && /\.cc-give-coin:is\(:hover, :focus-visible, \[aria-selected="true"\]\) \.cc-give-coinmark \{ color: inherit; \}/.test(css));
  ok('XRP rests in white, since its near-black vanishes on the dark tile', /id: "xrp"[^}]*rest: "#ffffff"/.test(give));
  ok('the coin tiles follow the label mode', /win\.setAttribute\("data-cc-give-labels", labelMode\(\)\);/.test(give) && /\[data-cc-give-labels="glyph"\] \.cc-give-tick \{ display: none; \}/.test(css));
}

console.log('\n' + (fail ? `FAILED  ${pass} passed, ${fail} failed` : `OK  ${pass} passed`));
process.exit(fail ? 1 : 0);
