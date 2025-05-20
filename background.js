
// Listen for messages from content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log("Background script received message:", message.type);
  
  if (message.type === "download") {
    // Handle file/folder download
    chrome.downloads.download({
      url: message.url,
      filename: message.filename,
      saveAs: true
    }, (downloadId) => {
      if (chrome.runtime.lastError) {
        console.error("Download error:", chrome.runtime.lastError);
        sendResponse({ success: false, error: chrome.runtime.lastError });
      } else {
        console.log("Download started with ID:", downloadId);
        sendResponse({ success: true, downloadId });
      }
    });
    return true; // Required for async sendResponse
  }
  
  if (message.type === "fetchRepoData") {
    // Fetch repository data using GitHub API
    console.log("Fetching data from:", message.url);
    
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
      console.log("Data fetched successfully");
      sendResponse({ success: true, data });
    })
    .catch(error => {
      console.error("Error fetching data:", error);
      sendResponse({ success: false, error: error.toString() });
    });
    return true; // Required for async sendResponse
  }
  
  // Handle ZIP creation for multiple files/folders
  if (message.type === "createZip") {
    console.log("Creating ZIP for selected items");
    // This would be implemented to fetch multiple files and create a ZIP
    // For now we'll just send a mock response
    setTimeout(() => {
      sendResponse({ 
        success: true,
        message: "ZIP creation would happen here"
      });
    }, 1000);
    return true;
  }
});

// Listen for installation/update events
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === "install") {
    console.log("GitHub Downloader & Analyzer installed");
  } else if (details.reason === "update") {
    console.log("GitHub Downloader & Analyzer updated");
  }
});
