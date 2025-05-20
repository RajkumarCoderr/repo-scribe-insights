
// Listen for messages from content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "download") {
    // Handle file/folder download
    chrome.downloads.download({
      url: message.url,
      filename: message.filename,
      saveAs: true
    }, (downloadId) => {
      if (chrome.runtime.lastError) {
        sendResponse({ success: false, error: chrome.runtime.lastError });
      } else {
        sendResponse({ success: true, downloadId });
      }
    });
    return true; // Required for async sendResponse
  }
  
  if (message.type === "fetchRepoData") {
    // Fetch repository data using GitHub API
    fetch(message.url, {
      headers: {
        'Accept': 'application/vnd.github+json'
      }
    })
    .then(response => response.json())
    .then(data => {
      sendResponse({ success: true, data });
    })
    .catch(error => {
      sendResponse({ success: false, error: error.toString() });
    });
    return true; // Required for async sendResponse
  }
});
