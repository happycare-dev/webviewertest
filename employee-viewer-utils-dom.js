/* Escaping, dates, row highlight, modal position & drag. */
(function (EV) {
  EV.esc = function (str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  };

  EV.escAttr = function (str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;')
      .replace(/</g, '&lt;');
  };

  EV.formatDate = function (dateStr) {
    if (!dateStr) return '';
    var parts = dateStr.split('/');
    if (parts.length !== 3) return dateStr;
    return parts[2] + '/' + parts[0] + '/' + parts[1];
  };

  EV.displayToFmDate = function (displayStr) {
    if (!displayStr || !String(displayStr).trim()) return '';
    var p = String(displayStr).trim().split('/');
    if (p.length !== 3) return String(displayStr).trim();
    return p[1] + '/' + p[2] + '/' + p[0];
  };

  EV.clearRowHighlight = function () {
    var tbody = document.getElementById('tbody');
    if (!tbody) return;
    tbody.querySelectorAll('tr.row-selected').forEach(function (tr) {
      tr.classList.remove('row-selected');
    });
  };

  EV.highlightRowForElement = function (el) {
    if (!el || !el.closest) return;
    var tr = el.closest('tr');
    if (!tr || tr.parentElement !== document.getElementById('tbody')) return;
    EV.clearRowHighlight();
    tr.classList.add('row-selected');
  };

  EV.centerModalBoxInViewport = function (overlay) {
    var box = overlay && overlay.querySelector('.modal-box');
    if (!box) return;
    var w = box.offsetWidth;
    var h = box.offsetHeight;
    if (w < 8 || h < 8) return;
    var vw = window.innerWidth;
    var vh = window.innerHeight;
    box.style.position = 'fixed';
    box.style.margin = '0';
    box.style.transform = 'none';
    var left = Math.round((vw - w) / 2);
    var top = Math.round((vh - h) / 2);
    left = Math.max(8, Math.min(left, vw - w - 8));
    top = Math.max(8, Math.min(top, vh - h - 8));
    box.style.left = left + 'px';
    box.style.top = top + 'px';
  };

  EV.showModalOverlay = function (overlay) {
    if (!overlay) return;
    overlay.style.display = 'flex';
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        EV.centerModalBoxInViewport(overlay);
      });
    });
  };

  EV.initDraggableModal = function (overlayId) {
    var overlay = document.getElementById(overlayId);
    if (!overlay) return;
    var box = overlay.querySelector('.modal-box');
    var handle = overlay.querySelector('.modal-drag-handle');
    if (!box || !handle) return;

    var moving = false;
    var startPointer = { x: 0, y: 0 };
    var startBox = { left: 0, top: 0 };

    function clampMove(left, top) {
      var maxL = Math.max(8, window.innerWidth - box.offsetWidth - 8);
      var maxT = Math.max(8, window.innerHeight - box.offsetHeight - 8);
      return {
        left: Math.max(8, Math.min(left, maxL)),
        top: Math.max(8, Math.min(top, maxT))
      };
    }

    function onMove(clientX, clientY) {
      if (!moving) return;
      var dx = clientX - startPointer.x;
      var dy = clientY - startPointer.y;
      var next = clampMove(startBox.left + dx, startBox.top + dy);
      box.style.left = next.left + 'px';
      box.style.top = next.top + 'px';
    }

    function endDrag() {
      moving = false;
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      document.removeEventListener('touchmove', onTouchMove, true);
      document.removeEventListener('touchend', onTouchEnd, true);
      document.removeEventListener('touchcancel', onTouchEnd, true);
    }

    function onMouseMove(e) {
      onMove(e.clientX, e.clientY);
    }

    function onMouseUp() {
      endDrag();
    }

    function onTouchMove(e) {
      if (!moving || !e.touches[0]) return;
      var t = e.touches[0];
      onMove(t.clientX, t.clientY);
      e.preventDefault();
    }

    function onTouchEnd() {
      endDrag();
    }

    function beginDrag(clientX, clientY) {
      moving = true;
      startPointer.x = clientX;
      startPointer.y = clientY;
      var r = box.getBoundingClientRect();
      startBox.left = r.left;
      startBox.top = r.top;
      box.style.position = 'fixed';
      box.style.left = r.left + 'px';
      box.style.top = r.top + 'px';
      box.style.margin = '0';
      box.style.transform = 'none';
    }

    handle.addEventListener('mousedown', function (e) {
      if (e.button !== 0) return;
      beginDrag(e.clientX, e.clientY);
      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
      e.preventDefault();
    });

    handle.addEventListener('touchstart', function (e) {
      if (!e.touches[0]) return;
      var t = e.touches[0];
      beginDrag(t.clientX, t.clientY);
      document.addEventListener('touchmove', onTouchMove, { capture: true, passive: false });
      document.addEventListener('touchend', onTouchEnd, { capture: true });
      document.addEventListener('touchcancel', onTouchEnd, { capture: true });
      e.preventDefault();
    }, { passive: false });
  };
})(window.EV);
