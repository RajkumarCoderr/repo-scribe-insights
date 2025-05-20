
# GitHub Downloader & Analyzer

A Chrome extension that enhances GitHub with file/folder download capabilities and repository insights.

## Features

### 🔽 Download GitHub Files & Folders
- Select files and folders with checkboxes
- Download individual files or multiple selections as a zip
- Intuitive UI with a floating action button

### 📊 Repository Insights Panel
- View repository statistics:
  - Total repository size
  - File and folder count
  - Language breakdown
  - Commit frequency analytics
  - Top contributors list

### 📄 Export README Files
- Export README files to different formats:
  - PDF export with GitHub styling
  - DOCX format for easy editing

### 🗃 Repository Size Display
- See the total size of a repository
- Breakdown of size by directory

### Additional Features
- 🧭 Quick navigation sidebar
- 🔍 Smart file preview
- 🌐 Multi-language UI support

## Installation

1. Download this repository
2. Open Chrome and navigate to `chrome://extensions`
3. Enable "Developer mode" in the top-right corner
4. Click "Load unpacked" and select the extension directory
5. The extension icon should appear in your toolbar

## Usage

1. Navigate to any GitHub repository
2. Use the checkboxes that appear next to files and folders to select them
3. Click the floating "Download" button to download your selection
4. Use the "Insights" button to view repository statistics
5. Click "Export README" to save the README file in different formats

## Privacy & Permissions

This extension requires the following permissions:
- `downloads`: To save files to your device
- `scripting`: To modify GitHub pages with checkboxes and buttons
- `storage`: To save your settings and preferences
- `activeTab`: To interact with the current tab

It only activates on GitHub pages (`https://github.com/*`).

## Development

### Structure
- `manifest.json`: Extension configuration
- `background.js`: Background service worker
- `content.js`: Injects UI into GitHub pages
- `popup.html/js/css`: Extension popup UI
- `styles.css`: Styles for injected UI elements
- `utils/`: Helper functions

### Contributing
Contributions are welcome! Please feel free to submit a Pull Request.

## License
This project is licensed under the MIT License - see the LICENSE file for details.
