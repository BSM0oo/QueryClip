// exportUtils.js

export const formatTime = (seconds) => {
  const date = new Date(seconds * 1000);
  return date.toISOString().substr(11, 8);
};

/**
 * Generates lightweight, Notion-friendly content for clipboard
 * @param {Object} data - The data to format
 * @param {Object} options - Formatting options
 * @param {boolean} options.includeImages - Whether to include image placeholders in the output
 * @param {boolean} options.useActualImages - Whether to include actual images instead of placeholders
 * @param {string} options.imageFormat - Format for image conversion (png or jpeg)
 * @param {number} options.imageQuality - Quality of the output image (0-1 for jpeg)
 * @param {number} options.maxWidth - Maximum width of the output image
 * @param {number} options.maxHeight - Maximum height of the output image
 * @returns {string} Formatted content
 */
/**
 * Generates lightweight, Notion-friendly content for clipboard
 * Now supports async image processing for better Notion compatibility
 */
export const generateSimplifiedContent = async ({ 
  videoTitle, 
  videoId, 
  notes, 
  screenshots = [], 
  transcriptAnalysis, 
  videoDescription 
}, options = {}) => {
  const { 
    includeImages = false,
    useActualImages = false,
    imageFormat = 'png',  // Notion-compatible format
    imageQuality = 0.8,   // Balance between quality and file size
    maxWidth = 800,       // Reasonable width for Notion
    maxHeight = 600       // Reasonable height for Notion
  } = options;
  
  // Build the content using pure markdown for maximum Notion compatibility
  const parts = [];
  
  // Add video title
  if (videoTitle) {
    parts.push(`# ${videoTitle}\n\n`);
  }
  
  // Add YouTube link
  if (videoId) {
    parts.push(`🔗 [Watch on YouTube](https://www.youtube.com/watch?v=${videoId})\n\n`);
  }
  
  // Add notes
  if (notes?.trim()) {
    parts.push(`## Notes\n\n${notes}\n\n`);
  }
  
  // Add transcript analysis (simplified)
  if (transcriptAnalysis?.trim()) {
    parts.push(`## Transcript Analysis\n\n${transcriptAnalysis}\n\n`);
  }
  
  // Add screenshots
  if (screenshots?.length > 0) {
    parts.push(`## Screenshots (${screenshots.length})\n\n`);
    
    if (includeImages) {
      // Process screenshots in smaller batches to avoid overwhelming the browser
      const batchSize = 3; // Smaller batch size for better performance
      const batches = Math.ceil(screenshots.length / batchSize);
      
      // Process each batch sequentially
      for (let batchIndex = 0; batchIndex < batches; batchIndex++) {
        const batchStart = batchIndex * batchSize;
        const batchEnd = Math.min((batchIndex + 1) * batchSize, screenshots.length);
        const batchScreenshots = screenshots.slice(batchStart, batchEnd);
        
        // Process each screenshot sequentially - more reliable than parallel processing
        for (let index = 0; index < batchScreenshots.length; index++) {
          const screenshot = batchScreenshots[index];
          const actualIndex = batchStart + index;
          const timestamp = formatTime(screenshot.timestamp);
          const caption = screenshot.caption || 'No caption';
          
          console.log(`Processing screenshot ${actualIndex + 1} of ${screenshots.length}`);
          parts.push(`### Screenshot ${actualIndex + 1}: [${timestamp}]\n\n`);
          
          if (useActualImages) {
            console.log(`Processing screenshot ${actualIndex + 1} at ${timestamp}...`);
            
            try {
              // Check which property the image data is stored in
              let imageDataUrl = null;
              
              if (screenshot.dataUrl) {
                console.log(`Using dataUrl property for screenshot ${actualIndex + 1}`);
                imageDataUrl = screenshot.dataUrl;
              } else if (screenshot.image) {
                console.log(`Using image property for screenshot ${actualIndex + 1}`);
                imageDataUrl = screenshot.image;
              } else {
                throw new Error('No image data found in screenshot');
              }
              
              // Check if the image data is valid
              if (!imageDataUrl || typeof imageDataUrl !== 'string' || !imageDataUrl.startsWith('data:')) {
                throw new Error(`Invalid image data format for screenshot ${actualIndex + 1}`);
              }
              
              // Include the actual image optimized for Notion (await the conversion)
              console.log(`Converting screenshot ${actualIndex + 1}...`);
              // Since we're in a sequential loop, we need to await the conversion
              const optimizedImage = await convertImageFormat(imageDataUrl, {
                format: imageFormat,
                quality: imageQuality,
                maxWidth,
                maxHeight
              });
              
              console.log(`Screenshot ${actualIndex + 1} converted successfully, length: ${optimizedImage.length}`);
              // Add the optimized image to the markdown
              parts.push(`![Screenshot at ${timestamp}](${optimizedImage})\n\n`);
            } catch (error) {
              console.error(`Error processing screenshot ${actualIndex + 1}:`, error);
              // Fallback to placeholder if image processing fails
              parts.push(`📷 *Screenshot from video at timestamp ${timestamp} (Error: ${error.message})*\n\n`);
            }
          } else {
            // Include a placeholder description instead of the actual image
            parts.push(`📷 *Screenshot from video at timestamp ${timestamp}*\n\n`);
          }
          
          if (caption && caption !== 'No caption') {
            parts.push(`**Caption:** ${caption}\n\n`);
          }
        }
        
        // Add a small delay between batches to avoid browser hanging with many images
        if (batchIndex < batches - 1) {
          await new Promise(resolve => setTimeout(resolve, 10));
        }
      }
    } else {
      // Text-only references to screenshots
      const screenshotItems = screenshots.map((screenshot, index) => {
        const timestamp = formatTime(screenshot.timestamp);
        const caption = screenshot.caption || 'No caption';
        return `${index + 1}. [${timestamp}] ${caption}`;
      }).join('\n');
      
      parts.push(`${screenshotItems}\n\n`);
    }
  }
  
  // Add video description (simplified)
  if (videoDescription?.trim()) {
    parts.push(`## Video Description\n\n${videoDescription}\n\n`);
  }
  
  return parts.join('');
};

/**
 * Converts an image data URL to a more Notion-compatible format using canvas
 * @param {string} dataUrl - The image data URL to convert
 * @param {Object} options - Conversion options
 * @param {string} options.format - Target format: 'png' or 'jpeg'
 * @param {number} options.quality - Image quality (0-1), only for JPEG
 * @param {number} options.maxWidth - Maximum width to resize to
 * @param {number} options.maxHeight - Maximum height to resize to
 * @returns {Promise<string>} - A processed data URL optimized for Notion
 */
export const convertImageFormat = async (dataUrl, options = {}) => {
  const {
    format = 'png',
    quality = 0.8,
    maxWidth = 800,
    maxHeight = 600
  } = options;
  
  console.log('📸 Starting image conversion with format:', format);
  
  if (!dataUrl) {
    console.error('❌ No image data provided for conversion');
    return '';
  }
  
  if (!dataUrl.startsWith('data:')) {
    console.error('❌ Invalid image data format, expected data URL');
    return dataUrl; // Not a valid data URL, return as is
  }
  
  return new Promise((resolve, reject) => {
    try {
      // Log the type of image we're processing
      const imageType = dataUrl.split(';')[0].split(':')[1];
      console.log(`📷 Processing ${imageType} image, target: ${format}`);
      
      // Create an image element to load the data URL
      const img = new Image();
      img.crossOrigin = 'Anonymous';
      
      img.onload = () => {
        try {
          console.log(`✅ Image loaded successfully: ${img.width}x${img.height} pixels`);
          
          // Calculate new dimensions while maintaining aspect ratio
          let width = img.width;
          let height = img.height;
          
          // Scale down if image exceeds maximum dimensions
          if (width > maxWidth || height > maxHeight) {
            const aspectRatio = width / height;
            
            if (width > maxWidth) {
              width = maxWidth;
              height = Math.round(width / aspectRatio);
            }
            
            if (height > maxHeight) {
              height = maxHeight;
              width = Math.round(height * aspectRatio);
            }
            
            console.log(`🔄 Resizing to: ${width}x${height} pixels`);
          }
          
          // Create canvas for the conversion
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          
          // Draw the image onto the canvas (resized)
          const ctx = canvas.getContext('2d');
          ctx.fillStyle = '#FFFFFF'; // White background
          ctx.fillRect(0, 0, width, height); // Fill with white
          ctx.drawImage(img, 0, 0, width, height);
          
          // Convert to the target format
          const mimeType = format === 'jpeg' ? 'image/jpeg' : 'image/png';
          const outputQuality = format === 'jpeg' ? quality : undefined;
          
          console.log(`⚙️ Converting to ${mimeType} with quality: ${outputQuality || 'default'}`);
          
          // Get the new data URL
          const optimizedDataUrl = canvas.toDataURL(mimeType, outputQuality);
          
          // Log size comparison for debugging
          const originalSize = Math.round(dataUrl.length / 1024);
          const newSize = Math.round(optimizedDataUrl.length / 1024);
          const compressionRatio = Math.round(newSize/originalSize*100);
          console.log(`🔍 Image optimized: ${originalSize}KB → ${newSize}KB (${compressionRatio}%)`);
          
          if (compressionRatio > 95) {
            console.warn('⚠️ Image optimization minimal - check if already optimized');
          }
          
          if (optimizedDataUrl.length < 100) {
            console.error('❌ Conversion produced invalid output, using original');
            resolve(dataUrl); // Fallback to original
          } else {
            console.log('✅ Image conversion successful');
            resolve(optimizedDataUrl);
          }
        } catch (drawError) {
          console.error('❌ Error processing image in canvas:', drawError);
          resolve(dataUrl); // Fallback to original
        }
      };
      
      img.onerror = (e) => {
        console.error('❌ Error loading image for conversion:', e);
        resolve(dataUrl); // Fallback to original
      };
      
      // Timeout in case the image loading gets stuck
      const timeout = setTimeout(() => {
        console.warn('⚠️ Image loading timed out after 5s, using original');
        resolve(dataUrl);
      }, 5000);
      
      // Clear timeout if image loads or errors out
      img.onload = function() {
        clearTimeout(timeout);
        this.onload = null; // Prevent memory leak
        
        try {
          console.log(`✅ Image loaded successfully: ${this.width}x${this.height} pixels`);
          
          // Calculate new dimensions while maintaining aspect ratio
          let width = this.width;
          let height = this.height;
          
          // Scale down if image exceeds maximum dimensions
          if (width > maxWidth || height > maxHeight) {
            const aspectRatio = width / height;
            
            if (width > maxWidth) {
              width = maxWidth;
              height = Math.round(width / aspectRatio);
            }
            
            if (height > maxHeight) {
              height = maxHeight;
              width = Math.round(height * aspectRatio);
            }
            
            console.log(`🔄 Resizing to: ${width}x${height} pixels`);
          }
          
          // Create canvas for the conversion
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          
          // Draw the image onto the canvas (resized)
          const ctx = canvas.getContext('2d');
          ctx.fillStyle = '#FFFFFF'; // White background
          ctx.fillRect(0, 0, width, height); // Fill with white
          ctx.drawImage(this, 0, 0, width, height);
          
          // Convert to the target format
          const mimeType = format === 'jpeg' ? 'image/jpeg' : 'image/png';
          const outputQuality = format === 'jpeg' ? quality : undefined;
          
          console.log(`⚙️ Converting to ${mimeType} with quality: ${outputQuality || 'default'}`);
          
          // Get the new data URL
          const optimizedDataUrl = canvas.toDataURL(mimeType, outputQuality);
          
          // Log size comparison for debugging
          const originalSize = Math.round(dataUrl.length / 1024);
          const newSize = Math.round(optimizedDataUrl.length / 1024);
          const compressionRatio = Math.round(newSize/originalSize*100);
          console.log(`🔍 Image optimized: ${originalSize}KB → ${newSize}KB (${compressionRatio}%)`);
          
          resolve(optimizedDataUrl);
        } catch (drawError) {
          console.error('❌ Error processing image in canvas:', drawError);
          resolve(dataUrl); // Fallback to original
        }
      };
      
      img.onerror = function(e) {
        clearTimeout(timeout);
        console.error('❌ Error loading image:', e);
        resolve(dataUrl);
      };
      
      // Load the image
      console.log('🔄 Loading image...');
      img.src = dataUrl;
      
    } catch (error) {
      console.error('❌ Error in image conversion process:', error);
      resolve(dataUrl); // Fallback to original
    }
  }).catch(error => {
    console.error('❌ Promise error in image conversion:', error);
    return dataUrl; // Final fallback
  });
}

const formatLinks = (text, isHTML) => {
  if (!text) return '';
  
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const socialRegex = /([A-Za-z]+:)\s*([^\n]+)/g;
  
  let formattedText = text;
  
  if (isHTML) {
    // Convert URLs to clickable links
    formattedText = formattedText.replace(urlRegex, (url) => 
      `<a href="${url}" target="_blank" rel="noopener noreferrer">${url}</a>`
    );
    
    // Format social media handles and other labeled items
    formattedText = formattedText.replace(socialRegex, (match, label, content) =>
      `<div class="description-item"><strong>${label}</strong> ${content}</div>`
    );
  }
  
  return formattedText;
};

const generateTranscript = (transcript, isHTML) => {
  if (!transcript?.length) return '';
  
  const formattedTranscript = transcript.map(item => {
    const timestamp = formatTime(item.start);
    return isHTML
      ? `<span class="timestamp">${timestamp}</span> <span class="transcript-text">${item.text}</span>`
      : `${timestamp} ${item.text}`;
  }).join(' ');

  return isHTML
    ? `<div class="transcript-content">${formattedTranscript}</div>`
    : formattedTranscript;
};

const formatScreenshotContent = (screenshot, index, isHTML) => {
  // Handle prompt response type screenshots
  if (screenshot.type === 'prompt_response') {
    const content = [
      `Time: ${formatTime(screenshot.timestamp)}`,
      'Query:',
      screenshot.prompt,
      'Response:',
      screenshot.response
    ];

    if (isHTML) {
      return `
        <div class="prompt-response">
          <div class="time">${formatTime(screenshot.timestamp)}</div>
          <div class="query">
            <strong>Query:</strong>
            <p>${screenshot.prompt}</p>
          </div>
          <div class="response">
            <strong>Response:</strong>
            <div class="markdown-content">${screenshot.response}</div>
          </div>
        </div>
      `;
    }

    return content.join('\n\n');
  }

  // Handle regular screenshots
  const screenshotContent = [
    isHTML 
      ? `<img src="${screenshot.image}" alt="Screenshot ${index + 1}" class="screenshot-image">` 
      : `![Screenshot ${index + 1}](${screenshot.image})`,
  ];

  if (screenshot.caption) {
    const captionContent = isHTML 
      ? `<div class="screenshot-caption">
          <ul>
            ${screenshot.caption.split('\n')
              .map(line => line.trim())
              .filter(line => line)
              .map(line => `<li>${line}</li>`)
              .join('\n')}
          </ul>
        </div>`
      : screenshot.caption;

    screenshotContent.push(captionContent);
  }

  return isHTML
    ? `<div class="screenshot-container">${screenshotContent.join('\n')}</div>`
    : screenshotContent.join('\n\n');
};

export const generateExportContent = ({
  videoTitle,
  videoId,
  videoDescription,
  notes,
  screenshots,
  transcriptAnalysis,
  transcript,
  format = 'markdown'
}) => {
  const isHTML = format === 'html';
  const newline = '\n';
  
  // Wrapper functions for formatting
  const h1 = (text) => isHTML 
    ? `<h1 class="export-title">${text}</h1>` 
    : `# ${text}`;
  
  const h2 = (text) => isHTML 
    ? `<h2 class="export-subtitle">${text}</h2>` 
    : `## ${text}`;
  
  const section = (content, className) => isHTML 
    ? `<section class="${className}">${content}</section>` 
    : content;
  
  // Build content sections
  let content = [];

  // Title and metadata
  content.push(h1(videoTitle || 'Video Notes'));
  content.push(section(
    `Video ID: ${videoId}${newline}Date: ${new Date().toLocaleDateString()}`,
    'metadata'
  ));

  // Description section
  if (videoDescription?.trim()) {
    content.push(h2('Video Description'));
    content.push(section(
      formatLinks(videoDescription, isHTML),
      'video-description'
    ));
  }

  // Notes section
  if (notes?.trim()) {
    content.push(h2('Notes'));
    content.push(section(notes, 'notes-section'));
  }

  // Screenshots section
  if (screenshots?.length) {
    content.push(h2('Screenshots and Annotations'));
    screenshots.forEach((screenshot, index) => {
      content.push(formatScreenshotContent(screenshot, index, isHTML));
    });
  }

  // Transcript analysis section
  if (transcriptAnalysis?.trim()) {
    content.push(h2('Transcript Analysis'));
    const formattedAnalysis = isHTML
      ? transcriptAnalysis
          .split('\n')
          .map(line => {
            if (line.match(/^\d+\./)) return `<h3>${line}</h3>`;
            if (line.trim().startsWith('-')) return `<div class="analysis-item">${line}</div>`;
            return `<p>${line}</p>`;
          })
          .join('\n')
      : transcriptAnalysis;

    content.push(section(formattedAnalysis, 'transcript-analysis'));
  }

  // Full transcript section
  if (transcript?.length) {
    content.push(h2('Full Transcript'));
    content.push(section(generateTranscript(transcript, isHTML), 'transcript-section'));
  }

  // Format-specific wrappers
  if (isHTML) {
    return `<!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${videoTitle || 'Video Notes'}</title>
        <style>
          /* Critical styles for initial render */
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.5; }
          .export-container { max-width: none; margin: 0 auto; padding: 2rem; }
          .transcript-section { font-size: 0.95rem; line-height: 1.5; }
          .transcript-content { display: inline; white-space: normal; }
          .timestamp { font-family: ui-monospace, monospace; color: #555; display: inline; margin-right: 0.25rem; }
          .transcript-text { display: inline; margin-right: 0.5rem; }
          .prompt-response { margin: 2rem 0; padding: 1rem; border: 1px solid #e2e8f0; border-radius: 0.5rem; }
          .prompt-response .time { color: #666; font-family: monospace; margin-bottom: 1rem; }
          .prompt-response .query { margin-bottom: 1rem; }
          .prompt-response .response { margin-top: 1rem; }
          .markdown-content ul { margin-left: 1.5rem; list-style-type: disc; }
          
          /* Mobile-optimized print styles */
          @media print {
            body { 
              font-family: "Times New Roman", serif; 
              font-size: 10pt;
              width: 100%;
              margin: 0 auto;
            }
            .export-container { 
              padding: 0; 
              width: 100%;
              max-width: 100%;
            }
            .export-title {
              font-size: 16pt;
              margin-bottom: 12pt;
            }
            .export-subtitle {
              font-size: 14pt;
              margin-top: 16pt;
              margin-bottom: 10pt;
            }
            .prompt-response { 
              break-inside: avoid;
              margin: 12pt 0;
              padding: 8pt;
            }
            .screenshot-container {
              width: 100%;
              margin: 12pt 0;
            }
            .screenshot-image {
              max-width: 100%;
              max-height: 5in;
            }
            p, li {
              margin-bottom: 6pt;
              line-height: 1.4;
            }
          }
        </style>
        <link rel="stylesheet" href="export-styles.css">
      </head>
      <body>
        <div class="export-container">
          ${content.join('\n\n')}
        </div>
      </body>
      </html>`;
  }

  return content.join('\n\n');
};