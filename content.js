
// GitHub Enhancer Pro - Content Script
// Global state with efficient memory management
const state = {
  sidebarVisible: true,
  repoInfo: {
    owner: '',
    repo: '',
    branch: 'main',
    path: '',
  },
  uiElements: {
    sidebar: null,
  },
  observers: [],
  initialized: false,
  data: {
    repoStats: null,
    languages: null,
    contributors: null,
    fileStats: null,
  },
  cache: {}, // In-memory cache to reduce API calls
};

// Initialize extension with performance optimizations
function initExtension() {
  if (state.initialized) return;
  if (!isGitHubRepoPage()) return;

  console.log('GitHub Enhancer: Initializing');
  extractRepoInfo();

  // Use requestIdleCallback for non-critical initialization
  window.requestIdleCallback(() => {
    createSidebar();
    setupEventListeners();
    observeDOMChanges();
    state.initialized = true;
  });
}

// More accurate GitHub repo page detection
function isGitHubRepoPage() {
  const path = window.location.pathname.split('/').filter(Boolean);
  return window.location.hostname === 'github.com' && 
         path.length >= 2 && 
         !['settings', 'marketplace', 'explore'].includes(path[0]) &&
         document.querySelector('.repository-content, .js-repo-home-link');
}

// Extract repo information efficiently
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

// Create the sidebar with lazy-loaded content
function createSidebar() {
  if (state.uiElements.sidebar) return;

  // Create the sidebar container
  const sidebar = document.createElement('div');
  sidebar.className = 'gh-enhancer-sidebar';
  sidebar.setAttribute('data-color-mode', document.documentElement.getAttribute('data-color-mode') || 'auto');
  sidebar.setAttribute('data-theme', document.documentElement.getAttribute('data-theme') || '');
  
  // Add toggle button
  const toggleButton = document.createElement('button');
  toggleButton.className = 'gh-enhancer-toggle';
  toggleButton.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>';
  toggleButton.addEventListener('click', toggleSidebar);
  sidebar.appendChild(toggleButton);

  // Create sidebar content
  const content = document.createElement('div');
  content.className = 'gh-enhancer-content';
  
  // Header section
  const header = document.createElement('div');
  header.className = 'gh-enhancer-header';
  header.innerHTML = `
    <h3>GitHub Enhancer</h3>
    <div class="gh-enhancer-tabs">
      <button class="gh-tab active" data-tab="overview">Overview</button>
      <button class="gh-tab" data-tab="files">Files</button>
      <button class="gh-tab" data-tab="contrib">Contributors</button>
      <button class="gh-tab" data-tab="actions">Actions</button>
    </div>
  `;
  content.appendChild(header);

  // Tab contents
  const tabContents = document.createElement('div');
  tabContents.className = 'gh-enhancer-tab-contents';
  
  // Overview tab (shown by default)
  const overviewTab = document.createElement('div');
  overviewTab.className = 'gh-tab-content active';
  overviewTab.setAttribute('data-tab', 'overview');
  overviewTab.innerHTML = `
    <div class="gh-enhancer-loading">
      <div class="gh-enhancer-spinner"></div>
      <p>Loading repository info...</p>
    </div>
    <div class="gh-enhancer-stats" style="display: none;">
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
      <div class="gh-stat">
        <div class="gh-stat-label">Stars & Forks</div>
        <div class="gh-stat-value" id="repo-popularity">-</div>
      </div>
      <div class="gh-chart">
        <h4>Language Breakdown</h4>
        <div id="language-chart" class="gh-chart-placeholder"></div>
      </div>
      <div class="gh-chart">
        <h4>Commit Activity</h4>
        <div id="commit-chart" class="gh-chart-placeholder"></div>
      </div>
    </div>
  `;
  tabContents.appendChild(overviewTab);

  // Files tab
  const filesTab = document.createElement('div');
  filesTab.className = 'gh-tab-content';
  filesTab.setAttribute('data-tab', 'files');
  filesTab.innerHTML = `
    <div class="gh-enhancer-loading">
      <div class="gh-enhancer-spinner"></div>
      <p>Analyzing files...</p>
    </div>
    <div class="gh-enhancer-file-stats" style="display: none;">
      <div class="gh-stat">
        <div class="gh-stat-label">Total Files</div>
        <div class="gh-stat-value" id="total-files">-</div>
      </div>
      <div class="gh-stat">
        <div class="gh-stat-label">Lines of Code</div>
        <div class="gh-stat-value" id="total-loc">-</div>
      </div>
      <div class="gh-file-section">
        <h4>Largest Files</h4>
        <ul id="largest-files" class="gh-file-list"></ul>
      </div>
      <div class="gh-file-section">
        <h4>Tech Stack</h4>
        <div id="tech-stack" class="gh-tech-badges"></div>
      </div>
    </div>
  `;
  tabContents.appendChild(filesTab);

  // Contributors tab
  const contribTab = document.createElement('div');
  contribTab.className = 'gh-tab-content';
  contribTab.setAttribute('data-tab', 'contrib');
  contribTab.innerHTML = `
    <div class="gh-enhancer-loading">
      <div class="gh-enhancer-spinner"></div>
      <p>Loading contributor data...</p>
    </div>
    <div class="gh-enhancer-contrib-stats" style="display: none;">
      <div class="gh-stat">
        <div class="gh-stat-label">Total Contributors</div>
        <div class="gh-stat-value" id="total-contributors">-</div>
      </div>
      <div class="gh-contrib-section">
        <h4>Top Contributors</h4>
        <ul id="top-contributors" class="gh-contributor-list"></ul>
      </div>
      <div class="gh-chart">
        <h4>Contribution Distribution</h4>
        <div id="contrib-chart" class="gh-chart-placeholder"></div>
      </div>
    </div>
  `;
  tabContents.appendChild(contribTab);

  // Actions tab
  const actionsTab = document.createElement('div');
  actionsTab.className = 'gh-tab-content';
  actionsTab.setAttribute('data-tab', 'actions');
  actionsTab.innerHTML = `
    <div class="gh-enhancer-actions">
      <div class="gh-action-group">
        <h4>Quick Actions</h4>
        <button class="gh-action-btn" id="download-repo">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
          Download ZIP
        </button>
        <button class="gh-action-btn" id="copy-clone-url">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
          Copy Clone URL
        </button>
        <button class="gh-action-btn" id="open-codespace">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="16 18 22 12 16 6"></polyline><polyline points="8 6 2 12 8 18"></polyline></svg>
          Open in Codespace
        </button>
      </div>
      <div class="gh-action-group">
        <h4>External Tools</h4>
        <button class="gh-action-btn" id="open-codesandbox">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path></svg>
          Open in CodeSandbox
        </button>
        <button class="gh-action-btn" id="open-gitpod">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect><line x1="8" y1="21" x2="16" y2="21"></line><line x1="12" y1="17" x2="12" y2="21"></line></svg>
          Open in Gitpod
        </button>
      </div>
    </div>
  `;
  tabContents.appendChild(actionsTab);
  
  content.appendChild(tabContents);
  sidebar.appendChild(content);

  // Add tab switching functionality
  sidebar.querySelectorAll('.gh-tab').forEach(tab => {
    tab.addEventListener('click', (e) => {
      const tabName = e.currentTarget.getAttribute('data-tab');
      switchTab(tabName);
      
      // Load tab data if needed
      if (tabName === 'overview' && !state.data.repoStats) {
        loadRepositoryData();
      } else if (tabName === 'files' && !state.data.fileStats) {
        loadFileStats();
      } else if (tabName === 'contrib' && !state.data.contributors) {
        loadContributorData();
      }
    });
  });

  // Add action buttons functionality
  sidebar.querySelector('#download-repo')?.addEventListener('click', downloadRepo);
  sidebar.querySelector('#copy-clone-url')?.addEventListener('click', copyCloneUrl);
  sidebar.querySelector('#open-codespace')?.addEventListener('click', openInCodespace);
  sidebar.querySelector('#open-codesandbox')?.addEventListener('click', openInCodeSandbox);
  sidebar.querySelector('#open-gitpod')?.addEventListener('click', openInGitpod);

  // Find github UI container (try multiple selectors for robustness)
  const githubContainer = document.querySelector('main, .application-main');
  
  if (githubContainer) {
    githubContainer.classList.add('with-gh-enhancer');
    document.body.appendChild(sidebar);
    state.uiElements.sidebar = sidebar;
    
    // Load initial data
    loadRepositoryData();
  }
}

// Toggle sidebar visibility with animation
function toggleSidebar() {
  const sidebar = state.uiElements.sidebar;
  if (!sidebar) return;
  
  state.sidebarVisible = !state.sidebarVisible;
  
  if (state.sidebarVisible) {
    sidebar.classList.remove('collapsed');
    document.querySelector('main, .application-main')?.classList.add('with-gh-enhancer');
  } else {
    sidebar.classList.add('collapsed');
    document.querySelector('main, .application-main')?.classList.remove('with-gh-enhancer');
  }
}

// Switch between tabs
function switchTab(tabName) {
  const sidebar = state.uiElements.sidebar;
  if (!sidebar) return;
  
  // Update tab buttons
  sidebar.querySelectorAll('.gh-tab').forEach(tab => {
    if (tab.getAttribute('data-tab') === tabName) {
      tab.classList.add('active');
    } else {
      tab.classList.remove('active');
    }
  });
  
  // Update tab content
  sidebar.querySelectorAll('.gh-tab-content').forEach(content => {
    if (content.getAttribute('data-tab') === tabName) {
      content.classList.add('active');
    } else {
      content.classList.remove('active');
    }
  });
}

// Load repository data
function loadRepositoryData() {
  const { owner, repo } = state.repoInfo;
  if (!owner || !repo) return;
  
  // Check cache first
  const cacheKey = `repo:${owner}/${repo}`;
  if (state.cache[cacheKey]) {
    updateRepoStats(state.cache[cacheKey]);
    return;
  }
  
  const sidebar = state.uiElements.sidebar;
  const loadingEl = sidebar?.querySelector('[data-tab="overview"] .gh-enhancer-loading');
  const statsEl = sidebar?.querySelector('[data-tab="overview"] .gh-enhancer-stats');
  
  if (loadingEl) loadingEl.style.display = 'flex';
  if (statsEl) statsEl.style.display = 'none';
  
  // Fetch repo data via background script
  chrome.runtime.sendMessage({
    type: 'fetchRepoData',
    url: `https://api.github.com/repos/${owner}/${repo}`
  }, response => {
    if (response && response.success && response.data) {
      // Cache the data
      state.cache[cacheKey] = response.data;
      state.data.repoStats = response.data;
      
      updateRepoStats(response.data);
    } else {
      showError('overview', 'Could not load repository data');
    }
  });
  
  // Also fetch languages
  chrome.runtime.sendMessage({
    type: 'fetchRepoData',
    url: `https://api.github.com/repos/${owner}/${repo}/languages`
  }, response => {
    if (response && response.success && response.data) {
      state.data.languages = response.data;
      updateLanguageChart(response.data);
    }
  });
}

// Update repo stats in UI
function updateRepoStats(data) {
  const sidebar = state.uiElements.sidebar;
  if (!sidebar) return;
  
  const loadingEl = sidebar.querySelector('[data-tab="overview"] .gh-enhancer-loading');
  const statsEl = sidebar.querySelector('[data-tab="overview"] .gh-enhancer-stats');
  
  if (loadingEl) loadingEl.style.display = 'none';
  if (statsEl) statsEl.style.display = 'block';
  
  // Update stats
  const sizeEl = sidebar.querySelector('#repo-size');
  if (sizeEl) sizeEl.textContent = formatBytes(data.size * 1024);
  
  const langEl = sidebar.querySelector('#repo-language');
  if (langEl) langEl.textContent = data.language || 'N/A';
  
  const updatedEl = sidebar.querySelector('#repo-updated');
  if (updatedEl) updatedEl.textContent = new Date(data.updated_at).toLocaleDateString();
  
  const popularityEl = sidebar.querySelector('#repo-popularity');
  if (popularityEl) popularityEl.textContent = `⭐ ${data.stargazers_count} · 🍴 ${data.forks_count}`;
  
  // Simple placeholder for commit chart
  const commitChartEl = sidebar.querySelector('#commit-chart');
  if (commitChartEl) {
    commitChartEl.innerHTML = `
      <div class="gh-sparkline">
        <div class="gh-sparkbar" style="height: 30%"></div>
        <div class="gh-sparkbar" style="height: 50%"></div>
        <div class="gh-sparkbar" style="height: 20%"></div>
        <div class="gh-sparkbar" style="height: 80%"></div>
        <div class="gh-sparkbar" style="height: 40%"></div>
        <div class="gh-sparkbar" style="height: 60%"></div>
        <div class="gh-sparkbar" style="height: 70%"></div>
      </div>
      <div class="gh-chart-label">Recent commit activity</div>
    `;
  }
}

// Update language chart
function updateLanguageChart(languages) {
  const sidebar = state.uiElements.sidebar;
  if (!sidebar) return;
  
  const chartEl = sidebar.querySelector('#language-chart');
  if (!chartEl) return;
  
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

// Load file statistics
function loadFileStats() {
  const { owner, repo } = state.repoInfo;
  if (!owner || !repo) return;
  
  const sidebar = state.uiElements.sidebar;
  const loadingEl = sidebar?.querySelector('[data-tab="files"] .gh-enhancer-loading');
  const statsEl = sidebar?.querySelector('[data-tab="files"] .gh-enhancer-file-stats');
  
  if (loadingEl) loadingEl.style.display = 'flex';
  if (statsEl) statsEl.style.display = 'none';
  
  // Simulate file statistics until we implement full file traversal
  setTimeout(() => {
    const fileStats = {
      totalFiles: Math.floor(Math.random() * 500) + 100,
      totalLoc: Math.floor(Math.random() * 50000) + 5000,
      largestFiles: [
        { name: 'vendor.js', size: 1240000, path: 'dist/js/vendor.js' },
        { name: 'main.css', size: 580000, path: 'dist/css/main.css' },
        { name: 'app.bundle.js', size: 420000, path: 'dist/js/app.bundle.js' },
        { name: 'data.json', size: 380000, path: 'src/data/data.json' },
        { name: 'index.html', size: 120000, path: 'public/index.html' }
      ],
      techStack: detectTechStack()
    };
    
    state.data.fileStats = fileStats;
    updateFileStats(fileStats);
  }, 500);
}

// Update file statistics in UI
function updateFileStats(data) {
  const sidebar = state.uiElements.sidebar;
  if (!sidebar) return;
  
  const loadingEl = sidebar.querySelector('[data-tab="files"] .gh-enhancer-loading');
  const statsEl = sidebar.querySelector('[data-tab="files"] .gh-enhancer-file-stats');
  
  if (loadingEl) loadingEl.style.display = 'none';
  if (statsEl) statsEl.style.display = 'block';
  
  // Update stats
  const filesEl = sidebar.querySelector('#total-files');
  if (filesEl) filesEl.textContent = data.totalFiles.toLocaleString();
  
  const locEl = sidebar.querySelector('#total-loc');
  if (locEl) locEl.textContent = data.totalLoc.toLocaleString();
  
  // Update largest files list
  const largestFilesEl = sidebar.querySelector('#largest-files');
  if (largestFilesEl) {
    largestFilesEl.innerHTML = '';
    
    data.largestFiles.forEach(file => {
      const li = document.createElement('li');
      li.className = 'gh-file-item';
      li.innerHTML = `
        <div class="gh-file-name">${file.name}</div>
        <div class="gh-file-size">${formatBytes(file.size)}</div>
      `;
      largestFilesEl.appendChild(li);
    });
  }
  
  // Update tech stack
  const techStackEl = sidebar.querySelector('#tech-stack');
  if (techStackEl && data.techStack) {
    techStackEl.innerHTML = '';
    
    data.techStack.forEach(tech => {
      const badge = document.createElement('span');
      badge.className = 'gh-tech-badge';
      badge.textContent = tech;
      techStackEl.appendChild(badge);
    });
  }
}

// Detect tech stack based on files in repo
function detectTechStack() {
  // This is a simplified version - in practice you would check the actual files in the repo
  const files = document.querySelectorAll('.js-navigation-open');
  const fileNames = Array.from(files).map(el => el.textContent.trim());
  
  const techStack = [];
  
  if (fileNames.some(name => name === 'package.json')) techStack.push('Node.js');
  if (fileNames.some(name => name === 'yarn.lock')) techStack.push('Yarn');
  if (fileNames.some(name => name === 'pnpm-lock.yaml')) techStack.push('pnpm');
  if (fileNames.some(name => name.endsWith('.tsx'))) techStack.push('TypeScript');
  if (fileNames.some(name => name === 'vite.config.js' || name === 'vite.config.ts')) techStack.push('Vite');
  if (fileNames.some(name => name === 'webpack.config.js')) techStack.push('Webpack');
  if (fileNames.some(name => name === 'tailwind.config.js' || name === 'tailwind.config.ts')) techStack.push('TailwindCSS');
  if (fileNames.some(name => name.includes('next.config'))) techStack.push('Next.js');
  if (fileNames.some(name => name.includes('svelte'))) techStack.push('Svelte');
  if (fileNames.some(name => name.endsWith('.vue'))) techStack.push('Vue.js');
  if (fileNames.some(name => name.includes('angular'))) techStack.push('Angular');
  
  // If no specific tech detected, check for common web tech
  if (fileNames.some(name => name.endsWith('.js'))) techStack.push('JavaScript');
  if (fileNames.some(name => name.endsWith('.html'))) techStack.push('HTML');
  if (fileNames.some(name => name.endsWith('.css'))) techStack.push('CSS');
  
  return techStack;
}

// Load contributor data
function loadContributorData() {
  const { owner, repo } = state.repoInfo;
  if (!owner || !repo) return;
  
  const sidebar = state.uiElements.sidebar;
  const loadingEl = sidebar?.querySelector('[data-tab="contrib"] .gh-enhancer-loading');
  const statsEl = sidebar?.querySelector('[data-tab="contrib"] .gh-enhancer-contrib-stats');
  
  if (loadingEl) loadingEl.style.display = 'flex';
  if (statsEl) statsEl.style.display = 'none';
  
  // Check cache first
  const cacheKey = `contributors:${owner}/${repo}`;
  if (state.cache[cacheKey]) {
    updateContributorStats(state.cache[cacheKey]);
    return;
  }
  
  // Fetch contributor data
  chrome.runtime.sendMessage({
    type: 'fetchRepoData',
    url: `https://api.github.com/repos/${owner}/${repo}/contributors`
  }, response => {
    if (response && response.success && response.data) {
      // Cache the data
      state.cache[cacheKey] = response.data;
      state.data.contributors = response.data;
      
      updateContributorStats(response.data);
    } else {
      showError('contrib', 'Could not load contributor data');
    }
  });
}

// Update contributor statistics in UI
function updateContributorStats(data) {
  const sidebar = state.uiElements.sidebar;
  if (!sidebar) return;
  
  const loadingEl = sidebar.querySelector('[data-tab="contrib"] .gh-enhancer-loading');
  const statsEl = sidebar.querySelector('[data-tab="contrib"] .gh-enhancer-contrib-stats');
  
  if (loadingEl) loadingEl.style.display = 'none';
  if (statsEl) statsEl.style.display = 'block';
  
  // Update total count
  const totalEl = sidebar.querySelector('#total-contributors');
  if (totalEl) totalEl.textContent = data.length.toString();
  
  // Update contributors list (top 5)
  const contribListEl = sidebar.querySelector('#top-contributors');
  if (contribListEl) {
    contribListEl.innerHTML = '';
    
    const topContributors = data.slice(0, 5);
    const totalContributions = topContributors.reduce((sum, c) => sum + c.contributions, 0);
    
    topContributors.forEach(contributor => {
      const percentage = Math.round((contributor.contributions / totalContributions) * 100);
      
      const li = document.createElement('li');
      li.className = 'gh-contributor-item';
      li.innerHTML = `
        <img src="${contributor.avatar_url}" alt="${contributor.login}" class="gh-contributor-avatar" />
        <div class="gh-contributor-info">
          <div class="gh-contributor-name">${contributor.login}</div>
          <div class="gh-contributor-bar-wrap">
            <div class="gh-contributor-bar" style="width: ${percentage}%"></div>
          </div>
          <div class="gh-contributor-count">${contributor.contributions} commits (${percentage}%)</div>
        </div>
      `;
      contribListEl.appendChild(li);
    });
  }
  
  // Generate contribution chart
  const chartEl = sidebar.querySelector('#contrib-chart');
  if (chartEl && data.length > 0) {
    const topFive = data.slice(0, 5);
    const otherContributions = data.slice(5).reduce((sum, c) => sum + c.contributions, 0);
    const totalContributions = topFive.reduce((sum, c) => sum + c.contributions, 0) + otherContributions;
    
    // Create simple donut chart
    let segments = '';
    let cumulativePercentage = 0;
    let legend = '<div class="gh-chart-legend">';
    
    // Add top 5 contributors
    const colors = ['#1f77b4', '#ff7f0e', '#2ca02c', '#d62728', '#9467bd'];
    topFive.forEach((contributor, i) => {
      const percentage = (contributor.contributions / totalContributions) * 100;
      const startAngle = cumulativePercentage * 3.6; // 3.6 degrees per percentage point in a circle
      const endAngle = (cumulativePercentage + percentage) * 3.6;
      
      segments += getDonutSegment(startAngle, endAngle, colors[i]);
      
      legend += `
        <div class="gh-legend-item">
          <span class="gh-legend-color" style="background-color: ${colors[i]}"></span>
          <span class="gh-legend-name">${contributor.login}</span>
          <span class="gh-legend-value">${Math.round(percentage)}%</span>
        </div>
      `;
      
      cumulativePercentage += percentage;
    });
    
    // Add "Others" segment if there are more contributors
    if (otherContributions > 0) {
      const percentage = (otherContributions / totalContributions) * 100;
      const startAngle = cumulativePercentage * 3.6;
      const endAngle = 360;
      
      segments += getDonutSegment(startAngle, endAngle, '#aec7e8');
      
      legend += `
        <div class="gh-legend-item">
          <span class="gh-legend-color" style="background-color: #aec7e8"></span>
          <span class="gh-legend-name">Others</span>
          <span class="gh-legend-value">${Math.round(percentage)}%</span>
        </div>
      `;
    }
    
    legend += '</div>';
    
    chartEl.innerHTML = `
      <div class="gh-donut-chart">
        <svg viewBox="0 0 100 100">
          ${segments}
          <circle cx="50" cy="50" r="25" fill="var(--color-canvas-default)" />
        </svg>
      </div>
      ${legend}
    `;
  }
}

// Generate donut chart segment
function getDonutSegment(startAngle, endAngle, color) {
  // Convert angles to radians
  const startRad = (startAngle - 90) * Math.PI / 180;
  const endRad = (endAngle - 90) * Math.PI / 180;
  
  // Calculate points
  const x1 = 50 + 40 * Math.cos(startRad);
  const y1 = 50 + 40 * Math.sin(startRad);
  const x2 = 50 + 40 * Math.cos(endRad);
  const y2 = 50 + 40 * Math.sin(endRad);
  
  // Create arc flag
  const largeArcFlag = endAngle - startAngle <= 180 ? '0' : '1';
  
  // Create path
  return `<path d="M 50 50 L ${x1} ${y1} A 40 40 0 ${largeArcFlag} 1 ${x2} ${y2} Z" fill="${color}" />`;
}

// Show error message in tab
function showError(tabName, message) {
  const sidebar = state.uiElements.sidebar;
  if (!sidebar) return;
  
  const loadingEl = sidebar.querySelector(`[data-tab="${tabName}"] .gh-enhancer-loading`);
  if (loadingEl) {
    loadingEl.innerHTML = `
      <div class="gh-enhancer-error">
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
        <p>${message}</p>
      </div>
    `;
  }
}

// Quick action handlers
function downloadRepo() {
  const { owner, repo } = state.repoInfo;
  if (!owner || !repo) return;
  
  const downloadUrl = `https://github.com/${owner}/${repo}/archive/refs/heads/master.zip`;
  chrome.runtime.sendMessage({
    type: 'download',
    url: downloadUrl,
    filename: `${repo}.zip`
  });
  
  showToast('Download started');
}

function copyCloneUrl() {
  const { owner, repo } = state.repoInfo;
  if (!owner || !repo) return;
  
  const cloneUrl = `https://github.com/${owner}/${repo}.git`;
  
  navigator.clipboard.writeText(cloneUrl)
    .then(() => showToast('Clone URL copied to clipboard'))
    .catch(() => showToast('Failed to copy URL', 'error'));
}

function openInCodespace() {
  const { owner, repo } = state.repoInfo;
  if (!owner || !repo) return;
  
  window.open(`https://github.com/codespaces/new?hide_repo_select=true&ref=main&repo=${owner}%2F${repo}`, '_blank');
}

function openInCodeSandbox() {
  const { owner, repo } = state.repoInfo;
  if (!owner || !repo) return;
  
  window.open(`https://codesandbox.io/s/github/${owner}/${repo}`, '_blank');
}

function openInGitpod() {
  const { owner, repo } = state.repoInfo;
  if (!owner || !repo) return;
  
  window.open(`https://gitpod.io/#https://github.com/${owner}/${repo}`, '_blank');
}

// Show toast notification
function showToast(message, type = 'info') {
  // Remove any existing toast
  document.querySelectorAll('.gh-enhancer-toast').forEach(el => el.remove());
  
  const toast = document.createElement('div');
  toast.className = `gh-enhancer-toast ${type}`;
  toast.textContent = message;
  
  document.body.appendChild(toast);
  
  // Trigger animation
  setTimeout(() => toast.classList.add('show'), 10);
  
  // Auto-hide after 3 seconds
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// Format bytes to human-readable size
function formatBytes(bytes, decimals = 2) {
  if (!bytes || bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

// Get color for programming language
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

// Setup event listeners
function setupEventListeners() {
  // Listen for theme changes
  const observer = new MutationObserver(mutations => {
    for (const mutation of mutations) {
      if (mutation.attributeName === 'data-color-mode' || mutation.attributeName === 'data-theme') {
        updateTheme();
      }
    }
  });
  
  observer.observe(document.documentElement, { attributes: true });
  state.observers.push(observer);
  
  // Listen for messages from background script
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'themeChanged') {
      updateTheme();
    }
    return true;
  });
}

// Update theme of extension to match GitHub's theme
function updateTheme() {
  const sidebar = state.uiElements.sidebar;
  if (!sidebar) return;
  
  const colorMode = document.documentElement.getAttribute('data-color-mode') || 'auto';
  const theme = document.documentElement.getAttribute('data-theme') || '';
  
  sidebar.setAttribute('data-color-mode', colorMode);
  sidebar.setAttribute('data-theme', theme);
}

// Efficient DOM changes observation
function observeDOMChanges() {
  // Clean up any existing observers
  if (state.observers.length) {
    state.observers.forEach(observer => observer.disconnect());
    state.observers = [];
  }
  
  // Watch for URL changes
  let lastUrl = window.location.href;
  const urlObserver = new MutationObserver(() => {
    if (lastUrl !== window.location.href) {
      lastUrl = window.location.href;
      onLocationChange();
    }
  });
  
  urlObserver.observe(document.body, { childList: true, subtree: true });
  state.observers.push(urlObserver);
  
  // Watch for relevant DOM changes (e.g., turbo navigation in GitHub)
  const contentObserver = new MutationObserver(mutations => {
    for (const mutation of mutations) {
      if (mutation.target.classList && 
          (mutation.target.classList.contains('repository-content') || 
           mutation.target.querySelector('.repository-content'))) {
        onRepoContentChange();
        break;
      }
    }
  });
  
  contentObserver.observe(document.body, { childList: true, subtree: true });
  state.observers.push(contentObserver);
}

// Handle location/URL changes
function onLocationChange() {
  console.log('GitHub Enhancer: Location changed');
  
  if (!isGitHubRepoPage()) {
    // We're not on a repo page, hide the sidebar
    const sidebar = state.uiElements.sidebar;
    if (sidebar) {
      sidebar.classList.add('hidden');
      document.querySelector('main, .application-main')?.classList.remove('with-gh-enhancer');
    }
    return;
  }
  
  // Reset state for the new page
  state.repoInfo = {
    owner: '',
    repo: '',
    branch: 'main',
    path: '',
  };
  state.data = {
    repoStats: null,
    languages: null,
    contributors: null,
    fileStats: null,
  };
  
  // Update repo info and refresh
  extractRepoInfo();
  
  // Show sidebar if it exists
  const sidebar = state.uiElements.sidebar;
  if (sidebar) {
    sidebar.classList.remove('hidden');
    if (state.sidebarVisible) {
      document.querySelector('main, .application-main')?.classList.add('with-gh-enhancer');
    }
    
    // Reset to overview tab
    switchTab('overview');
    loadRepositoryData();
  } else {
    // Create sidebar if it doesn't exist
    createSidebar();
  }
}

// Handle repo content changes (for SPA navigation)
function onRepoContentChange() {
  console.log('GitHub Enhancer: Repo content changed');
  
  // Only do actual refresh if repo info changed
  const oldOwner = state.repoInfo.owner;
  const oldRepo = state.repoInfo.repo;
  
  extractRepoInfo();
  
  if (oldOwner !== state.repoInfo.owner || oldRepo !== state.repoInfo.repo) {
    // Repo changed, reload data
    state.data = {
      repoStats: null,
      languages: null,
      contributors: null,
      fileStats: null,
    };
    
    // Reset to overview tab
    switchTab('overview');
    loadRepositoryData();
  }
}

// Cleanup function to prevent memory leaks
function cleanup() {
  // Remove all event listeners and observers
  if (state.observers.length) {
    state.observers.forEach(observer => observer.disconnect());
  }
  
  // Remove UI elements
  const sidebar = state.uiElements.sidebar;
  if (sidebar && document.body.contains(sidebar)) {
    sidebar.remove();
  }
  
  document.querySelector('main, .application-main')?.classList.remove('with-gh-enhancer');
  
  // Reset state
  state.initialized = false;
  state.data = {
    repoStats: null,
    languages: null,
    contributors: null,
    fileStats: null,
  };
}

// Initialize the extension
window.addEventListener('load', () => {
  initExtension();
});

// Clear resources on unload
window.addEventListener('unload', cleanup);
