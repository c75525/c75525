/* Enter transition: viewport drop, tightening projected spiral, rim-occluded sink. */
window.installWishingWell = function (entry, map, positions, objects) {
  if (!entry) return;
  var ns = 'http://www.w3.org/2000/svg', busy = false;
  function node(tag, attrs) {
    var el = document.createElementNS(ns, tag);
    Object.keys(attrs).forEach(function (key) { el.setAttribute(key, attrs[key]); });
    return el;
  }
  function smooth(t) { return t * t * (3 - 2 * t); }
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
    event.preventDefault();
    busy = true;
    entry.setAttribute('aria-busy', 'true');
    var overlay = node('svg', { 'aria-hidden': 'true' });
    overlay.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:10000;overflow:hidden';
    var group = node('g', {}), defs = node('defs', {});
    var clip = node('clipPath', { id: 'wishing-well-rim', clipPathUnits: 'userSpaceOnUse' });
    var boundary = node('path', {});
    clip.appendChild(boundary); defs.appendChild(clip); group.appendChild(defs);
    var ball = node('ellipse', { fill: '#fff' });
    group.appendChild(ball); overlay.appendChild(group); document.body.appendChild(overlay);
    var startPoint = new DOMPoint(-24, -24).matrixTransform(matrix.inverse());
    var start = performance.now(), landingAngle = Math.PI * .78;
    var landing = { x: 400 + Math.cos(landingAngle) * 350, y: 155 + Math.sin(landingAngle) * 111 };
    function finish() {
      overlay.remove(); busy = false; entry.removeAttribute('aria-busy');
      window.location.assign(target.url);
    }
    function frame(now) {
      var elapsed = (now - start) / 1000, p = positions.get(target.url);
      var m = map.getScreenCTM();
      if (!m) { finish(); return; }
      group.setAttribute('transform', 'matrix(' + [m.a, m.b, m.c, m.d, m.e, m.f].join(' ') + ')');
      var x, y, radius, flatten = .9;
      var targetAngle = p.core ? landingAngle : Math.atan2((p.y - 155) / p.radiusY, (p.x - 400) / p.radiusX);
      var perspective = p.core ? 1 : .78 + .36 * ((Math.sin(targetAngle) + 1) / 2);
      var holeRadius = p.r * perspective, ballRadius = holeRadius * .8;
      if (elapsed < .65) {
        var t = elapsed / .65;
        // Accelerating curved fall from outside the upper-left viewport.
        x = startPoint.x + (landing.x - startPoint.x) * t;
        y = startPoint.y + (landing.y - startPoint.y) * t * t;
        radius = 11 + (8 - 11) * t;
      } else if (elapsed < 3.4) {
        var u = (elapsed - .65) / 2.75;
        // Normalized reciprocal radius: broad first orbit, rapidly tightening finish.
        var contraction = (1 / (1 + 3 * u) - .25) / .75;
        var r = (p.core ? 0 : p.radiusX) + (350 - (p.core ? 0 : p.radiusX)) * contraction;
        var turns = Math.PI * 2 * (1.15 * u + 1.35 * u * u);
        var endTurns = Math.PI * 5;
        var correction = Math.atan2(Math.sin(targetAngle - landingAngle - endTurns), Math.cos(targetAngle - landingAngle - endTurns));
        var angle = landingAngle + turns + correction * smooth(u);
        x = 400 + Math.cos(angle) * r;
        y = 155 + Math.sin(angle) * r * (111 / 350);
        var depth = .78 + .36 * ((Math.sin(angle) + 1) / 2);
        radius = (8 * (1 - smooth(u)) + ballRadius * smooth(u)) * (depth * (1 - u) + u);
        flatten = .78 + .12 * ((Math.sin(angle) + 1) / 2);
      } else {
        var sink = Math.min(1, (elapsed - 3.4) / .6);
        radius = ballRadius;
        flatten = .78 + .12 * ((Math.sin(targetAngle) + 1) / 2);
        x = p.x; y = p.y + sink * (holeRadius * .48 + radius + 1);
        // The ellipse's lower/front arc occludes the ball as it descends.
        var rx = holeRadius, ry = holeRadius * .48;
        boundary.setAttribute('d', 'M ' + (p.x - rx) + ' ' + (p.y - 1000) + ' H ' + (p.x + rx) + ' V ' + p.y + ' A ' + rx + ' ' + ry + ' 0 0 1 ' + (p.x - rx) + ' ' + p.y + ' Z');
        ball.setAttribute('clip-path', 'url(#wishing-well-rim)');
      }
      ball.setAttribute('cx', x); ball.setAttribute('cy', y);
      ball.setAttribute('rx', radius); ball.setAttribute('ry', radius * flatten);
      if (elapsed >= 4) finish(); else requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  });
};
