// Minimal service worker: its only job is to make the toolbar action open
// Chrome's native side panel (docked on the right). All job rendering and API
// work still happens in the side panel page itself (src/sidebar.ts).

const SIDE_PANEL_PATH = 'sidebar.html';

async function enableActionOpensPanel(): Promise<void> {
  try {
    await chrome.sidePanel.setOptions({ path: SIDE_PANEL_PATH, enabled: true });
    await chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
  } catch {
    // Older Chrome builds without the sidePanel API; nothing to do.
  }
}

chrome.runtime.onInstalled.addListener(() => {
  void enableActionOpensPanel();
});

chrome.runtime.onStartup.addListener(() => {
  void enableActionOpensPanel();
});

// setPanelBehavior is remembered by Chrome, but the worker can be revived
// before either lifecycle event fires (e.g. after an update), so set it here
// too — the call is idempotent.
void enableActionOpensPanel();

// Fallback for the case where openPanelOnActionClick could not be set: an
// action click is a user gesture, so opening the panel directly is allowed.
chrome.action.onClicked.addListener((tab) => {
  if (tab.windowId === undefined) return;
  try {
    void chrome.sidePanel.open({ windowId: tab.windowId });
  } catch {
    // Panel behavior already handles the click.
  }
});
