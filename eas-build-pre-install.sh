#!/bin/bash

# Enable core library desugaring for Radar SDK
echo "Enabling core library desugaring in build.gradle..."

BUILD_GRADLE="android/app/build.gradle"

if [ -f "$BUILD_GRADLE" ]; then
  # Add desugaring to android block
  if ! grep -q "coreLibraryDesugaringEnabled" "$BUILD_GRADLE"; then
    sed -i '/defaultConfig {/a\        coreLibraryDesugaringEnabled true' "$BUILD_GRADLE"
    echo "Added coreLibraryDesugaringEnabled to android.defaultConfig"
  fi
  
  # Add desugaring dependency
  if ! grep -q "coreLibraryDesugaring" "$BUILD_GRADLE"; then
    sed -i '/dependencies {/a\    coreLibraryDesugaring("com.android.tools:desugar_jdk_libs:2.0.4")' "$BUILD_GRADLE"
    echo "Added desugaring dependency"
  fi
  
  echo "Desugaring configuration complete!"
else
  echo "Warning: $BUILD_GRADLE not found"
fi