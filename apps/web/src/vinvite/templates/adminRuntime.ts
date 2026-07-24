// ── Design+ runtime ──────────────────────────────────────────────────────────
// A template-agnostic script appended by RichRenderer to EVERY rich template's
// srcdoc. It renders the system-admin overlay layer (config.adminLayer):
//   • elements  — photos/videos anchored into a section (or fixed), positioned
//     in %, rotated, animated; `cover` fills the whole section (video covers).
//     An element with a motion `path` travels base → kf2 → kf3 … via a
//     generated CSS keyframe animation (loop / alternate / once).
//   • styles    — per-section background / text color / CSS-variable overrides
//     (the editor writes the template's accent variables here)
//   • particles — full-page falling particles on a fixed canvas: preset shapes
//     or a custom uploaded image; `scroll` mode only falls while scrolling.
//   • trail     — particles emitted under the guest's cursor/finger as it
//     moves: the same preset shapes or a custom image, fading out quickly.
// It keeps its own copy of the layer and re-renders on vinvite:config pushes,
// so live editing works without reloading the iframe. Plain ES5, no deps.
//
// Edit mode (window.__ADMIN_EDIT__): elements are draggable; motion-path stops
// render as numbered draggable markers (the element itself is stop №1) and the
// path animation is paused unless the host toggles play (adminPlay).

export const ADMIN_RUNTIME = `(function(){
  var LAYER = (window.__CONFIG__ && window.__CONFIG__.adminLayer) || {};
  var EDIT = window.__ADMIN_EDIT__ === true;
  var PLAY = window.__ADMIN_PLAY__ === true;

  /* Design+ editing: drag a node to reposition it (the element itself, or one
     of its numbered motion-path markers when kf is set); the new percent
     position is applied live and reported to the host editor on release. */
  function makeDraggable(wrap, el, kf){
    wrap.style.pointerEvents = 'auto';
    wrap.style.cursor = 'move';
    wrap.style.touchAction = 'none';
    wrap.addEventListener('pointerdown', function(down){
      down.preventDefault();
      down.stopPropagation();
      var target = kf == null ? el : el.path[kf];
      var fixed = el.anchor === 'fixed' || !el.anchor;
      var anchor = fixed ? null : document.getElementById(el.anchor);
      var r = fixed
        ? { width: window.innerWidth, height: window.innerHeight }
        : anchor.getBoundingClientRect();
      var startX = down.clientX, startY = down.clientY;
      var origX = target.x != null ? target.x : 50, origY = target.y != null ? target.y : 50;
      function clamp(v){ return Math.max(0, Math.min(100, Math.round(v * 10) / 10)); }
      function apply(mv){
        target.x = clamp(origX + (mv.clientX - startX) / r.width * 100);
        target.y = clamp(origY + (mv.clientY - startY) / r.height * 100);
        wrap.style.left = target.x + '%';
        wrap.style.top = target.y + '%';
      }
      function onMove(mv){ apply(mv); }
      function onUp(mv){
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
        var msg = { type: 'vinvite:admin-move', id: el.id, x: target.x, y: target.y };
        if (kf != null) msg.kf = kf;
        window.parent.postMessage(msg, '*');
      }
      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp);
    });
  }

  var KEYFRAMES =
    '@keyframes vaFloat{from{transform:translateY(0)}to{transform:translateY(-12px)}}' +
    '@keyframes vaPulse{0%,100%{transform:scale(1)}50%{transform:scale(1.05)}}' +
    '@keyframes vaSpin{from{transform:rotate(0)}to{transform:rotate(360deg)}}' +
    '@keyframes vaFadeIn{from{opacity:0}to{opacity:1}}' +
    '@keyframes vaSlideUp{from{opacity:0;transform:translateY(40px)}to{opacity:1;transform:translateY(0)}}' +
    '@keyframes vaZoom{from{opacity:0;transform:scale(.8)}to{opacity:1;transform:scale(1)}}';

  /* Motion path: one @keyframes per element, animating the wrapper's left/top
     (and rotate/scale/opacity per stop). Stop 0 is the element's base pose. */
  function pathCss(el){
    var pts = el.path;
    if (!pts || !pts.length) return '';
    var stops = [{ x: el.x != null ? el.x : 50, y: el.y != null ? el.y : 50 }].concat(pts);
    var css = '@keyframes vaPath_' + el.id + '{';
    for (var i = 0; i < stops.length; i++) {
      var p = stops[i];
      var pct = Math.round(i / (stops.length - 1) * 1000) / 10;
      var rot = p.rotate != null ? p.rotate : (el.rotate || 0);
      var sc = p.scale != null ? p.scale : 1;
      css += pct + '%{left:' + (p.x != null ? p.x : 50) + '%;top:' + (p.y != null ? p.y : 50) + '%;'
        + 'transform:translate(-50%,-50%) rotate(' + rot + 'deg) scale(' + sc + ')'
        + (p.opacity != null ? ';opacity:' + p.opacity : '') + '}';
    }
    return css + '}';
  }

  function styleEl(){
    var el = document.getElementById('__vaStyles');
    if (!el) { el = document.createElement('style'); el.id = '__vaStyles'; document.head.appendChild(el); }
    return el;
  }

  function renderStyles(){
    var css = KEYFRAMES;
    var els = LAYER.elements || [];
    for (var e = 0; e < els.length; e++) { if (els[e]) css += pathCss(els[e]); }
    var styles = LAYER.styles || [];
    for (var i = 0; i < styles.length; i++) {
      var s = styles[i];
      if (!s || !s.section) continue;
      var sel = '#' + s.section;
      var rules = [];
      if (s.background) rules.push('background:' + s.background + ' !important');
      if (s.text) rules.push('color:' + s.text + ' !important');
      if (s.vars) for (var k in s.vars) { if (s.vars[k]) rules.push(k + ':' + s.vars[k]); }
      if (rules.length) css += sel + '{' + rules.join(';') + '}';
    }
    styleEl().textContent = css;
  }

  /* Numbered draggable marker for one motion-path stop (edit mode only). */
  function kfMarker(anchor, el, i, fixed){
    var g = document.createElement('div');
    g.setAttribute('data-va-el', '');
    var gs = g.style;
    gs.position = fixed ? 'fixed' : 'absolute';
    gs.left = (el.path[i].x != null ? el.path[i].x : 50) + '%';
    gs.top = (el.path[i].y != null ? el.path[i].y : 50) + '%';
    gs.transform = 'translate(-50%,-50%)';
    gs.width = '26px'; gs.height = '26px'; gs.borderRadius = '50%';
    gs.border = '2px dashed rgba(167,139,250,0.95)';
    gs.background = 'rgba(124,58,237,0.35)';
    gs.color = '#fff'; gs.fontSize = '12px'; gs.fontWeight = '700';
    gs.display = 'flex'; gs.alignItems = 'center'; gs.justifyContent = 'center';
    gs.zIndex = '9999'; gs.userSelect = 'none';
    gs.boxShadow = '0 2px 8px rgba(0,0,0,0.4)';
    g.textContent = String(i + 2);
    makeDraggable(g, el, i);
    anchor.appendChild(g);
  }

  function renderElements(){
    var old = document.querySelectorAll('[data-va-el]');
    for (var i = old.length - 1; i >= 0; i--) old[i].parentNode.removeChild(old[i]);

    var els = LAYER.elements || [];
    for (var j = 0; j < els.length; j++) {
      var el = els[j];
      if (!el || !el.src) continue;
      var fixed = el.anchor === 'fixed' || !el.anchor;
      var anchor = fixed ? document.body : document.getElementById(el.anchor);
      if (!anchor) continue;
      if (!fixed && !anchor.style.position) anchor.style.position = 'relative';

      /* wrapper owns placement; inner node owns look + animation so animated
         transforms never fight the centering transform */
      var wrap = document.createElement('div');
      wrap.setAttribute('data-va-el', '');
      var ws = wrap.style;
      ws.pointerEvents = 'none';
      if (el.cover) {
        ws.position = 'absolute'; ws.left = '0'; ws.top = '0'; ws.right = '0'; ws.bottom = '0';
        ws.overflow = 'hidden';
        ws.zIndex = el.z != null ? String(el.z) : '0';
      } else {
        ws.position = fixed ? 'fixed' : 'absolute';
        ws.left = (el.x != null ? el.x : 50) + '%';
        ws.top = (el.y != null ? el.y : 50) + '%';
        ws.width = (el.w != null ? el.w : 30) + '%';
        ws.transform = 'translate(-50%,-50%) rotate(' + (el.rotate || 0) + 'deg)';
        ws.zIndex = el.z != null ? String(el.z) : '5';
        /* motion path plays for guests; in edit mode only when toggled */
        if (el.path && el.path.length && (!EDIT || PLAY)) {
          var mode = el.pathMode || 'loop';
          ws.animation = 'vaPath_' + el.id + ' ' + (el.pathDur != null ? el.pathDur : 6) + 's '
            + (el.pathEase || 'ease-in-out') + ' '
            + (mode === 'once' ? '1 forwards' : mode === 'alternate' ? 'infinite alternate' : 'infinite');
        }
      }

      var node;
      if (el.type === 'video') {
        node = document.createElement('video');
        node.src = el.src;
        node.muted = true; node.loop = true; node.autoplay = true;
        node.setAttribute('muted', ''); node.setAttribute('playsinline', '');
        try { var p = node.play(); if (p && p.catch) p.catch(function(){}); } catch (e) {}
      } else {
        node = document.createElement('img');
        node.src = el.src;
        node.alt = '';
      }
      var ns = node.style;
      ns.display = 'block';
      ns.width = '100%';
      if (el.cover) { ns.height = '100%'; ns.objectFit = 'cover'; }
      if (el.radius != null) ns.borderRadius = el.radius + 'px';
      if (el.opacity != null) ns.opacity = String(el.opacity);

      var anim = el.anim && el.anim !== 'none' ? el.anim : null;
      if (anim) {
        var dur = el.animDur != null ? el.animDur : 1.6;
        var map = {
          'float': 'vaFloat 5s ease-in-out infinite alternate',
          'pulse': 'vaPulse 2.6s ease-in-out infinite',
          'spin': 'vaSpin 14s linear infinite',
          'fade-in': 'vaFadeIn ' + dur + 's ease both',
          'slide-up': 'vaSlideUp ' + dur + 's cubic-bezier(.16,1,.3,1) both',
          'zoom': 'vaZoom ' + dur + 's cubic-bezier(.16,1,.3,1) both'
        };
        if (map[anim]) {
          ns.animation = map[anim];
          if (el.animDelay) ns.animationDelay = el.animDelay + 's';
        }
      }

      wrap.appendChild(node);
      anchor.appendChild(wrap);
      if (EDIT && !el.cover) {
        wrap.style.outline = '1px dashed rgba(124,58,237,0.75)';
        wrap.style.outlineOffset = '2px';
        makeDraggable(wrap, el);
        if (el.path) for (var k = 0; k < el.path.length; k++) kfMarker(anchor, el, k, fixed);
      }
    }
  }

  /* ── Falling particles ──────────────────────────────────────────────────── */
  var PT = { key: '', canvas: null, ctx: null, items: [], img: null, raf: 0, cfg: null, boost: 0 };
  /* ── Cursor/finger trail ────────────────────────────────────────────────── */
  var TR = { key: '', canvas: null, ctx: null, items: [], img: null, raf: 0, cfg: null };

  var PALETTES = {
    confetti: ['#f43f5e','#f59e0b','#10b981','#3b82f6','#a855f7','#facc15'],
    snow: ['rgba(255,255,255,0.9)','rgba(255,255,255,0.7)','rgba(230,240,255,0.8)'],
    hearts: ['#fb7185','#f43f5e','#fda4af'],
    sparkles: ['#e8c76a','#f5e2a8','#d4af37'],
    petals: ['#fbcfe8','#f9a8d4','#fda4af']
  };

  function onScrollBoost(){ PT.boost = 1; }
  window.addEventListener('scroll', onScrollBoost, true);
  window.addEventListener('wheel', onScrollBoost, { passive: true });
  window.addEventListener('touchmove', onScrollBoost, { passive: true });

  function stopParticles(){
    if (PT.raf) { cancelAnimationFrame(PT.raf); PT.raf = 0; }
    if (PT.canvas && PT.canvas.parentNode) PT.canvas.parentNode.removeChild(PT.canvas);
    PT.canvas = null; PT.ctx = null; PT.items = []; PT.cfg = null; PT.img = null;
  }

  function resizeCanvas(){
    if (PT.canvas) { PT.canvas.width = window.innerWidth; PT.canvas.height = window.innerHeight; }
    if (TR.canvas) { TR.canvas.width = window.innerWidth; TR.canvas.height = window.innerHeight; }
  }
  window.addEventListener('resize', resizeCanvas);

  function spawn(cfg, w, h, top){
    var size = (cfg.size != null ? cfg.size : 14) * (0.6 + Math.random() * 0.8);
    return {
      x: Math.random() * w,
      y: top ? -size - Math.random() * h * 0.3 : Math.random() * h,
      s: size,
      vy: (26 + Math.random() * 30) * (cfg.speed != null ? cfg.speed : 1),
      rot: Math.random() * Math.PI * 2,
      vr: (Math.random() - 0.5) * 2.2,
      ph: Math.random() * Math.PI * 2,
      sway: 8 + Math.random() * 16,
      c: Math.floor(Math.random() * 6)
    };
  }

  function heartPath(ctx, s){
    ctx.beginPath();
    ctx.moveTo(0, s * 0.3);
    ctx.bezierCurveTo(s * 0.5, -s * 0.3, s * 1.1, s * 0.3, 0, s);
    ctx.bezierCurveTo(-s * 1.1, s * 0.3, -s * 0.5, -s * 0.3, 0, s * 0.3);
    ctx.closePath();
  }
  function starPath(ctx, s){
    ctx.beginPath();
    ctx.moveTo(0, -s);
    ctx.quadraticCurveTo(s * 0.14, -s * 0.14, s, 0);
    ctx.quadraticCurveTo(s * 0.14, s * 0.14, 0, s);
    ctx.quadraticCurveTo(-s * 0.14, s * 0.14, -s, 0);
    ctx.quadraticCurveTo(-s * 0.14, -s * 0.14, 0, -s);
    ctx.closePath();
  }

  /* Shared shape painter for both engines. alpha scales the whole particle
     (the trail fades items out with their remaining life); override forces a
     single colour (the trail's colour picker) instead of the preset palette. */
  function drawShape(ctx, preset, img, it, alpha, override){
    var pal = PALETTES[preset] || PALETTES.confetti;
    var color = override || pal[it.c % pal.length];
    ctx.save();
    ctx.translate(it.x, it.y);
    ctx.globalAlpha = alpha != null ? alpha : 1;
    if (preset === 'custom') {
      if (img && img.complete && img.naturalWidth) {
        ctx.rotate(it.rot);
        var ratio = img.naturalHeight / img.naturalWidth || 1;
        ctx.drawImage(img, -it.s / 2, -it.s * ratio / 2, it.s, it.s * ratio);
      }
    } else if (preset === 'snow') {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(0, 0, it.s * 0.32, 0, Math.PI * 2);
      ctx.fill();
    } else if (preset === 'hearts') {
      ctx.rotate(Math.sin(it.ph) * 0.4);
      ctx.fillStyle = color;
      heartPath(ctx, it.s * 0.5);
      ctx.fill();
    } else if (preset === 'sparkles') {
      ctx.rotate(it.rot);
      ctx.globalAlpha = (alpha != null ? alpha : 1) * (0.55 + Math.sin(it.ph * 3) * 0.45);
      ctx.fillStyle = color;
      starPath(ctx, it.s * 0.55);
      ctx.fill();
    } else if (preset === 'petals') {
      ctx.rotate(it.rot);
      ctx.fillStyle = color;
      ctx.beginPath();
      if (ctx.ellipse) ctx.ellipse(0, 0, it.s * 0.5, it.s * 0.28, 0, 0, Math.PI * 2);
      else ctx.arc(0, 0, it.s * 0.4, 0, Math.PI * 2);
      ctx.fill();
    } else { /* confetti */
      ctx.rotate(it.rot);
      ctx.fillStyle = color;
      ctx.fillRect(-it.s * 0.32, -it.s * 0.22, it.s * 0.64, it.s * 0.44);
    }
    ctx.restore();
  }

  var lastT = 0;
  function tick(now){
    PT.raf = requestAnimationFrame(tick);
    if (!PT.ctx || !PT.cfg) return;
    var dt = lastT ? Math.min((now - lastT) / 1000, 0.05) : 0.016;
    lastT = now;
    var cfg = PT.cfg;
    var w = PT.canvas.width, h = PT.canvas.height;
    PT.ctx.clearRect(0, 0, w, h);
    /* scroll mode: fall only while the guest scrolls (velocity eases out) */
    var vel = cfg.mode === 'scroll' ? PT.boost : 1;
    PT.boost *= 0.95;
    for (var i = 0; i < PT.items.length; i++) {
      var it = PT.items[i];
      it.y += it.vy * vel * dt;
      it.ph += dt * 1.6;
      it.x += Math.sin(it.ph) * it.sway * dt;
      it.rot += it.vr * dt;
      if (it.y > h + it.s) PT.items[i] = spawn(cfg, w, h, true);
      else if (it.x < -it.s * 2) it.x = w + it.s;
      else if (it.x > w + it.s * 2) it.x = -it.s;
      drawShape(PT.ctx, cfg.preset, PT.img, it, 1);
    }
  }

  function initParticles(){
    var p = LAYER.particles;
    var cfg = p && p.preset && p.preset !== 'none' ? p : null;
    var key = cfg ? JSON.stringify(cfg) : '';
    if (key === PT.key) return;
    PT.key = key;
    stopParticles();
    if (!cfg) return;
    var c = document.createElement('canvas');
    c.setAttribute('data-va-particles', '');
    c.style.cssText = 'position:fixed;left:0;top:0;width:100%;height:100%;pointer-events:none;z-index:9990;';
    if (typeof c.getContext !== 'function' || typeof requestAnimationFrame !== 'function') return;
    document.body.appendChild(c);
    PT.canvas = c;
    PT.ctx = c.getContext('2d');
    PT.cfg = cfg;
    if (cfg.preset === 'custom' && cfg.src) { PT.img = new Image(); PT.img.src = cfg.src; }
    resizeCanvas();
    PT.items = [];
    var n = Math.max(5, Math.min(120, cfg.count != null ? cfg.count : 40));
    for (var i = 0; i < n; i++) PT.items.push(spawn(cfg, c.width, c.height, cfg.mode === 'scroll'));
    lastT = 0;
    PT.raf = requestAnimationFrame(tick);
  }

  /* ── Trail engine: emit on pointer/touch move, items fade out fast ──────── */
  function emitTrail(x, y){
    if (!TR.cfg) return;
    var cfg = TR.cfg;
    var n = Math.max(1, Math.min(6, cfg.density != null ? cfg.density : 2));
    for (var i = 0; i < n; i++) {
      TR.items.push({
        x: x + (Math.random() - 0.5) * 14,
        y: y + (Math.random() - 0.5) * 14,
        s: (cfg.size != null ? cfg.size : 14) * (0.5 + Math.random() * 0.7),
        vx: (Math.random() - 0.5) * 60,
        vy: -14 + Math.random() * 44,
        life: 1,
        decay: 1.1 + Math.random() * 0.9,
        rot: Math.random() * Math.PI * 2,
        vr: (Math.random() - 0.5) * 6,
        ph: Math.random() * Math.PI * 2,
        c: Math.floor(Math.random() * 6)
      });
    }
    if (TR.items.length > 300) TR.items.splice(0, TR.items.length - 300);
  }
  window.addEventListener('pointermove', function(e){ emitTrail(e.clientX, e.clientY); }, { passive: true });
  window.addEventListener('touchmove', function(e){
    var t = e.touches && e.touches[0];
    if (t) emitTrail(t.clientX, t.clientY);
  }, { passive: true });

  var trailT = 0;
  function tickTrail(now){
    TR.raf = requestAnimationFrame(tickTrail);
    if (!TR.ctx || !TR.cfg) return;
    var dt = trailT ? Math.min((now - trailT) / 1000, 0.05) : 0.016;
    trailT = now;
    TR.ctx.clearRect(0, 0, TR.canvas.width, TR.canvas.height);
    for (var i = TR.items.length - 1; i >= 0; i--) {
      var it = TR.items[i];
      it.life -= it.decay * dt;
      if (it.life <= 0) { TR.items.splice(i, 1); continue; }
      it.x += it.vx * dt;
      it.y += it.vy * dt;
      it.vy += 70 * dt; /* gentle gravity */
      it.rot += it.vr * dt;
      it.ph += dt * 2;
      drawShape(TR.ctx, TR.cfg.preset, TR.img, it, Math.min(1, it.life), TR.cfg.color);
    }
  }

  function stopTrail(){
    if (TR.raf) { cancelAnimationFrame(TR.raf); TR.raf = 0; }
    if (TR.canvas && TR.canvas.parentNode) TR.canvas.parentNode.removeChild(TR.canvas);
    TR.canvas = null; TR.ctx = null; TR.items = []; TR.cfg = null; TR.img = null;
  }

  function initTrail(){
    var tr = LAYER.trail;
    var cfg = tr && tr.preset && tr.preset !== 'none' ? tr : null;
    var key = cfg ? JSON.stringify(cfg) : '';
    if (key === TR.key) return;
    TR.key = key;
    stopTrail();
    if (!cfg) return;
    var c = document.createElement('canvas');
    c.setAttribute('data-va-trail', '');
    c.style.cssText = 'position:fixed;left:0;top:0;width:100%;height:100%;pointer-events:none;z-index:9991;';
    if (typeof c.getContext !== 'function' || typeof requestAnimationFrame !== 'function') return;
    document.body.appendChild(c);
    TR.canvas = c;
    TR.ctx = c.getContext('2d');
    TR.cfg = cfg;
    if (cfg.preset === 'custom' && cfg.src) { TR.img = new Image(); TR.img.src = cfg.src; }
    c.width = window.innerWidth;
    c.height = window.innerHeight;
    trailT = 0;
    TR.raf = requestAnimationFrame(tickTrail);
  }

  function render(){ renderStyles(); renderElements(); initParticles(); initTrail(); }

  window.addEventListener('message', function(e){
    var d = e.data;
    if (d && typeof d === 'object' && d.type === 'vinvite:config' && d.config) {
      LAYER = d.config.adminLayer || {};
      if (d.adminPlay != null) PLAY = d.adminPlay === true;
      render();
    }
  });

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', render);
  else render();
})();`;
