#!/bin/bash
exec > /var/log/deploy.log 2>&1

echo "=== Starting deploy ==="
date

# Install Docker on Amazon Linux 2023
dnf install -y docker git
systemctl start docker
systemctl enable docker

echo "=== Docker installed ==="
docker --version

# Clone repo
cd /opt
git clone https://github.com/AMA-Labs/vibe-coding-experiment-OCR-tool.git app
cd app

echo "=== Repo cloned ==="

# Build Docker image
docker build -t ocr-canvas . 2>&1

echo "=== Docker image built ==="

# Run container
docker run -d --name ocr-canvas --restart always -p 80:3001 \
  -e OPENAI_API_KEY=YOUR_OPENAI_KEY_HERE \
  -e JWT_SECRET=prod-secret-ocr-canvas-2024-secure \
  -e NODE_ENV=production \
  -e PORT=3001 \
  -v ocr-data:/app/server/data \
  -v ocr-uploads:/app/server/uploads \
  ocr-canvas

echo "=== Container started ==="
docker ps
echo "=== Deploy complete ==="
date
