
/**
 * GitHub API utility functions
 * Helper module for making GitHub API requests and parsing responses
 */

// GitHub API endpoint
const API_BASE_URL = 'https://api.github.com';

// Default request headers
const DEFAULT_HEADERS = {
  'Accept': 'application/vnd.github.v3+json'
  // Note: Auth token would be added here if available
};

/**
 * Fetch repository information
 * @param {string} owner - Repository owner
 * @param {string} repo - Repository name
 * @returns {Promise<Object>} - Repository data
 */
export async function fetchRepoInfo(owner, repo) {
  return await fetchFromAPI(`/repos/${owner}/${repo}`);
}

/**
 * Fetch repository languages
 * @param {string} owner - Repository owner
 * @param {string} repo - Repository name
 * @returns {Promise<Object>} - Languages data
 */
export async function fetchRepoLanguages(owner, repo) {
  return await fetchFromAPI(`/repos/${owner}/${repo}/languages`);
}

/**
 * Fetch repository contributors
 * @param {string} owner - Repository owner
 * @param {string} repo - Repository name
 * @returns {Promise<Array>} - Contributors data
 */
export async function fetchRepoContributors(owner, repo) {
  return await fetchFromAPI(`/repos/${owner}/${repo}/contributors`);
}

/**
 * Fetch file content
 * @param {string} owner - Repository owner
 * @param {string} repo - Repository name
 * @param {string} path - File path
 * @param {string} ref - Branch or commit reference
 * @returns {Promise<Object>} - File data including content
 */
export async function fetchFileContent(owner, repo, path, ref = 'main') {
  return await fetchFromAPI(`/repos/${owner}/${repo}/contents/${path}?ref=${ref}`);
}

/**
 * Search code in repository
 * @param {string} query - Search query
 * @param {string} owner - Repository owner
 * @param {string} repo - Repository name
 * @returns {Promise<Object>} - Search results
 */
export async function searchRepoCode(query, owner, repo) {
  return await fetchFromAPI(`/search/code?q=${encodeURIComponent(query)}+repo:${owner}/${repo}`);
}

/**
 * Get commit history for a file
 * @param {string} owner - Repository owner
 * @param {string} repo - Repository name
 * @param {string} path - File path
 * @returns {Promise<Array>} - Commit history
 */
export async function getFileCommitHistory(owner, repo, path) {
  return await fetchFromAPI(`/repos/${owner}/${repo}/commits?path=${path}`);
}

/**
 * Get repository directory contents
 * @param {string} owner - Repository owner
 * @param {string} repo - Repository name
 * @param {string} path - Directory path
 * @param {string} ref - Branch or commit reference
 * @returns {Promise<Array>} - Directory contents
 */
export async function getDirectoryContents(owner, repo, path = '', ref = 'main') {
  return await fetchFromAPI(`/repos/${owner}/${repo}/contents/${path}?ref=${ref}`);
}

/**
 * Fetch data from GitHub API
 * @param {string} endpoint - API endpoint
 * @param {Object} options - Fetch options
 * @returns {Promise<any>} - API response
 */
async function fetchFromAPI(endpoint, options = {}) {
  try {
    const url = endpoint.startsWith('http') ? endpoint : `${API_BASE_URL}${endpoint}`;
    
    const response = await fetch(url, {
      headers: DEFAULT_HEADERS,
      ...options
    });
    
    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.message || `GitHub API error: ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('GitHub API request failed:', error);
    throw error;
  }
}

/**
 * Convert base64 to text
 * @param {string} base64 - Base64 encoded string
 * @returns {string} - Decoded text
 */
export function decodeBase64(base64) {
  return atob(base64.replace(/\s/g, ''));
}

/**
 * Format repository size
 * @param {number} size - Size in KB
 * @returns {string} - Formatted size
 */
export function formatRepoSize(size) {
  const kb = size;
  if (kb < 1024) return `${kb} KB`;
  
  const mb = kb / 1024;
  if (mb < 1024) return `${mb.toFixed(1)} MB`;
  
  const gb = mb / 1024;
  return `${gb.toFixed(1)} GB`;
}

/**
 * Calculate relative time from date
 * @param {string|Date} date - Date or date string
 * @returns {string} - Relative time (e.g., "3 days ago")
 */
export function getRelativeTime(date) {
  const now = new Date();
  const past = new Date(date);
  const diffMs = now - past;
  
  const diffSec = Math.round(diffMs / 1000);
  if (diffSec < 60) return 'just now';
  
  const diffMin = Math.round(diffSec / 60);
  if (diffMin < 60) return `${diffMin} minutes ago`;
  
  const diffHours = Math.round(diffMin / 60);
  if (diffHours < 24) return `${diffHours} hours ago`;
  
  const diffDays = Math.round(diffHours / 24);
  if (diffDays < 30) return `${diffDays} days ago`;
  
  const diffMonths = Math.round(diffDays / 30);
  if (diffMonths < 12) return `${diffMonths} months ago`;
  
  const diffYears = Math.round(diffMonths / 12);
  return `${diffYears} years ago`;
}

/**
 * Calculate file size display
 * @param {number} bytes - Size in bytes
 * @param {number} decimals - Decimal places
 * @returns {string} - Formatted file size
 */
export function formatFileSize(bytes, decimals = 1) {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}
