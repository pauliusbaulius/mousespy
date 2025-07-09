#!/bin/bash

# Package Chrome Extension Script
# This script packages the Chrome extension (chrome) into a zip file

echo "Packaging Chrome extension..."

# Check if chrome directory exists
if [ ! -d "chrome" ]; then
    echo "Error: chrome directory not found!"
    exit 1
fi

# Extract version from manifest.json
VERSION=$(grep '"version"' chrome/manifest.json | sed 's/.*"version": "\([^"]*\)".*/\1/')
if [ -z "$VERSION" ]; then
    echo "Error: Could not extract version from manifest.json"
    exit 1
fi

echo "📦 Version detected: $VERSION"

# Create out directory if it doesn't exist
mkdir -p out

# Create the zip file
echo "Creating mousespy-chrome-$VERSION.zip..."
cd chrome
zip -r -FS ../out/mousespy-chrome-$VERSION.zip * --exclude '*.git*' '*.DS_Store*' '*.swp*' '*.tmp*'

# Check if zip was created successfully
if [ $? -eq 0 ]; then
    echo "✅ Chrome extension packaged successfully: out/mousespy-chrome-$VERSION.zip"
    echo "📦 Package size: $(du -h ../out/mousespy-chrome-$VERSION.zip | cut -f1)"
else
    echo "❌ Error: Failed to create zip file"
    exit 1
fi

cd ..
echo "🎉 Chrome extension ready for distribution!" 