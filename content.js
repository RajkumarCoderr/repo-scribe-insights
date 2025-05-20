
// Global state
const state = {
  selectedItems: [],
  repoInfo: {
    owner: '',
    repo: '',
    branch: 'main',
    path: '',
  },
  uiElements: {
    downloadBar: null,
    insightsPanel: null,
  }
};

// Initialize the extension
function initExtension() {
  // Check if we're on a GitHub repository page
  if (!isGitHubRepoPage()) return;
  
  // Extract repo information
  extractRepoInfo();
  
  // Initialize UI components
  injectCheckboxes();
  createDownloadBar();
  createInsightsPanel();
  
  // Add event listeners
  document.addEventListener('click', handleDocumentClick);
  
  // Observe DOM changes to handle GitHub's AJAX navigation
  observeDOMChanges();
}

// Check if the current page is a GitHub repository page
function isGitHubRepoPage() {
  return window.location.hostname === 'github.com' && 
         document.querySelector('.repository-content') !== null;
}

// Extract repository information from the URL
function extractRepoInfo() {
  const pathParts = window.location.pathname.split('/').filter(Boolean);
  if (pathParts.length >= 2) {
    state.repoInfo.owner = pathParts[0];
    state.repoInfo.repo = pathParts[1];
    
    // Check if we're in a specific branch/directory
    if (pathParts.length > 3 && pathParts[2] === 'tree') {
      state.repoInfo.branch = pathParts[3];
      state.repoInfo.path = pathParts.slice(4).join('/');
    }
  }
  
  console.log('Extracted repo info:', state.repoInfo);
}

// Inject checkboxes next to files and folders
function injectCheckboxes() {
  // Find all file and folder rows in the GitHub file explorer
  const fileRows = document.querySelectorAll('.js-navigation-item');
  
  fileRows.forEach(row => {
    // Skip if it's a header row or already has a checkbox
    if (row.querySelector('.gh-downloader-checkbox') || 
        row.classList.contains('up-tree') || 
        row.classList.contains('js-navigation-header')) {
      return;
    }
    
    // Create checkbox
    const checkbox = document.createElement('div');
    checkbox.className = 'gh-downloader-checkbox';
    checkbox.innerHTML = `
      <input type="checkbox" id="gh-dl-${Math.random().toString(36).substring(2, 9)}" />
      <label></label>
    `;
    
    // Get file/folder information
    const fileElement = row.querySelector('.js-navigation-open');
    if (!fileElement) return;
    
    const fileName = fileElement.textContent.trim();
    const isFolder = row.querySelector('svg.octicon-file-directory') !== null;
    const path = fileElement.getAttribute('href') || '';
    
    // Store data in the checkbox
    checkbox.dataset.name = fileName;
    checkbox.dataset.path = path;
    checkbox.dataset.type = isFolder ? 'folder' : 'file';
    
    // Add event listener
    checkbox.querySelector('input').addEventListener('change', function(e) {
      handleItemSelection(this, {
        name: fileName,
        path: path,
        type: isFolder ? 'folder' : 'file'
      });
    });
    
    // Insert checkbox at the beginning of the row
    const iconCell = row.querySelector('.icon-col');
    if (iconCell) {
      iconCell.insertBefore(checkbox, iconCell.firstChild);
    }
  });
}

// Handle item selection
function handleItemSelection(checkbox, item) {
  if (checkbox.checked) {
    state.selectedItems.push(item);
  } else {
    state.selectedItems = state.selectedItems.filter(i => i.path !== item.path);
  }
  
  // Update download bar visibility
  updateDownloadBar();
}

// Create or update the floating download bar
function createDownloadBar() {
  if (state.uiElements.downloadBar) {
    // If already exists, just update it
    updateDownloadBar();
    return;
  }
  
  const downloadBar = document.createElement('div');
  downloadBar.className = 'gh-downloader-bar';
  downloadBar.innerHTML = `
    <div class="gh-downloader-count">0 items selected</div>
    <button class="gh-downloader-button gh-download-btn">
      <svg aria-hidden="true" height="16" viewBox="0 0 16 16" version="1.1" width="16">
        <path fill-rule="evenodd" d="M7.47 10.78a.75.75 0 001.06 0l3.75-3.75a.75.75 0 00-1.06-1.06L8.75 8.44V1.75a.75.75 0 00-1.5 0v6.69L4.78 5.97a.75.75 0 00-1.06 1.06l3.75 3.75zM3.75 13a.75.75 0 000 1.5h8.5a.75.75 0 000-1.5h-8.5z"></path>
      </svg>
      Download
    </button>
    <button class="gh-downloader-button gh-insights-btn">
      <svg aria-hidden="true" height="16" viewBox="0 0 16 16" version="1.1" width="16">
        <path fill-rule="evenodd" d="M1.5 1.75a.75.75 0 00-1.5 0v12.5c0 .414.336.75.75.75h14.5a.75.75 0 000-1.5H1.5V1.75zm14.28 2.53a.75.75 0 00-1.06-1.06L10 7.94 7.53 5.47a.75.75 0 00-1.06 0L3.22 8.72a.75.75 0 001.06 1.06L7 7.06l2.47 2.47a.75.75 0 001.06 0l5.25-5.25z"></path>
      </svg>
      Insights
    </button>
    <button class="gh-downloader-button gh-export-btn">
      <svg aria-hidden="true" height="16" viewBox="0 0 16 16" version="1.1" width="16">
        <path fill-rule="evenodd" d="M0 1.75A.75.75 0 01.75 1h4.253c1.227 0 2.317.59 3 1.501A3.744 3.744 0 0111.006 1h4.245a.75.75 0 01.75.75v10.5a.75.75 0 01-.75.75h-4.507a2.25 2.25 0 00-1.591.659l-.622.621a.75.75 0 01-1.06 0l-.622-.621A2.25 2.25 0 005.258 13H.75a.75.75 0 01-.75-.75V1.75zm8.755 3a2.25 2.25 0 012.25-2.25H14.5v9h-3.757c-.71 0-1.4.201-1.992.572l.004-7.322zm-1.504 7.324l.004-7.324A2.25 2.25 0 005.006 2.5H1.5v9h3.757a3.75 3.75 0 011.994.574z"></path>
      </svg>
      Export README
    </button>
  `;
  
  // Add event listeners to buttons
  downloadBar.querySelector('.gh-download-btn').addEventListener('click', handleDownload);
  downloadBar.querySelector('.gh-insights-btn').addEventListener('click', showInsightsPanel);
  downloadBar.querySelector('.gh-export-btn').addEventListener('click', handleExportReadme);
  
  // Add download bar to the page
  document.body.appendChild(downloadBar);
  state.uiElements.downloadBar = downloadBar;
  
  // Initially hide it
  downloadBar.style.display = 'none';
}

// Update the download bar based on selected items
function updateDownloadBar() {
  const downloadBar = state.uiElements.downloadBar;
  if (!downloadBar) return;
  
  if (state.selectedItems.length > 0) {
    downloadBar.style.display = 'flex';
    downloadBar.querySelector('.gh-downloader-count').textContent = 
      `${state.selectedItems.length} item${state.selectedItems.length !== 1 ? 's' : ''} selected`;
  } else {
    downloadBar.style.display = 'none';
  }
}

// Handle download button click
function handleDownload() {
  if (state.selectedItems.length === 0) return;
  
  // If only one file is selected, download it directly
  if (state.selectedItems.length === 1 && state.selectedItems[0].type === 'file') {
    downloadSingleFile(state.selectedItems[0]);
    return;
  }
  
  // For multiple files or folders, create a zip
  downloadMultipleItems();
}

// Download a single file
function downloadSingleFile(item) {
  const { owner, repo, branch } = state.repoInfo;
  const rawUrl = `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${item.path.split('/blob/')[1]}`;
  
  chrome.runtime.sendMessage({
    type: 'download',
    url: rawUrl,
    filename: item.name
  }, response => {
    if (response && response.success) {
      showToast('File download started');
    } else {
      showToast('Error downloading file', 'error');
    }
  });
}

// Download multiple items (will be implemented in the background script)
function downloadMultipleItems() {
  showToast('Preparing download... This may take a moment');
  
  // In a real implementation, this would fetch the content and create a zip file
  // For this demo, we'll show a toast message
  setTimeout(() => {
    showToast('Download feature is being implemented');
  }, 1500);
}

// Create and display the insights panel
function createInsightsPanel() {
  const panel = document.createElement('div');
  panel.className = 'gh-insights-panel';
  panel.innerHTML = `
    <div class="gh-insights-header">
      <h3>Repository Insights</h3>
      <button class="gh-insights-close">✕</button>
    </div>
    <div class="gh-insights-content">
      <div class="gh-insights-loading">
        <div class="gh-spinner"></div>
        <p>Loading repository insights...</p>
      </div>
      <div class="gh-insights-data" style="display: none;">
        <div class="gh-insights-stat">
          <div class="gh-insights-label">Repository Size</div>
          <div class="gh-insights-value" id="repo-size">-</div>
        </div>
        <div class="gh-insights-stat">
          <div class="gh-insights-label">Files & Folders</div>
          <div class="gh-insights-value" id="repo-files">-</div>
        </div>
        <div class="gh-insights-stat">
          <div class="gh-insights-label">Primary Language</div>
          <div class="gh-insights-value" id="repo-language">-</div>
        </div>
        <div class="gh-insights-stat">
          <div class="gh-insights-label">Contributors</div>
          <div class="gh-insights-value" id="repo-contributors">-</div>
        </div>
        <div class="gh-insights-chart">
          <h4>Language Breakdown</h4>
          <div id="language-chart" class="gh-chart-placeholder">
            Chart placeholder (will show language breakdown)
          </div>
        </div>
        <div class="gh-insights-chart">
          <h4>Commit Activity</h4>
          <div id="commit-chart" class="gh-chart-placeholder">
            Chart placeholder (will show commit activity)
          </div>
        </div>
      </div>
    </div>
  `;
  
  // Add event listener to close button
  panel.querySelector('.gh-insights-close').addEventListener('click', () => {
    panel.classList.remove('gh-panel-visible');
  });
  
  // Add panel to the page
  document.body.appendChild(panel);
  state.uiElements.insightsPanel = panel;
}

// Show the insights panel and load data
function showInsightsPanel() {
  const panel = state.uiElements.insightsPanel;
  if (!panel) return;
  
  panel.classList.add('gh-panel-visible');
  
  // Load repository information
  loadRepositoryInsights();
}

// Load repository insights from GitHub API
function loadRepositoryInsights() {
  const { owner, repo } = state.repoInfo;
  const apiUrl = `https://api.github.com/repos/${owner}/${repo}`;
  
  const insightsPanel = state.uiElements.insightsPanel;
  const loadingEl = insightsPanel.querySelector('.gh-insights-loading');
  const dataEl = insightsPanel.querySelector('.gh-insights-data');
  
  loadingEl.style.display = 'flex';
  dataEl.style.display = 'none';
  
  // Fetch repository data
  chrome.runtime.sendMessage({
    type: 'fetchRepoData',
    url: apiUrl
  }, response => {
    loadingEl.style.display = 'none';
    dataEl.style.display = 'block';
    
    if (response && response.success && response.data) {
      const data = response.data;
      
      // Update UI with repository data
      insightsPanel.querySelector('#repo-size').textContent = formatBytes(data.size * 1024); // GitHub API returns size in KB
      insightsPanel.querySelector('#repo-language').textContent = data.language || 'N/A';
      
      // For other data we would need additional API calls
      insightsPanel.querySelector('#repo-files').textContent = 'Calculating...';
      insightsPanel.querySelector('#repo-contributors').textContent = `${data.watchers} watchers`;
      
      // This would be replaced with actual chart rendering
      insightsPanel.querySelector('#language-chart').textContent = 
        `Primary language: ${data.language || 'Unknown'}`;
      insightsPanel.querySelector('#commit-chart').textContent = 
        `Last updated: ${new Date(data.updated_at).toLocaleDateString()}`;
    } else {
      // Show error message
      dataEl.innerHTML = '<div class="gh-insights-error">Error loading repository insights</div>';
    }
  });
}

// Handle export README button click
function handleExportReadme() {
  // Find README file in the current directory
  const readmeLink = Array.from(document.querySelectorAll('.js-navigation-open'))
    .find(el => el.textContent.toLowerCase().includes('readme'));
  
  if (!readmeLink) {
    showToast('README file not found in this directory', 'warning');
    return;
  }
  
  // Show export options modal
  showExportModal(readmeLink.getAttribute('href'));
}

// Show README export options modal
function showExportModal(readmePath) {
  // Create modal if it doesn't exist
  let modal = document.querySelector('.gh-export-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.className = 'gh-export-modal';
    modal.innerHTML = `
      <div class="gh-export-modal-content">
        <div class="gh-export-modal-header">
          <h3>Export README</h3>
          <button class="gh-export-modal-close">✕</button>
        </div>
        <div class="gh-export-modal-body">
          <p>Choose export format:</p>
          <div class="gh-export-buttons">
            <button class="gh-export-btn-pdf">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                <polyline points="14 2 14 8 20 8"></polyline>
                <line x1="16" y1="13" x2="8" y2="13"></line>
                <line x1="16" y1="17" x2="8" y2="17"></line>
                <line x1="10" y1="9" x2="8" y2="9"></line>
              </svg>
              PDF Format
            </button>
            <button class="gh-export-btn-docx">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                <polyline points="14 2 14 8 20 8"></polyline>
                <line x1="16" y1="13" x2="8" y2="13"></line>
                <line x1="16" y1="17" x2="8" y2="17"></line>
                <line x1="10" y1="9" x2="8" y2="9"></line>
              </svg>
              DOCX Format
            </button>
          </div>
        </div>
      </div>
      <div class="gh-export-modal-overlay"></div>
    `;
    
    // Add event listeners
    modal.querySelector('.gh-export-modal-close').addEventListener('click', () => {
      modal.classList.remove('gh-modal-visible');
    });
    
    modal.querySelector('.gh-export-modal-overlay').addEventListener('click', () => {
      modal.classList.remove('gh-modal-visible');
    });
    
    modal.querySelector('.gh-export-btn-pdf').addEventListener('click', () => {
      exportReadme(readmePath, 'pdf');
      modal.classList.remove('gh-modal-visible');
    });
    
    modal.querySelector('.gh-export-btn-docx').addEventListener('click', () => {
      exportReadme(readmePath, 'docx');
      modal.classList.remove('gh-modal-visible');
    });
    
    document.body.appendChild(modal);
  }
  
  // Show the modal
  modal.classList.add('gh-modal-visible');
}

// Export README to PDF or DOCX
function exportReadme(path, format) {
  showToast(`Preparing README ${format.toUpperCase()} export...`);
  
  // In a real implementation, this would fetch the README content and convert it
  // For this demo, we'll show a toast message
  setTimeout(() => {
    showToast(`README ${format.toUpperCase()} export feature is being implemented`);
  }, 1500);
}

// Show toast notification
function showToast(message, type = 'info') {
  // Remove any existing toast
  const existingToast = document.querySelector('.gh-toast');
  if (existingToast) {
    existingToast.remove();
  }
  
  // Create new toast
  const toast = document.createElement('div');
  toast.className = `gh-toast gh-toast-${type}`;
  toast.textContent = message;
  
  // Add to document
  document.body.appendChild(toast);
  
  // Trigger animation
  setTimeout(() => {
    toast.classList.add('gh-toast-visible');
  }, 10);
  
  // Auto remove after 3 seconds
  setTimeout(() => {
    toast.classList.remove('gh-toast-visible');
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// Format bytes to human-readable format
function formatBytes(bytes, decimals = 2) {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

// Observe DOM changes to handle GitHub's AJAX navigation
function observeDOMChanges() {
  const observer = new MutationObserver(mutations => {
    mutations.forEach(mutation => {
      if (mutation.type === 'childList' && 
          mutation.addedNodes.length > 0 && 
          document.querySelector('.js-navigation-item:not(.has-gh-downloader-checkbox)')) {
        // GitHub's content has changed, reinitialize our elements
        injectCheckboxes();
      }
    });
  });
  
  observer.observe(document.body, { 
    childList: true,
    subtree: true
  });
}

// Handle document click events
function handleDocumentClick(e) {
  // Close modals when clicking outside
  if (e.target.classList.contains('gh-export-modal-overlay')) {
    document.querySelector('.gh-export-modal').classList.remove('gh-modal-visible');
  }
}

// Initialize the extension when the page loads
document.addEventListener('DOMContentLoaded', initExtension);
// Also try to initialize after a short delay to handle dynamic content
setTimeout(initExtension, 1000);
