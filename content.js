
/**
 * GitHub Enhancer Pro - Content Script
 * Injects UI enhancements directly into GitHub's interface
 */

// Configuration
const CONFIG = {
  apiBaseUrl: 'https://api.github.com',
  rawContentUrl: 'https://raw.githubusercontent.com',
  selectors: {
    fileList: '.Box-row.js-navigation-item',
    fileNameCol: '.js-navigation-open',
    readmeContainer: '#readme',
    repoHeader: '.Layout-main',
    repoNavigation: '.file-navigation',
  },
  refreshInterval: 500, // ms to wait for GitHub's UI to update after navigation
  version: '1.0.0'
};

// Global state
const state = {
  initialized: false,
  repoInfo: {
    owner: '',
    repo: '',
    branch: 'main',
    path: '',
  },
  currentView: '',
  uiElements: {
    sidebar: null,
    fileCheckboxes: new Map(),
    selectedFiles: new Set(),
    toast: null,
    collapsedState: false,
    hiddenState: false
  },
  // Cache API responses to reduce requests
  cache: {
    fileData: new Map(),
    repoStats: null,
  },
};

// Main initialization
function init() {
  // Don't initialize multiple times
  if (state.initialized) return;
  
  // Only initialize on GitHub repository pages
  if (!isGitHubRepoPage()) return;
  
  console.log('GitHub Enhancer: Initializing...');
  
  // Load saved preferences
  loadUserPreferences().then(() => {
    // Extract repository information
    extractRepoInfo();
    
    // Initialize UI elements
    createSidebar();
    observePageChanges();
    
    // Update file navigation when on file list view
    if (isFileExplorerPage()) {
      enhanceFileExplorer();
    }
    
    // Mark as initialized
    state.initialized = true;
    console.log('GitHub Enhancer: Initialized successfully');
  });
}

/**
 * Load user preferences from storage
 */
async function loadUserPreferences() {
  return new Promise((resolve) => {
    chrome.storage.local.get(
      ['sidebarCollapsed', 'sidebarHidden'], 
      (result) => {
        state.uiElements.collapsedState = result.sidebarCollapsed || false;
        state.uiElements.hiddenState = result.sidebarHidden || false;
        resolve();
      }
    );
  });
}

/**
 * Save user preferences to storage
 */
function saveUserPreferences() {
  chrome.storage.local.set({
    sidebarCollapsed: state.uiElements.collapsedState,
    sidebarHidden: state.uiElements.hiddenState
  });
}

/**
 * Check if current page is a GitHub repository page
 */
function isGitHubRepoPage() {
  const path = window.location.pathname.split('/').filter(Boolean);
  return window.location.hostname === 'github.com' && 
         path.length >= 2 && 
         !['settings', 'marketplace', 'explore', 'notifications', 'account', 'login'].includes(path[0]);
}

/**
 * Check if current page is a file explorer page
 */
function isFileExplorerPage() {
  return document.querySelector(CONFIG.selectors.fileList) !== null;
}

/**
 * Check if current page has a README
 */
function hasReadme() {
  return document.querySelector(CONFIG.selectors.readmeContainer) !== null;
}

/**
 * Extract repository information from URL
 */
function extractRepoInfo() {
  const pathParts = window.location.pathname.split('/').filter(Boolean);
  
  if (pathParts.length >= 2) {
    state.repoInfo.owner = pathParts[0];
    state.repoInfo.repo = pathParts[1];
    
    // Handle branches and file paths
    if (pathParts.length > 3 && pathParts[2] === 'tree') {
      state.repoInfo.branch = pathParts[3];
      state.repoInfo.path = pathParts.slice(4).join('/');
    } else if (pathParts.length > 3 && pathParts[2] === 'blob') {
      state.repoInfo.branch = pathParts[3];
      state.repoInfo.path = pathParts.slice(4).join('/');
    } else {
      // Default branch - try to get from page
      const defaultBranchElement = document.querySelector('span.css-truncate-target[data-menu-button]');
      if (defaultBranchElement) {
        state.repoInfo.branch = defaultBranchElement.textContent.trim();
      }
    }
    
    // Determine current view
    if (pathParts.length > 2) {
      if (pathParts[2] === 'tree') {
        state.currentView = 'file-explorer';
      } else if (pathParts[2] === 'blob') {
        state.currentView = 'file-view';
      } else if (pathParts[2] === 'issues') {
        state.currentView = 'issues';
      } else if (pathParts[2] === 'pull') {
        state.currentView = 'pull-requests';
      } else {
        state.currentView = 'other';
      }
    } else {
      state.currentView = 'repo-root';
    }
  }
}

/**
 * Create and inject the sidebar
 */
function createSidebar() {
  // Remove existing sidebar if it exists
  if (state.uiElements.sidebar) {
    state.uiElements.sidebar.remove();
    state.uiElements.sidebar = null;
  }
  
  // Create sidebar container
  const sidebar = document.createElement('div');
  sidebar.className = 'gh-enhancer-sidebar';
  sidebar.id = 'github-enhancer-sidebar';
  
  // Apply saved state
  if (state.uiElements.collapsedState) {
    sidebar.classList.add('collapsed');
  }
  
  if (state.uiElements.hiddenState) {
    sidebar.classList.add('hidden');
  }
  
  // Apply theme attributes from GitHub
  sidebar.setAttribute('data-color-mode', document.documentElement.getAttribute('data-color-mode') || document.body.getAttribute('data-color-mode') || 'auto');
  sidebar.setAttribute('data-theme', document.documentElement.getAttribute('data-theme') || document.body.getAttribute('data-theme') || '');
  
  // Create toggle button
  const toggleButton = document.createElement('button');
  toggleButton.className = 'gh-enhancer-toggle';
  toggleButton.setAttribute('aria-label', 'Toggle GitHub Enhancer sidebar');
  toggleButton.innerHTML = `
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M19 12H5M12 19l-7-7 7-7"/>
    </svg>
    <span class="sr-only">Toggle sidebar</span>
  `;
  toggleButton.addEventListener('click', toggleSidebar);
  sidebar.appendChild(toggleButton);

  // Create sidebar content container
  const sidebarContent = document.createElement('div');
  sidebarContent.className = 'gh-enhancer-content';
  
  // Create header with tabs
  const header = createSidebarHeader();
  sidebarContent.appendChild(header);
  
  // Create tab contents container
  const tabContents = document.createElement('div');
  tabContents.className = 'gh-enhancer-tab-contents';
  
  // Add the various tabs
  tabContents.appendChild(createOverviewTab());
  tabContents.appendChild(createFilesTab());
  tabContents.appendChild(createReadmeTab());
  tabContents.appendChild(createActionsTab());
  
  sidebarContent.appendChild(tabContents);
  sidebar.appendChild(sidebarContent);
  
  // Add to page and store reference
  document.body.appendChild(sidebar);
  state.uiElements.sidebar = sidebar;
  
  // Start with overview tab selected
  switchTab('overview');
  
  // Load data for the overview tab
  loadRepoOverview();
  
  // Adjust the GitHub layout
  adjustGitHubLayout();
}

/**
 * Adjust GitHub layout to accommodate the sidebar
 */
function adjustGitHubLayout() {
  const mainContent = document.querySelector('.Layout-main');
  if (!mainContent) return;

  // Reset any existing styles
  mainContent.style.width = '';
  
  // Apply transition for smooth resizing
  mainContent.style.transition = 'width 0.2s ease-out';
  
  // Adjust width based on sidebar state
  if (state.uiElements.sidebar) {
    if (state.uiElements.hiddenState) {
      mainContent.style.width = '100%';
    } else if (state.uiElements.collapsedState) {
      mainContent.style.width = `calc(100% - var(--gh-enhancer-collapsed-width))`;
    } else {
      mainContent.style.width = `calc(100% - var(--gh-enhancer-width))`;
    }
  }
}

/**
 * Create the sidebar header with tabs
 */
function createSidebarHeader() {
  const header = document.createElement('div');
  header.className = 'gh-enhancer-header';
  
  const title = document.createElement('h3');
  title.textContent = 'GitHub Enhancer';
  
  const version = document.createElement('span');
  version.textContent = ` v${CONFIG.version}`;
  version.style.fontSize = '12px';
  version.style.color = 'var(--gh-enhancer-muted-color)';
  version.style.fontWeight = 'normal';
  title.appendChild(version);
  
  header.appendChild(title);
  
  const tabs = document.createElement('div');
  tabs.className = 'gh-enhancer-tabs';
  
  // Define tabs
  const tabsData = [
    { id: 'overview', label: 'Overview' },
    { id: 'files', label: 'Files' },
    { id: 'readme', label: 'README' },
    { id: 'actions', label: 'Actions' }
  ];
  
  // Create tab buttons
  tabsData.forEach((tab, index) => {
    const button = document.createElement('button');
    button.className = 'gh-tab' + (index === 0 ? ' active' : '');
    button.setAttribute('data-tab', tab.id);
    button.textContent = tab.label;
    button.addEventListener('click', () => switchTab(tab.id));
    tabs.appendChild(button);
  });
  
  header.appendChild(tabs);
  return header;
}

/**
 * Create the Overview tab content
 */
function createOverviewTab() {
  const tab = document.createElement('div');
  tab.className = 'gh-tab-content';
  tab.setAttribute('data-tab', 'overview');
  
  tab.innerHTML = `
    <div class="gh-enhancer-loading">
      <div class="gh-enhancer-spinner"></div>
      <p>Loading repository information...</p>
    </div>
    <div class="gh-enhancer-overview" style="display: none;">
      <div class="gh-stat">
        <div class="gh-stat-label">Repository Size</div>
        <div class="gh-stat-value" id="repo-size">-</div>
      </div>
      <div class="gh-stat">
        <div class="gh-stat-label">Primary Language</div>
        <div class="gh-stat-value" id="repo-language">-</div>
      </div>
      <div class="gh-stat">
        <div class="gh-stat-label">Last Updated</div>
        <div class="gh-stat-value" id="repo-updated">-</div>
      </div>
      <div class="gh-chart">
        <h4>Language Breakdown</h4>
        <div id="language-chart" class="gh-chart-container"></div>
      </div>
      <div class="gh-chart">
        <h4>Tech Stack</h4>
        <div id="tech-stack" class="gh-tech-badges"></div>
      </div>
    </div>
  `;
  
  return tab;
}

/**
 * Create the Files tab content
 */
function createFilesTab() {
  const tab = document.createElement('div');
  tab.className = 'gh-tab-content';
  tab.setAttribute('data-tab', 'files');
  
  tab.innerHTML = `
    <div class="gh-file-manager">
      <div class="gh-file-selection">
        <div class="gh-selection-header">
          <span id="selected-count">0 files selected</span>
          <button id="download-selected" class="gh-action-btn" disabled>
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
              <polyline points="7 10 12 15 17 10"></polyline>
              <line x1="12" y1="15" x2="12" y2="3"></line>
            </svg>
            Download Selected
          </button>
        </div>
        <div class="gh-selection-notice">
          <p>Select files using checkboxes in the file list to download them.</p>
        </div>
      </div>
      <div class="gh-file-stats">
        <div class="gh-stat">
          <div class="gh-stat-label">Current Directory</div>
          <div class="gh-stat-value" id="current-path">-</div>
        </div>
        <div class="gh-stat">
          <div class="gh-stat-label">Files</div>
          <div class="gh-stat-value" id="file-count">-</div>
        </div>
        <div class="gh-stat">
          <div class="gh-stat-label">Total Size</div>
          <div class="gh-stat-value" id="total-size">-</div>
        </div>
      </div>
      <div class="gh-file-section">
        <h4>Largest Files</h4>
        <ul id="largest-files" class="gh-file-list">
          <li class="gh-loading-placeholder">Analyzing files...</li>
        </ul>
      </div>
    </div>
  `;
  
  // Add event listener for download selected button
  tab.querySelector('#download-selected').addEventListener('click', downloadSelectedFiles);
  
  return tab;
}

/**
 * Create the README tab content
 */
function createReadmeTab() {
  const tab = document.createElement('div');
  tab.className = 'gh-tab-content';
  tab.setAttribute('data-tab', 'readme');
  
  tab.innerHTML = `
    <div class="gh-readme-export">
      <div class="gh-readme-header">
        <h4>README.md Export</h4>
        <p>Export the README file to various formats</p>
      </div>
      <div class="gh-export-options">
        <button id="export-md" class="gh-export-btn">
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
            <polyline points="14 2 14 8 20 8"></polyline>
            <line x1="16" y1="13" x2="8" y2="13"></line>
            <line x1="16" y1="17" x2="8" y2="17"></line>
            <polyline points="10 9 9 9 8 9"></polyline>
          </svg>
          Markdown (.md)
        </button>
        <button id="export-txt" class="gh-export-btn">
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
            <polyline points="14 2 14 8 20 8"></polyline>
            <line x1="16" y1="13" x2="8" y2="13"></line>
            <line x1="16" y1="17" x2="8" y2="17"></line>
            <polyline points="10 9 9 9 8 9"></polyline>
          </svg>
          Text (.txt)
        </button>
        <button id="export-pdf" class="gh-export-btn">
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
            <polyline points="14 2 14 8 20 8"></polyline>
            <line x1="16" y1="13" x2="8" y2="13"></line>
            <line x1="16" y1="17" x2="8" y2="17"></line>
            <polyline points="10 9 9 9 8 9"></polyline>
          </svg>
          PDF (.pdf)
        </button>
        <button id="export-docx" class="gh-export-btn">
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
            <polyline points="14 2 14 8 20 8"></polyline>
            <line x1="16" y1="13" x2="8" y2="13"></line>
            <line x1="16" y1="17" x2="8" y2="17"></line>
            <polyline points="10 9 9 9 8 9"></polyline>
          </svg>
          Word (.docx)
        </button>
      </div>
      <div id="readme-preview" class="gh-readme-preview">
        <div class="gh-loading-placeholder">Loading README preview...</div>
      </div>
    </div>
  `;
  
  // Add event listeners for export buttons
  tab.querySelector('#export-md').addEventListener('click', () => exportReadme('md'));
  tab.querySelector('#export-txt').addEventListener('click', () => exportReadme('txt'));
  tab.querySelector('#export-pdf').addEventListener('click', () => exportReadme('pdf'));
  tab.querySelector('#export-docx').addEventListener('click', () => exportReadme('docx'));
  
  return tab;
}

/**
 * Create the Actions tab content
 */
function createActionsTab() {
  const tab = document.createElement('div');
  tab.className = 'gh-tab-content';
  tab.setAttribute('data-tab', 'actions');
  
  tab.innerHTML = `
    <div class="gh-actions-panel">
      <div class="gh-action-group">
        <h4>Quick Actions</h4>
        <button id="clone-repo" class="gh-action-btn">
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
          </svg>
          Copy Clone URL
        </button>
        <button id="download-zip" class="gh-action-btn">
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
            <polyline points="7 10 12 15 17 10"></polyline>
            <line x1="12" y1="15" x2="12" y2="3"></line>
          </svg>
          Download ZIP
        </button>
        <button id="open-codespace" class="gh-action-btn">
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="16 18 22 12 16 6"></polyline>
            <polyline points="8 6 2 12 8 18"></polyline>
          </svg>
          Open in Codespace
        </button>
      </div>
      
      <div class="gh-action-group">
        <h4>Extension Options</h4>
        <div class="gh-stat">
          <div class="gh-stat-label">Show Sidebar</div>
          <div class="gh-stat-value">
            <label class="gh-enhancer-switch">
              <input type="checkbox" id="toggle-sidebar">
              <span class="gh-enhancer-slider"></span>
            </label>
          </div>
        </div>
      </div>

      <div class="gh-action-group">
        <h4>External Tools</h4>
        <button id="open-codesandbox" class="gh-action-btn">
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
          </svg>
          Open in CodeSandbox
        </button>
        <button id="open-gitpod" class="gh-action-btn">
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
            <line x1="3" y1="9" x2="21" y2="9"></line>
            <line x1="3" y1="15" x2="21" y2="15"></line>
            <line x1="9" y1="3" x2="9" y2="21"></line>
            <line x1="15" y1="3" x2="15" y2="21"></line>
          </svg>
          Open in GitPod
        </button>
      </div>
    </div>
  `;
  
  // Add event listeners
  tab.querySelector('#clone-repo').addEventListener('click', copyCloneUrl);
  tab.querySelector('#download-zip').addEventListener('click', downloadZip);
  tab.querySelector('#open-codespace').addEventListener('click', openInCodespace);
  tab.querySelector('#open-codesandbox').addEventListener('click', openInCodeSandbox);
  tab.querySelector('#open-gitpod').addEventListener('click', openInGitpod);
  
  // Add sidebar visibility toggle
  const sidebarToggle = tab.querySelector('#toggle-sidebar');
  sidebarToggle.checked = !state.uiElements.hiddenState;
  sidebarToggle.addEventListener('change', () => {
    state.uiElements.hiddenState = !sidebarToggle.checked;
    saveUserPreferences();
    
    if (state.uiElements.sidebar) {
      if (state.uiElements.hiddenState) {
        state.uiElements.sidebar.classList.add('hidden');
      } else {
        state.uiElements.sidebar.classList.remove('hidden');
      }
    }
    
    // Adjust main content width
    adjustGitHubLayout();
  });
  
  return tab;
}

/**
 * Switch between tabs
 */
function switchTab(tabId) {
  if (!state.uiElements.sidebar) return;
  
  // Update tab buttons
  const tabButtons = state.uiElements.sidebar.querySelectorAll('.gh-tab');
  tabButtons.forEach(btn => {
    if (btn.getAttribute('data-tab') === tabId) {
      btn.classList.add('active');
      btn.setAttribute('aria-selected', 'true');
    } else {
      btn.classList.remove('active');
      btn.setAttribute('aria-selected', 'false');
    }
  });
  
  // Update tab content
  const tabContents = state.uiElements.sidebar.querySelectorAll('.gh-tab-content');
  tabContents.forEach(content => {
    if (content.getAttribute('data-tab') === tabId) {
      content.classList.add('active');
      // Load data for specific tabs if needed
      if (tabId === 'files' && isFileExplorerPage()) {
        updateFileManager();
      } else if (tabId === 'readme' && hasReadme()) {
        loadReadmeContent();
      }
    } else {
      content.classList.remove('active');
    }
  });
}

/**
 * Toggle sidebar visibility
 */
function toggleSidebar() {
  const sidebar = state.uiElements.sidebar;
  if (!sidebar) return;
  
  sidebar.classList.toggle('collapsed');
  state.uiElements.collapsedState = sidebar.classList.contains('collapsed');
  
  // Save preference
  saveUserPreferences();
  
  // Adjust GitHub layout
  adjustGitHubLayout();
}

/**
 * Enhance file explorer with file sizes and checkboxes
 */
function enhanceFileExplorer() {
  // Clear previous state
  state.uiElements.fileCheckboxes.clear();
  state.uiElements.selectedFiles.clear();
  
  // Find all file and directory rows
  const fileRows = document.querySelectorAll(CONFIG.selectors.fileList);
  if (!fileRows.length) return;
  
  // Process each row
  fileRows.forEach(row => {
    // Skip if already processed
    if (row.querySelector('.gh-enhancer-checkbox')) return;
    
    const fileLink = row.querySelector(CONFIG.selectors.fileNameCol);
    if (!fileLink) return;
    
    const fileName = fileLink.textContent.trim();
    const isDirectory = row.querySelector('[aria-label="Directory"]') !== null;
    const path = fileLink.getAttribute('href')?.split('/').slice(5).join('/') || '';
    
    // Create checkbox container
    const checkboxContainer = document.createElement('div');
    checkboxContainer.style.display = 'inline-flex';
    checkboxContainer.style.alignItems = 'center';
    checkboxContainer.style.marginRight = '8px';
    
    // Create checkbox
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.className = 'gh-enhancer-checkbox';
    checkbox.setAttribute('data-path', path);
    checkbox.setAttribute('data-name', fileName);
    checkbox.setAttribute('data-type', isDirectory ? 'dir' : 'file');
    checkbox.setAttribute('aria-label', `Select ${fileName}`);
    
    // Append checkbox to container
    checkboxContainer.appendChild(checkbox);
    
    // Create size cell
    const sizeCell = document.createElement('div');
    sizeCell.className = 'gh-enhancer-size-cell';
    sizeCell.innerHTML = '<span class="gh-enhancer-loading-size">...</span>';
    
    // Find insert points
    // For new GitHub UI - find the first content td
    const contentCell = row.querySelector('td:first-child');
    
    if (contentCell) {
      // If using the table layout
      contentCell.style.display = 'flex';
      contentCell.style.alignItems = 'center';
      contentCell.prepend(checkboxContainer);
      row.appendChild(sizeCell);
    } else {
      // Fallback for other layouts
      const firstCell = row.firstChild;
      if (firstCell) {
        firstCell.style.display = 'flex';
        firstCell.style.alignItems = 'center';
        firstCell.prepend(checkboxContainer);
      }
      row.appendChild(sizeCell);
    }
    
    // Add size cell if it's a file row
    if (!isDirectory) {
      // Fetch and display file size
      fetchFileSize(path).then(size => {
        sizeCell.textContent = formatBytes(size);
      }).catch(() => {
        sizeCell.textContent = 'Unknown';
      });
    } else {
      sizeCell.textContent = '--';
    }
    
    // Store reference and add change event
    state.uiElements.fileCheckboxes.set(path, checkbox);
    checkbox.addEventListener('change', () => {
      if (checkbox.checked) {
        state.uiElements.selectedFiles.add(path);
      } else {
        state.uiElements.selectedFiles.delete(path);
      }
      updateSelectionStatus();
    });
  });
  
  // Add selection header before the file list
  addSelectionHeaderToFileList();
  
  // Update file manager in sidebar
  updateFileManager();
}

/**
 * Add selection header to file list in GitHub UI
 */
function addSelectionHeaderToFileList() {
  // Skip if already added
  if (document.querySelector('.gh-selection-header-main')) return;
  
  // Find the table header
  const fileListHeader = document.querySelector('.Box-header.position-sticky');
  if (!fileListHeader) return;
  
  // Create selection header
  const selectionHeader = document.createElement('div');
  selectionHeader.className = 'gh-selection-header-main';
  selectionHeader.style.display = 'none'; // Initially hidden
  selectionHeader.innerHTML = `
    <div class="gh-selection-count">0 files selected</div>
    <div class="gh-selection-actions">
      <button class="gh-selection-download-btn" disabled>
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
          <polyline points="7 10 12 15 17 10"></polyline>
          <line x1="12" y1="15" x2="12" y2="3"></line>
        </svg>
        Download Selected
      </button>
    </div>
  `;
  
  // Add button event
  selectionHeader.querySelector('.gh-selection-download-btn').addEventListener('click', downloadSelectedFiles);
  
  // Insert before file list
  fileListHeader.parentNode.insertBefore(selectionHeader, fileListHeader);
}

/**
 * Update selection status after checkbox changes
 */
function updateSelectionStatus() {
  const count = state.uiElements.selectedFiles.size;
  
  // Update sidebar selection counter
  const sidebarCounter = state.uiElements.sidebar?.querySelector('#selected-count');
  if (sidebarCounter) {
    sidebarCounter.textContent = `${count} ${count === 1 ? 'file' : 'files'} selected`;
  }
  
  // Update sidebar download button
  const sidebarDownloadBtn = state.uiElements.sidebar?.querySelector('#download-selected');
  if (sidebarDownloadBtn) {
    sidebarDownloadBtn.disabled = count === 0;
  }
  
  // Update main UI selection header
  const mainHeader = document.querySelector('.gh-selection-header-main');
  if (mainHeader) {
    mainHeader.style.display = count > 0 ? 'flex' : 'none';
    
    // Update main UI selection counter
    const mainCounter = mainHeader.querySelector('.gh-selection-count');
    if (mainCounter) {
      mainCounter.textContent = `${count} ${count === 1 ? 'file' : 'files'} selected`;
    }
    
    // Update main UI download button
    const mainDownloadBtn = mainHeader.querySelector('.gh-selection-download-btn');
    if (mainDownloadBtn) {
      mainDownloadBtn.disabled = count === 0;
    }
  }
}

/**
 * Update file manager in sidebar
 */
function updateFileManager() {
  if (!state.uiElements.sidebar) return;
  
  // Update current path
  const pathElement = state.uiElements.sidebar.querySelector('#current-path');
  if (pathElement) {
    pathElement.textContent = state.repoInfo.path || '/';
  }
  
  // Count files and directories
  const fileRows = document.querySelectorAll(CONFIG.selectors.fileList);
  let fileCount = 0;
  let totalSize = 0;
  
  fileRows.forEach(row => {
    const isDirectory = row.querySelector('[aria-label="Directory"]') !== null;
    if (!isDirectory) {
      fileCount++;
      // Try to get size from the file size cell we added
      const sizeCell = row.querySelector('.gh-enhancer-size-cell');
      if (sizeCell && !sizeCell.textContent.includes('...')) {
        // Parse size from text like "1.2 KB"
        const sizeText = sizeCell.textContent.trim();
        totalSize += parseApproximateSize(sizeText);
      }
    }
  });
  
  // Update file count
  const fileCountElement = state.uiElements.sidebar.querySelector('#file-count');
  if (fileCountElement) {
    fileCountElement.textContent = fileCount.toString();
  }
  
  // Update total size
  const totalSizeElement = state.uiElements.sidebar.querySelector('#total-size');
  if (totalSizeElement) {
    totalSizeElement.textContent = formatBytes(totalSize);
  }
  
  // Update largest files list
  updateLargestFilesList();
}

/**
 * Update the largest files list in the sidebar
 */
function updateLargestFilesList() {
  if (!state.uiElements.sidebar) return;
  
  const largestFilesElement = state.uiElements.sidebar.querySelector('#largest-files');
  if (!largestFilesElement) return;
  
  // Collect file sizes
  const files = [];
  document.querySelectorAll(CONFIG.selectors.fileList).forEach(row => {
    const isDirectory = row.querySelector('[aria-label="Directory"]') !== null;
    if (isDirectory) return;
    
    const fileLink = row.querySelector(CONFIG.selectors.fileNameCol);
    const sizeCell = row.querySelector('.gh-enhancer-size-cell');
    
    if (fileLink && sizeCell && !sizeCell.textContent.includes('...')) {
      const fileName = fileLink.textContent.trim();
      const sizeText = sizeCell.textContent.trim();
      const size = parseApproximateSize(sizeText);
      
      files.push({ name: fileName, size: size, sizeText: sizeText });
    }
  });
  
  // Sort by size (largest first)
  files.sort((a, b) => b.size - a.size);
  
  // Update list
  largestFilesElement.innerHTML = '';
  
  if (files.length === 0) {
    largestFilesElement.innerHTML = '<li class="gh-loading-placeholder">No files to analyze</li>';
    return;
  }
  
  // Take top 5 files
  files.slice(0, 5).forEach(file => {
    const li = document.createElement('li');
    li.className = 'gh-file-item';
    li.innerHTML = `
      <div class="gh-file-name">${file.name}</div>
      <div class="gh-file-size">${file.sizeText}</div>
    `;
    largestFilesElement.appendChild(li);
  });
}

/**
 * Load repository overview data
 */
function loadRepoOverview() {
  const { owner, repo } = state.repoInfo;
  if (!owner || !repo) return;
  
  const sidebar = state.uiElements.sidebar;
  if (!sidebar) return;
  
  // Show loading state
  const loadingEl = sidebar.querySelector('[data-tab="overview"] .gh-enhancer-loading');
  const overviewEl = sidebar.querySelector('[data-tab="overview"] .gh-enhancer-overview');
  
  if (loadingEl) loadingEl.style.display = 'flex';
  if (overviewEl) overviewEl.style.display = 'none';
  
  // Fetch repo data
  fetchRepoData().then(data => {
    if (!data) {
      showError('overview', 'Could not load repository data');
      return;
    }
    
    // Update overview
    updateOverview(data);
    
    // Hide loading, show content
    if (loadingEl) loadingEl.style.display = 'none';
    if (overviewEl) overviewEl.style.display = 'block';
    
    // Also fetch languages
    fetchLanguages();
  }).catch(err => {
    console.error('GitHub Enhancer: Error loading repo data:', err);
    showError('overview', 'Error loading repository data');
  });
  
  // Detect tech stack
  detectTechStack().then(stack => {
    updateTechStack(stack);
  });
}

/**
 * Update overview tab with repo data
 */
function updateOverview(data) {
  const sidebar = state.uiElements.sidebar;
  if (!sidebar) return;
  
  // Update size
  const sizeEl = sidebar.querySelector('#repo-size');
  if (sizeEl && data.size) {
    sizeEl.textContent = formatBytes(data.size * 1024); // GitHub API returns size in KB
  }
  
  // Update language
  const langEl = sidebar.querySelector('#repo-language');
  if (langEl) {
    langEl.textContent = data.language || 'Not specified';
  }
  
  // Update last updated
  const updatedEl = sidebar.querySelector('#repo-updated');
  if (updatedEl && data.updated_at) {
    const date = new Date(data.updated_at);
    updatedEl.textContent = date.toLocaleDateString();
  }
}

/**
 * Update language chart
 */
function updateLanguageChart(languages) {
  const sidebar = state.uiElements.sidebar;
  if (!sidebar) return;
  
  const chartEl = sidebar.querySelector('#language-chart');
  if (!chartEl) return;
  
  // If no languages data
  if (!languages || Object.keys(languages).length === 0) {
    chartEl.innerHTML = '<div class="gh-chart-empty">No language data available</div>';
    return;
  }
  
  // Calculate percentages
  const total = Object.values(languages).reduce((sum, count) => sum + count, 0);
  const langEntries = Object.entries(languages)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5); // Top 5 languages
  
  // Generate language bars
  let chartHtml = '<div class="gh-lang-bars">';
  
  langEntries.forEach(([lang, count]) => {
    const percentage = Math.round((count / total) * 100);
    const color = getLanguageColor(lang);
    
    chartHtml += `
      <div class="gh-lang-item">
        <div class="gh-lang-name">
          <span class="gh-lang-color" style="background-color: ${color}"></span>
          ${lang}
        </div>
        <div class="gh-lang-bar-wrap">
          <div class="gh-lang-bar" style="width: ${percentage}%; background-color: ${color}"></div>
        </div>
        <div class="gh-lang-percent">${percentage}%</div>
      </div>
    `;
  });
  
  chartHtml += '</div>';
  chartEl.innerHTML = chartHtml;
}

/**
 * Update tech stack badges
 */
function updateTechStack(stack) {
  const sidebar = state.uiElements.sidebar;
  if (!sidebar) return;
  
  const techStackEl = sidebar.querySelector('#tech-stack');
  if (!techStackEl) return;
  
  if (!stack || stack.length === 0) {
    techStackEl.innerHTML = '<div class="gh-chart-empty">No tech stack detected</div>';
    return;
  }
  
  // Create badges
  techStackEl.innerHTML = '';
  stack.forEach(tech => {
    const badge = document.createElement('span');
    badge.className = 'gh-tech-badge';
    badge.textContent = tech;
    techStackEl.appendChild(badge);
  });
}

/**
 * Load README content for export
 */
function loadReadmeContent() {
  const sidebar = state.uiElements.sidebar;
  if (!sidebar) return;
  
  const previewEl = sidebar.querySelector('#readme-preview');
  if (!previewEl) return;
  
  // Check if README exists
  const readmeElement = document.querySelector(CONFIG.selectors.readmeContainer);
  if (!readmeElement) {
    previewEl.innerHTML = '<div class="gh-chart-empty">No README found in this repository</div>';
    return;
  }
  
  // Get README content
  const readmeContent = readmeElement.querySelector('article');
  if (!readmeContent) {
    previewEl.innerHTML = '<div class="gh-chart-empty">Could not load README content</div>';
    return;
  }
  
  // Create a simplified preview
  previewEl.innerHTML = '';
  const preview = document.createElement('div');
  preview.className = 'gh-readme-content';
  preview.appendChild(readmeContent.cloneNode(true));
  
  // Remove any interactive elements
  preview.querySelectorAll('button, input, select').forEach(el => el.remove());
  
  previewEl.appendChild(preview);
}

/**
 * Export README to various formats
 */
function exportReadme(format) {
  const { owner, repo, branch } = state.repoInfo;
  if (!owner || !repo) {
    showToast('Repository information not available', 'error');
    return;
  }
  
  // Get README raw URL
  const readmeRawUrl = `${CONFIG.rawContentUrl}/${owner}/${repo}/${branch || 'main'}/README.md`;
  
  // Show loading toast
  showToast(`Preparing ${format.toUpperCase()} export...`, 'info');
  
  // Fetch raw content
  fetch(readmeRawUrl)
    .then(response => {
      if (!response.ok) {
        throw new Error('Failed to fetch README');
      }
      return response.text();
    })
    .then(content => {
      switch (format) {
        case 'md':
          downloadText(content, `${repo}-README.md`);
          showToast('README.md downloaded');
          break;
        case 'txt':
          // Strip markdown syntax for plain text
          const plainText = content
            .replace(/(?:^|\n)#+\s+([^\n]*)/g, '\n\n$1\n') // headers
            .replace(/(?:^|\n)[\*\-]\s+([^\n]*)/g, '\n• $1') // bullet points
            .replace(/(?:\*\*|__)(.*?)(?:\*\*|__)/g, '$1') // bold
            .replace(/(?:\*|_)(.*?)(?:\*|_)/g, '$1') // italic
            .replace(/(?:^|\n)```[^\n]*\n[\s\S]*?\n```/g, '') // code blocks
            .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1 ($2)') // links
            .replace(/!\[([^\]]+)\]\(([^)]+)\)/g, '[Image: $1]'); // images
            
          downloadText(plainText, `${repo}-README.txt`);
          showToast('README.txt downloaded');
          break;
        case 'pdf':
          // For PDF export using Blob and download API
          exportReadmeToPdf(content, `${repo}-README.pdf`);
          break;
        case 'docx':
          // For DOCX export using Blob and download API
          exportReadmeToDocx(content, `${repo}-README.docx`);
          break;
      }
    })
    .catch(error => {
      console.error('GitHub Enhancer: Error exporting README:', error);
      showToast('Failed to export README', 'error');
    });
}

/**
 * Export readme to PDF
 */
function exportReadmeToPdf(content, filename) {
  try {
    // Convert markdown to HTML
    const html = convertMarkdownToHtml(content);
    
    // Create a blob
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    
    // Download HTML file (since PDF conversion needs server-side processing)
    chrome.runtime.sendMessage({
      type: 'download',
      url: url,
      filename: filename.replace('.pdf', '.html')
    }, () => {
      URL.revokeObjectURL(url);
      showToast('README exported as HTML (PDF requires conversion)', 'info');
    });
  } catch (error) {
    console.error('PDF export error:', error);
    showToast('Failed to export as PDF', 'error');
  }
}

/**
 * Export readme to DOCX
 */
function exportReadmeToDocx(content, filename) {
  try {
    // Download as markdown since conversion to DOCX requires server-side processing
    const blob = new Blob([content], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    
    chrome.runtime.sendMessage({
      type: 'download',
      url: url,
      filename: filename.replace('.docx', '.md')
    }, () => {
      URL.revokeObjectURL(url);
      showToast('README exported as Markdown (DOCX requires conversion)', 'info');
    });
  } catch (error) {
    console.error('DOCX export error:', error);
    showToast('Failed to export as DOCX', 'error');
  }
}

/**
 * Convert markdown to HTML
 */
function convertMarkdownToHtml(markdown) {
  // This is a simple markdown to HTML converter
  let html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>README</title>
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif;
          line-height: 1.6;
          max-width: 800px;
          margin: 0 auto;
          padding: 20px;
        }
        h1, h2, h3, h4, h5, h6 {
          margin-top: 24px;
          margin-bottom: 16px;
          font-weight: 600;
          line-height: 1.25;
        }
        h1 { font-size: 2em; }
        h2 { font-size: 1.5em; }
        code {
          background-color: rgba(27,31,35,.05);
          padding: 0.2em 0.4em;
          border-radius: 3px;
          font-family: SFMono-Regular, Consolas, Liberation Mono, Menlo, monospace;
          font-size: 85%;
        }
        pre {
          background-color: #f6f8fa;
          padding: 16px;
          border-radius: 6px;
          overflow: auto;
        }
        pre code {
          background-color: transparent;
          padding: 0;
        }
        a {
          color: #0366d6;
          text-decoration: none;
        }
        a:hover {
          text-decoration: underline;
        }
      </style>
    </head>
    <body>
  `;
  
  // Basic conversion (very simplified)
  let convertedContent = markdown
    // Headers
    .replace(/^# (.*$)/gm, '<h1>$1</h1>')
    .replace(/^## (.*$)/gm, '<h2>$1</h2>')
    .replace(/^### (.*$)/gm, '<h3>$1</h3>')
    // Bold
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    // Italic
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    // Code blocks
    .replace(/```([^`]*?)```/g, '<pre><code>$1</code></pre>')
    // Inline code
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    // Links
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')
    // Lists
    .replace(/^\s*-\s(.*$)/gm, '<li>$1</li>')
    // Paragraphs
    .replace(/^(?!<[hl]|<li|<pre)(.+)/gm, '<p>$1</p>');
  
  html += convertedContent + '</body></html>';
  return html;
}

/**
 * Download selected files as ZIP
 */
function downloadSelectedFiles() {
  if (state.uiElements.selectedFiles.size === 0) {
    showToast('No files selected', 'warning');
    return;
  }
  
  const { owner, repo, branch } = state.repoInfo;
  if (!owner || !repo) {
    showToast('Repository information not available', 'error');
    return;
  }
  
  showToast('Preparing files for download...', 'info');
  
  // Request ZIP creation via background script
  chrome.runtime.sendMessage({
    type: 'createZip',
    owner: owner,
    repo: repo,
    branch: branch || 'main',
    paths: Array.from(state.uiElements.selectedFiles)
  }, response => {
    if (response && response.success) {
      showToast('Download started');
    } else {
      showToast('Files are being downloaded individually', 'info');
    }
  });
}

/**
 * Download text content
 */
function downloadText(content, filename) {
  const blob = new Blob([content], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  
  chrome.runtime.sendMessage({
    type: 'download',
    url: url,
    filename: filename
  }, () => {
    URL.revokeObjectURL(url);
  });
}

/**
 * Quick action: Copy clone URL
 */
function copyCloneUrl() {
  const { owner, repo } = state.repoInfo;
  if (!owner || !repo) {
    showToast('Repository information not available', 'error');
    return;
  }
  
  const url = `https://github.com/${owner}/${repo}.git`;
  navigator.clipboard.writeText(url)
    .then(() => showToast('Clone URL copied to clipboard'))
    .catch(() => showToast('Failed to copy URL', 'error'));
}

/**
 * Quick action: Download ZIP
 */
function downloadZip() {
  const { owner, repo, branch } = state.repoInfo;
  if (!owner || !repo) {
    showToast('Repository information not available', 'error');
    return;
  }
  
  const url = `https://github.com/${owner}/${repo}/archive/refs/heads/${branch || 'main'}.zip`;
  
  chrome.runtime.sendMessage({
    type: 'download',
    url: url,
    filename: `${repo}.zip`
  });
  
  showToast('Download started');
}

/**
 * Quick action: Open in Codespace
 */
function openInCodespace() {
  const { owner, repo } = state.repoInfo;
  if (!owner || !repo) {
    showToast('Repository information not available', 'error');
    return;
  }
  
  window.open(`https://github.com/codespaces/new?hide_repo_select=true&ref=main&repo=${owner}%2F${repo}`, '_blank');
}

/**
 * Quick action: Open in CodeSandbox
 */
function openInCodeSandbox() {
  const { owner, repo } = state.repoInfo;
  if (!owner || !repo) {
    showToast('Repository information not available', 'error');
    return;
  }
  
  window.open(`https://codesandbox.io/s/github/${owner}/${repo}`, '_blank');
}

/**
 * Quick action: Open in GitPod
 */
function openInGitpod() {
  const { owner, repo } = state.repoInfo;
  if (!owner || !repo) {
    showToast('Repository information not available', 'error');
    return;
  }
  
  window.open(`https://gitpod.io/#https://github.com/${owner}/${repo}`, '_blank');
}

/**
 * Show error message
 */
function showError(tabId, message) {
  const sidebar = state.uiElements.sidebar;
  if (!sidebar) return;
  
  const loadingEl = sidebar.querySelector(`[data-tab="${tabId}"] .gh-enhancer-loading`);
  if (loadingEl) {
    loadingEl.innerHTML = `
      <div class="gh-enhancer-error">
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
        <p>${message}</p>
      </div>
    `;
  }
}

/**
 * Show toast notification
 */
function showToast(message, type = 'info') {
  // Remove existing toasts
  document.querySelectorAll('.gh-enhancer-toast').forEach(t => t.remove());
  
  // Create toast
  const toast = document.createElement('div');
  toast.className = `gh-enhancer-toast ${type}`;
  toast.setAttribute('role', 'alert');
  toast.textContent = message;
  
  // Add to body
  document.body.appendChild(toast);
  
  // Show with animation
  setTimeout(() => toast.classList.add('show'), 10);
  
  // Auto-hide
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 300);
  }, 3000);
  
  // Store reference
  state.uiElements.toast = toast;
}

/**
 * Observe page changes to update UI
 */
function observePageChanges() {
  // Clean up existing observers
  if (state.observers) {
    state.observers.forEach(observer => observer.disconnect());
  }
  
  state.observers = [];
  
  // Observe URL changes (for SPA navigation)
  let lastUrl = window.location.href;
  const urlObserver = new MutationObserver(() => {
    if (lastUrl !== window.location.href) {
      lastUrl = window.location.href;
      onLocationChange();
    }
  });
  
  urlObserver.observe(document.body, { childList: true, subtree: true });
  state.observers.push(urlObserver);
  
  // Observe theme changes
  const themeObserver = new MutationObserver(mutations => {
    for (const mutation of mutations) {
      if (mutation.attributeName === 'data-color-mode' || 
          mutation.attributeName === 'data-theme') {
        updateTheme();
      }
    }
  });
  
  themeObserver.observe(document.documentElement, { attributes: true });
  if (document.body.hasAttribute('data-color-mode')) {
    themeObserver.observe(document.body, { attributes: true });
  }
  
  state.observers.push(themeObserver);
}

/**
 * Handle location/URL changes
 */
function onLocationChange() {
  console.log('GitHub Enhancer: Location changed');
  
  // Reset state for new page
  extractRepoInfo();
  
  // Handle different page types
  if (!isGitHubRepoPage()) {
    if (state.uiElements.sidebar) {
      state.uiElements.sidebar.classList.add('hidden');
    }
    return;
  }
  
  // Show sidebar if it exists
  if (state.uiElements.sidebar) {
    // Apply saved state
    if (state.uiElements.hiddenState) {
      state.uiElements.sidebar.classList.add('hidden');
    } else {
      state.uiElements.sidebar.classList.remove('hidden');
    }
    
    // Reset to overview tab
    switchTab('overview');
    loadRepoOverview();
  } else {
    // Create sidebar if it doesn't exist
    createSidebar();
  }
  
  // Handle specific view types
  setTimeout(() => {
    if (isFileExplorerPage()) {
      enhanceFileExplorer();
    }
    
    // Adjust layout
    adjustGitHubLayout();
  }, CONFIG.refreshInterval);
}

/**
 * Update theme of extension to match GitHub's theme
 */
function updateTheme() {
  const sidebar = state.uiElements.sidebar;
  if (!sidebar) return;
  
  const colorMode = document.documentElement.getAttribute('data-color-mode') || 
                   document.body.getAttribute('data-color-mode') || 'auto';
  const theme = document.documentElement.getAttribute('data-theme') || 
               document.body.getAttribute('data-theme') || '';
  
  sidebar.setAttribute('data-color-mode', colorMode);
  sidebar.setAttribute('data-theme', theme);
}

// API and data helpers

/**
 * Fetch repository data from GitHub API
 */
async function fetchRepoData() {
  const { owner, repo } = state.repoInfo;
  if (!owner || !repo) return null;
  
  // Check cache first
  if (state.cache.repoStats) return state.cache.repoStats;
  
  try {
    // Request via background script to handle auth/rate limits
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage({
        type: 'fetchRepoData',
        url: `${CONFIG.apiBaseUrl}/repos/${owner}/${repo}`
      }, response => {
        if (response && response.success && response.data) {
          // Cache the data
          state.cache.repoStats = response.data;
          resolve(response.data);
        } else {
          reject(new Error('Failed to fetch repo data'));
        }
      });
    });
  } catch (error) {
    console.error('GitHub Enhancer: Error fetching repo data:', error);
    return null;
  }
}

/**
 * Fetch language data from GitHub API
 */
async function fetchLanguages() {
  const { owner, repo } = state.repoInfo;
  if (!owner || !repo) return;
  
  try {
    // Request via background script
    chrome.runtime.sendMessage({
      type: 'fetchRepoData',
      url: `${CONFIG.apiBaseUrl}/repos/${owner}/${repo}/languages`
    }, response => {
      if (response && response.success && response.data) {
        updateLanguageChart(response.data);
      }
    });
  } catch (error) {
    console.error('GitHub Enhancer: Error fetching languages:', error);
  }
}

/**
 * Fetch file size from GitHub API
 */
async function fetchFileSize(filePath) {
  const { owner, repo, branch } = state.repoInfo;
  if (!owner || !repo || !filePath) return 0;
  
  // Check cache first
  const cacheKey = `file:${owner}/${repo}/${branch}/${filePath}`;
  if (state.cache.fileData.has(cacheKey)) {
    return state.cache.fileData.get(cacheKey).size;
  }
  
  try {
    // Request via background script
    return new Promise((resolve) => {
      chrome.runtime.sendMessage({
        type: 'fetchRepoData',
        url: `${CONFIG.apiBaseUrl}/repos/${owner}/${repo}/contents/${filePath}?ref=${branch || 'main'}`
      }, response => {
        if (response?.success && response?.data?.size) {
          // Cache the data
          state.cache.fileData.set(cacheKey, { size: response.data.size });
          resolve(response.data.size);
        } else {
          resolve(0);
        }
      });
    });
  } catch (error) {
    console.error('GitHub Enhancer: Error fetching file size:', error);
    return 0;
  }
}

/**
 * Detect tech stack based on files and repo structure
 */
async function detectTechStack() {
  // Start with empty tech stack
  const techStack = new Set();
  
  // Check for package files
  const fileNameMap = {};
  document.querySelectorAll(CONFIG.selectors.fileNameCol).forEach(fileLink => {
    const fileName = fileLink.textContent.trim();
    fileNameMap[fileName.toLowerCase()] = true;
  });
  
  // Common framework and library detection
  if (fileNameMap['package.json']) techStack.add('Node.js');
  if (fileNameMap['yarn.lock']) techStack.add('Yarn');
  if (fileNameMap['pnpm-lock.yaml']) techStack.add('pnpm');
  if (fileNameMap['webpack.config.js']) techStack.add('Webpack');
  if (fileNameMap['vite.config.js'] || fileNameMap['vite.config.ts']) techStack.add('Vite');
  if (fileNameMap['next.config.js'] || fileNameMap['next.config.ts']) techStack.add('Next.js');
  if (fileNameMap['nuxt.config.js'] || fileNameMap['nuxt.config.ts']) techStack.add('Nuxt.js');
  if (fileNameMap['angular.json']) techStack.add('Angular');
  if (fileNameMap['tailwind.config.js'] || fileNameMap['tailwind.config.ts']) techStack.add('TailwindCSS');
  if (fileNameMap['svelte.config.js']) techStack.add('Svelte');
  if (fileNameMap['tsconfig.json']) techStack.add('TypeScript');
  if (fileNameMap['.eslintrc.json'] || fileNameMap['.eslintrc.js']) techStack.add('ESLint');
  if (fileNameMap['docker-compose.yml'] || fileNameMap['dockerfile']) techStack.add('Docker');
  if (fileNameMap['go.mod']) techStack.add('Go');
  if (fileNameMap['requirements.txt'] || fileNameMap['setup.py']) techStack.add('Python');
  if (fileNameMap['.rspec']) techStack.add('Ruby');
  if (fileNameMap['composer.json']) techStack.add('PHP');
  
  // Check file extensions for languages
  const hasFileWithExt = (ext) => {
    return Object.keys(fileNameMap).some(name => name.endsWith(ext));
  };
  
  if (hasFileWithExt('.jsx') || hasFileWithExt('.tsx')) techStack.add('React');
  if (hasFileWithExt('.vue')) techStack.add('Vue.js');
  if (hasFileWithExt('.svelte')) techStack.add('Svelte');
  if (hasFileWithExt('.go')) techStack.add('Go');
  if (hasFileWithExt('.py')) techStack.add('Python');
  if (hasFileWithExt('.rb')) techStack.add('Ruby');
  if (hasFileWithExt('.php')) techStack.add('PHP');
  if (hasFileWithExt('.java')) techStack.add('Java');
  if (hasFileWithExt('.cs')) techStack.add('C#');
  if (hasFileWithExt('.ts') && !techStack.has('TypeScript')) techStack.add('TypeScript');
  if (hasFileWithExt('.js') && !techStack.has('Node.js')) techStack.add('JavaScript');
  
  return Array.from(techStack);
}

// Utility functions

/**
 * Format bytes to human-readable size
 */
function formatBytes(bytes, decimals = 2) {
  if (!bytes || bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB'];
  
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

/**
 * Parse approximate size from string like "1.5 KB"
 */
function parseApproximateSize(sizeStr) {
  try {
    const parts = sizeStr.split(' ');
    if (parts.length !== 2) return 0;
    
    const num = parseFloat(parts[0]);
    const unit = parts[1].toUpperCase();
    
    const unitMultipliers = {
      'BYTES': 1,
      'B': 1,
      'KB': 1024,
      'MB': 1024 * 1024,
      'GB': 1024 * 1024 * 1024,
      'TB': 1024 * 1024 * 1024 * 1024
    };
    
    return num * (unitMultipliers[unit] || 1);
  } catch (e) {
    return 0;
  }
}

/**
 * Get color for programming language
 */
function getLanguageColor(language) {
  const colors = {
    'JavaScript': '#f1e05a',
    'TypeScript': '#3178c6',
    'HTML': '#e34c26',
    'CSS': '#563d7c',
    'Python': '#3572A5',
    'Java': '#b07219',
    'C#': '#178600',
    'PHP': '#4F5D95',
    'C++': '#f34b7d',
    'Ruby': '#701516',
    'Go': '#00ADD8',
    'Swift': '#F05138',
    'Kotlin': '#A97BFF',
    'Rust': '#DEA584',
    'Dart': '#00B4AB'
  };
  
  return colors[language] || '#8257e5'; // Default purple for unknown languages
}

// Initialize extension when DOM is ready
document.addEventListener('DOMContentLoaded', init);

// Re-initialize when page changes (for single-page apps)
window.addEventListener('load', init);

// Set up re-initialization check every second (for dynamic content)
const initInterval = setInterval(() => {
  if (isGitHubRepoPage() && !state.initialized) {
    init();
  }
}, CONFIG.refreshInterval);

// Clean up resources on page unload
window.addEventListener('beforeunload', () => {
  clearInterval(initInterval);
  
  // Clean up observers
  if (state.observers) {
    state.observers.forEach(observer => observer.disconnect());
  }
  
  // Remove UI elements
  if (state.uiElements.sidebar && document.body.contains(state.uiElements.sidebar)) {
    state.uiElements.sidebar.remove();
  }
  
  document.querySelectorAll('.gh-enhancer-toast, .gh-selection-header-main, .gh-enhancer-checkbox, .gh-enhancer-size-cell').forEach(el => {
    if (el.parentNode) el.parentNode.removeChild(el);
  });
});
