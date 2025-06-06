# Setting Up Ngrok for QueryClip Remote Access

Based on your code, I can see that your app uses:
- Backend: FastAPI running on port 8991
- Frontend: Vite dev server on port 3000 (in development) or serving static files via the backend when built

Here's a guide to set up ngrok for remote access:

## NEW: Automated Build and Deploy Process

To avoid the "old version" issue with ngrok, two scripts have been created:

1. **`buildrun.sh`** - Builds frontend and copies files to static directory:
   ```bash
   # Run this script to build and update static files
   ./buildrun.sh
   
   # Then start the backend
   python main.py
   ```

2. **`start-ngrok.sh`** - Does everything in one step:
   ```bash
   # This script builds the frontend, copies files to static, 
   # starts the backend, and launches ngrok
   ./start-ngrok.sh
   ```

These scripts ensure that the static files are always up-to-date with your latest frontend changes.

## Manual Process (if you don't want to use the scripts)

If you prefer to run things manually, follow these steps:

1. **Build the frontend and copy files to static:**
   ```bash
   cd frontend
   npm run build
   cd ..
   cp -r frontend/dist/* static/
   ```

2. **Start the backend:**
   ```bash
   python main.py
   ```

3. **Launch ngrok in another terminal:**
   ```bash
   ngrok http 8991
   ```

## Troubleshooting CORS Issues

If you see errors like:
```
XMLHttpRequest cannot load http://xyz-123.ngrok-free.app:8000/api/transcript/VIDEO_ID due to access control checks.
Not allowed to request resource
```

Follow these steps:

1. **Fix Port Mismatch Issue**
   - If you see port 8000 in error messages but your server runs on 8991, this is likely a browser caching issue
   - Try the following steps in order:
     1. Clear your browser cache or try a different browser
     2. Run `./buildrun.sh` to rebuild and update static files
     3. Restart your backend server

2. **Update CORS Settings**
   - Ensure CORS is configured in `main.py` to allow all origins:
   ```python
   app.add_middleware(
       CORSMiddleware,
       allow_origins=["*"],  # Allow all origins for ngrok access
       allow_credentials=True,
       allow_methods=["*"],
       allow_headers=["*"],
   )
   ```

3. **Verify Ngrok Tunnel**
   - Make sure your ngrok tunnel is pointing to port 8991: `ngrok http 8991`
   - Check the ngrok interface at http://localhost:4040 to verify request/response details

## Option 1: Expose only the backend (Recommended)

This works best if you build the frontend and let the backend serve it:

1. **Use the automated script (recommended):**
   ```bash
   ./start-ngrok.sh
   ```

   OR

   ```bash
   ./buildrun.sh   # Build frontend and update static
   python main.py  # In terminal 1
   ngrok http 8991 # In terminal 2
   ```

2. **Use the ngrok URL:**
   - The command will output a URL like `https://12ab-34-56-78-90.ngrok.io`
   - Share this URL with anyone who needs to access your app remotely

## Option 2: Development mode (separate tunnels)

If you need to work in development mode:

1. **Run the backend:**
   ```bash
   python main.py
   ```

2. **Run the frontend dev server:**
   ```bash
   cd frontend
   npm run dev
   ```

3. **Create TWO ngrok tunnels (in separate terminal windows):**
   ```bash
   # Terminal 1 - Backend
   ngrok http 8991
   
   # Terminal 2 - Frontend
   ngrok http 3000
   ```

4. **Modify config.js:**
   In `frontend/src/config.js`, temporarily update the API URL to point to the ngrok backend URL.

## Important Considerations:

1. **YouTube API Behavior:**
   - The ngrok URL will change each session (unless you pay for a fixed subdomain)
   - Some YouTube API quotas might be shared with other ngrok users
   - The video transcript retrieval should be less likely to get flagged vs. cloud providers

2. **Security:**
   - Anyone with the ngrok URL can access your application
   - For sensitive content, use ngrok authentication: `ngrok http 8991 --basic-auth="username:password"`

3. **Performance:**
   - Video playback may be slower through ngrok
   - Larger screenshots might take longer to transfer

4. **Reliability:**
   - Free ngrok sessions time out after a few hours
   - The connection is dependent on your home internet reliability

5. **Bandwidth Usage:**
   - Free ngrok has bandwidth limits (1-2 GB/month)
   - Watching videos remotely will count against your home internet data cap

## Starting the App:

For simplest setup, always use Option 1 (built frontend with automated script):
1. Run `./start-ngrok.sh` (does everything in one step)
2. Share the ngrok URL

This avoids any CORS issues and provides the best user experience.