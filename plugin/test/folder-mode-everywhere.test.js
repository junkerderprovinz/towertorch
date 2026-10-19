// Folder mode has to be handled everywhere the other modes are, in three places
// that would otherwise check for "grid" alone:
//
//   · applyFilter(), or the filter falls through to findRows() over the hidden
//     native table, which folder mode never drives;
//   · refresh() and the 3.5s stats timer in startTimers(), or the CPU, RAM and NET
//     readouts go stale;
//   · every call site that renders after a change, or a bare renderGrid() replaces
//     the folder grouping with the flat grid.
//
// applyFilter(), refresh() and renderCurrentView() are sliced out of docker.js and
// run with stubbed collaborators, and the file is audited as source so a call site
// that goes back to a bare renderGrid() fails here.
const fs = require('fs');
const path = require('path');
const DIR = path.join(__dirname, '..', 'src', 'towertorch', 'usr', 'local', 'emhttp', 'plugins', 'towertorch', 'scripts');
const DOCKER = process.argv[2] || path.join(DIR, 'docker.js');

let pass = 0, fail = 0;
const ok = (name, cond, extra) => { cond ? (pass++, console.log('  PASS  ' + name)) : (fail++, console.log('  FAIL  ' + name + (extra ? '  -> ' + extra : ''))); };

const src = fs.readFileSync(DOCKER, 'utf8');
function grabFn(name) {
  const i = src.indexOf('function ' + name + '(');
  if (i < 0) throw new Error('function not found in docker.js: ' + name);
  let d = 0;
  for (let k = src.indexOf('{', i); k < src.length; k++) { if (src[k] === '{') d++; else if (src[k] === '}') { d--; if (!d) return src.slice(i, k + 1); } }
  throw new Error('unbalanced function: ' + name);
}

console.log('\napplyFilter() carries an explicit "folder" branch');
{
  const applyFilterSrc = grabFn('applyFilter');
  ok('applyFilter() branches on mode === "folder"', /mode === "folder"/.test(applyFilterSrc));
  ok('that branch re-renders through renderFolderView()', /mode === "folder"[\s\S]*?renderFolderView\(\)/.test(applyFilterSrc));

  console.log('\napplyFilter(): which path fires per mode');
  function run(mode, ccOrgView, gh, findRowsCb, renderFolderViewCb) {
    const fn = new Function('mode', 'filterText', 'gridHolder', 'ccOrgView', 'norm', 'renderFolderView', 'findRows',
      applyFilterSrc + '\nreturn applyFilter;'
    )(mode, 'sonarr', gh, ccOrgView, s => s, renderFolderViewCb, findRowsCb);
    fn();
  }
  {
    const card = { dataset: { name: 'plex' }, style: {} };
    const gh = { querySelectorAll: () => [card] };
    let findRowsCalled = false;
    run('grid', null, gh, () => { findRowsCalled = true; return []; }, () => {});
    ok('grid mode toggles cards directly', !findRowsCalled);
  }
  {
    let findRowsCalled = false, folderViewCalled = false;
    run('folder', { flatEntries: [] }, null, () => { findRowsCalled = true; return []; }, () => { folderViewCalled = true; });
    ok('folder mode calls renderFolderView()', folderViewCalled);
    ok('folder mode never falls through to findRows() over the hidden native table', !findRowsCalled);
  }
  {
    let folderViewCalled = false, threw = false;
    try { run('folder', null, null, () => [], () => { folderViewCalled = true; }); } catch (e) { threw = true; }
    ok('folder mode with ccOrgView still null does not throw', !threw);
    ok('...and does not call renderFolderView() against missing data', !folderViewCalled);
  }
  {
    let findRowsCalled = false;
    run('list', null, null, () => { findRowsCalled = true; return []; }, () => {});
    ok('list mode drives findRows() over the native table', findRowsCalled);
  }
}

console.log('\nrefresh() includes folder mode in its stats-polling gate');
{
  const refreshSrc = grabFn('refresh');
  ok('refresh() names mode === "folder" in its refreshStats() gate', /mode === "folder"/.test(refreshSrc));

  console.log('\nrefresh(): which modes trigger refreshStats()');
  function runRefresh(mode, colOnRes) {
    let statsCalled = false;
    const fn = new Function('mode', 'colOn', 'applyMode', 'refreshStats', refreshSrc + '\nreturn refresh;')(
      mode, () => colOnRes, () => {}, () => { statsCalled = true; }
    );
    fn();
    return statsCalled;
  }
  ok('grid mode: refreshStats() fires', runRefresh('grid', false));
  ok('folder mode: refreshStats() fires', runRefresh('folder', false));
  ok('list mode without the resource column: refreshStats() is skipped', !runRefresh('list', false));
  ok('list mode with the resource column: refreshStats() fires', runRefresh('list', true));
}
console.log('\nThe 3.5s stats timer in startTimers() includes folder mode');
{
  // refresh() only covers a manual re-render; this interval is what keeps CPU, RAM
  // and NET ticking while the tab sits open, and it carries its own mode gate.
  const m = src.match(/setInterval\(function \(\) \{[\s\S]*?\}, 3500\)\);/);
  ok('the 3.5s polling interval was found in the source', !!m);
  ok('...and its condition names mode === "folder"', !!m && /mode === "folder"/.test(m[0]), m && m[0]);
}

console.log('\nrenderCurrentView() is the single dispatch point');
{
  const dispatcherSrc = grabFn('renderCurrentView');
  ok('renderCurrentView() checks mode === "folder" before the flat grid', /mode === "folder"[\s\S]*?renderFolderView\(\)/.test(dispatcherSrc));
  ok('...and calls renderGrid() for every other theming mode', /renderGrid\(\)/.test(dispatcherSrc));

  console.log('\nrenderCurrentView(): where each mode routes');
  function runDispatch(mode) {
    const calls = [];
    const fn = new Function('mode', 'renderFolderView', 'renderGrid', dispatcherSrc + '\nreturn renderCurrentView;')(
      mode, () => calls.push('folder'), () => calls.push('grid')
    );
    fn();
    return calls;
  }
  ok('mode "folder" routes to renderFolderView()', JSON.stringify(runDispatch('folder')) === JSON.stringify(['folder']));
  ok('mode "grid" routes to renderGrid()', JSON.stringify(runDispatch('grid')) === JSON.stringify(['grid']));
}
console.log('\nSource audit: every render call site goes through renderCurrentView()');
{
  // A bare "else renderGrid();" drops the folder grouping back to the flat grid the
  // moment its trigger fires. The one in renderCurrentView() is the fallback itself.
  const bareElseRenderGrid = (src.match(/else renderGrid\(\);/g) || []).length;
  ok('one "else renderGrid();" in the whole file', bareElseRenderGrid === 1, bareElseRenderGrid);
  const dispatcherSrc = grabFn('renderCurrentView');
  ok('...and it sits inside renderCurrentView()', dispatcherSrc.indexOf('else renderGrid();') >= 0);

  const stillBuggy = (src.match(/mode === "list"[^\n]*else renderGrid\(\);/g) || []).length;
  ok('no "if list ... else renderGrid()" call site is left', stillBuggy === 0, stillBuggy);

  // loadConfig and the restart-policy, bandwidth, limits and editor saves all fall back
  // through renderCurrentView().
  const routed = (src.match(/else renderCurrentView\(\);/g) || []).length;
  ok('the five call sites read "else renderCurrentView();"', routed === 5, routed);

  // The icon-mode select and the storage-sync listener are written differently, so
  // they are checked by name rather than by counting the pattern.
  ok('the icon-mode select site reads renderCurrentView()', /if \(mode !== "list"\) renderCurrentView\(\);/.test(src));
  ok('the storage-sync listener names folder mode', /mode === "grid" \|\| mode === "folder"\) renderCurrentView\(\);/.test(src));
}

console.log('\n' + (fail ? `FAILED  ${pass} passed, ${fail} failed` : `OK  ${pass} passed`));
process.exit(fail ? 1 : 0);
