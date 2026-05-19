import { state, currentTrip, createTrip, renameTrip, deleteTrip, setCurrentTrip, clearTripPins } from './state.js';
import { customPrompt, customConfirm, escapeHtml, escapeAttr } from './modal.js';

const menuEl = document.getElementById("menu");
let menuOpen = false;
let editingId = null;

function tripSummary(trip) {
  const dated = trip.pins.filter(p => p.dateStart).sort((a, b) => a.dateStart.localeCompare(b.dateStart));
  if (!dated.length) return null;
  const start = new Date(dated[0].dateStart);
  const endStr = dated.reduce((best, p) => {
    const d = p.dateEnd || p.dateStart;
    return d > best ? d : best;
  }, dated[0].dateStart);
  const end = new Date(endStr);
  const days = Math.round((end - start) / 86400000) + 1;
  const fmt = (d) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const count = trip.pins.length;
  return fmt(start) + ' – ' + fmt(end) + ' · ' + days + (days === 1 ? ' day' : ' days') + ' · ' + count + (count === 1 ? ' pin' : ' pins');
}

export function isMenuOpen() { return menuOpen; }
export function closeMenu() { menuOpen = false; editingId = null; }

export function renderMenu() {
  const trip = currentTrip();
  const tripName = trip ? trip.name : "No trip yet";
  if (!menuOpen) {
    menuEl.innerHTML =
      '<button class="menu-toggle">' +
        '<span>' + escapeHtml(tripName) + '</span>' +
        '<span class="chev">▾</span>' +
      '</button>';
    menuEl.querySelector(".menu-toggle").addEventListener("click", () => {
      menuOpen = true;
      renderMenu();
    });
    return;
  }
  const items = state.trips.map(t => {
    const isCurrent = t.id === state.currentTripId;
    if (isCurrent && editingId === t.id) {
      return (
        '<div class="menu-trip current editing" data-id="' + t.id + '">' +
          '<div class="menu-trip-edit">' +
            '<input class="menu-trip-input" value="' + escapeAttr(t.name) + '" />' +
            '<button class="menu-clear-pins">Clear all pins</button>' +
          '</div>' +
        '</div>'
      );
    }
    const summary = tripSummary(t);
    return (
      '<div class="menu-trip ' + (isCurrent ? 'current' : '') + '" data-id="' + t.id + '">' +
        '<div class="menu-trip-info">' +
          '<span class="menu-trip-name">' + escapeHtml(t.name) + '</span>' +
          (summary ? '<div class="trip-summary">' + escapeHtml(summary) + '</div>' : '') +
        '</div>' +
        (isCurrent
          ? '<button class="menu-icon" data-action="rename" title="Rename">✎</button>' +
            '<button class="menu-icon" data-action="delete" title="Delete">×</button>'
          : '') +
      '</div>'
    );
  }).join("");
  menuEl.innerHTML =
    '<div class="menu-header">' +
      '<span>Trips</span>' +
      '<button class="menu-close" title="Close">×</button>' +
    '</div>' +
    '<div class="menu-trips">' +
      (items || '<div class="menu-empty">No trips yet</div>') +
    '</div>' +
    '<button class="menu-new">+ New Trip</button>';

  menuEl.querySelector(".menu-close").addEventListener("click", () => {
    menuOpen = false;
    editingId = null;
    renderMenu();
  });
  menuEl.querySelector(".menu-new").addEventListener("click", async () => {
    editingId = null;
    const name = await customPrompt("Name your trip", "Trip " + (state.trips.length + 1), "Trip name");
    if (name !== null) createTrip(name.trim() || "Untitled");
  });

  menuEl.querySelectorAll(".menu-trip").forEach(el => {
    const id = el.dataset.id;

    if (el.classList.contains("editing")) {
      const input = el.querySelector(".menu-trip-input");
      const clearBtn = el.querySelector(".menu-clear-pins");

      input.focus();
      input.select();

      const commitRename = () => {
        const val = input.value.trim();
        if (val) renameTrip(id, val);
        editingId = null;
        renderMenu();
      };

      input.addEventListener("keydown", (ev) => {
        if (ev.key === "Enter") { ev.preventDefault(); commitRename(); }
        if (ev.key === "Escape") { editingId = null; renderMenu(); }
        ev.stopPropagation();
      });
      input.addEventListener("blur", () => {
        if (editingId === id) commitRename();
      });

      clearBtn.addEventListener("mousedown", (ev) => ev.preventDefault()); // prevent input blur before click
      clearBtn.addEventListener("click", async (ev) => {
        ev.stopPropagation();
        const t = state.trips.find(t => t.id === id);
        const count = t ? t.pins.length : 0;
        if (count === 0) { editingId = null; renderMenu(); return; }
        const ok = await customConfirm(
          "Remove all " + count + " pin" + (count === 1 ? "" : "s") + " from this trip?",
          { confirmLabel: "Clear", confirmStyle: "danger" }
        );
        if (ok) { clearTripPins(id); editingId = null; }
        else { renderMenu(); }
      });
      return;
    }

    el.querySelector(".menu-trip-name").addEventListener("click", () => setCurrentTrip(id));
    const renameBtn = el.querySelector('[data-action="rename"]');
    const deleteBtn = el.querySelector('[data-action="delete"]');
    if (renameBtn) renameBtn.addEventListener("click", (ev) => {
      ev.stopPropagation();
      editingId = id;
      renderMenu();
    });
    if (deleteBtn) deleteBtn.addEventListener("click", async (ev) => {
      ev.stopPropagation();
      const ok = await customConfirm("Delete this trip and all its pins?", { confirmLabel: "Delete", confirmStyle: "danger" });
      if (ok) deleteTrip(id);
    });
  });
}
