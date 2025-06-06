START with THIS: docker build --platform linux/amd64 -t youtube-notes-app .


Deploy to Cloud Run:

gcloud run deploy youtube-notes-app \
  --image us-west1-docker.pkg.dev/webapps-426717/youtube-notes-repo/youtube-notes-app \
  --platform managed \
  --region us-west1 \
  --project webapps-426717 \
  --allow-unauthenticated \
  --memory 512Mi \
  --cpu 1 \
  --min-instances 0 \
  --max-instances 1

  First, let's make sure you're properly authenticated:


# Set your project ID
gcloud config set project webapps-426717

We need to use the correct registry URL. Let's set up Artifact Registry (the newer version of Container Registry):

bashCopy# Enable Artifact Registry API
gcloud services enable artifactregistry.googleapis.com

# Create a new repository
gcloud artifacts repositories create youtube-notes-repo \
    --repository-format=docker \
    --location=us-west1 \
    --description="Repository for YouTube Notes App"

Configure Docker to authenticate with Artifact Registry:

bashCopygcloud auth configure-docker us-west1-docker.pkg.dev

Now, let's tag your local image with the correct registry URL:

bashCopy# List your local Docker images to get the image ID
docker images

# Tag your image (replace [IMAGE_ID] with your actual image ID)
docker tag youtube-notes-app us-west1-docker.pkg.dev/webapps-426717/youtube-notes-repo/youtube-notes-app

Push the image:

docker push us-west1-docker.pkg.dev/webapps-426717/youtube-notes-repo/youtube-notes-app

### Deploy to Cloud Run:

docker deploy youtube-notes-app \
  --image us-west1-docker.pkg.dev/webapps-426717/youtube-notes-repo/youtube-notes-app \
  --platform managed \
  --region us-central1 \
  --project webapps-426717 \
  --allow-unauthenticated \
  --memory 512Mi \
  --cpu 1 \
  --min-instances 0 \
  --max-instances 1
