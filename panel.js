import { currentTrip, updatePin, deletePin } from './state.js';
import { customConfirm, escapeHtml, escapeAttr } from './modal.js';

const panelEl = document.getElementById("panel");
let openPinId = null;

export function isPanelOpen() { return openPinId !== null; }
export function getOpenPinId() { return openPinId; }

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
  panelEl.innerHTML =
    '<div class="panel-header">' +
      '<span class="panel-num">' + (idx + 1) + '</span>' +
      '<input class="panel-name" placeholder="Place name" value="' + escapeAttr(pin.name) + '">' +
      '<button class="panel-close" title="Close">×</button>' +
    '</div>' +
    '<label class="panel-field"><span>Dates</span>' +
      '<input class="panel-input" data-field="dates" placeholder="e.g. May 12–15" value="' + escapeAttr(pin.dates) + '">' +
    '</label>' +
    '<label class="panel-field"><span>Flights</span>' +
      '<textarea class="panel-textarea" data-field="flights" placeholder="Flight info">' + escapeHtml(pin.flights) + '</textarea>' +
    '</label>' +
    '<label class="panel-field"><span>Hotels</span>' +
      '<textarea class="panel-textarea" data-field="hotels" placeholder="Where you\'re staying">' + escapeHtml(pin.hotels) + '</textarea>' +
    '</label>' +
    '<label class="panel-field"><span>Notes</span>' +
      '<textarea class="panel-textarea" data-field="notes" placeholder="Anything else">' + escapeHtml(pin.notes) + '</textarea>' +
    '</label>' +
    '<button class="panel-delete">Delete pin</button>';

  panelEl.querySelector(".panel-close").addEventListener("click", closePanel);
  panelEl.querySelector(".panel-name").addEventListener("input", (ev) => {
    updatePin(pin.id, { name: ev.target.value });
  });
  panelEl.querySelectorAll("[data-field]").forEach(input => {
    input.addEventListener("input", (ev) => {
      updatePin(pin.id, { [ev.target.dataset.field]: ev.target.value });
    });
  });
  panelEl.querySelector(".panel-delete").addEventListener("click", async () => {
    const ok = await customConfirm("Delete this pin?", { confirmLabel: "Delete", confirmStyle: "danger" });
    if (ok) deletePin(pin.id);
  });
}
