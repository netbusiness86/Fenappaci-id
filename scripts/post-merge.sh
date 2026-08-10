#!/bin/bash
set -e

# Install dependencies (no frozen lockfile — task agents may add new packages)
pnpm install --no-frozen-lockfile
