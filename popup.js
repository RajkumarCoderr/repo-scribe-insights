
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
      
      // Try to communicate with content script
      try {
        chrome.tabs.sendMessage(currentTab.id, { type: 'getState' }, function(response) {
          if (response && response.success) {
            // Update sidebar toggle state
            toggleSidebar.checked = !response.state.hiddenState;
          } else {
            console.log('Content script not ready or no response');
          }
        });
      } catch (e) {
        console.log('Error communicating with content script:', e);
      }
    } else {
      updateStatus(false, 'Not on GitHub');
    }
    
    // Load sidebar visibility preference
    chrome.storage.local.get(['sidebarHidden'], function(result) {
      toggleSidebar.checked = result.sidebarHidden !== true; // Default to shown
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
  chrome.storage.local.set({ sidebarHidden: !isVisible });
  
  // Send message to content script
  chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
    if (tabs[0] && tabs[0].url && tabs[0].url.includes('github.com')) {
      chrome.tabs.sendMessage(tabs[0].id, { 
        type: 'toggleSidebarVisibility', 
        visible: isVisible 
      });
    }
  });
});

// Handle options button
optionsButton.addEventListener('click', function() {
  // For now, just show some info
  alert("GitHub Enhancer Pro\n\nVersion: 1.0.0\n\nOptions panel coming soon!");
});

// Initialize popup
document.addEventListener('DOMContentLoaded', function() {
  checkCurrentTab();
});
