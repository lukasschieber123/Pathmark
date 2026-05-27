import { currentTrip, updatePin, genId } from './state.js';
import { escapeHtml, escapeAttr } from './modal.js';
import { SANDBOX_W, SANDBOX_H } from './constants.js';

const viewEl = document.getElementById('timeline-view');
let open = false;
let activeIdx = 0;
let stripEl = null;
let activeTool = 'cursor';

let panX = 0, panY = 0, zoom = 1;
let lastRenderedIdx = -1;

let selectedEl = null, selectedPin = null, selectedItem = null;

// Draw state
let drawColor = '#ffffff';
let drawWidth = 3;
let drawStyle = 'solid';
let drawMode = 'pen';       // 'pen' | 'eraser'
let drawSubPanel = null;    // 'color' | 'size' | 'style' | null
let currentPoints = [];
let currentPathEl = null;

const DRAW_COLORS = ['#ffffff', '#1a1a2e', '#f59133', '#ef476f', '#4895ef', '#06d6a0', '#ffd166', '#c77dff', '#ff87ab'];

function selectItem(el, pin, item) {
  if (selectedEl) selectedEl.classList.remove('tl-selected');
  selectedEl = el; selectedPin = pin; selectedItem = item;
  el.classList.add('tl-selected');
}

function deselectAll() {
  if (selectedEl) selectedEl.classList.remove('tl-selected');
  selectedEl = null; selectedPin = null; selectedItem = null;
}

export function isTimelineOpen() { return open; }

function handleArrowKey(e) {
  if (!stripEl) return;
  if (e.key === 'ArrowLeft')  { e.preventDefault(); stripEl.scrollBy({ left: -140, behavior: 'smooth' }); }
  if (e.key === 'ArrowRight') { e.preventDefault(); stripEl.scrollBy({ left:  140, behavior: 'smooth' }); }
}

export function openTimeline() {
  open = true;
  viewEl.classList.add('open');
  document.addEventListener('keydown', handleArrowKey);
  render();
}

export function closeTimeline() {
  open = false;
  viewEl.classList.remove('open');
  document.removeEventListener('keydown', handleArrowKey);
  deselectAll();
}

export function renderTimeline() {
  if (open) render();
}

function formatDate(str) {
  if (!str) return '';
  const [y, m, d] = str.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function applyTransform(canvasEl) {
  canvasEl.style.transform = `translate(${panX}px, ${panY}px) scale(${zoom})`;
}

function fitToView(sandboxEl) {
  const vw = sandboxEl.offsetWidth;
  const vh = sandboxEl.offsetHeight;
  zoom = Math.min(vw / SANDBOX_W, vh / SANDBOX_H) * 0.92;
  panX = (vw - SANDBOX_W * zoom) / 2;
  panY = (vh - SANDBOX_H * zoom) / 2;
}

function setCursor(sandboxEl) {
  if (activeTool === 'note') { sandboxEl.style.cursor = 'crosshair'; return; }
  if (activeTool === 'pen')  { sandboxEl.style.cursor = drawMode === 'eraser' ? 'cell' : 'crosshair'; return; }
  sandboxEl.style.cursor = 'grab';
}

function clampPan(sandboxEl) {
  const margin = 100;
  const vw = sandboxEl.offsetWidth;
  const vh = sandboxEl.offsetHeight;
  panX = Math.min(vw - margin, Math.max(margin - SANDBOX_W * zoom, panX));
  panY = Math.min(vh - margin, Math.max(margin - SANDBOX_H * zoom, panY));
}

function clientToCanvas(sandboxEl, clientX, clientY) {
  const rect = sandboxEl.getBoundingClientRect();
  return {
    x: (clientX - rect.left - panX) / zoom,
    y: (clientY - rect.top  - panY) / zoom,
  };
}

function pointsToD(pts) {
  if (pts.length === 0) return '';
  if (pts.length < 3) return `M ${pts[0][0]} ${pts[0][1]} L ${pts[pts.length - 1][0]} ${pts[pts.length - 1][1]}`;
  let d = `M ${pts[0][0]} ${pts[0][1]}`;
  for (let i = 1; i < pts.length - 1; i++) {
    const mx = (pts[i][0] + pts[i + 1][0]) / 2;
    const my = (pts[i][1] + pts[i + 1][1]) / 2;
    d += ` Q ${pts[i][0]} ${pts[i][1]} ${mx} ${my}`;
  }
  d += ` L ${pts[pts.length - 1][0]} ${pts[pts.length - 1][1]}`;
  return d;
}

function distToSegment(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return Math.hypot(px - ax, py - ay);
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lenSq));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

function isNearPath(points, x, y, threshold) {
  for (let i = 0; i < points.length - 1; i++) {
    if (distToSegment(x, y, points[i][0], points[i][1], points[i + 1][0], points[i + 1][1]) < threshold) return true;
  }
  if (points.length > 0) {
    const last = points[points.length - 1];
    if (Math.hypot(last[0] - x, last[1] - y) < threshold) return true;
  }
  return false;
}

// --- Draw sub-panel helpers ---

function colorDotStyle(c) {
  const border = (c === '#ffffff' || c === '#1a1a2e') ? ' box-shadow: inset 0 0 0 1.5px rgba(180,200,230,0.4);' : '';
  return `background:${c};${border}`;
}

function buildStripHTML() {
  const wSvg = `<svg width="18" height="14" viewBox="0 0 18 14"><line x1="1" y1="4" x2="17" y2="4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><line x1="1" y1="7.5" x2="17" y2="7.5" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/><line x1="1" y1="11" x2="17" y2="11" stroke="currentColor" stroke-width="4" stroke-linecap="round"/></svg>`;
  const sSvg = `<svg width="18" height="14" viewBox="0 0 18 14"><line x1="1" y1="4" x2="17" y2="4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><line x1="1" y1="8" x2="17" y2="8" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-dasharray="5 3"/><line x1="1" y1="12" x2="17" y2="12" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-dasharray="1 3"/></svg>`;
  const eSvg = `<svg width="16" height="14" viewBox="0 0 16 14" fill="none"><rect x="1.5" y="2" width="13" height="8" rx="1.5" stroke="currentColor" stroke-width="1.3"/><line x1="6" y1="2" x2="6" y2="10" stroke="currentColor" stroke-width="1" stroke-opacity="0.5"/><line x1="1.5" y1="12" x2="14.5" y2="12" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>`;
  return (
    `<button class="tl-dp-tool${drawSubPanel === 'color' ? ' active' : ''}" data-sub="color" title="Color">` +
      `<div class="tl-dp-color-dot" style="${colorDotStyle(drawColor)}"></div>` +
    '</button>' +
    `<button class="tl-dp-tool${drawSubPanel === 'size' ? ' active' : ''}" data-sub="size" title="Size">${wSvg}</button>` +
    `<button class="tl-dp-tool${drawSubPanel === 'style' ? ' active' : ''}" data-sub="style" title="Line style">${sSvg}</button>` +
    `<button class="tl-dp-tool${drawMode === 'eraser' ? ' active' : ''}" data-sub="eraser" title="Eraser">${eSvg}</button>`
  );
}

function buildSubHTML(type) {
  if (type === 'color') {
    return DRAW_COLORS.map(c =>
      `<div class="tl-dp-swatch${c === drawColor ? ' active' : ''}" data-color="${c}" style="${colorDotStyle(c)}"></div>`
    ).join('');
  }
  if (type === 'size') {
    return [2, 4, 8].map(w =>
      `<button class="tl-dp-opt${drawWidth === w ? ' active' : ''}" data-width="${w}">` +
        `<svg width="36" height="14" viewBox="0 0 36 14"><line x1="3" y1="7" x2="33" y2="7" stroke="currentColor" stroke-width="${w}" stroke-linecap="round"/></svg>` +
      '</button>'
    ).join('');
  }
  if (type === 'style') {
    const items = [
      { v: 'solid',  da: '' },
      { v: 'dashed', da: ' stroke-dasharray="8 4"' },
      { v: 'dotted', da: ' stroke-dasharray="2 5" stroke-linecap="round"' },
    ];
    return items.map(s =>
      `<button class="tl-dp-opt${drawStyle === s.v ? ' active' : ''}" data-style="${s.v}">` +
        `<svg width="36" height="12" viewBox="0 0 36 12"><line x1="3" y1="6" x2="33" y2="6" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"${s.da}/></svg>` +
      '</button>'
    ).join('');
  }
  return '';
}

function openSub(type) {
  drawSubPanel = type;
  const subEl = viewEl.querySelector('.tl-draw-sub');
  if (!subEl) return;
  subEl.innerHTML = buildSubHTML(type);
  subEl.classList.add('open');

  if (type === 'color') {
    subEl.querySelectorAll('.tl-dp-swatch').forEach(el => {
      el.addEventListener('click', () => {
        drawColor = el.dataset.color;
        subEl.querySelectorAll('.tl-dp-swatch').forEach(e => e.classList.toggle('active', e.dataset.color === drawColor));
        const dot = viewEl.querySelector('.tl-draw-strip .tl-dp-color-dot');
        if (dot) dot.setAttribute('style', colorDotStyle(drawColor));
      });
    });
  } else if (type === 'size') {
    subEl.querySelectorAll('.tl-dp-opt').forEach(el => {
      el.addEventListener('click', () => {
        drawWidth = +el.dataset.width;
        subEl.querySelectorAll('.tl-dp-opt').forEach(e => e.classList.toggle('active', +e.dataset.width === drawWidth));
      });
    });
  } else if (type === 'style') {
    subEl.querySelectorAll('.tl-dp-opt').forEach(el => {
      el.addEventListener('click', () => {
        drawStyle = el.dataset.style;
        subEl.querySelectorAll('.tl-dp-opt').forEach(e => e.classList.toggle('active', e.dataset.style === drawStyle));
      });
    });
  }
}

function closeSub() {
  drawSubPanel = null;
  const subEl = viewEl.querySelector('.tl-draw-sub');
  if (subEl) { subEl.classList.remove('open'); subEl.innerHTML = ''; }
  viewEl.querySelectorAll('.tl-dp-tool[data-sub="color"], .tl-dp-tool[data-sub="size"], .tl-dp-tool[data-sub="style"]')
    .forEach(b => b.classList.remove('active'));
}

// --- Render ---

function render() {
  viewEl.dispatchEvent(new Event('tl-cleanup'));
  const trip = currentTrip();
  const tripName = trip ? escapeHtml(trip.name) : 'No trip';
  const pins = trip ? trip.pins : [];

  if (activeIdx >= pins.length) activeIdx = 0;
  const activePin = pins[activeIdx] || null;

  if (activeIdx !== lastRenderedIdx) {
    lastRenderedIdx = activeIdx;
    panX = 0; panY = 0; zoom = 1;
  }

  let trackHTML = '';
  if (pins.length === 0) {
    trackHTML = '<div class="tl-empty">No stops yet — add pins on the globe.</div>';
  } else {
    pins.forEach((pin, i) => {
      const name = pin.name ? escapeHtml(pin.name) : 'Stop ' + (i + 1);
      const date = formatDate(pin.dateStart);
      const isActive = i === activeIdx;
      trackHTML +=
        '<div class="tl-stop' + (isActive ? ' tl-stop-active' : '') + '" data-idx="' + i + '">' +
          '<span class="tl-stop-name">' + name + '</span>' +
          '<div class="tl-dot"></div>' +
          '<span class="tl-stop-date">' + (date || ' ') + '</span>' +
        '</div>';
      if (i < pins.length - 1) trackHTML += '<div class="tl-connector"></div>';
    });
  }

  viewEl.innerHTML =
    '<div class="tl-header">' +
      '<button class="tl-close" title="Back to globe">' +
        '<svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z" fill="currentColor"/></svg>' +
      '</button>' +
      '<span class="tl-title">' + tripName + ' · Timeline</span>' +
      '<div class="tl-key-hint">' +
        '<button class="tl-key" id="tl-scroll-left">&#8592;</button>' +
        '<button class="tl-key" id="tl-scroll-right">&#8594;</button>' +
      '</div>' +
    '</div>' +
    '<div class="tl-strip"><div class="tl-track">' + trackHTML + '</div></div>' +
    '<div class="tl-body">' +
      '<div class="tl-toolbar">' +
        '<button class="tl-tool' + (activeTool === 'cursor' ? ' tl-tool-active' : '') + '" data-tool="cursor" title="Cursor">' +
          '<svg width="13" height="18" viewBox="0 0 13 19" fill="currentColor"><path d="M1 1v14.5l3.5-3.5 2.2 6 2-.7-2.2-6H11L1 1z"/></svg>' +
        '</button>' +
        '<button class="tl-tool' + (activeTool === 'note' ? ' tl-tool-active' : '') + '" data-tool="note" title="Sticky note">' +
          '<svg width="16" height="16" viewBox="0 0 16 16" fill="none">' +
            '<path d="M2 2h9l3 3v9H2V2z" stroke="currentColor" stroke-width="1.4"/>' +
            '<path d="M11 2v3h3" stroke="currentColor" stroke-width="1.4" fill="none"/>' +
            '<line x1="4.5" y1="6.5" x2="11.5" y2="6.5" stroke="currentColor" stroke-width="1.2"/>' +
            '<line x1="4.5" y1="9" x2="11.5" y2="9" stroke="currentColor" stroke-width="1.2"/>' +
            '<line x1="4.5" y1="11.5" x2="8.5" y2="11.5" stroke="currentColor" stroke-width="1.2"/>' +
          '</svg>' +
        '</button>' +
        '<button class="tl-tool" data-tool="image" title="Upload photo">' +
          '<svg width="14" height="16" viewBox="0 0 14 16" fill="none">' +
            '<path d="M7 11V3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>' +
            '<path d="M3.5 6.5L7 3L10.5 6.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>' +
            '<path d="M1 12.5V14.5H13V12.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>' +
          '</svg>' +
        '</button>' +
        '<button class="tl-tool' + (activeTool === 'pen' ? ' tl-tool-active' : '') + '" data-tool="pen" title="Draw">' +
          '<svg width="15" height="15" viewBox="0 0 15 15" fill="none">' +
            '<path d="M11.5 1L14 3.5L5.5 12L2 13L3 9.5L11.5 1Z" fill="currentColor"/>' +
            '<line x1="10.5" y1="2" x2="13" y2="4.5" stroke="rgba(255,255,255,0.25)" stroke-width="0.8"/>' +
          '</svg>' +
        '</button>' +
      '</div>' +
      '<div class="tl-draw-strip' + (activeTool === 'pen' ? ' open' : '') + '">' +
        (activeTool === 'pen' ? buildStripHTML() : '') +
      '</div>' +
      '<div class="tl-draw-sub"></div>' +
      '<div class="tl-sandbox-area">' +
        '<div class="tl-canvas" data-pin="' + (activePin ? activePin.id : '') + '"></div>' +
      '</div>' +
    '</div>';

  stripEl = viewEl.querySelector('.tl-strip');
  viewEl.querySelector('.tl-close').addEventListener('click', closeTimeline);
  viewEl.querySelector('#tl-scroll-left').addEventListener('click',  () => stripEl.scrollBy({ left: -140, behavior: 'smooth' }));
  viewEl.querySelector('#tl-scroll-right').addEventListener('click', () => stripEl.scrollBy({ left:  140, behavior: 'smooth' }));

  viewEl.querySelectorAll('.tl-stop').forEach(el => {
    el.addEventListener('click', () => { activeIdx = +el.dataset.idx; render(); });
  });

  const sandboxEl = viewEl.querySelector('.tl-sandbox-area');
  const canvasEl  = viewEl.querySelector('.tl-canvas');

  // Wire draw strip buttons
  viewEl.querySelectorAll('.tl-dp-tool').forEach(btn => {
    btn.addEventListener('click', () => {
      const sub = btn.dataset.sub;
      if (sub === 'eraser') {
        drawMode = drawMode === 'eraser' ? 'pen' : 'eraser';
        btn.classList.toggle('active', drawMode === 'eraser');
        closeSub();
        setCursor(sandboxEl);
        return;
      }
      if (drawSubPanel === sub) {
        closeSub();
      } else {
        viewEl.querySelectorAll('.tl-dp-tool').forEach(b => {
          if (b.dataset.sub !== 'eraser') b.classList.toggle('active', b.dataset.sub === sub);
        });
        openSub(sub);
      }
    });
  });

  // Re-open sub if it was open before re-render
  if (activeTool === 'pen' && drawSubPanel) openSub(drawSubPanel);

  viewEl.querySelectorAll('.tl-tool').forEach(btn => {
    btn.addEventListener('click', () => {
      if (btn.dataset.tool === 'image') {
        if (activePin) triggerImageUpload(sandboxEl, canvasEl, activePin);
        return;
      }
      const prev = activeTool;
      activeTool = btn.dataset.tool;
      viewEl.querySelectorAll('.tl-tool').forEach(b =>
        b.classList.toggle('tl-tool-active', b.dataset.tool === activeTool)
      );
      const drawStripEl = viewEl.querySelector('.tl-draw-strip');
      if (drawStripEl) {
        if (activeTool === 'pen') {
          drawStripEl.innerHTML = buildStripHTML();
          drawStripEl.classList.add('open');
          wireStripButtons(sandboxEl);
          if (drawSubPanel) openSub(drawSubPanel);
        } else {
          drawStripEl.classList.remove('open');
          closeSub();
        }
      }
      setCursor(sandboxEl);
    });
  });

  fitToView(sandboxEl);
  applyTransform(canvasEl);
  setCursor(sandboxEl);

  if (activePin) {
    renderNotes(canvasEl, activePin);
    renderStrokes(canvasEl, activePin);
    wireSandbox(sandboxEl, canvasEl, activePin);
  }
}

function wireStripButtons(sandboxEl) {
  viewEl.querySelectorAll('.tl-dp-tool').forEach(btn => {
    btn.addEventListener('click', () => {
      const sub = btn.dataset.sub;
      if (sub === 'eraser') {
        drawMode = drawMode === 'eraser' ? 'pen' : 'eraser';
        btn.classList.toggle('active', drawMode === 'eraser');
        closeSub();
        setCursor(sandboxEl);
        return;
      }
      if (drawSubPanel === sub) {
        closeSub();
      } else {
        viewEl.querySelectorAll('.tl-dp-tool').forEach(b => {
          if (b.dataset.sub !== 'eraser') b.classList.toggle('active', b.dataset.sub === sub);
        });
        openSub(sub);
      }
    });
  });
}

// --- Rendering strokes ---

function renderStrokes(canvasEl, pin) {
  let svgEl = canvasEl.querySelector('.tl-draw-svg');
  if (!svgEl) {
    svgEl = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svgEl.setAttribute('class', 'tl-draw-svg');
    svgEl.setAttribute('width', SANDBOX_W);
    svgEl.setAttribute('height', SANDBOX_H);
    canvasEl.insertBefore(svgEl, canvasEl.firstChild);
  }
  (pin.sandbox?.items || []).filter(it => it.type === 'stroke').forEach(item => {
    svgEl.appendChild(makeSvgPath(item));
  });
}

function makeSvgPath(item) {
  const el = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  el.setAttribute('d', item.d);
  el.setAttribute('stroke', item.color);
  el.setAttribute('stroke-width', item.width);
  el.setAttribute('fill', 'none');
  el.setAttribute('stroke-linecap', 'round');
  el.setAttribute('stroke-linejoin', 'round');
  if (item.style === 'dashed') el.setAttribute('stroke-dasharray', `${item.width * 4} ${item.width * 2}`);
  else if (item.style === 'dotted') el.setAttribute('stroke-dasharray', `${item.width} ${item.width * 3}`);
  el.dataset.id = item.id;
  return el;
}

// --- Sandbox wiring ---

function wireSandbox(sandboxEl, canvasEl, activePin) {
  let panning = false, startX, startY, startPanX, startPanY;

  sandboxEl.addEventListener('mousedown', e => {
    if (!e.target.closest('.tl-note, .tl-img-card')) deselectAll();
    if (e.target.closest('.tl-note, .tl-img-card')) return;

    if (activeTool === 'pen') {
      e.preventDefault();

      // Close sub-panel the moment drawing starts
      closeSub();
      viewEl.querySelectorAll('.tl-dp-tool').forEach(b => b.classList.remove('active'));
      if (drawMode === 'eraser') {
        const eraserBtn = viewEl.querySelector('.tl-dp-tool[data-sub="eraser"]');
        if (eraserBtn) eraserBtn.classList.add('active');
      }

      const svgEl = canvasEl.querySelector('.tl-draw-svg');
      if (!svgEl) return;

      if (drawMode === 'eraser') {
        let didErase = false;
        function onEraseMove(e) {
          const ept = clientToCanvas(sandboxEl, e.clientX, e.clientY);
          const threshold = 20 / zoom;
          const toRemove = activePin.sandbox.items
            .filter(it => it.type === 'stroke' && isNearPath(it.points, ept.x, ept.y, threshold))
            .map(it => it.id);
          if (!toRemove.length) return;
          didErase = true;
          activePin.sandbox.items = activePin.sandbox.items.filter(it => !toRemove.includes(it.id));
          toRemove.forEach(id => svgEl.querySelector(`[data-id="${id}"]`)?.remove());
          updatePin(activePin.id, { sandbox: activePin.sandbox });
        }
        function onEraseUp() {
          document.removeEventListener('mousemove', onEraseMove);
          document.removeEventListener('mouseup', onEraseUp);
          if (didErase) {
            drawMode = 'pen';
            const btn = viewEl.querySelector('.tl-dp-tool[data-sub="eraser"]');
            if (btn) btn.classList.remove('active');
            setCursor(sandboxEl);
          }
        }
        document.addEventListener('mousemove', onEraseMove);
        document.addEventListener('mouseup', onEraseUp);
        return;
      }

      // Pen drawing
      const pt = clientToCanvas(sandboxEl, e.clientX, e.clientY);
      currentPoints = [[pt.x, pt.y]];
      currentPathEl = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      currentPathEl.setAttribute('fill', 'none');
      currentPathEl.setAttribute('stroke', drawColor);
      currentPathEl.setAttribute('stroke-width', drawWidth);
      currentPathEl.setAttribute('stroke-linecap', 'round');
      currentPathEl.setAttribute('stroke-linejoin', 'round');
      if (drawStyle === 'dashed') currentPathEl.setAttribute('stroke-dasharray', `${drawWidth * 4} ${drawWidth * 2}`);
      else if (drawStyle === 'dotted') currentPathEl.setAttribute('stroke-dasharray', `${drawWidth} ${drawWidth * 3}`);
      currentPathEl.setAttribute('d', `M ${pt.x} ${pt.y} L ${pt.x + 0.01} ${pt.y}`);
      svgEl.appendChild(currentPathEl);

      function onDrawMove(e) {
        if (!currentPathEl) return;
        const pt2 = clientToCanvas(sandboxEl, e.clientX, e.clientY);
        const last = currentPoints[currentPoints.length - 1];
        if (Math.hypot(pt2.x - last[0], pt2.y - last[1]) < 3 / zoom) return;
        currentPoints.push([pt2.x, pt2.y]);
        currentPathEl.setAttribute('d', pointsToD(currentPoints));
      }
      function onDrawUp() {
        document.removeEventListener('mousemove', onDrawMove);
        document.removeEventListener('mouseup', onDrawUp);
        if (!currentPathEl) return;
        if (currentPoints.length < 2) { currentPathEl.remove(); currentPathEl = null; currentPoints = []; return; }
        const d = pointsToD(currentPoints);
        const item = { type: 'stroke', id: genId(), color: drawColor, width: drawWidth, style: drawStyle, d, points: currentPoints };
        currentPathEl.dataset.id = item.id;
        activePin.sandbox.items.push(item);
        updatePin(activePin.id, { sandbox: activePin.sandbox });
        currentPathEl = null; currentPoints = [];
      }
      document.addEventListener('mousemove', onDrawMove);
      document.addEventListener('mouseup', onDrawUp);
      return;
    }

    if (activeTool !== 'cursor') return;
    panning = true;
    startX = e.clientX; startY = e.clientY;
    startPanX = panX; startPanY = panY;
    sandboxEl.style.cursor = 'grabbing';
    e.preventDefault();
  });

  function onPanMove(e) {
    if (!panning) return;
    panX = startPanX + (e.clientX - startX);
    panY = startPanY + (e.clientY - startY);
    clampPan(sandboxEl);
    applyTransform(canvasEl);
  }

  function onPanUp() {
    if (!panning) return;
    panning = false;
    setCursor(sandboxEl);
  }

  document.addEventListener('mousemove', onPanMove);
  document.addEventListener('mouseup', onPanUp);

  function onBackspace(e) {
    if (e.key !== 'Backspace' && e.key !== 'Delete') return;
    if (!selectedItem) return;
    if (document.activeElement && document.activeElement.tagName === 'TEXTAREA') return;
    e.preventDefault();
    selectedPin.sandbox.items = selectedPin.sandbox.items.filter(it => it.id !== selectedItem.id);
    updatePin(selectedPin.id, { sandbox: selectedPin.sandbox });
    selectedEl.remove();
    deselectAll();
  }
  document.addEventListener('keydown', onBackspace);

  viewEl.addEventListener('tl-cleanup', () => {
    document.removeEventListener('mousemove', onPanMove);
    document.removeEventListener('mouseup', onPanUp);
    document.removeEventListener('keydown', onBackspace);
    deselectAll();
  }, { once: true });

  sandboxEl.addEventListener('wheel', e => {
    e.preventDefault();
    const rect = sandboxEl.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const factor = e.deltaY < 0 ? 1.1 : 1 / 1.1;
    const newZoom = Math.min(4, Math.max(0.15, zoom * factor));
    panX = mx - (mx - panX) * (newZoom / zoom);
    panY = my - (my - panY) * (newZoom / zoom);
    zoom = newZoom;
    clampPan(sandboxEl);
    applyTransform(canvasEl);
  }, { passive: false });

  sandboxEl.addEventListener('click', e => {
    if (activeTool !== 'note') return;
    if (e.target.closest('.tl-note')) return;
    const rect = sandboxEl.getBoundingClientRect();
    const cx = (e.clientX - rect.left - panX) / zoom;
    const cy = (e.clientY - rect.top  - panY) / zoom;
    createNote(canvasEl, activePin, cx, cy);
  });
}

// --- Notes ---

function renderNotes(canvasEl, pin) {
  (pin.sandbox?.items || []).forEach(item => {
    if (item.type === 'note') {
      if (!('xPx' in item)) {
        item.xPx = (item.x || 0) / 100 * SANDBOX_W;
        item.yPx = (item.y || 0) / 100 * SANDBOX_H;
        delete item.x; delete item.y;
        updatePin(pin.id, { sandbox: pin.sandbox });
      }
      mountNote(canvasEl, pin, item);
    } else if (item.type === 'image') {
      mountImage(canvasEl, pin, item);
    }
  });
}

function createNote(canvasEl, pin, xPx, yPx) {
  const item = { type: 'note', id: genId(), xPx, yPx, text: '' };
  pin.sandbox.items.push(item);
  updatePin(pin.id, { sandbox: pin.sandbox });
  mountNote(canvasEl, pin, item);
  activeTool = 'cursor';
  viewEl.querySelectorAll('.tl-tool').forEach(b =>
    b.classList.toggle('tl-tool-active', b.dataset.tool === 'cursor')
  );
  viewEl.querySelector('.tl-draw-strip')?.classList.remove('open');
  closeSub();
  const sandboxEl = viewEl.querySelector('.tl-sandbox-area');
  if (sandboxEl) setCursor(sandboxEl);
}

function mountNote(canvasEl, pin, item) {
  const el = document.createElement('div');
  el.className = 'tl-note';
  el.style.left = item.xPx + 'px';
  el.style.top  = item.yPx + 'px';
  el.innerHTML =
    '<div class="tl-note-drag">' +
      '<button class="tl-note-delete" title="Delete note">×</button>' +
    '</div>' +
    '<textarea class="tl-note-body" placeholder="Type a note…">' + escapeHtml(item.text) + '</textarea>';

  const textarea = el.querySelector('.tl-note-body');
  const autoResize = () => { textarea.style.height = 'auto'; textarea.style.height = textarea.scrollHeight + 'px'; };
  textarea.addEventListener('input', () => { item.text = textarea.value; updatePin(pin.id, { sandbox: pin.sandbox }); autoResize(); });
  textarea.addEventListener('mousedown', e => e.stopPropagation());

  el.querySelector('.tl-note-delete').addEventListener('click', e => {
    e.stopPropagation();
    pin.sandbox.items = pin.sandbox.items.filter(it => it.id !== item.id);
    updatePin(pin.id, { sandbox: pin.sandbox });
    el.remove();
  });

  makeDraggable(el, pin, item, canvasEl);
  canvasEl.appendChild(el);
  autoResize();
}

function makeDraggable(noteEl, pin, item, canvasEl) {
  const handle = noteEl.querySelector('.tl-note-drag');
  handle.addEventListener('mousedown', e => {
    if (e.target.classList.contains('tl-note-delete')) return;
    e.preventDefault(); e.stopPropagation();
    const startX = e.clientX, startY = e.clientY;
    const startLeft = noteEl.offsetLeft, startTop = noteEl.offsetTop;
    function onMove(e) {
      noteEl.style.left = (startLeft + (e.clientX - startX) / zoom) + 'px';
      noteEl.style.top  = (startTop  + (e.clientY - startY) / zoom) + 'px';
    }
    function onUp() {
      item.xPx = noteEl.offsetLeft; item.yPx = noteEl.offsetTop;
      updatePin(pin.id, { sandbox: pin.sandbox });
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    }
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  });
}

function makeInteractive(el, pin, item, canvasEl) {
  el.addEventListener('mousedown', e => {
    e.stopPropagation();
    if (!el.classList.contains('tl-selected')) {
      e.preventDefault();
      selectItem(el, pin, item);
      return;
    }
    e.preventDefault();
    const startX = e.clientX, startY = e.clientY;
    const startLeft = el.offsetLeft, startTop = el.offsetTop;
    function onMove(e) {
      el.style.left = (startLeft + (e.clientX - startX) / zoom) + 'px';
      el.style.top  = (startTop  + (e.clientY - startY) / zoom) + 'px';
    }
    function onUp() {
      item.xPx = el.offsetLeft; item.yPx = el.offsetTop;
      updatePin(pin.id, { sandbox: pin.sandbox });
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    }
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  });
}

// --- Images ---

function triggerImageUpload(sandboxEl, canvasEl, pin) {
  const input = document.createElement('input');
  input.type = 'file'; input.accept = 'image/*'; input.style.display = 'none';
  document.body.appendChild(input);
  input.addEventListener('change', () => {
    const file = input.files[0];
    document.body.removeChild(input);
    if (!file) return;
    resizeToDataURL(file, 900, 700, 0.82, src => {
      const vw = sandboxEl.offsetWidth, vh = sandboxEl.offsetHeight;
      const xPx = (vw / 2 - panX) / zoom, yPx = (vh / 2 - panY) / zoom;
      const item = { type: 'image', id: genId(), xPx, yPx, src };
      pin.sandbox.items.push(item);
      updatePin(pin.id, { sandbox: pin.sandbox });
      mountImage(canvasEl, pin, item);
    });
  });
  input.click();
}

function resizeToDataURL(file, maxW, maxH, quality, cb) {
  const img = new Image();
  const url = URL.createObjectURL(file);
  img.onload = () => {
    URL.revokeObjectURL(url);
    let w = img.naturalWidth, h = img.naturalHeight;
    if (w > maxW || h > maxH) { const s = Math.min(maxW / w, maxH / h); w = Math.round(w * s); h = Math.round(h * s); }
    const cv = document.createElement('canvas');
    cv.width = w; cv.height = h;
    cv.getContext('2d').drawImage(img, 0, 0, w, h);
    cb(cv.toDataURL('image/jpeg', quality));
  };
  img.src = url;
}

function mountImage(canvasEl, pin, item) {
  const el = document.createElement('div');
  el.className = 'tl-img-card';
  el.style.left = item.xPx + 'px';
  el.style.top  = item.yPx + 'px';
  el.style.width = (item.width || 360) + 'px';
  el.innerHTML =
    '<div class="tl-img-body"><img src="' + escapeAttr(item.src) + '" draggable="false" alt=""/></div>' +
    '<div class="tl-img-resize"></div>';
  makeInteractive(el, pin, item, canvasEl);
  makeResizable(el, pin, item);
  canvasEl.appendChild(el);
}

function makeResizable(el, pin, item) {
  const handle = el.querySelector('.tl-img-resize');
  handle.addEventListener('mousedown', e => {
    e.stopPropagation();
    e.preventDefault();
    const startX = e.clientX;
    const startW = el.offsetWidth;
    function onMove(e) {
      const newW = Math.max(80, startW + (e.clientX - startX) / zoom);
      el.style.width = newW + 'px';
    }
    function onUp() {
      item.width = el.offsetWidth;
      updatePin(pin.id, { sandbox: pin.sandbox });
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    }
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  });
}
