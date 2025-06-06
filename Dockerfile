FROM python:3.9-slim

# Install Node.js, npm and playwright system dependencies
RUN apt-get update && apt-get install -y \
    nodejs \
    npm \
    wget \
    libglib2.0-0 \
    libnss3 \
    libnspr4 \
    libatk1.0-0 \
    libatk-bridge2.0-0 \
    libcups2 \
    libdrm2 \
    libdbus-1-3 \
    libxcb1 \
    libxkbcommon0 \
    libx11-6 \
    libxcomposite1 \
    libxdamage1 \
    libxext6 \
    libxfixes3 \
    libxrandr2 \
    libpango-1.0-0 \
    libcairo2 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

RUN playwright install --with-deps chromium

# Copy the entire application first
COPY . .

# Frontend build steps
WORKDIR /app/frontend
RUN npm install
RUN npm run build
RUN ls -la dist/  # Debug: List built files

WORKDIR /app

# Create static directory and ensure proper permissions
RUN mkdir -p static && \
    cp -r frontend/dist/* static/ && \
    chmod -R 755 static && \
    ls -la static/  # Debug: List copied files

# Expose port 8000
EXPOSE 8080

# Command to run the application with debug logging
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8080", "--log-level", "debug"]