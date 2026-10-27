// The settings page opens with TowerTorch's logo on a picture tile and its name beside it, the
// header ShipLog and FireSquire carry on their settings pages with the same sizes, and Unraid's
// title strip goes.
const fs = require('fs');
const path = require('path');
const DIR = path.join(__dirname, '..', 'src', 'towertorch', 'usr', 'local', 'emhttp', 'plugins', 'towertorch');
const settings = fs.readFileSync(path.join(DIR, 'scripts', 'settings.js'), 'utf8');

let pass = 0, fail = 0;
const ok = (name, cond, extra) => { cond ? (pass++, console.log('  PASS  ' + name)) : (fail++, console.log('  FAIL  ' + name + (extra ? '  -> ' + extra : ''))); };

const rule = (sel) => { const m = new RegExp('"#cc-settings ' + sel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\{([^}]*)\\}"').exec(settings); return m ? m[1] : ''; };
const narrow = settings.slice(settings.indexOf('"@media (max-width:1023px){"'));

console.log('\nThe header is built once per render, before the tabs and the cards');
{
  const at = settings.indexOf('var hero = el("div", "cc-hero")');
  ok('render() builds it', at > settings.indexOf('function render()'));
  ok('it lands on the page before the tab column', at > 0 && at < settings.indexOf('root.appendChild(body);') && /root\.appendChild\(hero\);/.test(settings));
  ok('the logo is the plugin tile\'s own', /heroLogo\.src = "\/plugins\/towertorch\/images\/towertorch\.png"/.test(settings));
  ok('the logo is decoration, the name says it', /heroLogo\.alt = ""/.test(settings));
  ok('the name is the page\'s heading', /el\("h1", "cc-hero-name", "TowerTorch"\)/.test(settings));
  ok('the line under it speaks both languages', /el\("p", "cc-hero-sub", T\("[^"]+", "[^"]+"\)\)/.test(settings));
  ok('Unraid\'s title strip is hidden', /querySelectorAll\("div\.title"\)\)\.forEach\(function \(tt\) \{ tt\.style\.setProperty\("display", "none", "important"\); \}\)/.test(settings));
}

console.log('\nThe sizes ShipLog and FireSquire share');
{
  const tile = rule('.cc-hero-tile'), name = rule('.cc-hero-name'), sub = rule('.cc-hero-sub');
  ok('an 88px tile with 10px inside', /width:88px;height:88px;padding:10px/.test(tile), tile);
  ok('the tile is the resting grey of a logo tile', /background:rgba\(128,128,128,\.18\)/.test(tile));
  ok('its corners follow the shape engine', /border-radius:var\(--cc-radius-control\)/.test(tile));
  ok('the name is 32px bold in the page font', /font-family:inherit;font-size:32px;font-weight:700/.test(name), name);
  ok('the line under it is a sub-line in the dim ink', /font-size:var\(--cc-text-subline\)/.test(sub) && /color:var\(--cc-text-dim\)/.test(sub));
  ok('20px between tile and name', /gap:20px/.test(rule('.cc-hero')));
  ok('a narrow window takes a 72px tile and a 26px name', /\.cc-hero-tile\{width:72px;height:72px;padding:8px\}/.test(narrow) && /\.cc-hero-name\{font-size:26px\}/.test(narrow));
}

console.log('\n' + (fail ? `FAILED  ${pass} passed, ${fail} failed` : `OK  ${pass} passed`));
process.exit(fail ? 1 : 0);
