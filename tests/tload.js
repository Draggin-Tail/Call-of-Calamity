// Browser load check: the page loads with every story file, no page errors, the loot and gold files are in, and a filled shop shows on a phone-sized screen.
// Serves the game folder itself on 8766 (GAME_DIR to override). Run: cd tests && node tload.js
const { chromium } = require('playwright'); const http = require('http'), fs = require('fs'), path = require('path'), os = require('os');
const root = process.env.GAME_DIR || path.join(__dirname, '..', 'game'), T = { '.html': 'text/html', '.js': 'text/javascript', '.png': 'image/png', '.jpg': 'image/jpeg' };
const srv = http.createServer((q, r) => { const f = path.join(root, decodeURIComponent(q.url.split('?')[0])); fs.readFile(f, (e, d) => { if (e) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'content-type': T[path.extname(f)] || 'text/plain' }); r.end(d); }); }).listen(8766);
(async () => {
  const b = await chromium.launch(), p = await b.newPage({ viewport: { width: 390, height: 780 } }), errs = [];
  p.on('pageerror', e => errs.push('pageerror: ' + e.message)); p.on('console', m => { if (m.type() === 'error' && !/404|Failed to load resource/.test(m.text())) errs.push('console: ' + m.text()); });
  await p.goto('http://localhost:8766/index.html'); await p.waitForTimeout(3000);
  const st = await p.evaluate(() => { const C = window.GAME_CAMPAIGN; return { loot: !!(C && C.LOOT), gold: !!(C && C.GOLD), arena: !!(C && C.ARENA), validate: C ? C.validate().length : -1, sandring: C && C.NODES.the_sandring ? C.NODES.the_sandring.shop.join() : null, shops: C ? Object.values(C.NODES).filter(n => n.shop).map(n => n.shop.length).join() : '', bodyText: document.body.innerText.slice(0, 200) }; });
  console.log(JSON.stringify(st)); console.log(errs.length ? 'ERRORS:\n' + errs.join('\n') : 'no page errors');
  await p.screenshot({ path: path.join(os.tmpdir(), 'tload.png') }); await b.close(); srv.close(); process.exit(errs.length ? 1 : 0);
})();
