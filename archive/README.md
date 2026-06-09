# Sandbox archive (retired 2026-06-08)

The original freeform-canvas timeline ("sandbox": sticky notes, text boxes,
checklists, image upload, freehand drawing, pan/zoom). Retired in favor of a
document-style timeline. Kept here in case we want it back.

- `timeline-sandbox.js` — the full sandbox module (exports openTimeline,
  closeTimeline, isTimelineOpen, renderTimeline). Drop-in replacement for the
  current `timeline.js` — main.js needs no changes.
- `app-sandbox-snapshot.html` — full snapshot of app.html at retirement, so all
  the `.tl-*` CSS and #timeline-view markup are preserved (they were inline).

To restore: copy timeline-sandbox.js back over timeline.js, and re-add the
`.tl-*` CSS / markup from the snapshot.
