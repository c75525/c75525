const assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const source=fs.readFileSync('assets/js/wishing-well.js','utf8');
function run(core,reduced,choice,speed,initial){
 const elements=[],frames=[];let click,destination,clock=0;
 function element(tag){const el={tag,attrs:{},style:{},children:[],setAttribute(k,v){this.attrs[k]=v},removeAttribute(k){delete this.attrs[k]},appendChild(e){this.children.push(e)},remove(){this.removed=true}};elements.push(el);return el;}
 const entry=element('a');entry.addEventListener=(_,fn)=>click=fn;
 const window={matchMedia:()=>({matches:reduced}),location:{assign:url=>destination=url}};
 let randoms=[0,choice,.5];const math=Object.create(Math);math.random=()=>randoms.shift()??.5;
 vm.runInNewContext(source,{window,document:{createElementNS:(_,tag)=>element(tag),body:element('body')},DOMPoint:class{constructor(x,y){this.x=x;this.y=y}matrixTransform(){return this}},performance:{now:()=>clock},requestAnimationFrame:fn=>frames.push(fn),Math:math});
 const p={x:400,y:155,r:7,core,radiusX:175,radiusY:55.5,speed};
 function move(){if(!core){p.x=400+175*Math.cos(initial+speed*clock/1000);p.y=155+55.5*Math.sin(initial+speed*clock/1000)}}move();
 const matrix={a:1,b:0,c:0,d:1,e:0,f:0,inverse(){return this}};
 window.installWishingWell(entry,{getScreenCTM:()=>matrix},new Map([['/target/',p]]),[{url:'/target/'}]);
 let prevented=false;click({button:0,preventDefault(){prevented=true}});
 assert.equal(entry.href,'/target/');if(reduced){assert.equal(prevented,false);assert.equal(frames.length,0);return 0}
 assert.ok(prevented);click({button:0,preventDefault(){}});assert.equal(frames.length,1);
 let previous,clipped=false;
 while(!destination&&clock<20000){
  move();const fn=frames.shift();assert.ok(fn);fn(clock);
  const ball=elements.find(e=>e.tag==='ellipse');
  for(const k of ['cx','cy','rx','ry'])assert.ok(Number.isFinite(ball.attrs[k]),k);
  if(ball.attrs['clip-path']&&!clipped){
   assert.ok(previous,'landing frame exists');
   assert.ok(Math.hypot(previous.x-previous.tx,previous.y-previous.ty)<.01,'landing must meet live hole BEFORE clipping');
   assert.equal(destination,undefined,'must sink before navigating');clipped=true;
  }
  previous={x:ball.attrs.cx,y:ball.attrs.cy,tx:p.x,ty:p.y};clock+=16;
 }
 assert.equal(destination,'/target/');assert.ok(clipped);assert.ok(elements.find(e=>e.tag==='svg').removed);return clock;
}
const durations=new Set();
for(const core of [false,true])for(const choice of [.1,.3,.6,.9])for(const speed of [-.08,.08])for(const angle of [-3.13,0,3.13])durations.add(run(core,false,choice,speed,angle));
run(false,true,.3,.08,0);assert.ok(durations.size>4);
console.log('48 moving-target routes passed: direct/short/medium/long, core, both target directions, angle wrap, exact capture before clipping, variable duration, reduced motion.');
