/* -*- Mode: JS; tab-width: 2; indent-tabs-mode: nil; js-indent-level: 2; fill-column: 100 -*- */
// SPDX-License-Identifier: MIT

// ZetaJS LibreOffice WASM Thread for Document Conversion
// This worker handles LibreOffice operations using ZetaJS

// JS mode: module
import { ZetaHelperThread } from './assets/vendor/zetajs/zetaHelper.js';

// Global variables - zetajs environment:
const zHT = new ZetaHelperThread();
const zetajs = zHT.zetajs;
const css = zHT.css;

// Global variables for LibreOffice operations
let xModel;
let bean_hidden, bean_overwrite, bean_pdf_export;

// Export variables for debugging
export { zHT, xModel, bean_hidden, bean_overwrite, bean_pdf_export };

function initializeConverter() {
  // Initialize LibreOffice property beans
  bean_hidden = new css.beans.PropertyValue({Name: 'Hidden', Value: true});
  bean_overwrite = new css.beans.PropertyValue({Name: 'Overwrite', Value: true});
  
  // PDF export filter for different document types
  const pdfFilters = {
    'writer': 'writer_pdf_Export',
    'calc': 'calc_pdf_Export', 
    'impress': 'impress_pdf_Export',
    'draw': 'draw_pdf_Export'
  };

  // Handle messages from main thread
  zHT.thrPort.onmessage = (e) => {
    try {
      switch (e.data.cmd) {
        case 'convert':
          handleConversion(e.data);
          break;
        case 'cleanup':
          handleCleanup();
          break;
        default:
          throw new Error('Unknown message command: ' + e.data.cmd);
      }
    } catch (error) {
      console.error('Office thread error:', error);
      zetajs.mainPort.postMessage({
        cmd: 'error',
        error: error.message,
        stack: error.stack
      });
    }
  };

  function handleConversion(data) {
    const { fileName, from, to } = data;
    
    try {
      // Close old document if exists
      if (xModel !== undefined && 
          xModel.queryInterface(zetajs.type.interface(css.util.XCloseable))) {
        xModel.close(false);
        xModel = undefined;
      }

      // Determine document type and appropriate PDF filter
      const extension = fileName.toLowerCase().split('.').pop();
      let filterName = 'writer_pdf_Export'; // default
      
      switch (extension) {
        case 'xlsx':
        case 'xls':
        case 'ods':
          filterName = 'calc_pdf_Export';
          break;
        case 'pptx':
        case 'ppt':
        case 'odp':
          filterName = 'impress_pdf_Export';
          break;
        case 'odg':
          filterName = 'draw_pdf_Export';
          break;
        default:
          filterName = 'writer_pdf_Export';
      }

      bean_pdf_export = new css.beans.PropertyValue({
        Name: 'FilterName', 
        Value: filterName
      });

      // Load the document
      console.log(`Loading document: ${fileName} (${extension})`);
      xModel = zHT.desktop.loadComponentFromURL(
        'file://' + from, 
        '_blank', 
        0, 
        [bean_hidden]
      );

      if (!xModel) {
        throw new Error('Failed to load document');
      }

      // Convert to PDF
      console.log(`Converting to PDF using filter: ${filterName}`);
      xModel.storeToURL(
        'file://' + to, 
        [bean_overwrite, bean_pdf_export]
      );

      // Notify main thread of successful conversion
      zetajs.mainPort.postMessage({
        cmd: 'converted',
        fileName: fileName,
        from: from,
        to: to
      });

      console.log(`Conversion completed: ${fileName} -> PDF`);

    } catch (error) {
      const exc = zetajs.catchUnoException(error);
      const errorMessage = exc ? `LibreOffice Error: ${exc.Message}` : error.message;
      console.error('Conversion failed:', errorMessage);
      
      zetajs.mainPort.postMessage({
        cmd: 'error',
        error: errorMessage,
        fileName: fileName
      });
    }
  }

  function handleCleanup() {
    try {
      if (xModel !== undefined && 
          xModel.queryInterface(zetajs.type.interface(css.util.XCloseable))) {
        xModel.close(false);
        xModel = undefined;
      }
      zetajs.mainPort.postMessage({ cmd: 'cleaned' });
    } catch (error) {
      console.error('Cleanup error:', error);
    }
  }

  // Signal that the worker is ready
  zHT.thrPort.postMessage({ cmd: 'ready' });
}

// Initialize the converter
initializeConverter();

/* vim:set shiftwidth=2 softtabstop=2 expandtab cinoptions=b1,g0,N-s cinkeys+=0=break: */
