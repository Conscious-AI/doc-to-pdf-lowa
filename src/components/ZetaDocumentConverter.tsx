'use client';

import { useState, useRef, useEffect } from 'react';
import { Upload, Download, FileText, Loader2, CheckCircle, AlertCircle } from 'lucide-react';

type ConversionStatus = 'idle' | 'loading' | 'converting' | 'success' | 'error';

// ZetaJS types
interface ZetaHelperMain {
  start: (callback: () => void) => void;
  thrPort: {
    postMessage: (message: unknown) => void;
    onmessage: ((e: MessageEvent) => void) | null;
  };
}

declare global {
  interface Window {
    FS: {
      writeFile: (path: string, data: Uint8Array) => void;
      readFile: (path: string) => Uint8Array;
      unlink: (path: string) => void;
    };
  }
}

export default function ZetaDocumentConverter() {
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<ConversionStatus>('idle');
  const [error, setError] = useState<string>('');
  const [pdfUrl, setPdfUrl] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [warmupStatus, setWarmupStatus] = useState<'idle' | 'warming' | 'ready' | 'failed'>('idle');
  const zetaHelperRef = useRef<ZetaHelperMain | null>(null);
  // ZetaJS will be loaded dynamically at runtime

  // Initialize ZetaJS
  const initializeZeta = async () => {
    if (warmupStatus !== 'idle') return;
    
    setWarmupStatus('warming');
    
    try {
      // Dynamically import ZetaJS helper directly (aligns with ZetaJS sample)
      const zetaUrl = '/assets/vendor/zetajs/zetaHelper.js';
      const mod = await import(/* webpackIgnore: true */ zetaUrl) as { ZetaHelperMain: new (path: string, options: { threadJsType: string; wasmPkg: string }) => ZetaHelperMain };
      const ZetaHelperMain = mod.ZetaHelperMain;
      
      // Initialize ZetaJS with our office thread; use CDN (free) build
      const zHM = new ZetaHelperMain('/office_thread.js', {
        threadJsType: 'module',
        wasmPkg: 'free'
      });
      // Prefer qtCanvasElements to silence Qt deprecation of Module.canvas
      try {
        const canvasEl = document.getElementById('qtcanvas') as HTMLCanvasElement | null;
        if (canvasEl && (zHM as unknown as { Module?: { qtCanvasElements?: HTMLCanvasElement[] } }).Module) {
          ((zHM as unknown as { Module: { qtCanvasElements: HTMLCanvasElement[] } }).Module).qtCanvasElements = [canvasEl];
        }
      } catch {}
      
      zetaHelperRef.current = zHM;
      
      // Start ZetaJS and set up message handling
      zHM.start(() => {
        zHM.thrPort.onmessage = (e: MessageEvent) => {
          const { cmd, fileName, from, to, error: errorMsg } = e.data;
          
          switch (cmd) {
            case 'ready':
              setWarmupStatus('ready');
              console.log('ZetaJS LibreOffice is ready for conversion');
              break;
              
            case 'converted':
              try {
                // Clean up input file
                if (window.FS && from) {
                  try { window.FS.unlink(from); } catch {}
                }
                
                // Read the converted PDF
                const pdfData = window.FS.readFile(to);
                const pdfBlob = new Blob([pdfData.slice()], { type: 'application/pdf' });
                const url = URL.createObjectURL(pdfBlob);
                
                setPdfUrl(url);
                setStatus('success');
                
                // Clean up output file
                try { window.FS.unlink(to); } catch {}
                
                console.log(`Conversion completed: ${fileName}`);
              } catch (err) {
                console.error('Error processing converted file:', err);
                setError('Failed to process converted PDF');
                setStatus('error');
              }
              break;
              
            case 'error':
              console.error('ZetaJS conversion error:', errorMsg);
              setError(errorMsg || 'Conversion failed');
              setStatus('error');
              break;
              
            default:
              console.warn('Unknown ZetaJS message:', e.data);
          }
        };
        
        // Signal that we're ready to accept files
        setStatus('idle');
      });
      
    } catch (err) {
      console.error('ZetaJS initialization failed:', err);
      setError('Failed to initialize LibreOffice');
      setWarmupStatus('failed');
      setStatus('error');
    }
  };

  // Trigger initialization on mount
  useEffect(() => {
    const timer = setTimeout(initializeZeta, 0);
    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleFileSelect = (selectedFile: File) => {
    const allowedTypes = [
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
      'application/vnd.openxmlformats-officedocument.presentationml.presentation', // .pptx
      'application/msword', // .doc
      'application/vnd.ms-excel', // .xls
      'application/vnd.ms-powerpoint', // .ppt
      'application/vnd.oasis.opendocument.text', // .odt
      'application/vnd.oasis.opendocument.spreadsheet', // .ods
      'application/vnd.oasis.opendocument.presentation', // .odp
    ];

    if (!allowedTypes.includes(selectedFile.type)) {
      setError('Please select a Word, Excel, PowerPoint, or OpenDocument file');
      return;
    }

    setFile(selectedFile);
    setError('');
    setPdfUrl('');
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) {
      handleFileSelect(droppedFile);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      handleFileSelect(selectedFile);
    }
  };

  const convertToPDF = async () => {
    if (!file || !zetaHelperRef.current || warmupStatus !== 'ready') return;

    setStatus('converting');
    setError('');
    setPdfUrl('');

    try {
      // Read file as array buffer
      const arrayBuffer = await file.arrayBuffer();
      const uint8Array = new Uint8Array(arrayBuffer);
      
      // Create file paths
      const fileName = file.name;
      const extension = fileName.split('.').pop() || '';
      const inputPath = `/tmp/input.${extension}`;
      const outputPath = '/tmp/output.pdf';
      
      // Write file to virtual filesystem
      window.FS.writeFile(inputPath, uint8Array);
      
      // Send conversion request to ZetaJS worker
      zetaHelperRef.current.thrPort.postMessage({
        cmd: 'convert',
        fileName: fileName,
        from: inputPath,
        to: outputPath
      });

    } catch (err) {
      console.error('Conversion setup error:', err);
      setError(err instanceof Error ? err.message : 'Conversion failed');
      setStatus('error');
    }
  };

  const downloadPDF = () => {
    if (pdfUrl) {
      const link = document.createElement('a');
      link.href = pdfUrl;
      link.download = `${file?.name.replace(/\.[^/.]+$/, '')}.pdf` || 'converted.pdf';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const resetConverter = () => {
    setFile(null);
    setStatus('idle');
    setError('');
    if (pdfUrl) {
      URL.revokeObjectURL(pdfUrl);
      setPdfUrl('');
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const getStatusIcon = () => {
    if (status === 'loading' || status === 'converting') {
      return <Loader2 className="w-5 h-5 animate-spin text-blue-500" />;
    }
    if (status === 'success') {
      return <CheckCircle className="w-5 h-5 text-green-500" />;
    }
    if (status === 'error') {
      return <AlertCircle className="w-5 h-5 text-red-500" />;
    }
    
    // Show warmup status when idle
    switch (warmupStatus) {
      case 'warming':
        return <Loader2 className="w-5 h-5 animate-spin text-orange-500" />;
      case 'ready':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'failed':
        return <AlertCircle className="w-5 h-5 text-red-500" />;
      default:
        return <FileText className="w-5 h-5 text-gray-400" />;
    }
  };

  const getStatusText = () => {
    switch (status) {
      case 'converting':
        return 'Converting document...';
      case 'success':
        return 'Conversion successful!';
      case 'error':
        return 'Conversion failed';
      default:
        // Show warmup status when idle
        switch (warmupStatus) {
          case 'warming':
            return 'Initializing LibreOffice...';
          case 'ready':
            return 'LibreOffice ready - Upload a document!';
          case 'failed':
            return 'LibreOffice failed to load';
          default:
            return 'Starting up...';
        }
    }
  };

  return (
    <>
      {/* Hidden canvas required by ZetaJS/Qt runtime */}
      <div style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', pointerEvents: 'none' }}>
        <canvas id="qtcanvas" width={1} height={1} />
      </div>
      
      <div className="max-w-2xl mx-auto p-6 space-y-6">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Document to PDF Converter
          </h1>
          <p className="text-gray-600 mb-2">
            Convert Word, Excel, and PowerPoint files to PDF in your browser
          </p>
          <p className="text-sm text-blue-600">
            ⚡ Powered by ZetaJS + LibreOffice WASM
          </p>
        </div>

      {/* File Upload Area */}
      <div
        className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
          file ? 'border-green-300 bg-green-50' : 'border-gray-300 hover:border-gray-400'
        }`}
        onDrop={handleDrop}
        onDragOver={(e) => e.preventDefault()}
        onClick={() => fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".doc,.docx,.xls,.xlsx,.ppt,.pptx,.odt,.ods,.odp"
          onChange={handleFileInputChange}
          className="hidden"
        />
        
        <Upload className="w-12 h-12 text-gray-400 mx-auto mb-4" />
        
        {file ? (
          <div>
            <p className="text-lg font-medium text-green-700">{file.name}</p>
            <p className="text-sm text-green-600">
              {(file.size / 1024 / 1024).toFixed(2)} MB
            </p>
          </div>
        ) : (
          <div>
            <p className="text-lg text-gray-600 mb-2">
              Drop your document here or click to browse
            </p>
            <p className="text-sm text-gray-500">
              Supports: .docx, .xlsx, .pptx, .doc, .xls, .ppt, .odt, .ods, .odp
            </p>
          </div>
        )}
      </div>

      {/* Status */}
      <div className="flex items-center justify-center space-x-3 py-4">
        {getStatusIcon()}
        <span className="text-lg font-medium">{getStatusText()}</span>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-700">{error}</p>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex space-x-4">
        {!pdfUrl ? (
          <button
            onClick={convertToPDF}
            disabled={!file || status === 'converting' || warmupStatus !== 'ready'}
            className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-medium py-3 px-6 rounded-lg transition-colors"
          >
            {status === 'converting' ? (
              <span className="flex items-center justify-center">
                <Loader2 className="w-5 h-5 animate-spin mr-2" />
                Converting...
              </span>
            ) : (
              'Convert to PDF'
            )}
          </button>
        ) : (
          <>
            <button
              onClick={downloadPDF}
              className="flex-1 bg-green-600 hover:bg-green-700 text-white font-medium py-3 px-6 rounded-lg transition-colors flex items-center justify-center"
            >
              <Download className="w-5 h-5 mr-2" />
              Download PDF
            </button>
            <button
              onClick={resetConverter}
              className="bg-gray-500 hover:bg-gray-600 text-white font-medium py-3 px-6 rounded-lg transition-colors"
            >
              Convert Another
            </button>
          </>
        )}
      </div>

      {/* Module Status */}
      <div className="text-center text-sm text-gray-500">
        ZetaJS LibreOffice: {
          warmupStatus === 'ready' ? 'Ready ✅' : 
          warmupStatus === 'warming' ? 'Loading... ⏳' :
          warmupStatus === 'failed' ? 'Failed ❌' : 
          'Initializing... 🔄'
        }
      </div>
      </div>
    </>
  );
}
