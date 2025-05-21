
/**
 * GitHub Enhancer Pro - Popup Script
 * Controls the popup UI and interacts with the content script
 */

// Elements
const toggleSidebar = document.getElementById('toggle-sidebar');
const optionsButton = document.getElementById('btn-options');
const statusMessage = document.getElementById('status-message');

// Check if we're on a GitHub page
async function checkCurrentTab() {
  try {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    const currentTab = tabs[0];
    
    if (currentTab && currentTab.url && currentTab.url.includes('github.com')) {
      updateStatus(true, 'Active on GitHub');
    } else {
      updateStatus(false, 'Not on GitHub');
    }
    
    // Load sidebar visibility preference
    chrome.storage.local.get(['sidebarVisible'], function(result) {
      toggleSidebar.checked = result.sidebarVisible !== false; // Default to true
    });
  } catch (error) {
    console.error('Error checking current tab:', error);
  }
}

// Update status indicator
function updateStatus(active, message) {
  const indicator = statusMessage.querySelector('.status-indicator');
  const text = statusMessage.querySelector('.status-text');
  
  if (active) {
    indicator.classList.add('active');
    indicator.classList.remove('inactive');
  } else {
    indicator.classList.remove('active');
    indicator.classList.add('inactive');
  }
  
  text.textContent = message;
}

// Handle sidebar toggle
toggleSidebar.addEventListener('change', function() {
  const isVisible = this.checked;
  
  // Save preference
  chrome.storage.local.set({ sidebarVisible: isVisible });
  
  // Send message to content script
  chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
    if (tabs[0] && tabs[0].url && tabs[0].url.includes('github.com')) {
      chrome.tabs.sendMessage(tabs[0].id, { 
        type: 'toggleSidebar', 
        visible: isVisible 
      });
    }
  });
});

// Handle options button
optionsButton.addEventListener('click', function() {
  // For now, just open GitHub in a new tab
  chrome.tabs.create({ url: 'https://github.com' });
});

// Initialize popup
document.addEventListener('DOMContentLoaded', function() {
  checkCurrentTab();
});
