# AWS EC2 & RDS Integration Lab

Aplikasi web Node.js ringan dan praktis untuk praktikum/lab menghubungkan komputasi **AWS EC2** dengan database **AWS RDS** (mendukung MySQL dan PostgreSQL).

---

## 🎯 Fitur Lab

1. **Auto Detect Environment**:
   - Mendeteksi apakah aplikasi berjalan di AWS EC2 via AWS IMDSv2 (menampilkan Instance ID, AZ, Public/Private IP) atau di mesin lokal.
   - Status Uptime & Memory real-time.
2. **Uji Konektivitas RDS**:
   - Dialect switcher: MySQL (port 3306) & PostgreSQL (port 5432).
   - Tes ping live & latency round-trip (ms).
   - Penanganan error ramah saat Security Group belum dibuka / database belum dibuat.
3. **Uji Transaksi SQL (CRUD Notes)**:
   - Form insert catatan untuk membuktikan persistence database RDS.
   - Tabel auto-create (`CREATE TABLE IF NOT EXISTS notes`) saat pertama kali terhubung.
4. **Endpoint Health Check**:
   - `/health` mengembalikan status 200 OK untuk AWS Application Load Balancer (ALB) atau Target Group.

---

## 🚀 Panduan Lab AWS EC2 & RDS

### Langkah 1: Buat Database RDS
1. Masuk ke AWS Management Console -> **Amazon RDS** -> **Create database**.
2. Pilih engine: **MySQL** atau **PostgreSQL** (Free tier eligible).
3. Atur Master username (contoh: `admin`) dan Master password.
4. Pastikan opsi **Initial database name** diisi (misal: `labdb`).
5. Catat **Endpoint** RDS setelah statusnya *Available*.

---

### Langkah 2: Konfigurasi Security Group
- **EC2 Security Group (`ec2-sg`)**:
  - Inbound: `Port 80` (HTTP) dan `Port 3000` dari `0.0.0.0/0`.
  - Inbound: `Port 22` (SSH) dari IP Anda.
- **RDS Security Group (`rds-sg`)**:
  - Inbound: Port `3306` (MySQL) atau `5432` (Postgres).
  - Source: Pilih **Custom** lalu masukkan **Security Group ID milik EC2** (`sg-xxxxxxxx`). *(Paling penting agar aman dan terhubung di dalam VPC).*

---

### Langkah 3: Menjalankan di EC2

#### Opsi A: Otomatis via User Data saat Launch Instance
Tempelkan isi script [`ec2-userdata.sh`](./ec2-userdata.sh) ke bagian **Advanced Details -> User data** saat membuat instance EC2 baru.

#### Opsi B: Manual via SSH ke EC2
```bash
# 1. Clone repository
git clone https://github.com/farismasud/aws-ec2-rds-lab.git
cd aws-ec2-rds-lab

# 2. Install dependensi
npm install

# 3. Buat dan atur environment variable
cp .env.example .env
nano .env

# Isi .env dengan endpoint RDS Anda:
# DB_DIALECT=mysql
# DB_HOST=database-1.cxxxx.ap-southeast-1.rds.amazonaws.com
# DB_PORT=3306
# DB_USER=admin
# DB_PASSWORD=your_password
# DB_NAME=labdb

# 4. Jalankan aplikasi
node server.js
# atau menggunakan PM2 agar berjalan di background:
# npm install -g pm2
# pm2 start server.js --name aws-lab
```

Akses browser: `http://<PUBLIC-IP-EC2>:3000`

---

## 🛠️ Menjalankan Lokal

```bash
git clone https://github.com/farismasud/aws-ec2-rds-lab.git
cd aws-ec2-rds-lab
npm install
npm start
```
Buka `http://localhost:3000`. Jika `.env` belum diisi, dashboard tetap berjalan dan menampilkan status "Database Disconnected" dengan pesan panduan.

---

## 📄 License
MIT © [Faris Mass'ud](https://github.com/farismasud)
