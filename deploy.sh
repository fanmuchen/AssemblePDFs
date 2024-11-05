#!/bin/bash

# Load environment variables from .env file
set -a
source .env
set +a

# Clean local dist directory before building
echo "Cleaning local dist directory..."
rm -rf dist

# Build the project with Vite
echo "Building the project with Vite..."
npm run build

# Check if build was successful
if [ $? -ne 0 ]; then
  echo "Build failed. Exiting..."
  exit 1
fi

# Clean remote directory before uploading
echo "Cleaning remote directory..."
ssh -i $SSH_KEY_PATH $REMOTE_USER@$REMOTE_HOST "rm -rf $REMOTE_DIR/*"

# Check if remote directory clean was successful
if [ $? -ne 0 ]; then
  echo "Remote directory clean failed. Exiting..."
  exit 1
fi

# Transfer build files to remote server
echo "Transferring files to remote server..."
scp -i $SSH_KEY_PATH -r dist/* $REMOTE_USER@$REMOTE_HOST:$REMOTE_DIR

# Check if transfer was successful
if [ $? -ne 0 ]; then
  echo "File transfer failed. Exiting..."
  exit 1
fi

echo "Deployment successful!"
