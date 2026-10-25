import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { initDatabase, isConnectedToPostgres } from './db.js';
import authRoutes from './routes/auth.js';
import patientRoutes from './routes/patients.js';
import clinicianRoutes from './routes/clinicians.js';
import adminRoutes from './routes/admin.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5000;

// Enable CORS for frontend development
app.use(cors({
  origin: true,
  credentials: true
}));

app.use(express.json());

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/patients', patientRoutes);
app.use('/api/clinician', clinicianRoutes);
app.use('/api/admin', adminRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    appName: 'Enat Agar Fullstack Maternal Health Platform',
    postgresConnected: isConnectedToPostgres,
    timestamp: new Date().toISOString()
  });
});

// Candidate dist directories to search
const candidateDistDirs = [
  path.resolve(process.cwd(), 'dist'),
  path.resolve(__dirname, 'dist'),
  path.resolve(__dirname, './dist'),
  path.resolve(__dirname, '../dist'),
  path.resolve(process.cwd(), '../dist')
];

// 1. Mount standard Express static directories
candidateDistDirs.forEach(dir => {
  if (fs.existsSync(dir)) {
    app.use(express.static(dir));
    const assetsDir = path.join(dir, 'assets');
    if (fs.existsSync(assetsDir)) {
      app.use('/assets', express.static(assetsDir));
    }
  }
});

// 2. Fallback direct static file server (catches all static files even if mounted late)
app.use((req, res, next) => {
  if (req.path.startsWith('/api')) {
    return next();
  }

  for (const base of candidateDistDirs) {
    if (!fs.existsSync(base)) continue;

    // Check direct path inside dist
    const directPath = path.join(base, req.path);
    if (fs.existsSync(directPath) && fs.statSync(directPath).isFile()) {
      return res.sendFile(directPath);
    }

    // Check if file is in /assets/ subdirectory
    const inAssetsPath = path.join(base, 'assets', req.path);
    if (fs.existsSync(inAssetsPath) && fs.statSync(inAssetsPath).isFile()) {
      return res.sendFile(inAssetsPath);
    }
  }

  next();
});

// 3. SPA wildcard route: serves index.html for all page routes
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api')) {
    return next();
  }

  for (const base of candidateDistDirs) {
    const htmlFile = path.join(base, 'index.html');
    if (fs.existsSync(htmlFile)) {
      return res.sendFile(htmlFile);
    }
  }

  res.status(200).send(`
    <div style="font-family: sans-serif; padding: 2rem; max-width: 600px; margin: auto;">
      <h2>🌸 Enat Agar Backend API Running</h2>
      <p style="color: #666;">The backend is running, but <code>dist/index.html</code> was not found on this server.</p>
      <h4>Searched directories:</h4>
      <ul>
        ${candidateDistDirs.map(d => `<li><code>${d}</code> — <b>${fs.existsSync(d) ? 'Found directory' : 'Not found'}</b></li>`).join('')}
      </ul>
      <p><b>Fix:</b> In cPanel Terminal, run <code>npm run build</code> and then click <b>Restart</b> in Node.js App.</p>
    </div>
  `);
});

// Boot server
async function startServer() {
  await initDatabase();

  app.listen(PORT, () => {
    console.log(`=======================================================`);
    console.log(`🌸 Enat Agar Fullstack Backend running on port ${PORT}`);
    console.log(`🔗 API Base: http://localhost:${PORT}/api`);
    console.log(`🗄️ PostgreSQL Status: ${isConnectedToPostgres ? 'CONNECTED ✅' : 'WAITING / MEMORY-SYNC ACTIVE ⚡'}`);
    console.log(`=======================================================`);
  });
}

startServer();
