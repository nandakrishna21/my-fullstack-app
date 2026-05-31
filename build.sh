#!/bin/bash
cd frontend
npm ci
npm run build
mkdir -p ../backend/public
cp -r dist/* ../backend/public/
cd ../backend
npm ci --omit=dev
