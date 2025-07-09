#!/bin/bash

# Package Firefox Extension Script
# This script packages the Firefox extension (firefox) into a zip file

echo "Packaging Firefox extension..."

# Check if firefox directory exists
if [ ! -d "firefox" ]; then
    echo "Error: firefox directory not found!"
    exit 1
fi

# Extract version from manifest.json
VERSION=$(grep '"version"' firefox/manifest.json | sed 's/.*"version": "\([^"]*\)".*/\1/')
if [ -z "$VERSION" ]; then
    echo "Error: Could not extract version from manifest.json"
    exit 1
fi

echo "📦 Version detected: $VERSION"

# Create out directory if it doesn't exist
mkdir -p out

# Create the zip file
echo "Creating mousespy-firefox-$VERSION.zip..."
cd firefox
zip -r -FS ../out/mousespy-firefox-$VERSION.zip * --exclude '*.git*' '*.DS_Store*' '*.swp*' '*.tmp*'

# Check if zip was created successfully
if [ $? -eq 0 ]; then
    echo "✅ Firefox extension packaged successfully: out/mousespy-firefox-$VERSION.zip"
    echo "📦 Package size: $(du -h ../out/mousespy-firefox-$VERSION.zip | cut -f1)"
else
    echo "❌ Error: Failed to create zip file"
    exit 1
fi

cd ..
echo "🎉 Firefox extension ready for distribution!" 