const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const source = fs.readFileSync('assets/js/wishing-well.js', 'utf8');
function run(core, reduced) {
  const elements = [], frames = []; let click, destination;
  function element(tag) {
    const el = { tag, attrs: {}, style: {}, children: [], setAttribute(k,v) { this.attrs[k]=v; }, removeAttribute(k) { delete this.attrs[k]; }, appendChild(e) { this.children.push(e); }, remove() { this.removed=true; } };
    elements.push(el); return el;
  }
  const entry = element('a'); entry.addEventListener = (_, fn) => click=fn;
  const window = { matchMedia: () => ({matches: reduced}), location: {assign: url => destination=url} };
  vm.runInNewContext(source, {window, document: {createElementNS: (_,tag)=>element(tag), body: element('body')}, DOMPoint: class {constructor(x,y){this.x=x;this.y=y;} matrixTransform(){return this;}}, performance:{now:()=>0}, requestAnimationFrame:fn=>frames.push(fn), Math});
  const position = core ? {x:400,y:155,r:7,core:true} : {x:575,y:155,r:7,radiusX:175,radiusY:55.5};
  const matrix={a:1,b:0,c:0,d:1,e:0,f:0,inverse(){return this;}};
  window.installWishingWell(entry,{getScreenCTM:()=>matrix},new Map([['/target/',position]]),[{url:'/target/'}]);
  let prevented=false; click({button:0,preventDefault(){prevented=true;}});
  assert.equal(entry.href,'/target/');
  if(reduced){assert.equal(prevented,false);assert.equal(frames.length,0);return;}
  assert.ok(prevented);
  click({button:0,preventDefault(){}}); assert.equal(frames.length,1);
  for(let t=0;t<=4000;t+=50){
    const fn=frames.shift(); assert.ok(fn); fn(t);
    const ball=elements.find(e=>e.tag==='ellipse');
    for(const k of ['cx','cy','rx','ry']) assert.ok(Number.isFinite(ball.attrs[k]),k);
  }
  assert.equal(destination,'/target/');
  assert.ok(elements.find(e=>e.tag==='ellipse').attrs['clip-path']);
  assert.ok(elements.find(e=>e.tag==='svg').removed);
}
run(false,false); run(true,false); run(false,true);
console.log('Wishing well: ring/core destinations, finite geometry, repeat-click guard, rim clipping, reduced motion passed.');
