#!/usr/bin/env bash
set -euo pipefail

# Build the project (same as CI's check-dist job)
npm run bundle

# Ensure dist/ exists
if [ ! -d dist/ ]; then
  echo "Expected dist/ directory does not exist.  See status below:"
  echo 'Did you forget to run npm run bundle to update the dist/ directory?'
  ls -la ./
  exit 1
fi

# Check for differences in dist/
if [ "$(git diff --ignore-space-at-eol --text dist/ | wc -l)" -gt "0" ]; then
  echo "Detected uncommitted changes after build. See status below:"
  echo 'Did you forget to run npm run bundle to update the dist/ directory?'
  git diff --ignore-space-at-eol --text dist/
  exit 1
fi
