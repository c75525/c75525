/* Art-directed rolling paths, not a rigid-body simulation. Landings track live holes. */
window.installWishingWell = function (entry, map, positions, objects) {
  if (!entry) return;
  var ns = 'http://www.w3.org/2000/svg', busy = false, tau = Math.PI * 2;
  function node(tag, attrs) {
    var el = document.createElementNS(ns, tag);
    Object.keys(attrs).forEach(function (key) { el.setAttribute(key, attrs[key]); });
    return el;
  }
  function smooth(t) { return t * t * (3 - 2 * t); }
  function bezier(a, b, c, d, t) {
    var v = 1 - t;
    return v*v*v*a + 3*v*v*t*b + 3*v*t*t*c + t*t*t*d;
  }
  entry.addEventListener('click', function (event) {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    if (busy) { event.preventDefault(); return; }
    var candidates = objects.filter(function (o) { return positions.has(o.url); });
    if (!candidates.length) return;
    var target = candidates[Math.floor(Math.random() * candidates.length)];
    entry.href = target.url;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    var matrix = map.getScreenCTM();
    if (!matrix) return;
    event.preventDefault(); busy = true; entry.setAttribute('aria-busy', 'true');
    var overlay = node('svg', { 'aria-hidden': 'true' });
    overlay.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:10000;overflow:hidden';
    var group = node('g', {}), defs = node('defs', {});
    var clip = node('clipPath', { id: 'wishing-well-rim', clipPathUnits: 'userSpaceOnUse' });
    var boundary = node('path', {});
    clip.appendChild(boundary); defs.appendChild(clip); group.appendChild(defs);
    var ball = node('ellipse', { fill: '#fff' });
    group.appendChild(ball); overlay.appendChild(group); document.body.appendChild(overlay);
    var startPoint = new DOMPoint(-24, -24).matrixTransform(matrix.inverse());
    var start = performance.now(), contactAngle = Math.PI * .78;
    var landing = { x: 400 + Math.cos(contactAngle)*350, y: 155 + Math.sin(contactAngle)*111 };
    var p = positions.get(target.url);
    var lastAngle = p.core ? contactAngle : Math.atan2((p.y-155)/p.radiusY, (p.x-400)/p.radiusX);
    var unwrapped = lastAngle;
    var choice = Math.random(), direct = choice < .18;
    var laps = choice < .48 ? 0 : choice < .82 ? 1 : 2;
    var gap = ((contactAngle-lastAngle)%tau+tau)%tau + tau*laps;
    // Avoid a near-zero glide; whole revolutions preserve exact endpoint alignment.
    if (gap < 1) gap += tau;
    var angularRate = 2.4 + Math.random()*.8;
    var glideDuration = gap/angularRate;
    var dropDuration = Math.hypot(landing.x-startPoint.x, landing.y-startPoint.y)/900;
    var directDuration = Math.max(.6, Math.hypot(p.x-startPoint.x,p.y-startPoint.y)/700);
    var phase = direct ? 'direct' : 'drop', phaseStart = start;
    var glideAngle, sinkStart;
    function finish() {
      overlay.remove(); busy = false; entry.removeAttribute('aria-busy');
      window.location.assign(target.url);
    }
    function frame(now) {
      p = positions.get(target.url);
      var m = map.getScreenCTM();
      if (!m) { finish(); return; }
      group.setAttribute('transform', 'matrix('+[m.a,m.b,m.c,m.d,m.e,m.f].join(' ')+')');
      var theta = p.core ? contactAngle : Math.atan2((p.y-155)/p.radiusY,(p.x-400)/p.radiusX);
      unwrapped += Math.atan2(Math.sin(theta-lastAngle),Math.cos(theta-lastAngle)); lastAngle=theta;
      var depth = p.core ? 1 : .78+.36*((Math.sin(theta)+1)/2);
      var holeRadius=p.r*depth, radius=holeRadius*.8;
      var flatten=.78+.12*((Math.sin(theta)+1)/2), x, y;
      var elapsed=(now-phaseStart)/1000;
      if (phase === 'drop') {
        var t=Math.min(1,elapsed/dropDuration);
        // Arrive tangent to the counterclockwise track, rather than rebound at contact.
        var tangentX=Math.sin(contactAngle)*350, tangentY=-Math.cos(contactAngle)*111;
        var tangentScale=gap*.4/glideDuration*dropDuration/3;
        x=bezier(startPoint.x,startPoint.x+80,landing.x-tangentX*tangentScale,landing.x,t);
        y=bezier(startPoint.y,startPoint.y+80,landing.y-tangentY*tangentScale,landing.y,t);
        radius=11+(8-11)*t; flatten=.9;
        if(t===1) {
          phase='glide'; phaseStart=now;
          glideAngle=unwrapped;
          gap=((contactAngle-unwrapped)%tau+tau)%tau+tau*laps;
          if(gap<1) gap+=tau;
          glideDuration=gap/angularRate;
        }
      } else if (phase === 'glide') {
        var u=Math.min(1,elapsed/glideDuration), progress=.4*u+.6*u*u;
        // Unwrapped live target + a diminishing positive arc: no modulo jumps,
        // no fractional extra lap, and exactly the hole's position at u=1.
        var angle=contactAngle+(unwrapped-glideAngle)-gap*progress;
        var targetRadius=p.core?0:p.radiusX;
        var r=targetRadius+(350-targetRadius)*(1-smooth(u));
        x=400+Math.cos(angle)*r; y=155+Math.sin(angle)*r*(111/350);
        var travelDepth=.78+.36*((Math.sin(angle)+1)/2);
        radius=8*travelDepth*(1-smooth(u))+radius*smooth(u);
        flatten=.78+.12*((Math.sin(angle)+1)/2);
        if(u===1 && Math.hypot(x-p.x,y-p.y)<.01) { phase='sink'; sinkStart=now; }
      } else if (phase === 'direct') {
        var q=Math.min(1,elapsed/directDuration);
        x=bezier(startPoint.x,startPoint.x+80,p.x-30,p.x,q);
        y=bezier(startPoint.y,startPoint.y+80,p.y-110,p.y,q);
        radius=11*(1-smooth(q))+radius*smooth(q);
        if(q===1) { phase='sink'; sinkStart=now; }
      } else {
        var falling=(now-sinkStart)/1000;
        var descent=80*falling*falling;
        x=p.x; y=p.y+descent;
        var rx=holeRadius, ry=holeRadius*.48;
        boundary.setAttribute('d','M '+(p.x-rx)+' '+(p.y-1000)+' H '+(p.x+rx)+' V '+p.y+' A '+rx+' '+ry+' 0 0 1 '+(p.x-rx)+' '+p.y+' Z');
        ball.setAttribute('clip-path','url(#wishing-well-rim)');
        // Finish only once the entire ball has passed below the front lip.
        if(descent-radius*flatten>ry+1) { finish(); return; }
      }
      ball.setAttribute('cx',x); ball.setAttribute('cy',y);
      ball.setAttribute('rx',radius); ball.setAttribute('ry',radius*flatten);
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  });
};
