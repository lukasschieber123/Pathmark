const helpBtn = document.getElementById('help-btn');
const infoPanel = document.getElementById('info-panel');

let open = false;

export function init() {
  helpBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    toggle();
  });

  document.getElementById('info-panel-close').addEventListener('click', () => close());

  document.addEventListener('click', (e) => {
    if (open && !infoPanel.contains(e.target)) close();
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && open) close();
  });
}

function toggle() {
  open ? close() : openPanel();
}

function openPanel() {
  open = true;
  infoPanel.classList.add('open');
  helpBtn.classList.add('active');
}

function close() {
  open = false;
  infoPanel.classList.remove('open');
  helpBtn.classList.remove('active');
}
