#!/bin/bash
set -e

echo ""
echo "🚀 SwanyBot Pro Ultimate - Production Installer"
echo "================================================"
echo ""

# Check requirements
command -v docker >/dev/null 2>&1 || { echo "❌ Docker required. Install from https://docker.com"; exit 1; }
command -v docker-compose >/dev/null 2>&1 || { echo "❌ Docker Compose required"; exit 1; }

echo "✅ Docker and Docker Compose found"
echo ""

# Get configuration
read -p "Enter admin email [admin@localhost]: " ADMIN_EMAIL
ADMIN_EMAIL=${ADMIN_EMAIL:-admin@localhost}

read -sp "Enter admin password [admin123]: " ADMIN_PASSWORD
echo ""
ADMIN_PASSWORD=${ADMIN_PASSWORD:-admin123}

read -p "Enter N8N password [admin123]: " N8N_PASSWORD
N8N_PASSWORD=${N8N_PASSWORD:-admin123}

read -p "Enter Stripe Secret Key (optional): " STRIPE_KEY
read -p "Enter domain name [localhost]: " DOMAIN
DOMAIN=${DOMAIN:-localhost}

echo ""
echo "📝 Generating secure secrets..."

# Generate secrets
JWT_SECRET=$(openssl rand -hex 32)
DB_PASSWORD=$(openssl rand -hex 16)

echo "✅ Secrets generated"

# Create .env file
cat > .env << EOF
# SwanyBot Pro Ultimate Configuration
GENERATED_AT=$(date)

# Database
DB_PASSWORD=${DB_PASSWORD}
DATABASE_URL=postgresql://postgres:${DB_PASSWORD}@postgres:5432/swanybot

# Security
JWT_SECRET=${JWT_SECRET}

# API Keys
EMERGENT_LLM_KEY=sk-emergent-b28684b96617076783
STRIPE_SECRET_KEY=${STRIPE_KEY}

# N8N
N8N_PASSWORD=${N8N_PASSWORD}

# Admin
ADMIN_EMAIL=${ADMIN_EMAIL}
ADMIN_PASSWORD=${ADMIN_PASSWORD}

# Domain
DOMAIN=${DOMAIN}
EOF

echo "✅ Configuration saved to .env"
echo ""
echo "🐳 Starting Docker containers..."

# Pull images
docker-compose -f docker-compose.full.yml pull

# Start services
docker-compose -f docker-compose.full.yml up -d

echo "✅ Containers started"
echo ""
echo "⏳ Waiting for services to be ready..."
sleep 15

# Setup database
echo "📊 Initializing database..."
docker-compose -f docker-compose.full.yml exec -T postgres psql -U postgres -d swanybot -f /docker-entrypoint-initdb.d/schema.sql || true

# Create admin user
echo "👤 Creating admin user..."
docker-compose -f docker-compose.full.yml exec -T backend-node node -e "
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const pool = new Pool({
  host: 'postgres',
  port: 5432,
  database: 'swanybot',
  user: 'postgres',
  password: '${DB_PASSWORD}'
});

(async () => {
  try {
    const hash = await bcrypt.hash('${ADMIN_PASSWORD}', 10);
    const result = await pool.query(
      'INSERT INTO users (email, password_hash, username, full_name, credits, role) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id',
      ['${ADMIN_EMAIL}', hash, 'admin', 'Administrator', 1000, 'admin']
    );
    console.log('✅ Admin user created (ID: ' + result.rows[0].id + ')');
  } catch (err) {
    if (err.code === '23505') {
      console.log('ℹ️  Admin user already exists');
    } else {
      console.error('Error:', err.message);
    }
  }
  process.exit(0);
})();
" 2>/dev/null || echo "ℹ️  Admin user setup will complete on first backend start"

# Import N8N workflows
if [ -d "n8n/workflows" ]; then
  echo "📋 Importing N8N workflows..."
  docker cp n8n/workflows/. swanybot-n8n:/workflows/ 2>/dev/null || echo "ℹ️  N8N workflows will be available for manual import"
fi

# Pull Ollama models
echo "🤖 Pulling Ollama AI models (this may take a few minutes)..."
docker-compose -f docker-compose.full.yml exec -T ollama ollama pull llama3.2:3b 2>/dev/null || echo "ℹ️  Ollama models can be pulled manually later"

echo ""
echo "═══════════════════════════════════════════════════════"
echo "✅ Installation Complete!"
echo "═══════════════════════════════════════════════════════"
echo ""
echo "🌐 Services:"
echo "   • Frontend:        http://${DOMAIN}:3000"
echo "   • Node.js API:     http://${DOMAIN}:8002"
echo "   • Python API:      http://${DOMAIN}:8001"
echo "   • N8N Automation:  http://${DOMAIN}:5678"
echo "   • Ollama AI:       http://${DOMAIN}:11434"
echo ""
echo "👤 Admin Credentials:"
echo "   Email:    ${ADMIN_EMAIL}"
echo "   Password: ${ADMIN_PASSWORD}"
echo ""
echo "🤖 N8N Credentials:"
echo "   Username: admin"
echo "   Password: ${N8N_PASSWORD}"
echo ""
echo "📝 Next Steps:"
echo "   1. Access frontend at http://${DOMAIN}:3000"
echo "   2. Login with admin credentials"
echo "   3. Configure N8N workflows at http://${DOMAIN}:5678"
echo "   4. Add Stripe keys in Settings (if using payments)"
echo ""
echo "📖 Documentation: /app/PRODUCTION_DEPLOYMENT_GUIDE.md"
echo "🔍 View logs: docker-compose -f docker-compose.full.yml logs -f"
echo "🛑 Stop all:  docker-compose -f docker-compose.full.yml down"
echo ""
echo "═══════════════════════════════════════════════════════"
