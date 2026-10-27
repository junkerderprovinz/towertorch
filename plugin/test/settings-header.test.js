// The settings page opens with a banner across the tab column and the cards: TowerTorch's logo
// standing free and its name on a washed card surface with rings at the end, the banner ShipLog
// and FireSquire carry on their settings pages with the same sizes. Unraid's title strip goes.
const fs = require('fs');
const path = require('path');
const DIR = path.join(__dirname, '..', 'src', 'towertorch', 'usr', 'local', 'emhttp', 'plugins', 'towertorch');
const settings = fs.readFileSync(path.join(DIR, 'scripts', 'settings.js'), 'utf8');

let pass = 0, fail = 0;
const ok = (name, cond, extra) => { cond ? (pass++, console.log('  PASS  ' + name)) : (fail++, console.log('  FAIL  ' + name + (extra ? '  -> ' + extra : ''))); };

const rule = (sel) => { const m = new RegExp('"#cc-settings ' + sel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\{([^}]*)\\}"').exec(settings); return m ? m[1] : ''; };
const narrow = settings.slice(settings.indexOf('"@media (max-width:1023px){"'));

console.log('\nThe banner is built once per render, before the tabs and the cards');
{
  const at = settings.indexOf('var hero = el("div", "cc-hero")');
  ok('render() builds it', at > settings.indexOf('function render()'));
  ok('it lands on the page before the tab column', at > 0 && at < settings.indexOf('root.appendChild(body);') && /root\.appendChild\(hero\);/.test(settings));
  ok('the logo is the plugin tile\'s own, without a tile behind it', /heroLogo = el\("img", "cc-hero-logo"\)/.test(settings) && /heroLogo\.src = "\/plugins\/towertorch\/images\/towertorch\.png"/.test(settings) && !/cc-hero-tile/.test(settings));
  ok('the logo is decoration, the name says it', /heroLogo\.alt = ""/.test(settings));
  ok('the name is the page\'s heading', /el\("h1", "cc-hero-name", "TowerTorch"\)/.test(settings));
  ok('no line stands under the name', !/cc-hero-sub/.test(settings));
  ok('the rings are drawn inline and hidden from assistive technology', /<svg class="cc-hero-mark" viewBox="0 0 400 400" aria-hidden="true" focusable="false">(<circle cx="200" cy="200" r="\d+"\/>){3}<\/svg>/.test(settings));
  ok('Unraid\'s title strip is hidden', /querySelectorAll\("div\.title"\)\)\.forEach\(function \(tt\) \{ tt\.style\.setProperty\("display", "none", "important"\); \}\)/.test(settings));
}

console.log('\nThe sizes ShipLog and FireSquire share');
{
  const hero = rule('.cc-hero'), name = rule('.cc-hero-name'), logo = rule('.cc-hero-logo'), mark = rule('.cc-hero-mark');
  ok('136px high, 32px in from either side', /height:136px;margin:4px 0 16px 4px;padding:0 32px/.test(hero), hero);
  ok('as wide as the tab column and the cards together, from the tiles\' edge',/max-width:1144px/.test(hero));
  ok('its corners are a card\'s', /border-radius:var\(--cc-radius-card\)/.test(hero));
  ok('its ground is the card surface', /\),var\(--cc-fm-card,var\(--cc-surface-2\)\)$/.test(hero));
  ok('an 88px logo with 24px to the name', /width:88px;height:88px/.test(logo) && /gap:24px/.test(hero));
  ok('the name is 32px bold in the page font and in the text colour', /font-family:inherit;font-size:32px;font-weight:700/.test(name) && /color:var\(--cc-text\)/.test(hero), name);
  ok('the rings sit behind the logo and the name at the end', /z-index:-1;right:-72px/.test(mark) && /width:360px;height:360px/.test(mark));
  ok('a narrow window takes a 104px banner, a 64px logo and a 26px name',
    /\.cc-hero\{gap:16px;height:104px;padding:0 20px\}/.test(narrow) && /\.cc-hero-logo\{width:64px;height:64px\}/.test(narrow) && /\.cc-hero-name\{font-size:26px\}/.test(narrow));
}

console.log('\nThe colour engine reaches the banner');
{
  const hero = rule('.cc-hero');
  ok('the accent fills all three colours by default', ['a', 'b', 'c'].every((k, i) => hero.includes('--cc-hero-' + k + ':var(--cc-hero-' + (i + 1) + ',var(--cc-accent))')));
  ok('under the rainbow it takes the first three positions', /if \(rb\) hero\.style\.setProperty\("--cc-hero-" \+ n, rbC\(n - 1, accent\)\); else hero\.style\.removeProperty\("--cc-hero-" \+ n\);/.test(settings));
  ok('the reactive mode rests it grey until the pointer reaches it', /"#cc-settings\.cc-set-reactive \.cc-hero:not\(:hover\)\{--cc-hero-a:var\(--cc-text-dim\);--cc-hero-b:var\(--cc-text-dim\);--cc-hero-c:var\(--cc-text-dim\)\}"/.test(settings));
  ok('a light theme washes it more strongly', /"html:is\(\.Theme--white,\.Theme--azure\) #cc-settings \.cc-hero\{--cc-hero-wash:40%;--cc-hero-ring:36%\}"/.test(settings));
  ok('nothing on it moves', !/cc-hero[^"]*(animation|transition)/.test(settings));
}

console.log('\n' + (fail ? `FAILED  ${pass} passed, ${fail} failed` : `OK  ${pass} passed`));
process.exit(fail ? 1 : 0);
