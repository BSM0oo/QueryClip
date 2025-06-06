import axios from 'axios';

// Default settings that will be used until server config is loaded
const defaultConfig = {
    serverPort: 8991, // Fallback port (should match current .env)
    apiVersion: '1.0'
};

// Singleton to store server configuration
let serverConfig = null;

// Attempt to load server configuration (called once on app startup)
export const loadServerConfig = async () => {
    try {
        // Use a direct API call with a relative path that works with the proxy
        const response = await axios.get('/api/config', {
            // Add timeout to prevent hanging if the endpoint isn't available
            timeout: 2000
        });

        serverConfig = response.data;
        console.log('Server configuration loaded successfully:', serverConfig);
        return serverConfig;
    } catch (error) {
        console.warn('Failed to load server config, using defaults:', error);
        serverConfig = defaultConfig;
        return defaultConfig;
    }
};

// Get the current configuration (loads it first if needed)
export const getServerConfig = async () => {
    if (!serverConfig) {
        return await loadServerConfig();
    }
    return serverConfig;
};

// Get port for API requests
export const getServerPort = async () => {
    const config = await getServerConfig();
    return config.serverPort;
};
