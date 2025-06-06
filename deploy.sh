# 1) make executabel: chmod +x deploy.sh
# then deploy using the script: 
#  ./deploy.sh

# Navigate to your project directory
cd '/Users/williamsmith/Library/CloudStorage/OneDrive-Personal/Coding OneDrive/youtube-notes-app-clean-Claude-OneDrive-011025-gcloud'

# Configuration
PROJECT_ID="webapps-426717"
REGION="us-west1"  # or your preferred region
SERVICE_NAME="youtube-notes-app"

# Build the container
echo "Building container..."

docker build --platform linux/amd64 -t youtube-notes-app .

echo "Container built..."
echo "Tagging container..."

docker tag youtube-notes-app us-west1-docker.pkg.dev/webapps-426717/youtube-notes-repo/youtube-notes-app

echo "Container tagged..."
echo "Pushing container..."

docker push us-west1-docker.pkg.dev/webapps-426717/youtube-notes-repo/youtube-notes-app

echo "Container pushed..."
echo "Deploying container..."

gcloud run deploy youtube-notes-app \
  --image us-west1-docker.pkg.dev/webapps-426717/youtube-notes-repo/youtube-notes-app \
  --platform managed \
  --region us-west1 \
  --project webapps-426717 \
  --memory 512Mi \
  --cpu 1 \
  --min-instances 0 \
  --max-instances 1

echo "Container deployed..."