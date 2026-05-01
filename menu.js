import { state, currentTrip, createTrip, renameTrip, deleteTrip, setCurrentTrip } from './state.js';
import { customPrompt, customConfirm, escapeHtml } from './modal.js';

const menuEl = document.getElementById("menu");
let menuOpen = false;

export function isMenuOpen() { return menuOpen; }
export function closeMenu() { menuOpen = false; }

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
    return (
      '<div class="menu-trip ' + (isCurrent ? 'current' : '') + '" data-id="' + t.id + '">' +
        '<span class="menu-trip-name">' + escapeHtml(t.name) + '</span>' +
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
    renderMenu();
  });
  menuEl.querySelector(".menu-new").addEventListener("click", async () => {
    const name = await customPrompt("Name your trip", "Trip " + (state.trips.length + 1), "Trip name");
    if (name !== null) createTrip(name.trim() || "Untitled");
  });
  menuEl.querySelectorAll(".menu-trip").forEach(el => {
    const id = el.dataset.id;
    el.querySelector(".menu-trip-name").addEventListener("click", () => setCurrentTrip(id));
    const renameBtn = el.querySelector('[data-action="rename"]');
    const deleteBtn = el.querySelector('[data-action="delete"]');
    if (renameBtn) renameBtn.addEventListener("click", async (ev) => {
      ev.stopPropagation();
      const t = state.trips.find(t => t.id === id);
      const name = await customPrompt("Rename trip", t ? t.name : "", "Trip name");
      if (name !== null && name.trim()) renameTrip(id, name.trim());
    });
    if (deleteBtn) deleteBtn.addEventListener("click", async (ev) => {
      ev.stopPropagation();
      const ok = await customConfirm("Delete this trip and all its pins?", { confirmLabel: "Delete", confirmStyle: "danger" });
      if (ok) deleteTrip(id);
    });
  });
}
