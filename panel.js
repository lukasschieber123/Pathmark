import { currentTrip, updatePin, deletePin } from './state.js';
import { customConfirm, escapeHtml, escapeAttr } from './modal.js';

// Notes are edited (with rich formatting) in the Timeline and stored as HTML.
// Older notes were plain text — convert those so the preview keeps line breaks.
function notesToHtml(notes) {
  if (/<(p|div|br|h[1-6]|ul|ol|li|b|i|strong|em|u|span|a)[\s>\/]/i.test(notes)) return notes;
  return escapeHtml(notes).replace(/\n/g, '<br>');
}

function dateSummaryLines(pin, trip) {
  const parts = [];
  if (pin.dateStart && pin.dateEnd) {
    const days = Math.round((new Date(pin.dateEnd) - new Date(pin.dateStart)) / 86400000) + 1;
    if (days > 0) parts.push(days + (days === 1 ? ' day here' : ' days here'));
  }
  if (pin.dateEnd) {
    const dated = trip.pins.filter(p => p.dateStart).sort((a, b) => a.dateStart.localeCompare(b.dateStart));
    const idx = dated.findIndex(p => p.id === pin.id);
    if (idx >= 0 && idx + 1 < dated.length) {
      const next = dated[idx + 1];
      const transit = Math.round((new Date(next.dateStart) - new Date(pin.dateEnd)) / 86400000);
      if (transit > 0) {
        const label = next.name || 'next stop';
        parts.push(transit + (transit === 1 ? ' day' : ' days') + ' to ' + label);
      }
    }
  }
  return parts.join('<br>');
}

const panelEl = document.getElementById("panel");
let openPinId = null;
let onMovePin = null;

export function isPanelOpen() { return openPinId !== null; }
export function getOpenPinId() { return openPinId; }
export function setMoveCallback(fn) { onMovePin = fn; }

export function openPanel(pinId) {
  openPinId = pinId;
  renderPanel();
  panelEl.classList.add("open");
  setTimeout(() => {
    const nameInput = panelEl.querySelector(".panel-name");
    if (nameInput && !nameInput.value) nameInput.focus();
  }, 60);
}

export function closePanel() {
  openPinId = null;
  panelEl.classList.remove("open");
}

export function renderPanel() {
  if (!openPinId) return;
  const trip = currentTrip();
  if (!trip) { closePanel(); return; }
  const idx = trip.pins.findIndex(p => p.id === openPinId);
  if (idx < 0) { closePanel(); return; }
  const pin = trip.pins[idx];

  // Legacy pins kept separate Flights/Hotels fields. Fold any existing content
  // into the single Notes field (one-time, on first open) so nothing is lost.
  if ((pin.flights && pin.flights.trim()) || (pin.hotels && pin.hotels.trim())) {
    const merged = [];
    if (pin.flights && pin.flights.trim()) merged.push('Flights: ' + pin.flights.trim());
    if (pin.hotels && pin.hotels.trim()) merged.push('Hotels: ' + pin.hotels.trim());
    if (pin.notes && pin.notes.trim()) merged.push(pin.notes.trim());
    updatePin(pin.id, { notes: merged.join('\n\n'), flights: '', hotels: '' });
  }

  panelEl.innerHTML =
    '<div class="panel-header">' +
      '<span class="panel-num">' + (idx + 1) + '</span>' +
      '<input class="panel-name" placeholder="Place name" value="' + escapeAttr(pin.name) + '">' +
      '<button class="panel-close" title="Close">×</button>' +
    '</div>' +
    '<div class="panel-dates-row">' +
      '<label class="panel-field panel-field-half"><span>From</span>' +
        '<input type="date" class="panel-input" data-field="dateStart" value="' + escapeAttr(pin.dateStart) + '">' +
      '</label>' +
      '<label class="panel-field panel-field-half"><span>To</span>' +
        '<input type="date" class="panel-input" data-field="dateEnd" value="' + escapeAttr(pin.dateEnd) + '">' +
      '</label>' +
    '</div>' +
    '<div class="panel-date-calc">' + dateSummaryLines(pin, trip) + '</div>' +
    '<label class="panel-field"><span>Notes</span>' +
      (pin.notes && pin.notes.trim()
        ? '<div class="panel-notes-preview">' + notesToHtml(pin.notes) + '</div>'
        : '<div class="panel-notes-empty">No notes yet — add them in the Timeline.</div>') +
    '</label>' +
    '<button class="panel-move">Move pin</button>' +
    '<button class="panel-delete">Delete pin</button>';

  panelEl.querySelector(".panel-close").addEventListener("click", closePanel);
  panelEl.querySelector(".panel-name").addEventListener("input", (ev) => {
    updatePin(pin.id, { name: ev.target.value });
  });
  panelEl.querySelectorAll("[data-field]").forEach(input => {
    input.addEventListener("input", (ev) => {
      updatePin(pin.id, { [ev.target.dataset.field]: ev.target.value });
      if (ev.target.dataset.field === 'dateStart' || ev.target.dataset.field === 'dateEnd') {
        const calcEl = panelEl.querySelector('.panel-date-calc');
        if (calcEl) calcEl.innerHTML = dateSummaryLines(pin, currentTrip());
      }
    });
  });
  panelEl.querySelector(".panel-move").addEventListener("click", () => {
    closePanel();
    if (onMovePin) onMovePin(pin.id);
  });
  panelEl.querySelector(".panel-delete").addEventListener("click", async () => {
    const ok = await customConfirm("Delete this pin?", { confirmLabel: "Delete", confirmStyle: "danger" });
    if (ok) deletePin(pin.id);
  });
}
