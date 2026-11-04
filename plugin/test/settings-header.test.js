// The settings page opens with a banner across the tab column and the cards: TowerTorch's logo
// standing free, its name and its claim on a flat card surface, and the logo again at the end as a
// faint silhouette that takes the colour while the banner is pointed at or focused. ShipLog and
// FireSquire carry the same banner with the same sizes. Unraid's title strip goes.
const fs = require('fs');
const path = require('path');
const DIR = path.join(__dirname, '..', 'src', 'towertorch', 'usr', 'local', 'emhttp', 'plugins', 'towertorch');
const settings = fs.readFileSync(path.join(DIR, 'scripts', 'settings.js'), 'utf8');

let pass = 0, fail = 0;
const ok = (name, cond, extra) => { cond ? (pass++, console.log('  PASS  ' + name)) : (fail++, console.log('  FAIL  ' + name + (extra ? '  -> ' + extra : ''))); };

const rule = (sel) => { const m = new RegExp('"#tt-settings ' + sel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\{([^}]*)\\}"').exec(settings); return m ? m[1] : ''; };
const narrow = settings.slice(settings.indexOf('"@media (max-width:1023px){"'));

console.log('\nThe banner is built once per render, before the tabs and the cards');
{
  const at = settings.indexOf('var hero = el("div", "tt-hero")');
  ok('render() builds it', at > settings.indexOf('function render()'));
  ok('it lands on the page before the tab column', at > 0 && at < settings.indexOf('root.appendChild(body);') && /root\.appendChild\(hero\);/.test(settings));
  ok('the logo is the plugin tile\'s own, without a tile behind it', /heroLogo = el\("img", "tt-hero-logo"\)/.test(settings) && /heroLogo\.src = "\/plugins\/towertorch\/images\/towertorch\.png"/.test(settings) && !/tt-hero-tile/.test(settings));
  ok('the logo is decoration, the name says it', /heroLogo\.alt = ""/.test(settings));
  ok('the name is the page\'s heading', /el\("h1", "tt-hero-name", "TowerTorch"\)/.test(settings));
  ok('the claim from the README stands under the name', /el\("p", "tt-hero-claim", "Your server's UI on fire\. Your disks stay cool\."\)/.test(settings));
  ok('the silhouette is hidden from assistive technology', /<span class="tt-hero-mark" aria-hidden="true"><\/span>/.test(settings));
  ok('Unraid\'s title strip is hidden', /querySelectorAll\("div\.title"\)\)\.forEach\(function \(tt\) \{ tt\.style\.setProperty\("display", "none", "important"\); \}\)/.test(settings));
}

console.log('\nThe sizes ShipLog and FireSquire share');
{
  const hero = rule('.tt-hero'), name = rule('.tt-hero-name'), claim = rule('.tt-hero-claim'), logo = rule('.tt-hero-logo'), mark = rule('.tt-hero-mark');
  ok('136px high, 32px in from either side, 32px above the settings', /height:136px;margin:4px 0 32px 4px;padding:0 32px/.test(hero), hero);
  ok('as wide as the tab column and the cards together, from the tiles\' edge', /max-width:1144px/.test(hero));
  ok('its corners are a card\'s', /border-radius:var\(--tt-radius-card\)/.test(hero));
  ok('its ground is the flat card surface', /;background:var\(--tt-fm-card,var\(--tt-surface-2\)\)$/.test(hero));
  ok('an 88px logo with 24px to the name', /width:88px;height:88px/.test(logo) && /gap:24px/.test(hero));
  ok('the name is 32px bold in the page font and in the text colour', /font-family:inherit;font-size:32px;font-weight:700/.test(name) && /color:var\(--tt-text\)/.test(hero), name);
  ok('the claim is a title-size line in the dim ink', /font-size:var\(--tt-text-title\)/.test(claim) && /color:var\(--tt-text-dim\)/.test(claim), claim);
  ok('the name and the claim keep to one line each and end in an ellipsis', [name, claim].every((r) => /overflow:hidden;text-overflow:ellipsis;white-space:nowrap/.test(r)));
  ok('the silhouette is the logo\'s own outline, 264px, cut by the end edge', /inset-inline-end:-44px/.test(mark) && /width:264px;height:264px/.test(mark) && /mask:url\(\/plugins\/towertorch\/images\/towertorch\.png\) center\/contain no-repeat/.test(mark), mark);
  ok('the silhouette sits behind the logo and the text', /z-index:-1/.test(mark) && /isolation:isolate/.test(hero));
  ok('a narrow window takes a 104px banner, a 64px logo, a 208px silhouette and a 26px name',
    /\.tt-hero\{gap:16px;height:104px;padding:0 20px\}/.test(narrow) && /\.tt-hero-logo\{width:64px;height:64px\}/.test(narrow) &&
    /\.tt-hero-mark\{inset-inline-end:-36px;width:208px;height:208px\}/.test(narrow) && /\.tt-hero-name\{font-size:26px\}/.test(narrow));
}

console.log('\nThe silhouette takes the colour while the banner is pointed at or focused');
{
  const mark = rule('.tt-hero-mark'), lit = rule('.tt-hero:is(:hover,:focus-within) .tt-hero-mark');
  ok('it rests grey in every colour mode', /background-color:color-mix\(in srgb,var\(--tt-text-dim\) var\(--tt-hero-sil\),transparent\)/.test(mark), mark);
  ok('the pointer or the focus brings the accent', /background-color:color-mix\(in srgb,var\(--tt-hero-tint,var\(--tt-accent\)\) var\(--tt-hero-sil\),transparent\)/.test(lit), lit);
  ok('under the rainbow it takes the first position', /if \(rb\) hero\.style\.setProperty\("--tt-hero-tint", rbC\(0, accent\)\); else hero\.style\.removeProperty\("--tt-hero-tint"\);/.test(settings));
  ok('the change runs on the motion engine\'s control time, still when motion is off', /transition:background-color var\(--tt-motion-control-dur,0s\)/.test(mark));
  ok('no colour mode keeps it lit at rest', !/tt-set-reactive \.tt-hero/.test(settings));
  ok('a light theme shows it more strongly', /"html:is\(\.Theme--white,\.Theme--azure\) #tt-settings \.tt-hero\{--tt-hero-sil:30%\}"/.test(settings));
}

console.log('\n' + (fail ? `FAILED  ${pass} passed, ${fail} failed` : `OK  ${pass} passed`));
process.exit(fail ? 1 : 0);
