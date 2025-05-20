
document.addEventListener('DOMContentLoaded', function() {
  // Check if we're on a GitHub page
  chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
    const currentTab = tabs[0];
    const isGitHubRepo = currentTab.url && 
      currentTab.url.startsWith('https://github.com/') && 
      currentTab.url.split('/').length > 4;
    
    updatePopupUI(isGitHubRepo, currentTab.url);
  });
  
  // Theme toggle functionality
  const themeToggle = document.getElementById('theme-toggle');
  
  // Load saved theme preference
  chrome.storage.local.get('theme', function(data) {
    const isDark = data.theme === 'dark';
    themeToggle.checked = isDark;
    document.body.classList.toggle('dark-theme', isDark);
  });
  
  // Toggle theme when the switch is clicked
  themeToggle.addEventListener('change', function() {
    const isDark = this.checked;
    document.body.classList.toggle('dark-theme', isDark);
    
    // Save preference
    chrome.storage.local.set({ theme: isDark ? 'dark' : 'light' });
    
    // Send message to content script to update theme
    chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
      chrome.tabs.sendMessage(tabs[0].id, { action: 'updateTheme', theme: isDark ? 'dark' : 'light' });
    });
  });
  
  // Settings button click
  document.getElementById('settings-btn').addEventListener('click', function() {
    // In a real extension, this would open a settings page or modal
    alert('Settings feature coming soon!');
  });
});

// Update popup UI based on current tab
function updatePopupUI(isGitHubRepo, url) {
  const statusContainer = document.querySelector('.status-container');
  const statusIcon = statusContainer.querySelector('.status-icon svg');
  const statusMessage = statusContainer.querySelector('.status-message');
  
  if (isGitHubRepo) {
    // Extract repo name
    const urlParts = url.split('/');
    const owner = urlParts[3];
    const repo = urlParts[4];
    
    statusIcon.innerHTML = '<circle cx="12" cy="12" r="10"></circle><path d="M12 16l4-4-4-4M8 12h8"></path>';
    statusMessage.innerHTML = `Browsing: <strong>${owner}/${repo}</strong><br><span class="status-hint">Select files on the page to download</span>`;
    statusContainer.classList.add('is-active');
  } else if (url.includes('github.com')) {
    statusIcon.innerHTML = '<circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="16"></line><line x1="8" y1="12" x2="16" y2="12"></line>';
    statusMessage.textContent = 'Navigate to a GitHub repository to use this extension';
    statusContainer.classList.remove('is-active');
  } else {
    statusIcon.innerHTML = '<circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="16"></line><line x1="8" y1="12" x2="16" y2="12"></line>';
    statusMessage.textContent = 'This extension only works on GitHub repositories';
    statusContainer.classList.remove('is-active');
  }
}
