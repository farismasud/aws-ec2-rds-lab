#!/bin/bash
# ==============================================================================
# AWS EC2 User Data Script (Amazon Linux 2023 / Ubuntu)
# Otomatis install Node.js, clone repository, dan jalankan via PM2
# ==============================================================================

set -e

# Update paket OS
if command -v dnf &> /dev/null; then
  # Amazon Linux 2023
  dnf update -y
  dnf install -y git
  # Install Node.js 20
  dnf install -y nodejs npm
elif command -v apt-get &> /dev/null; then
  # Ubuntu / Debian
  apt-get update -y
  apt-get install -y git curl
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs
fi

# Install PM2 secara global
npm install -g pm2

# Clone repository
APP_DIR="/var/www/aws-ec2-rds-lab"
mkdir -p "$APP_DIR"
git clone https://github.com/farismasud/aws-ec2-rds-lab.git "$APP_DIR"
cd "$APP_DIR"

# Install dependensi
npm install --production

# Buat file .env default (Sesuaikan dengan endpoint RDS Anda)
cat << 'EOF' > .env
PORT=3000
DB_DIALECT=mysql
DB_HOST=GANTI_DENGAN_ENDPOINT_RDS_ANDA
DB_PORT=3306
DB_USER=admin
DB_PASSWORD=GANTI_DENGAN_PASSWORD_RDS
DB_NAME=labdb
DB_SSL=false
EOF

# Jalankan aplikasi dengan PM2 dan atur auto-start saat reboot
pm2 start server.js --name "aws-lab"
pm2 startup systemd -u root --hp /root
pm2 save

echo "AWS Lab App siap digunakan di port 3000"
