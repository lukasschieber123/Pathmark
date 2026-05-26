import { currentTrip } from './state.js';
import { escapeHtml } from './modal.js';

const viewEl = document.getElementById('timeline-view');
let open = false;
let activeIdx = 0;
let stripEl = null;
let activeTool = 'cursor';

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
}

export function renderTimeline() {
  if (open) render();
}

function formatDate(str) {
  if (!str) return '';
  const [y, m, d] = str.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function render() {
  const trip = currentTrip();
  const tripName = trip ? escapeHtml(trip.name) : 'No trip';
  const pins = trip ? trip.pins : [];

  if (activeIdx >= pins.length) activeIdx = 0;

  const activePin = pins[activeIdx] || null;

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
          '<span class="tl-stop-date">' + (date || ' ') + '</span>' +
        '</div>';
      if (i < pins.length - 1) {
        trackHTML += '<div class="tl-connector"></div>';
      }
    });
  }

  viewEl.innerHTML =
    '<div class="tl-header">' +
      '<button class="tl-close" title="Back to globe">' +
        '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">' +
          '<path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z" fill="currentColor"/>' +
        '</svg>' +
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
          '<svg width="13" height="18" viewBox="0 0 13 19" fill="currentColor" xmlns="http://www.w3.org/2000/svg">' +
            '<path d="M1 1v14.5l3.5-3.5 2.2 6 2-.7-2.2-6H11L1 1z"/>' +
          '</svg>' +
        '</button>' +
      '</div>' +
      '<div class="tl-sandbox-area">' +
        '<div class="tl-canvas" data-pin="' + (activePin ? activePin.id : '') + '"></div>' +
      '</div>' +
    '</div>';

  stripEl = viewEl.querySelector('.tl-strip');
  viewEl.querySelector('.tl-close').addEventListener('click', closeTimeline);
  viewEl.querySelector('#tl-scroll-left').addEventListener('click',  () => stripEl.scrollBy({ left: -140, behavior: 'smooth' }));
  viewEl.querySelector('#tl-scroll-right').addEventListener('click', () => stripEl.scrollBy({ left:  140, behavior: 'smooth' }));

  viewEl.querySelectorAll('.tl-stop').forEach(el => {
    el.addEventListener('click', () => {
      activeIdx = +el.dataset.idx;
      render();
    });
  });

  viewEl.querySelectorAll('.tl-tool').forEach(btn => {
    btn.addEventListener('click', () => {
      activeTool = btn.dataset.tool;
      viewEl.querySelectorAll('.tl-tool').forEach(b =>
        b.classList.toggle('tl-tool-active', b.dataset.tool === activeTool)
      );
    });
  });
}
