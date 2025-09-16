# Document to PDF Conversion (by LOWA - LibreOffice WASM)

A Next.js application that converts Word, Excel, and PowerPoint documents to PDF directly in the browser using LibreOffice WASM with the ZetaJS framework. The LibreOffice WASM and data files are loaded from the official Zeta CDN.

## Features

- **Client-side conversion**: All processing happens in the browser using ZetaJS
- **No server required**: Complete privacy and security
- **Multiple formats supported**: 
  - Word: `.doc`, `.docx`
  - Excel: `.xls`, `.xlsx` 
  - PowerPoint: `.ppt`, `.pptx`
  - OpenDocument: `.odt`, `.ods`, `.odp`
- **Modern UI**: Drag-and-drop file upload with progress indicators
- **High Performance**: Uses ZetaJS + LibreOffice WASM for optimal speed
- **Web Worker**: Non-blocking UI with background processing

## How it Works

This application uses **ZetaJS** framework to interface with LibreOffice WASM for document conversions entirely in the browser. 

### ZetaJS Architecture

- **ZetaHelperMain**: Manages the main thread and Web Worker communication
- **ZetaHelperThread**: Handles LibreOffice operations in a dedicated Web Worker
- **office_thread.js**: Custom conversion logic using LibreOffice UNO API
- **Automatic format detection**: Smart PDF filter selection based on file type

### WASM Files (CDN)

These files are fetched at runtime from the Zeta CDN (not stored in this repository):

- `soffice.wasm` - LibreOffice WebAssembly binary
- `soffice.js` - Loader/runtime
- `soffice.data` - Virtual filesystem with LibreOffice resources
- `soffice.data.js.metadata` - Data file metadata

## Usage

1. **Upload a document**: Drag and drop or click to select a file
2. **Convert**: Click "Convert to PDF" button
3. **Download**: Download the converted PDF file

## Development

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Build for production
npm run build
npm start
```

## Technical Details

### LibreOffice WASM Integration

The app initializes ZetaJS in the main thread using `ZetaHelperMain` and runs conversion logic inside a dedicated office thread via `ZetaHelperThread`. Files are written to the in-memory filesystem, and conversion is executed using the LibreOffice UNO API (`storeToURL`) to produce a PDF, all in the browser.

### File Processing

1. Files are read as ArrayBuffer in the browser
2. Written to LibreOffice's virtual filesystem (`/tmp/input.*`)
3. Converted using LibreOffice's headless mode
4. Output PDF read from virtual filesystem (`/tmp/output.pdf`)
5. Presented as downloadable blob

### Performance Considerations

- **Initial load**: ~250MB of WASM files need to be downloaded and compiled
- **Memory usage**: LibreOffice requires significant RAM for document processing
- **Processing time**: Varies by document size and complexity

### Browser Requirements

- Modern browser with WASM support
- Sufficient RAM (recommended 4GB+)
- COOP/COEP enabled (SharedArrayBuffer):
  - `Cross-Origin-Opener-Policy: same-origin`
  - `Cross-Origin-Embedder-Policy: require-corp`

## Build Configuration

The Next.js configuration includes:

- WASM support via webpack experiments
- COOP/COEP headers for SharedArrayBuffer support

## Deployment

The app fetches LibreOffice WASM and data from the Zeta CDN. Ensure your site sets the required COOP/COEP headers (see above).

## Troubleshooting

### Common Issues

1. **Module not loading**: Check browser console for CORS errors
2. **Conversion fails**: Verify input file format is supported
3. **Memory errors**: Try with smaller files or increase browser memory limits
4. **Slow loading**: WASM files are large; initial load time depends on network and device

### Debug Mode

Enable debug logging by opening browser console. The application logs:
- Module loading status
- File processing steps
- LibreOffice command execution
- Error details

## References

- ZetaJS example used as a starting point: [Convert to PDF example](https://github.com/allotropia/zetajs/tree/main/examples/convertpdf)
