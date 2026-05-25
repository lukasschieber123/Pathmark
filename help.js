const helpBar = document.getElementById('help-bar');
const helpDropdown = document.getElementById('help-dropdown');
const infoPanel = document.getElementById('info-panel');
const menuEl = document.getElementById('menu');

let dropdownOpen = false;
let infoPanelOpen = false;

export function init() {
  positionHelpBar();
  new ResizeObserver(positionHelpBar).observe(menuEl);
  window.addEventListener('resize', positionInfoPanel);

  document.getElementById('help-toggle').addEventListener('click', (e) => {
    e.stopPropagation();
    dropdownOpen = !dropdownOpen;
    helpDropdown.classList.toggle('show', dropdownOpen);
  });

  document.getElementById('help-info-btn').addEventListener('click', () => {
    infoPanelOpen = !infoPanelOpen;
    positionInfoPanel();
    infoPanel.classList.toggle('open', infoPanelOpen);
  });

  document.getElementById('info-panel-close').addEventListener('click', () => {
    infoPanelOpen = false;
    infoPanel.classList.remove('open');
  });

  document.addEventListener('click', (e) => {
    if (!helpBar.contains(e.target) && !infoPanel.contains(e.target)) {
      dropdownOpen = false;
      helpDropdown.classList.remove('show');
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && infoPanelOpen) {
      infoPanelOpen = false;
      infoPanel.classList.remove('open');
    }
  });
}

function positionHelpBar() {
  const rect = menuEl.getBoundingClientRect();
  helpBar.style.top = (rect.bottom + 6) + 'px';
  positionInfoPanel();
}

function positionInfoPanel() {
  const barRect = helpBar.getBoundingClientRect();
  const anchorBottom = dropdownOpen
    ? helpDropdown.getBoundingClientRect().bottom
    : barRect.bottom;
  const panelTop = anchorBottom + 6;
  const panelHeight = infoPanel.offsetHeight || 400;

  if (panelTop + panelHeight > window.innerHeight - 16) {
    // Would overflow bottom — move to right side below compass
    infoPanel.style.top = '68px';
    infoPanel.style.left = 'auto';
    infoPanel.style.right = '68px';
  } else {
    infoPanel.style.top = panelTop + 'px';
    infoPanel.style.left = barRect.left + 'px';
    infoPanel.style.right = 'auto';
  }
}
