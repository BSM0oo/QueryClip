import { loadServerConfig } from './utils/configLoader';

// API configuration
let serverHost = window.location.hostname;

// Initialize with a default port, but this will be updated
let serverPort = 8991;

// Define constants for development vs production environments
export const isDevelopment = process.env.NODE_ENV === 'development';

// Load server configuration on app startup
export const initializeConfig = async () => {
    try {
        const config = await loadServerConfig();
        serverPort = config.serverPort;
        console.log(`API configured to use port: ${serverPort}`);
        return config;
    } catch (error) {
        console.error('Failed to initialize config:', error);
        // Keep using default port
    }
};

// Use relative URLs when possible, but handle ngrok special case
export const getApiBaseUrl = () => {
  const host = window.location.hostname;
  const isNgrok = host.indexOf('ngrok') !== -1;
  
  if (isNgrok) {
    // For ngrok URLs, explicitly use the current origin without port 8000
    const origin = window.location.origin;
    console.log('Detected ngrok URL, using explicit origin:', origin);
    return origin;
  }
  
  return '';  // Empty means use relative URLs (current server)
};

// This is maintained for backward compatibility but now as a function to ensure it uses the latest port
export const getApiBaseURL = () => getApiBaseUrl();

// For backward compatibility with existing code
export const API_BASE_URL = getApiBaseUrl();

// We'll also add a function to refresh this URL if needed
export const refreshApiBaseUrl = () => {
  return ''; // Use relative URL
};

// During development, we can use the Vite proxy which handles requests to /api/*
// In production, we need to use the full URL
export const getApiUrl = (path) => {
    // Get the base URL (will detect ngrok and handle accordingly)
    const baseUrl = getApiBaseUrl();
    
    // Normalize path to remove any leading 'api/' since we add it below
    // This fixes cases where some code might already include 'api/' in the path
    let normalizedPath = path;
    
    if (normalizedPath.startsWith('/api/')) {
        normalizedPath = normalizedPath.substring(5); // Remove leading '/api/'
    } else if (normalizedPath.startsWith('api/')) {
        normalizedPath = normalizedPath.substring(4); // Remove leading 'api/'
    }
    
    // Ensure path has a leading slash
    if (!normalizedPath.startsWith('/')) {
        normalizedPath = '/' + normalizedPath;
    }
    
    // Now construct the final path with a single '/api' prefix and base URL
    const finalUrl = `${baseUrl}/api${normalizedPath}`;
    console.log(`API URL: ${finalUrl}`);
    return finalUrl;
};
