import { currentTrip, updatePin } from './state.js';
import { escapeHtml, escapeAttr } from './modal.js';

// Document-style timeline. The horizontal strip of connected dots is the
// navigator: click a stop (or use the ← → arrows) to open its document "page"
// below — a rich-text editor (headings, bold/italic, lists) where you write
// freely. One stop at a time, never a blank canvas, since the stops come from
// the pins placed on the globe. Formatted content is saved as HTML in
// pin.notes. The freeform sandbox version is archived in /archive.

const viewEl = document.getElementById('timeline-view');
let open = false;
let activeIdx = 0;

export function isTimelineOpen() { return open; }

// Move between stops. Ignored while typing so arrow keys still move the cursor.
function go(delta) {
  const trip = currentTrip();
  const n = trip ? trip.pins.length : 0;
  if (!n) return;
  activeIdx = Math.max(0, Math.min(n - 1, activeIdx + delta));
  render();
}

function handleArrowKey(e) {
  const el = document.activeElement;
  const tag = el && el.tagName;
  if (tag === 'TEXTAREA' || tag === 'INPUT' || (el && el.isContentEditable)) return;
  if (e.key === 'ArrowLeft')  { e.preventDefault(); go(-1); }
  if (e.key === 'ArrowRight') { e.preventDefault(); go(1); }
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

// Legacy notes were plain text; new notes are HTML. Convert plain text on the
// way into the editor so existing notes keep their line breaks.
function toEditorHTML(notes) {
  if (!notes) return '';
  if (/<(p|div|br|h[1-6]|ul|ol|li|b|i|strong|em|u|span|a)[\s>\/]/i.test(notes)) return notes;
  return escapeHtml(notes).replace(/\n/g, '<br>');
}

const LIST_UL = '<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="2" cy="4" r="1.3" fill="currentColor"/><circle cx="2" cy="8" r="1.3" fill="currentColor"/><circle cx="2" cy="12" r="1.3" fill="currentColor"/><line x1="6" y1="4" x2="14" y2="4" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/><line x1="6" y1="8" x2="14" y2="8" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/><line x1="6" y1="12" x2="14" y2="12" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>';
const LIST_OL = '<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><text x="0" y="6" font-size="5.5" fill="currentColor">1</text><text x="0" y="14" font-size="5.5" fill="currentColor">2</text><line x1="6" y1="4" x2="14" y2="4" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/><line x1="6" y1="12" x2="14" y2="12" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>';

function closeBtn() {
  return '<button class="tl-close" title="Back to globe (Esc)">' +
    '<svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z" fill="currentColor"/></svg>' +
    '</button>';
}

function header(tripName) {
  return '<div class="tl-header">' +
    closeBtn() +
    '<span class="tl-title">' + escapeHtml(tripName) + ' · Timeline</span>' +
    '<div class="tl-key-hint">' +
      '<button class="tl-key" id="tl-prev" title="Previous stop">&#8592;</button>' +
      '<button class="tl-key" id="tl-next" title="Next stop">&#8594;</button>' +
    '</div>' +
  '</div>';
}

function toolbar() {
  return '<div class="tld-toolbar">' +
    '<button class="tld-tb-btn" data-cmd="heading" title="Heading"><span style="font-weight:700">H</span></button>' +
    '<span class="tld-tb-sep"></span>' +
    '<button class="tld-tb-btn" data-cmd="bold" title="Bold (⌘B)"><b>B</b></button>' +
    '<button class="tld-tb-btn" data-cmd="italic" title="Italic (⌘I)"><i>I</i></button>' +
    '<span class="tld-tb-sep"></span>' +
    '<button class="tld-tb-btn" data-cmd="ul" title="Bulleted list">' + LIST_UL + '</button>' +
    '<button class="tld-tb-btn" data-cmd="ol" title="Numbered list">' + LIST_OL + '</button>' +
  '</div>';
}

function render() {
  const trip = currentTrip();
  const pins = trip ? trip.pins : [];

  if (activeIdx >= pins.length) activeIdx = 0;
  const activePin = pins[activeIdx] || null;

  // Horizontal stop strip
  let trackHTML;
  if (!pins.length) {
    trackHTML = '<div class="tl-empty">No stops yet — add pins on the globe.</div>';
  } else {
    trackHTML = pins.map((pin, i) => {
      const name = pin.name ? escapeHtml(pin.name) : 'Stop ' + (i + 1);
      const date = formatDate(pin.dateStart);
      const stop =
        '<div class="tl-stop' + (i === activeIdx ? ' tl-stop-active' : '') + '" data-idx="' + i + '">' +
          '<span class="tl-stop-name">' + name + '</span>' +
          '<div class="tl-dot"></div>' +
          '<span class="tl-stop-date">' + (date || ' ') + '</span>' +
        '</div>';
      return i < pins.length - 1 ? stop + '<div class="tl-connector"></div>' : stop;
    }).join('');
  }

  // Document page for the active stop
  let pageHTML;
  if (!trip) {
    pageHTML = '<div class="tld-empty">Create a trip to start planning.</div>';
  } else if (!activePin) {
    pageHTML = '<div class="tld-empty">Drop pins on the globe to start planning.<br>' +
               'Each stop opens a page here to fill in.</div>';
  } else {
    pageHTML =
      '<div class="tld-page">' +
        '<input class="tld-title" placeholder="Untitled stop" value="' + escapeAttr(activePin.name) + '">' +
        '<div class="tld-editor" contenteditable="true" data-placeholder="Add plans, bookings, ideas…">' +
          toEditorHTML(activePin.notes) +
        '</div>' +
      '</div>';
  }

  viewEl.innerHTML =
    header(trip ? trip.name : 'No trip') +
    '<div class="tl-strip"><div class="tl-track">' + trackHTML + '</div></div>' +
    (activePin ? toolbar() : '') +
    '<div class="tld-scroll">' + pageHTML + '</div>';

  // Wire chrome
  const stripEl = viewEl.querySelector('.tl-strip');
  viewEl.querySelector('.tl-close').addEventListener('click', closeTimeline);
  viewEl.querySelector('#tl-prev').addEventListener('click', () => go(-1));
  viewEl.querySelector('#tl-next').addEventListener('click', () => go(1));

  // Switch stops
  viewEl.querySelectorAll('.tl-stop').forEach(el => {
    el.addEventListener('click', () => { activeIdx = +el.dataset.idx; render(); });
  });

  // Keep the active stop visible in the strip
  const activeEl = viewEl.querySelector('.tl-stop-active');
  if (activeEl && stripEl) activeEl.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' });

  if (activePin) wirePage(activePin.id);
}

function wirePage(id) {
  const titleInput = viewEl.querySelector('.tld-title');
  const editor = viewEl.querySelector('.tld-editor');

  titleInput.addEventListener('input', () => {
    updatePin(id, { name: titleInput.value });
    const nameEl = viewEl.querySelector('.tl-stop-active .tl-stop-name');
    if (nameEl) nameEl.textContent = titleInput.value || 'Stop ' + (activeIdx + 1);
  });

  // Rich-text editing
  editor.addEventListener('input', () => {
    // Reset to truly empty so the placeholder returns after deleting everything —
    // but keep structural blocks (an empty list/heading is intentional content).
    if (!editor.textContent.trim() && !editor.querySelector('ul,ol,li,h2')) editor.innerHTML = '';
    updatePin(id, { notes: editor.innerHTML });
    updateToolbarState();
  });
  editor.addEventListener('keyup', updateToolbarState);
  editor.addEventListener('mouseup', updateToolbarState);

  viewEl.querySelectorAll('.tld-tb-btn').forEach(btn => {
    // mousedown (not click) + preventDefault keeps the editor selection intact
    btn.addEventListener('mousedown', (e) => {
      e.preventDefault();
      runCommand(btn.dataset.cmd, editor);
      editor.dispatchEvent(new Event('input'));
    });
  });
}

function runCommand(cmd, editor) {
  editor.focus();
  if (cmd === 'bold')   document.execCommand('bold');
  else if (cmd === 'italic') document.execCommand('italic');
  else if (cmd === 'ul') document.execCommand('insertUnorderedList');
  else if (cmd === 'ol') document.execCommand('insertOrderedList');
  else if (cmd === 'heading') {
    const cur = (document.queryCommandValue('formatBlock') || '').toLowerCase();
    document.execCommand('formatBlock', false, cur === 'h2' ? 'P' : 'H2');
  }
}

function updateToolbarState() {
  const state = {
    bold: document.queryCommandState('bold'),
    italic: document.queryCommandState('italic'),
    ul: document.queryCommandState('insertUnorderedList'),
    ol: document.queryCommandState('insertOrderedList'),
    heading: (document.queryCommandValue('formatBlock') || '').toLowerCase() === 'h2',
  };
  viewEl.querySelectorAll('.tld-tb-btn').forEach(btn => {
    btn.classList.toggle('tld-tb-active', !!state[btn.dataset.cmd]);
  });
}
