// Optimize background script for better memory usage
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log("Background script received message:", message.type);
  
  if (message.type === "download") {
    chrome.downloads.download({
      url: message.url,
      filename: message.filename,
      saveAs: true
    }, (downloadId) => {
      if (chrome.runtime.lastError) {
        console.error("Download error:", chrome.runtime.lastError);
        sendResponse({ success: false, error: chrome.runtime.lastError });
      } else {
        sendResponse({ success: true, downloadId });
      }
    });
    return true; // Required for async sendResponse
  }
  
  if (message.type === "fetchRepoData") {
    fetch(message.url, {
      headers: {
        'Accept': 'application/vnd.github+json'
      }
    })
    .then(response => {
      if (!response.ok) {
        throw new Error(`GitHub API responded with status: ${response.status}`);
      }
      return response.json();
    })
    .then(data => {
      sendResponse({ success: true, data });
    })
    .catch(error => {
      console.error("Error fetching data:", error);
      sendResponse({ success: false, error: error.toString() });
    });
    return true; // Required for async sendResponse
  }
  
  if (message.type === "createZip") {
    setTimeout(() => {
      sendResponse({ 
        success: true,
        message: "ZIP creation would happen here"
      });
    }, 500); // Reduced timeout for faster response
    return true;
  }
});

// Use lightweight installation handler
chrome.runtime.onInstalled.addListener((details) => {
  console.log(`GitHub Downloader & Analyzer ${details.reason}`);
});
