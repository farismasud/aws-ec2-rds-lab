require('dotenv').config();
const express = require('express');
const os = require('os');
const path = require('path');
const http = require('http');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Cache IMDSv2 metadata if running on AWS EC2
let cachedEc2Metadata = null;

async function fetchImds(pathName, token = null) {
  return new Promise((resolve) => {
    const headers = {};
    if (token) headers['X-aws-ec2-metadata-token'] = token;
    const req = http.request(
      `http://169.254.169.254/latest/meta-data/${pathName}`,
      { headers, timeout: 800 },
      (res) => {
        if (res.statusCode !== 200) return resolve(null);
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => resolve(data.trim()));
      }
    );
    req.on('error', () => resolve(null));
    req.on('timeout', () => {
      req.destroy();
      resolve(null);
    });
    req.end();
  });
}

async function getEc2Metadata() {
  if (cachedEc2Metadata) return cachedEc2Metadata;

  // IMDSv2 token request
  const token = await new Promise((resolve) => {
    const req = http.request(
      'http://169.254.169.254/latest/api/token',
      {
        method: 'PUT',
        headers: { 'X-aws-ec2-metadata-token-ttl-seconds': '60' },
        timeout: 800
      },
      (res) => {
        if (res.statusCode !== 200) return resolve(null);
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => resolve(data.trim()));
      }
    );
    req.on('error', () => resolve(null));
    req.on('timeout', () => {
      req.destroy();
      resolve(null);
    });
    req.end();
  });

  if (!token) {
    cachedEc2Metadata = { isEc2: false };
    return cachedEc2Metadata;
  }

  const [instanceId, instanceType, availabilityZone, localIpv4, publicIpv4] = await Promise.all([
    fetchImds('instance-id', token),
    fetchImds('instance-type', token),
    fetchImds('placement/availability-zone', token),
    fetchImds('local-ipv4', token),
    fetchImds('public-ipv4', token)
  ]);

  cachedEc2Metadata = {
    isEc2: true,
    instanceId: instanceId || 'N/A',
    instanceType: instanceType || 'N/A',
    availabilityZone: availabilityZone || 'N/A',
    localIpv4: localIpv4 || 'N/A',
    publicIpv4: publicIpv4 || 'N/A'
  };
  return cachedEc2Metadata;
}

// Health check endpoint for AWS Target Group / ALB / Auto Scaling
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// Server and environment info
app.get('/api/info', async (req, res) => {
  const ec2 = await getEc2Metadata();
  const networkInterfaces = os.networkInterfaces();
  const ips = [];
  for (const name of Object.keys(networkInterfaces)) {
    for (const net of networkInterfaces[name]) {
      if (net.family === 'IPv4' && !net.internal) {
        ips.push(`${name}: ${net.address}`);
      }
    }
  }

  res.json({
    hostname: os.hostname(),
    platform: `${os.type()} ${os.release()} (${os.arch()})`,
    nodeVersion: process.version,
    uptimeSeconds: Math.floor(os.uptime()),
    serverUptimeSeconds: Math.floor(process.uptime()),
    freeMemoryMb: Math.round(os.freemem() / (1024 * 1024)),
    totalMemoryMb: Math.round(os.totalmem() / (1024 * 1024)),
    localIps: ips,
    ec2
  });
});

// Database status endpoint
app.get('/api/db/status', async (req, res) => {
  const status = await db.testConnection();
  res.json(status);
});

// Notes CRUD endpoints
app.get('/api/notes', async (req, res) => {
  try {
    const notes = await db.getNotes();
    res.json({ success: true, data: notes });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/notes', async (req, res) => {
  try {
    const { title, content } = req.body;
    if (!title || !title.trim()) {
      return res.status(400).json({ success: false, error: 'Judul catatan wajib diisi' });
    }
    const note = await db.createNote(title.trim(), content ? content.trim() : '');
    res.status(201).json({ success: true, data: note });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.delete('/api/notes/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    await db.deleteNote(id);
    res.json({ success: true, message: `Catatan #${id} berhasil dihapus` });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Start server
app.listen(PORT, async () => {
  console.log(`===============================================`);
  console.log(` AWS EC2 & RDS Lab App running on port ${PORT}`);
  console.log(` Local URL: http://localhost:${PORT}`);
  console.log(`===============================================`);

  if (db.isConfigured()) {
    const ok = await db.initTable();
    if (ok) {
      console.log(' Table "notes" verified/initialized in RDS.');
    }
  } else {
    console.log(' Database credentials not configured yet. Set .env to connect RDS.');
  }
});
