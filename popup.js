document.getElementById("toggle").addEventListener("click", async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab) return;
  chrome.runtime.sendMessage({ type: "TOGGLE_FROM_POPUP", tabId: tab.id }, () => {
    window.close();
  });
});
