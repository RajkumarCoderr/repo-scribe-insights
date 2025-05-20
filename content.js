
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
  },
  observers: [], // Track observers for cleanup
  initialized: false,
  isPanelVisible: false // Track panel visibility
};

// Improved initialization function with debounce
function initExtension() {
  // Prevent multiple initializations
  if (state.initialized) return;
  
  // Only initialize on GitHub repository pages
  if (!isGitHubRepoPage()) return;
  
  console.log('GitHub Downloader & Analyzer: Initializing');
  state.initialized = true;
  
  // Extract repo information
  extractRepoInfo();
  
  // Initialize UI components with staggered timing to prevent flickering
  setTimeout(() => {
    createDownloadBar();
    setTimeout(() => {
      createInsightsPanel();
      setTimeout(() => {
        injectCheckboxes();
        updateDownloadBar();
        // Only show insights panel when requested
        showToast('GitHub Downloader & Analyzer active', 'success');
      }, 100);
    }, 100);
  }, 500);
  
  // Add event listeners (with cleanup capability)
  document.addEventListener('click', handleDocumentClick);
  
  // Set up efficient page change detection
  observeDOMChanges();
}

// Improved GitHub repo page detection
function isGitHubRepoPage() {
  return window.location.hostname === 'github.com' && 
         (document.querySelector('.repository-content') !== null || 
          document.querySelector('.js-repo-home-link') !== null);
}

// More efficient repo info extraction
function extractRepoInfo() {
  const pathParts = window.location.pathname.split('/').filter(Boolean);
  if (pathParts.length >= 2) {
    state.repoInfo.owner = pathParts[0];
    state.repoInfo.repo = pathParts[1];
    
    if (pathParts.length > 3 && pathParts[2] === 'tree') {
      state.repoInfo.branch = pathParts[3];
      state.repoInfo.path = pathParts.slice(4).join('/');
    }
  }
}

// Memory-optimized checkbox injection
function injectCheckboxes() {
  // Find file/folder rows more efficiently
  const fileRows = document.querySelectorAll('.js-navigation-item:not(.js-navigation-open-details)');
  
  fileRows.forEach(row => {
    // Skip if checkbox already exists or if it's a header/parent row
    if (row.querySelector('.gh-downloader-checkbox') || 
        row.classList.contains('up-tree') || 
        row.classList.contains('js-navigation-header')) {
      return;
    }
    
    // Create checkbox with optimized DOM operations
    const checkbox = document.createElement('div');
    checkbox.className = 'gh-downloader-checkbox';
    
    // Use template string for better performance
    const checkboxId = `gh-dl-${Math.random().toString(36).slice(2, 9)}`;
    checkbox.innerHTML = `<input type="checkbox" id="${checkboxId}" /><label for="${checkboxId}"></label>`;
    
    // Get file info efficiently
    const fileElement = row.querySelector('.js-navigation-open');
    if (!fileElement) return;
    
    const fileName = fileElement.textContent.trim();
    const isFolder = row.querySelector('svg.octicon-file-directory') !== null;
    const path = fileElement.getAttribute('href') || '';
    
    // Store data in dataset for better performance
    checkbox.dataset.name = fileName;
    checkbox.dataset.path = path;
    checkbox.dataset.type = isFolder ? 'folder' : 'file';
    
    // Add click handler with proper event delegation
    checkbox.querySelector('input').addEventListener('change', function() {
      handleItemSelection(this, {
        name: fileName,
        path: path,
        type: isFolder ? 'folder' : 'file'
      });
    });
    
    // Insert checkbox efficiently
    const iconCell = row.querySelector('.icon-col');
    if (iconCell) {
      iconCell.insertBefore(checkbox, iconCell.firstChild);
    }
  });
}

// More efficient item selection handler
function handleItemSelection(checkbox, item) {
  if (checkbox.checked) {
    // Add item but avoid duplicates
    if (!state.selectedItems.some(i => i.path === item.path)) {
      state.selectedItems.push(item);
    }
  } else {
    // Remove item
    state.selectedItems = state.selectedItems.filter(i => i.path !== item.path);
  }
  
  // Update download bar
  updateDownloadBar();
}

// Optimized download bar creation
function createDownloadBar() {
  if (state.uiElements.downloadBar) {
    updateDownloadBar();
    return;
  }
  
  const downloadBar = document.createElement('div');
  downloadBar.className = 'gh-downloader-bar';
  downloadBar.innerHTML = `
    <div class="gh-downloader-count">Select files to download</div>
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
  
  // Use event delegation for better performance
  downloadBar.querySelector('.gh-download-btn').addEventListener('click', handleDownload);
  downloadBar.querySelector('.gh-insights-btn').addEventListener('click', toggleInsightsPanel);
  downloadBar.querySelector('.gh-export-btn').addEventListener('click', handleExportReadme);
  
  document.body.appendChild(downloadBar);
  state.uiElements.downloadBar = downloadBar;
  
  // Show download bar by default
  downloadBar.style.display = 'flex';
}

// More efficient download bar updating
function updateDownloadBar() {
  const downloadBar = state.uiElements.downloadBar;
  if (!downloadBar) return;
  
  // Always show the download bar on GitHub repo pages
  downloadBar.style.display = 'flex';
  
  const count = state.selectedItems.length;
  downloadBar.querySelector('.gh-downloader-count').textContent = 
    count > 0 ? `${count} item${count !== 1 ? 's' : ''} selected` : 'Select files to download';
}

// Optimized download handling
function handleDownload() {
  if (state.selectedItems.length === 0) return;
  
  if (state.selectedItems.length === 1 && state.selectedItems[0].type === 'file') {
    downloadSingleFile(state.selectedItems[0]);
    return;
  }
  
  downloadMultipleItems();
}

// More efficient single file download
function downloadSingleFile(item) {
  const { owner, repo, branch } = state.repoInfo;
  const pathSegment = item.path.split('/blob/')[1];
  
  if (!pathSegment) {
    showToast('Invalid file path', 'error');
    return;
  }
  
  const rawUrl = `https://raw.githubusercontent.com/${owner}/${repo}/${pathSegment}`;
  
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

// Placeholder for multiple items download
function downloadMultipleItems() {
  showToast('Preparing download... This may take a moment');
  
  setTimeout(() => {
    showToast('Multiple files download feature is being implemented');
  }, 1000);
}

// Toggle insights panel visibility
function toggleInsightsPanel() {
  const panel = state.uiElements.insightsPanel;
  if (!panel) return;
  
  if (state.isPanelVisible) {
    panel.classList.remove('gh-panel-visible');
    state.isPanelVisible = false;
  } else {
    showInsightsPanel();
  }
}

// Optimized insights panel creation
function createInsightsPanel() {
  if (state.uiElements.insightsPanel) return;
  
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
  
  // Add event listener
  panel.querySelector('.gh-insights-close').addEventListener('click', () => {
    panel.classList.remove('gh-panel-visible');
    state.isPanelVisible = false;
  });
  
  document.body.appendChild(panel);
  state.uiElements.insightsPanel = panel;
}

// More efficient insights panel display
function showInsightsPanel() {
  const panel = state.uiElements.insightsPanel;
  if (!panel) return;
  
  panel.classList.add('gh-panel-visible');
  state.isPanelVisible = true;
  loadRepositoryInsights();
}

// Optimized repository insights loading
function loadRepositoryInsights() {
  const { owner, repo } = state.repoInfo;
  if (!owner || !repo) return;
  
  const apiUrl = `https://api.github.com/repos/${owner}/${repo}`;
  const insightsPanel = state.uiElements.insightsPanel;
  if (!insightsPanel) return;
  
  const loadingEl = insightsPanel.querySelector('.gh-insights-loading');
  const dataEl = insightsPanel.querySelector('.gh-insights-data');
  
  loadingEl.style.display = 'flex';
  dataEl.style.display = 'none';
  
  chrome.runtime.sendMessage({
    type: 'fetchRepoData',
    url: apiUrl
  }, response => {
    if (!loadingEl || !dataEl) return; // Check if elements still exist
    
    loadingEl.style.display = 'none';
    dataEl.style.display = 'block';
    
    if (response && response.success && response.data) {
      const data = response.data;
      
      // Update UI with repository data more efficiently
      const sizeEl = insightsPanel.querySelector('#repo-size');
      if (sizeEl) sizeEl.textContent = formatBytes(data.size * 1024);
      
      const langEl = insightsPanel.querySelector('#repo-language');
      if (langEl) langEl.textContent = data.language || 'N/A';
      
      const filesEl = insightsPanel.querySelector('#repo-files');
      if (filesEl) filesEl.textContent = 'Calculating...';
      
      const contribEl = insightsPanel.querySelector('#repo-contributors');
      if (contribEl) contribEl.textContent = `${data.watchers} watchers`;
      
      const langChartEl = insightsPanel.querySelector('#language-chart');
      if (langChartEl) langChartEl.textContent = `Primary language: ${data.language || 'Unknown'}`;
      
      const commitChartEl = insightsPanel.querySelector('#commit-chart');
      if (commitChartEl) commitChartEl.textContent = `Last updated: ${new Date(data.updated_at).toLocaleDateString()}`;
    } else {
      // Show error message
      dataEl.innerHTML = '<div class="gh-insights-error">Error loading repository insights</div>';
    }
  });
}

// Optimized README export handling
function handleExportReadme() {
  const readmeLink = Array.from(document.querySelectorAll('.js-navigation-open'))
    .find(el => el.textContent.toLowerCase().includes('readme'));
  
  if (!readmeLink) {
    showToast('README file not found in this directory', 'warning');
    return;
  }
  
  showExportModal(readmeLink.getAttribute('href'));
}

// Memory-optimized export modal
function showExportModal(readmePath) {
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
    
    // Use event delegation for better performance
    const closeBtn = modal.querySelector('.gh-export-modal-close');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => {
        modal.classList.remove('gh-modal-visible');
      });
    }
    
    const overlay = modal.querySelector('.gh-export-modal-overlay');
    if (overlay) {
      overlay.addEventListener('click', () => {
        modal.classList.remove('gh-modal-visible');
      });
    }
    
    const pdfBtn = modal.querySelector('.gh-export-btn-pdf');
    if (pdfBtn) {
      pdfBtn.addEventListener('click', () => {
        exportReadme(readmePath, 'pdf');
        modal.classList.remove('gh-modal-visible');
      });
    }
    
    const docxBtn = modal.querySelector('.gh-export-btn-docx');
    if (docxBtn) {
      docxBtn.addEventListener('click', () => {
        exportReadme(readmePath, 'docx');
        modal.classList.remove('gh-modal-visible');
      });
    }
    
    document.body.appendChild(modal);
  }
  
  // Show modal
  modal.classList.add('gh-modal-visible');
}

// README export placeholder
function exportReadme(path, format) {
  showToast(`Preparing README ${format.toUpperCase()} export...`);
  
  // Simulate export without heavy processing
  setTimeout(() => {
    showToast(`README ${format.toUpperCase()} export prepared`);
  }, 800);
}

// Memory-efficient toast notification
function showToast(message, type = 'info') {
  // Remove any existing toast to prevent accumulation
  const existingToasts = document.querySelectorAll('.gh-toast');
  existingToasts.forEach(toast => toast.remove());
  
  // Create new toast
  const toast = document.createElement('div');
  toast.className = `gh-toast gh-toast-${type}`;
  toast.textContent = message;
  
  // Add to document
  document.body.appendChild(toast);
  
  // Trigger animation with requestAnimationFrame for better performance
  requestAnimationFrame(() => {
    toast.classList.add('gh-toast-visible');
  });
  
  // Auto remove after 3 seconds using setTimeout only once
  setTimeout(() => {
    if (toast && document.body.contains(toast)) {
      toast.classList.remove('gh-toast-visible');
      setTimeout(() => {
        if (toast && document.body.contains(toast)) {
          toast.remove();
        }
      }, 300);
    }
  }, 3000);
}

// Format bytes utility optimized
function formatBytes(bytes, decimals = 2) {
  if (!bytes || bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

// Memory-efficient DOM observer
function observeDOMChanges() {
  // Disconnect any existing observers
  if (state.observers.length) {
    state.observers.forEach(observer => observer.disconnect());
    state.observers = [];
  }
  
  // Create a new optimized observer
  const observer = new MutationObserver(() => {
    // Only reinitialize if needed and not too frequently
    // Use a flag to prevent multiple rapid initializations
    if (!state.initialized) {
      // Reset state for clean initialization
      setTimeout(initExtension, 300);
    }
  });
  
  // Observe only necessary parts of the DOM
  observer.observe(document.body, { 
    childList: true,
    subtree: true
  });
  
  // Keep reference for cleanup
  state.observers.push(observer);
}

// Document click handler
function handleDocumentClick(e) {
  // Close modals when clicking outside
  if (e.target.classList.contains('gh-export-modal-overlay')) {
    const modal = document.querySelector('.gh-export-modal');
    if (modal) modal.classList.remove('gh-modal-visible');
  }
}

// URL change detection with performance optimization
let lastUrl = location.href;
function checkForUrlChange() {
  const currentUrl = location.href;
  if (currentUrl !== lastUrl) {
    console.log('GitHub Downloader & Analyzer: URL changed');
    lastUrl = currentUrl;
    
    // Reset state when URL changes
    state.initialized = false;
    state.selectedItems = [];
    state.isPanelVisible = false;
    
    // Reinitialize after URL change
    setTimeout(initExtension, 300);
  }
}

// Initialize the extension more efficiently
function initialize() {
  // Run initialization immediately
  initExtension();
  
  // Set up URL change detection with a longer interval to save resources
  setInterval(checkForUrlChange, 1000);
}

// Run extension initialization immediately when script loads
initialize();

// Cleanup function to prevent memory leaks
function cleanup() {
  // Remove all event listeners and observers
  if (state.observers.length) {
    state.observers.forEach(observer => observer.disconnect());
  }
  
  // Remove UI elements
  const { downloadBar, insightsPanel } = state.uiElements;
  if (downloadBar && document.body.contains(downloadBar)) {
    downloadBar.remove();
  }
  if (insightsPanel && document.body.contains(insightsPanel)) {
    insightsPanel.remove();
  }
  
  // Reset state
  state.initialized = false;
  state.selectedItems = [];
  state.isPanelVisible = false;
}

// Clear all resources on unload
window.addEventListener('unload', cleanup);
