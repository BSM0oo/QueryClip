# Steps to initialize and run the app:

First, check if you're in the correct directory (frontend folder)
Remove existing node_modules and package-lock.json
Reinstall dependencies
Start the development server

# Step 1: Navigate to frontend directory
cd frontend

# Step 2: Remove existing node_modules and lock file
rm -rf node_modules
rm package-lock.json

# Step 3: Install dependencies
npm install
npm install vite @vitejs/plugin-react

# Step 4: Start the development server
npm run dev

## If you still get errors, check if your package.json has these dependencies:

```json
{
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0"
  },
  "devDependencies": {
    "@vitejs/plugin-react": "^4.0.0",
    "vite": "^4.3.9"
  },
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview"
  }
}
```
