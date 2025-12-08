#!/bin/bash

echo "🚀 Starting SwanyBot Pro Ultimate - Node.js Backend"
echo "=================================================="
echo ""

cd /app/backend-node

echo "📦 Installing dependencies..."
npm install --silent

echo ""
echo "⚙️  Starting server on port 8002..."
echo ""
echo "Note: PostgreSQL database features require PostgreSQL to be installed"
echo "      Authentication and other features will work once PostgreSQL is set up"
echo ""

# Start server
npm start
