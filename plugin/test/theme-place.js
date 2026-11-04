// TTTheme.edge and TTTheme.placeAt, taken from tt-theme.js and bound to a test's own window and
// document, for the tests that place a window, a menu or a bubble.
const fs = require('fs');
const { DIR } = require('./cascade');
const path = require('path');

const src = fs.readFileSync(path.join(DIR, 'scripts', 'tt-theme.js'), 'utf8');
function grab(name) {
  const i = src.indexOf('function ' + name + '(');
  let d = 0;
  for (let k = src.indexOf('{', i); k < src.length; k++) { if (src[k] === '{') d++; else if (src[k] === '}') { d--; if (!d) return src.slice(i, k + 1); } }
  throw new Error('function not found: ' + name);
}

module.exports = (window, document) =>
  new Function('window', 'document', grab('edge') + '\n' + grab('placeAt') + '\nreturn { edge: edge, placeAt: placeAt };')(window, document);
