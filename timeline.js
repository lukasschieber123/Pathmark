import { currentTrip } from './state.js';
import { escapeHtml } from './modal.js';

const viewEl = document.getElementById('timeline-view');
let open = false;

export function isTimelineOpen() { return open; }

export function openTimeline() {
  open = true;
  viewEl.classList.add('open');
  render();
}

export function closeTimeline() {
  open = false;
  viewEl.classList.remove('open');
}

function render() {
  const trip = currentTrip();
  const name = trip ? escapeHtml(trip.name) : 'No trip';
  viewEl.innerHTML =
    '<div class="tl-header">' +
      '<button class="tl-close" title="Back to globe">' +
        '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">' +
          '<path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z" fill="currentColor"/>' +
        '</svg>' +
      '</button>' +
      '<span class="tl-title">' + name + ' · Timeline</span>' +
    '</div>' +
    '<div class="tl-body"></div>';
  viewEl.querySelector('.tl-close').addEventListener('click', closeTimeline);
}
