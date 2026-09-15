// Run after `bundle exec jekyll build`: node _tests/tube-navigation.cjs [baseurl]
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const baseurl = process.argv[2] ?? '';
const site = path.join(__dirname, '..', '_site');
const read = (name) => fs.readFileSync(path.join(site, name), 'utf8');
const objects = JSON.parse(read('tube-objects.json'));
assert.equal(objects.length, 2);
for (const object of objects) {
  assert.ok(object.url.startsWith(baseurl + '/'));
  assert.match(object.coordinate, /^-?\d+,-?\d+$/);
  assert.equal(typeof object.nav, 'object');
  const html = read(object.url.slice(baseurl.length));
  assert.ok(html.includes('aria-label="c75525 location"'));
  const arrows = [...html.matchAll(/class="tube-arrow [^"]+" href="([^"]+)"/g)];
  assert.equal(arrows.length, 1);
  assert.ok(objects.some((target) => target.url === arrows[0][1] && target.url !== object.url));
  assert.ok(!html.includes('class="left arrow"'));
  assert.ok(!html.includes('class="right arrow"'));
}
const ordinary = read('jekyll/update/2026/04/17/zup-third-post-yep.html');
assert.ok(!ordinary.includes('aria-label="c75525 location"'));
assert.match(ordinary, /class="(?:left|right) arrow"/);
const splash = read('index.html');
assert.ok(splash.includes('class="splash-body"'));
assert.ok(splash.includes('id="coordinate-form"'));
assert.ok(splash.includes('id="random-entry"'));
assert.ok(splash.includes('class="tube-map"'));
assert.ok(splash.includes('id="tube-map-rings"'));
assert.ok(splash.includes('id="tube-map-nodes"'));
assert.ok(splash.includes('function renderMap(objects)'));
assert.ok(splash.includes(`href="${baseurl}/archive/"`));
assert.ok(read('archive/index.html').includes('class="post-grid"'));
const entry = read('enter-c75525/index.html');
assert.ok(entry.includes('<noscript>'));
assert.ok(entry.includes('Choose a location manually'));
const script = entry.match(/<script>\s*([\s\S]*?)<\/script>/)[1];
async function runEntry(data, { ok = true, reject = false, random = 0 } = {}) {
  const status = { textContent: '' };
  let redirected;
  vm.runInNewContext(script, {
    document: { getElementById: () => status },
    window: { location: {
      href: `https://example.test${baseurl}/enter-c75525/`,
      origin: 'https://example.test',
      replace: (url) => { redirected = url; }
    } },
    fetch: (url) => {
      assert.equal(url, `${baseurl}/tube-objects.json`);
      return reject ? Promise.reject(new Error('offline')) : Promise.resolve({ ok, json: () => Promise.resolve(data) });
    },
    Math: { random: () => random, floor: Math.floor },
    URL
  });
  await new Promise(setImmediate);
  return { status: status.textContent, redirected };
}
(async () => {
  assert.equal((await runEntry(objects)).redirected, objects[0].url);
  assert.equal((await runEntry(objects, { random: .999 })).redirected, objects[1].url);
  for (const data of [[], [{ url: '//outside.test/post' }], [{ url: 'https://outside.test/post' }]]) {
    const result = await runEntry(data);
    assert.equal(result.redirected, undefined);
    assert.match(result.status, /No c75525 locations/);
  }
  for (const result of [await runEntry(null), await runEntry(objects, { ok: false }), await runEntry(objects, { reject: true })]) {
    assert.equal(result.redirected, undefined);
    assert.match(result.status, /Random entry is unavailable/);
  }
  console.log(`Tube navigation and random-entry checks passed (baseurl=${JSON.stringify(baseurl)}).`);
})().catch((error) => { console.error(error); process.exitCode = 1; });
