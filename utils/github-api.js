
/**
 * Helper functions for interacting with the GitHub API
 */

// Fetch repository information
async function fetchRepoInfo(owner, repo) {
  try {
    const response = await fetch(`https://api.github.com/repos/${owner}/${repo}`);
    if (!response.ok) {
      throw new Error(`GitHub API error: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.error('Error fetching repo info:', error);
    throw error;
  }
}

// Fetch repository contents
async function fetchRepoContents(owner, repo, path = '', branch = 'main') {
  try {
    const url = path 
      ? `https://api.github.com/repos/${owner}/${repo}/contents/${path}?ref=${branch}`
      : `https://api.github.com/repos/${owner}/${repo}/contents?ref=${branch}`;
      
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`GitHub API error: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.error('Error fetching repo contents:', error);
    throw error;
  }
}

// Fetch repository languages
async function fetchRepoLanguages(owner, repo) {
  try {
    const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/languages`);
    if (!response.ok) {
      throw new Error(`GitHub API error: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.error('Error fetching repo languages:', error);
    throw error;
  }
}

// Fetch repository contributors
async function fetchRepoContributors(owner, repo) {
  try {
    const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/contributors`);
    if (!response.ok) {
      throw new Error(`GitHub API error: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.error('Error fetching repo contributors:', error);
    throw error;
  }
}

// Fetch repository commits
async function fetchRepoCommits(owner, repo, page = 1, perPage = 30) {
  try {
    const response = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/commits?page=${page}&per_page=${perPage}`
    );
    if (!response.ok) {
      throw new Error(`GitHub API error: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.error('Error fetching repo commits:', error);
    throw error;
  }
}

// Calculate repository size (recursive)
async function calculateRepoSize(owner, repo, path = '', branch = 'main') {
  try {
    const contents = await fetchRepoContents(owner, repo, path, branch);
    let totalSize = 0;
    
    for (const item of contents) {
      if (item.type === 'file') {
        totalSize += item.size;
      } else if (item.type === 'dir') {
        // For directories, recursively calculate size
        const subPathSize = await calculateRepoSize(
          owner, 
          repo,
          item.path,
          branch
        );
        totalSize += subPathSize;
      }
    }
    
    return totalSize;
  } catch (error) {
    console.error('Error calculating repo size:', error);
    return 0;
  }
}

// Format byte size to human-readable format
function formatBytes(bytes, decimals = 2) {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

export {
  fetchRepoInfo,
  fetchRepoContents,
  fetchRepoLanguages,
  fetchRepoContributors,
  fetchRepoCommits,
  calculateRepoSize,
  formatBytes
};
