# AI Optimizer Suite Chrome Extension

A Chrome extension that enhances ChatGPT with vector-based memory and smart file processing capabilities.

## Features

- **Vector-based Memory**: Automatically caches your conversations and finds similar past interactions
- **Smart File Processing**:
  - Compress images before uploading to reduce file size
  - Extract text from PDF files automatically
  - Drag and drop file optimization

## Installation

1. **Build the Extension** (if not already done):

   ```bash
   npm install
   npm run build
   ```

2. **Load the Extension in Chrome**:
   - Open Chrome and navigate to `chrome://extensions/`
   - Enable "Developer mode" in the top right corner
   - Click "Load unpacked"
   - Select the `dist` folder from this project
   - The extension should now appear in your extensions list

## Usage

### Memory Feature

- Start typing in ChatGPT's input box
- If you've asked similar questions before, the extension will show a notification with your previous conversation
- The extension automatically caches new conversations for future reference

### File Processing

- Drag and drop any file onto the ChatGPT interface
- Choose from the following options:
  - **Compress Image**: Reduces image file size while maintaining quality
  - **Extract PDF Text**: Extracts all text from PDF files and inserts it into the input box
  - **Upload Original**: Uploads the file as-is

## Technical Details

- **Manifest Version**: 3
- **Build Tool**: Vite
- **Key Libraries**:
  - `@xenova/transformers`: For AI embeddings and similarity search
  - `compressorjs`: For image compression
  - `pdfjs-dist`: For PDF text extraction

## Troubleshooting

### Extension Not Loading

- Make sure you're loading the `dist` folder, not the `src` or root folder
- Ensure you're using a local file path (not OneDrive or cloud-synced folders)
- Check that Developer mode is enabled in Chrome

### Memory Not Working

- The extension needs to cache a few conversations before it can find matches
- Similarity threshold is set to 92% - very similar conversations will be found
- Check the browser console for any error messages

### File Processing Issues

- Make sure you're dragging files directly onto the ChatGPT interface
- PDF text extraction works best with text-based PDFs (not scanned images)
- Image compression maintains quality while reducing file size

## Development

To modify the extension:

1. Edit files in the `src` directory
2. Run `npm run build` to rebuild
3. Reload the extension in Chrome (click the refresh button on the extension card)

## File Structure

```
├── public/
│   └── manifest.json          # Extension manifest
├── src/
│   ├── background.js          # Service worker for AI processing
│   ├── content.js             # Main extension logic
│   └── styles.css             # Extension styling
├── dist/                      # Built extension files
├── package.json               # Dependencies and scripts
└── vite.config.js            # Build configuration
```

## Privacy

- All data is stored locally in your browser
- No data is sent to external servers
- Conversations are cached using Chrome's local storage API
