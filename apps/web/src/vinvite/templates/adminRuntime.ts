// ── Design+ runtime ──────────────────────────────────────────────────────────
// A template-agnostic script appended by RichRenderer to EVERY rich template's
// srcdoc. It renders the system-admin overlay layer (config.adminLayer):
//   • elements — photos/videos anchored into a section (or fixed), positioned
//     in %, rotated, animated; `cover` fills the whole section (video covers)
//   • styles   — per-section background / text color / CSS-variable overrides
//     (the editor writes the template's accent variables here)
// It keeps its own copy of the layer and re-renders on vinvite:config pushes,
// so live editing works without reloading the iframe. Plain ES5, no deps.

export const ADMIN_RUNTIME = `(function(){
  var LAYER = (window.__CONFIG__ && window.__CONFIG__.adminLayer) || {};
  var EDIT = window.__ADMIN_EDIT__ === true;

  /* Design+ editing: drag an overlay element to reposition it; the new percent
     position is applied live and reported to the host editor on release. */
  function makeDraggable(wrap, el){
    wrap.style.pointerEvents = 'auto';
    wrap.style.cursor = 'move';
    wrap.style.touchAction = 'none';
    wrap.style.outline = '1px dashed rgba(124,58,237,0.75)';
    wrap.style.outlineOffset = '2px';
    wrap.addEventListener('pointerdown', function(down){
      down.preventDefault();
      down.stopPropagation();
      var fixed = el.anchor === 'fixed' || !el.anchor;
      var anchor = fixed ? null : document.getElementById(el.anchor);
      var r = fixed
        ? { width: window.innerWidth, height: window.innerHeight }
        : anchor.getBoundingClientRect();
      var startX = down.clientX, startY = down.clientY;
      var origX = el.x != null ? el.x : 50, origY = el.y != null ? el.y : 50;
      function clamp(v){ return Math.max(0, Math.min(100, Math.round(v * 10) / 10)); }
      function apply(mv){
        el.x = clamp(origX + (mv.clientX - startX) / r.width * 100);
        el.y = clamp(origY + (mv.clientY - startY) / r.height * 100);
        wrap.style.left = el.x + '%';
        wrap.style.top = el.y + '%';
      }
      function onMove(mv){ apply(mv); }
      function onUp(mv){
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
        window.parent.postMessage({ type: 'vinvite:admin-move', id: el.id, x: el.x, y: el.y }, '*');
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

  function styleEl(){
    var el = document.getElementById('__vaStyles');
    if (!el) { el = document.createElement('style'); el.id = '__vaStyles'; document.head.appendChild(el); }
    return el;
  }

  function renderStyles(){
    var css = KEYFRAMES;
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
      if (EDIT && !el.cover) makeDraggable(wrap, el);
    }
  }

  function render(){ renderStyles(); renderElements(); }

  window.addEventListener('message', function(e){
    var d = e.data;
    if (d && typeof d === 'object' && d.type === 'vinvite:config' && d.config) {
      LAYER = d.config.adminLayer || {};
      render();
    }
  });

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', render);
  else render();
})();`;
