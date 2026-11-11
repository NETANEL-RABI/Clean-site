async function toggleReader(tabId) {
  try {
    await chrome.scripting.insertCSS({
      target: { tabId },
      files: ["reader.css"]
    });
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ["content.js"]
    });
    await chrome.tabs.sendMessage(tabId, { type: "TOGGLE" });
  } catch (err) {
    console.error("לא ניתן להפעיל בדף זה:", err);
  }
}

chrome.commands.onCommand.addListener(async (command) => {
  if (command !== "toggle-reader") return;
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab) toggleReader(tab.id);
});

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === "TOGGLE_FROM_POPUP") {
    toggleReader(msg.tabId).then(() => sendResponse({ ok: true }));
    return true;
  }
});
