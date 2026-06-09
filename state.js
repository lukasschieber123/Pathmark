import { STORAGE_KEY } from './constants.js';

const listeners = {
  renderAll: () => {},
  renderMenu: () => {},
  renderPins: () => {},
  closePanel: () => {},
  closeMenu: () => {},
};

export function setListeners(l) {
  Object.assign(listeners, l);
}

export function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const data = JSON.parse(raw);
      data.trips?.forEach(t => t.pins?.forEach(p => {
        delete p.dates;
        if (!('dateStart' in p)) p.dateStart = '';
        if (!('dateEnd' in p)) p.dateEnd = '';
        if (!p.sandbox) p.sandbox = { items: [] };
      }));
      return data;
    }
  } catch (e) {}
  return { trips: [], currentTripId: null };
}

export function saveState() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (e) {}
}

export function genId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

export const state = loadState();

export function currentTrip() {
  return state.trips.find(t => t.id === state.currentTripId) || null;
}

export function createTrip(name) {
  const trip = { id: genId(), name: name || ("Trip " + (state.trips.length + 1)), pins: [] };
  state.trips.push(trip);
  state.currentTripId = trip.id;
  saveState();
  listeners.renderAll();
}

export function deleteTrip(id) {
  state.trips = state.trips.filter(t => t.id !== id);
  if (state.currentTripId === id) {
    state.currentTripId = state.trips.length ? state.trips[0].id : null;
  }
  listeners.closePanel();
  saveState();
  listeners.renderAll();
}

export function renameTrip(id, name) {
  const t = state.trips.find(t => t.id === id);
  if (t) { t.name = name; saveState(); listeners.renderMenu(); }
}

export function setCurrentTrip(id) {
  state.currentTripId = id;
  listeners.closePanel();
  listeners.closeMenu();
  saveState();
  listeners.renderAll();
}

export function addPin(lng, lat) {
  const trip = currentTrip();
  if (!trip) return null;
  const pin = { id: genId(), lng, lat, name: "", dateStart: "", dateEnd: "", notes: "", sandbox: { items: [] } };
  trip.pins.push(pin);
  saveState();
  listeners.renderPins();
  return pin;
}

export function deletePin(id) {
  const trip = currentTrip();
  if (!trip) return;
  trip.pins = trip.pins.filter(p => p.id !== id);
  saveState();
  listeners.renderPins();
  listeners.closePanel();
}

export function updatePin(id, fields) {
  const trip = currentTrip();
  if (!trip) return;
  const pin = trip.pins.find(p => p.id === id);
  if (pin) { Object.assign(pin, fields); saveState(); }
}

export function clearTripPins(id) {
  const t = state.trips.find(t => t.id === id);
  if (t) { t.pins = []; saveState(); listeners.closePanel(); listeners.renderPins(); }
}
