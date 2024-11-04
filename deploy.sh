#!/bin/bash

# Load environment variables from .env file
set -a
source .env
set +a

# Compile TypeScript
echo "Compiling TypeScript..."
npm run build

# Check if TypeScript compilation was successful
if [ $? -ne 0 ]; then
  echo "TypeScript compilation failed. Exiting..."
  exit 1
fi

# Build the project with Vite
echo "Building the project with Vite..."
npm run build

# Check if build was successful
if [ $? -ne 0 ]; then
  echo "Build failed. Exiting..."
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
