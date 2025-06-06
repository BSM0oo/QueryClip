import React, { useState, useEffect, useRef } from 'react';
import { generateExportContent, generateSimplifiedContent } from '../utils/exportUtils';
import SaveToNotionButton from './SaveToNotionButton';
import '../styles/ExportStyles.css';

const NotesManager = ({
  title = "Notes & Export",
  showButtonText = (isVisible) => isVisible ? 'Hide Notes & Export' : 'Show Notes & Export',
  videoId,
  videoTitle,
  videoDescription,
  notes,
  onNotesChange,
  screenshots,
  transcriptAnalysis,
  transcript
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);
  const [error, setError] = useState('');
  const [exportData, setExportData] = useState(null);
  const [copySuccess, setCopySuccess] = useState('');
  const [includeImages, setIncludeImages] = useState(false);
  const [formatMode, setFormatMode] = useState('text');  // 'text', 'placeholder', 'image'

  // Prepare export data whenever props change
  useEffect(() => {
    setExportData({
      videoTitle,
      videoId,
      videoDescription,
      notes,
      screenshots: screenshots || [],
      transcriptAnalysis,
      transcript
    });
  }, [videoTitle, videoId, videoDescription, notes, screenshots, transcriptAnalysis, transcript]);

  const handleExport = async (format = 'markdown') => {
    try {
      if (!exportData) {
        throw new Error('No data available for export');
      }

      const content = generateExportContent({
        ...exportData,
        format
      });

      const mimeTypes = {
        markdown: 'text/markdown',
        html: 'text/html'
      };

      const extensions = {
        markdown: 'md',
        html: 'html'
      };

      const blob = new Blob([content], { type: mimeTypes[format] });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${exportData.videoTitle || 'video'}_notes.${extensions[format]}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Export error:', error);
      setError('Error exporting notes: ' + error.message);
    }
  };

  const [isProcessing, setIsProcessing] = useState(false);

  const handleCopyToClipboard = async () => {
    try {
      if (!exportData) {
        throw new Error('No data available to copy');
      }

      // Clear any previous errors and set processing state
      setError('');
      setIsProcessing(true);
      setCopySuccess('Processing...');
      console.log('Starting image processing...');

      // Add detailed processing status logging
      const screenshotCount = exportData.screenshots?.length || 0;
      console.log(`Screenshots: ${screenshotCount}, Format mode: ${formatMode}`);
      
      // Log the detailed structure of screenshots for debugging
      if (screenshotCount > 0) {
        const firstScreenshot = exportData.screenshots[0];
        console.log('First screenshot properties:', Object.keys(firstScreenshot));
        console.log('Image data source:', 
          firstScreenshot.dataUrl ? 'dataUrl property (preferred)' : 
          firstScreenshot.image ? 'image property (alternate)' : 
          'No recognized image data found');
        
        // Show detailed information about each screenshot format
        exportData.screenshots.forEach((screenshot, index) => {
          const hasDataUrl = !!screenshot.dataUrl;
          const hasImage = !!screenshot.image;
          const timestamp = screenshot.timestamp ? new Date(screenshot.timestamp * 1000).toISOString().substr(11, 8) : 'unknown';
          console.log(`Screenshot ${index + 1} [${timestamp}]: dataUrl=${hasDataUrl}, image=${hasImage}`);
        });
      }
      
      // Generate content based on selected format mode with improved optimization options
      const options = {
        includeImages: formatMode === 'placeholder' || formatMode === 'image',
        useActualImages: formatMode === 'image',
        imageFormat: 'png',  // Notion-compatible format
        imageQuality: 0.9,   // Higher quality for better appearance
        maxWidth: 800,       // Reasonable width for Notion
        maxHeight: 600,      // Reasonable height for Notion
      };

      console.log(`Processing with options: ${JSON.stringify(options)}`);

      // Display processing feedback for image-heavy operations
      if (formatMode === 'image' && screenshotCount > 0) {
        setCopySuccess(`Processing ${screenshotCount} images...`);
      }

      try {
        // Generate content and wait for all image processing to complete
        console.log('Generating simplified content...');
        
        // Show detailed processing status for images
        const screenshotCount = exportData.screenshots?.length || 0;
        if (formatMode === 'image' && screenshotCount > 0) {
          setCopySuccess(`Processing ${screenshotCount} images...`);
          
          // Add more detailed log for debugging
          console.log(`Processing ${screenshotCount} screenshots with the following data:`);
          exportData.screenshots.forEach((screenshot, index) => {
            const hasDataUrl = !!screenshot.dataUrl;
            const hasImage = !!screenshot.image;
            console.log(`Screenshot ${index+1}: dataUrl=${hasDataUrl}, image=${hasImage}, size=${hasDataUrl ? screenshot.dataUrl.length : (hasImage ? screenshot.image.length : 0)}`);
          });
        }
        
        // Generate the content with a clear UI update
        const simplifiedContent = await generateSimplifiedContent(exportData, options);
        console.log(`Content generated successfully: ${simplifiedContent.length} characters`);
        
        // Check if content is too large (browser clipboard limits vary)
        if (simplifiedContent.length > 5000000) { // 5MB limit as safety measure
          console.warn('Content might be too large for clipboard API');
          // We'll still try but warn the user
          setCopySuccess('Content may be too large');
        }
        
        // Implement a more robust clipboard copy mechanism
        let copySuccess = false;
        
        // Try modern clipboard API first
        if (navigator.clipboard && navigator.clipboard.writeText) {
          try {
            console.log('Using modern clipboard API...');
            await navigator.clipboard.writeText(simplifiedContent);
            console.log('Copied with modern clipboard API');
            copySuccess = true;
          } catch (clipboardError) {
            console.error('Modern clipboard API failed:', clipboardError);
            // Fall through to the legacy method
          }
        }
        
        // If modern method failed or isn't available, try legacy method
        if (!copySuccess) {
          console.log('Using legacy clipboard method...');
          const textarea = document.createElement('textarea');
          textarea.value = simplifiedContent;
          
          // Make sure the textarea is properly visible to the browser
          textarea.style.position = 'fixed';
          textarea.style.top = '0';
          textarea.style.left = '0';
          textarea.style.width = '2em';
          textarea.style.height = '2em';
          textarea.style.padding = '0';
          textarea.style.border = 'none';
          textarea.style.outline = 'none';
          textarea.style.boxShadow = 'none';
          textarea.style.background = 'transparent';
          textarea.style.zIndex = '-1'; // Behind everything but still present
          
          document.body.appendChild(textarea);
          
          // Ensure it's in the DOM before selecting
          setTimeout(() => {
            try {
              textarea.focus();
              textarea.select();
              
              const successful = document.execCommand('copy');
              document.body.removeChild(textarea);
              
              if (!successful) {
                throw new Error('execCommand copy operation failed');
              }
              
              console.log('Copied with execCommand fallback');
              copySuccess = true;
              
              // Update UI on success
              if (formatMode === 'image') {
                setCopySuccess(`Copied with ${screenshotCount} images!`);
              } else {
                setCopySuccess('Copied!');
              }
              
              // Clear the success message after a delay
              setTimeout(() => setCopySuccess(''), 2000);
            } catch (execError) {
              document.body.removeChild(textarea);
              throw new Error(`Legacy clipboard method failed: ${execError.message}`);
            }
          }, 100);
        } else {
          // Modern API worked, update UI
          if (formatMode === 'image') {
            setCopySuccess(`Copied with ${screenshotCount} images!`);
          } else {
            setCopySuccess('Copied!');
          }
          
          // Clear the success message after a delay
          setTimeout(() => setCopySuccess(''), 2000);
        }
      } catch (processingError) {
        console.error('Content generation or clipboard error:', processingError);
        throw new Error(`Processing failed: ${processingError.message}`);
      }
    } catch (error) {
      console.error('Copy error:', error);
      setError('Error copying to clipboard: ' + (error.message || 'Unknown error'));
      setCopySuccess('');
      setTimeout(() => setError(''), 5000);
    } finally {
      // Always reset processing state
      setIsProcessing(false);
      console.log('Processing completed');
    }
  };

  const handlePrint = () => {
    setIsPrinting(true);
    
    try {
      const printContent = generateExportContent({
        ...exportData,
        format: 'html'
      });

      // Create print iframe
      const printFrame = document.createElement('iframe');
      printFrame.style.position = 'fixed';
      printFrame.style.right = '0';
      printFrame.style.bottom = '0';
      printFrame.style.width = '0';
      printFrame.style.height = '0';
      printFrame.style.border = 'none';
      
      document.body.appendChild(printFrame);
      
      // Write content to iframe
      printFrame.contentDocument.write(printContent);
      
      // Set document title to include video title for better PDF filename
      const videoTitleFormatted = exportData.videoTitle ? exportData.videoTitle.trim() : 'Video';
      printFrame.contentDocument.title = `${videoTitleFormatted} QueryClip`;
      
      // Add mobile viewport meta tag to force mobile layout
      const head = printFrame.contentDocument.head;
      const metaViewport = document.createElement('meta');
      metaViewport.name = 'viewport';
      metaViewport.content = 'width=320, initial-scale=1';
      head.appendChild(metaViewport);

      // Add custom mobile CSS
      const mobileStyle = document.createElement('style');
      mobileStyle.textContent = `
        /* Force mobile layout for printing */
        @media print {
          body {
            width: 100% !important;
            max-width: 380px !important;
            margin: 0 auto !important;
            font-size: 10pt !important;
          }
          .export-container {
            padding: 0 !important;
            width: 100% !important;
          }
          .screenshot-container {
            width: 100% !important;
          }
          .screenshot-image {
            max-width: 100% !important;
            max-height: 5in !important;
          }
          .export-title {
            font-size: 16pt !important;
          }
          .export-subtitle {
            font-size: 13pt !important;
          }
          section {
            display: block !important;
            width: 100% !important;
          }
        }
      `;
      head.appendChild(mobileStyle);
      
      printFrame.contentDocument.close();

      // Wait for all images to load before printing
      Promise.all(
        Array.from(printFrame.contentDocument.images)
          .map(img => {
            if (img.complete) return Promise.resolve();
            return new Promise(resolve => {
              img.onload = resolve;
              img.onerror = resolve;
            });
          })
      ).then(() => {
        console.log('Printing with mobile layout emulation');
        printFrame.contentWindow.print();
        
        // Cleanup after print
        setTimeout(() => {
          document.body.removeChild(printFrame);
          setIsPrinting(false);
        }, 500);
      });
    } catch (error) {
      console.error('Print error:', error);
      setError('Error preparing print layout: ' + error.message);
      setIsPrinting(false);
    }
  };

  return (
    <div className="bg-white rounded-lg p-2 sm:p-3 border text-sm">
      <div className="flex justify-between items-center mb-2">
        <h2 className="text-base font-medium">{title}</h2>
        <button
          onClick={() => setIsVisible(!isVisible)}
          className="text-gray-600 hover:text-gray-800 text-xs"
        >
          {showButtonText(isVisible)}
        </button>
      </div>
      
      {isVisible && (
        <div className="space-y-3">
          {error && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative">
              <span className="block sm:inline">{error}</span>
              <button
                onClick={() => setError('')}
                className="absolute top-0 right-0 px-4 py-3"
              >
                ×
              </button>
            </div>
          )}
          
          <div className="bg-white rounded-lg p-2 border shadow-sm">
            <textarea
              value={notes}
              onChange={(e) => onNotesChange(e.target.value)}
              placeholder="Add your notes here..."
              className="w-full h-24 p-2 border rounded-md text-xs focus:ring-1 focus:ring-blue-500"
            />
            
            <div className="flex flex-col sm:flex-row gap-2 mt-4">
              <button
                onClick={() => handleExport('markdown')}
                disabled={isPrinting}
                className="flex-1 bg-purple-500 text-white px-6 py-3 rounded-md hover:bg-purple-600 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isPrinting ? 'Processing...' : 'Export as Markdown'}
              </button>
              
              <button
                onClick={() => handleExport('html')}
                disabled={isPrinting}
                className="flex-1 bg-purple-500 text-white px-6 py-3 rounded-md hover:bg-purple-600 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isPrinting ? 'Processing...' : 'Export as HTML'}
              </button>
              
              <button
                onClick={handlePrint}
                disabled={isPrinting}
                className="flex-1 bg-purple-500 text-white px-6 py-3 rounded-md hover:bg-purple-600 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isPrinting ? 'Preparing PDF...' : 'Save as PDF'}
              </button>
            </div>
            
            <div className="mt-4">
              <div className="flex flex-col space-y-1.5 mb-2">
                <div className="text-sm font-medium text-gray-700">Format Options:</div>
                
                <div className="flex items-center ml-2">
                  <input
                    id="format-text"
                    type="radio"
                    name="format-type"
                    checked={formatMode === 'text'}
                    onChange={() => setFormatMode('text')}
                    className="h-4 w-4 mr-2 border-gray-300 text-blue-600 focus:ring-blue-500"
                    disabled={isProcessing}
                  />
                  <label htmlFor="format-text" className="text-sm text-gray-700 mr-4">
                    Text only (most compatible)
                  </label>
                </div>
                
                <div className="flex items-center ml-2">
                  <input
                    id="format-placeholder"
                    type="radio"
                    name="format-type"
                    checked={formatMode === 'placeholder'}
                    onChange={() => setFormatMode('placeholder')}
                    className="h-4 w-4 mr-2 border-gray-300 text-blue-600 focus:ring-blue-500"
                    disabled={isProcessing}
                  />
                  <label htmlFor="format-placeholder" className="text-sm text-gray-700 mr-4">
                    Include screenshot descriptions
                  </label>
                </div>
                
                <div className="flex items-center ml-2">
                  <input
                    id="format-image"
                    type="radio"
                    name="format-type"
                    checked={formatMode === 'image'}
                    onChange={() => setFormatMode('image')}
                    className="h-4 w-4 mr-2 border-gray-300 text-blue-600 focus:ring-blue-500"
                    disabled={isProcessing}
                  />
                  <label htmlFor="format-image" className="text-sm text-gray-700 mr-4">
                    Include actual images (PNG format)
                  </label>
                </div>
                
                <div className="text-xs text-gray-500 ml-2 mt-1">
                  {formatMode === 'text' && "Basic text-only format for maximum compatibility"}
                  {formatMode === 'placeholder' && "Adds descriptions and timestamps without images"}
                  {formatMode === 'image' && "Includes optimized, Notion-compatible screenshots"}
                </div>
              </div>
              
              <div className="flex flex-wrap justify-between items-center">
                <button
                  onClick={handleCopyToClipboard}
                  disabled={isPrinting || isProcessing}
                  className="bg-blue-500 text-white px-6 py-3 rounded-md hover:bg-blue-600 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center mb-2 sm:mb-0"
                >
                  {isProcessing || copySuccess ? (
                    <span className="flex items-center">
                      {isProcessing ? (
                        <>
                          <svg className="animate-spin h-5 w-5 mr-1" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          {formatMode === 'image' ? 'Processing images...' : 'Processing...'}
                        </>
                      ) : (
                        <>
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-1" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                          {copySuccess}
                        </>
                      )}
                    </span>
                  ) : (
                    <span className="flex items-center">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-1" viewBox="0 0 20 20" fill="currentColor">
                        <path d="M8 3a1 1 0 011-1h2a1 1 0 110 2H9a1 1 0 01-1-1z" />
                        <path d="M6 3a2 2 0 00-2 2v11a2 2 0 002 2h8a2 2 0 002-2V5a2 2 0 00-2-2 3 3 0 01-3 3H9a3 3 0 01-3-3z" />
                      </svg>
                      Format to Copy {formatMode === 'image' 
                        ? '(with images)' 
                        : formatMode === 'placeholder' 
                          ? '(with descriptions)' 
                          : '(text only)'}
                    </span>
                  )}
                </button>
              
              <SaveToNotionButton 
                videoInfo={{
                  title: videoTitle || 'Untitled Video',
                  description: videoDescription || '',
                  transcript: Array.isArray(transcript) ? transcript : [],
                  notes: notes || '',
                  screenshots: Array.isArray(screenshots) ? screenshots : [],
                  transcriptAnalysis: transcriptAnalysis || {}
                }} 
                videoId={videoId} 
              />
              </div>
            </div>
            
            <p className="mt-4 text-sm text-gray-600">
              Note: PDF export will open your system print dialog. Select "Save as PDF" option.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default NotesManager;