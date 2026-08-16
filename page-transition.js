(function () {
  function init() {
    if (!document.body) { document.addEventListener('DOMContentLoaded', init); return; }
    var overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;inset:0;z-index:9999;pointer-events:none;opacity:0;background:#050506;transition:opacity 0.3s cubic-bezier(0.4,0,0.2,1);overflow:hidden;';
    var burst = document.createElement('div');
    burst.style.cssText = 'position:absolute;inset:0;background:radial-gradient(circle, rgba(255,130,60,0.95), rgba(255,60,20,0.4) 55%, transparent 100%);opacity:0;transition:opacity 0.25s ease;';
    var ring = document.createElement('div');
    ring.style.cssText = 'position:absolute;inset:0;border:0px solid rgba(255,120,50,0);transition:border-width 0.4s cubic-bezier(0.16,1,0.3,1), border-color 0.4s ease;';
    var grid = document.createElement('div');
    grid.style.cssText = 'position:absolute;inset:-10%;background-image:linear-gradient(rgba(255,122,61,0.08) 1px, transparent 1px),linear-gradient(90deg, rgba(255,122,61,0.08) 1px, transparent 1px);background-size:48px 48px;opacity:0;transition:opacity 0.3s ease;';
    overlay.appendChild(grid); overlay.appendChild(burst); overlay.appendChild(ring);
    document.body.appendChild(overlay);

    document.addEventListener('click', function (e) {
      var el = e.target.closest && e.target.closest('a');
      if (!el || !el.href) return;
      if (el.target === '_blank' || el.href.indexOf('#') !== -1 && el.href.split('#')[0] === window.location.href.split('#')[0]) return;
      if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey) return;
      var href = el.href;
      e.preventDefault();
      overlay.style.opacity = '1';
      grid.style.opacity = '1';
      burst.style.opacity = '1';
      ring.style.borderWidth = '30px';
      ring.style.borderColor = 'rgba(255,120,50,0.7)';
      if (window.urxAudio) window.urxAudio.playTransitionWhoosh();
      setTimeout(function () { window.location.href = href; }, 420);
    }, true);

    window.addEventListener('pageshow', function () {
      overlay.style.transition = 'none';
      overlay.style.opacity = '1';
      requestAnimationFrame(function () {
        overlay.style.transition = 'opacity 0.5s cubic-bezier(0.4,0,0.2,1)';
        overlay.style.opacity = '0';
      });
    });
  }
  init();
})();
