
/**
 * GitHub Enhancer Pro - Background Service Worker
 * Handles API requests, authentication, and download operations
 */

// GitHub API credentials (replace with yours or use auth)
const GITHUB_API = {
  baseUrl: 'https://api.github.com',
  headers: {
    'Accept': 'application/vnd.github.v3+json',
    // You can add a personal access token here for higher rate limits:
    // 'Authorization': 'token YOUR_GITHUB_TOKEN'
  }
};

// Handle messages from content script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // Always respond asynchronously
  const respond = (response) => {
    try {
      sendResponse(response);
    } catch (err) {
      console.error('GitHub Enhancer: Error sending response', err);
    }
  };

  switch (message.type) {
    case 'fetchRepoData':
      fetchGitHubData(message.url)
        .then(data => respond({ success: true, data }))
        .catch(error => {
          console.error('GitHub Enhancer: API Error', error);
          respond({ success: false, error: error.message });
        });
      return true; // Keep the message channel open for async response

    case 'download':
      chrome.downloads.download({
        url: message.url,
        filename: message.filename,
        saveAs: false
      });
      respond({ success: true });
      return false;

    case 'createZip':
      createAndDownloadZip(message.owner, message.repo, message.branch, message.paths)
        .then(() => respond({ success: true }))
        .catch(error => {
          console.error('GitHub Enhancer: ZIP Error', error);
          respond({ success: false, error: error.message });
        });
      return true;

    case 'exportToPdf':
      exportMarkdownToPdf(message.content, message.filename)
        .then(() => respond({ success: true }))
        .catch(error => {
          console.error('GitHub Enhancer: PDF Export Error', error);
          respond({ success: false, error: error.message });
        });
      return true;

    case 'exportToDocx':
      exportMarkdownToDocx(message.content, message.filename)
        .then(() => respond({ success: true }))
        .catch(error => {
          console.error('GitHub Enhancer: DOCX Export Error', error);
          respond({ success: false, error: error.message });
        });
      return true;

    default:
      respond({ success: false, error: 'Unknown message type' });
      return false;
  }
});

/**
 * Fetch data from GitHub API
 */
async function fetchGitHubData(url) {
  try {
    const response = await fetch(url, { headers: GITHUB_API.headers });
    
    if (!response.ok) {
      if (response.status === 403 && response.headers.get('x-ratelimit-remaining') === '0') {
        throw new Error('GitHub API rate limit exceeded. Try again later.');
      }
      throw new Error(`GitHub API error: ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('GitHub Enhancer: Fetch Error', error);
    throw error;
  }
}

/**
 * Create a ZIP file from selected repository files and trigger download
 */
async function createAndDownloadZip(owner, repo, branch, paths) {
  // This would normally use JSZip library
  // For this implementation we'll just trigger individual downloads
  
  try {
    // For each path, fetch the raw content and download
    for (const path of paths) {
      const url = `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${path}`;
      const filename = path.split('/').pop();
      
      chrome.downloads.download({
        url: url,
        filename: `${owner}_${repo}_${filename}`,
        saveAs: false
      });
    }
    
    return { success: true };
  } catch (error) {
    console.error('GitHub Enhancer: ZIP creation error', error);
    throw error;
  }
}

/**
 * Convert markdown to PDF and download
 */
async function exportMarkdownToPdf(markdown, filename) {
  try {
    // In a real implementation, this would use a library to convert markdown to PDF
    // For demonstration purposes, we'll generate a simple PDF with minimal styling
    
    // Convert markdown to HTML (basic implementation)
    const html = convertMarkdownToHtml(markdown);
    
    // Create a data URL for the HTML
    const htmlBlob = new Blob([html], { type: 'text/html' });
    const htmlUrl = URL.createObjectURL(htmlBlob);
    
    // Download as HTML (in real implementation, would convert to PDF)
    chrome.downloads.download({
      url: htmlUrl,
      filename: filename.replace('.pdf', '.html'),
      saveAs: false
    });
    
    return { success: true };
  } catch (error) {
    console.error('GitHub Enhancer: PDF export error', error);
    throw error;
  }
}

/**
 * Convert markdown to DOCX and download
 */
async function exportMarkdownToDocx(markdown, filename) {
  try {
    // In a real implementation, this would use a library to convert markdown to DOCX
    // For demonstration purposes, we'll just save the markdown
    
    // Create a data URL for the markdown
    const mdBlob = new Blob([markdown], { type: 'text/markdown' });
    const mdUrl = URL.createObjectURL(mdBlob);
    
    // Download as markdown (in real implementation, would convert to DOCX)
    chrome.downloads.download({
      url: mdUrl,
      filename: filename.replace('.docx', '.md'),
      saveAs: false
    });
    
    return { success: true };
  } catch (error) {
    console.error('GitHub Enhancer: DOCX export error', error);
    throw error;
  }
}

/**
 * Basic markdown to HTML conversion
 */
function convertMarkdownToHtml(markdown) {
  // This is a very simplified markdown converter
  // In a real implementation, use a proper library
  
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

// Initialize extension
chrome.runtime.onInstalled.addListener(() => {
  console.log('GitHub Enhancer Pro installed successfully!');
});
