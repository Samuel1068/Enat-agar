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

// Global crash protection for cPanel/Passenger
process.on('uncaughtException', (err) => {
  console.error('⚠️ [Process Uncaught Exception]:', err.message);
});
process.on('unhandledRejection', (reason) => {
  console.error('⚠️ [Process Unhandled Rejection]:', reason);
});

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

// Strip any application subpath prefix (e.g. /Enat-agar1/api/... -> /api/...)
app.use((req, res, next) => {
  const apiIndex = req.url.indexOf('/api/');
  if (apiIndex > 0) {
    req.url = req.url.substring(apiIndex);
  } else if (req.url.endsWith('/api')) {
    req.url = '/api';
  }
  next();
});

// Health check endpoint
const handleHealth = (req: express.Request, res: express.Response) => {
  res.json({
    status: 'ok',
    appName: 'Enat Agar Fullstack Maternal Health Platform',
    postgresConnected: isConnectedToPostgres,
    timestamp: new Date().toISOString()
  });
};

// API Routes: mount on root, subfolder prefixes (/Enat1), and wildcards
const subpaths = ['', '/Enat1', '/enat1', '/Enat', '/enat', '/Enat-agar1'];
subpaths.forEach(sub => {
  app.use(`${sub}/api/auth`, authRoutes);
  app.use(`${sub}/api/patients`, patientRoutes);
  app.use(`${sub}/api/clinician`, clinicianRoutes);
  app.use(`${sub}/api/admin`, adminRoutes);
  app.get(`${sub}/api/health`, handleHealth);
});

app.use('*/api/auth', authRoutes);
app.use('*/api/patients', patientRoutes);
app.use('*/api/clinician', clinicianRoutes);
app.use('*/api/admin', adminRoutes);
app.get('*/api/health', handleHealth);

// Candidate dist directories to search
const candidateDistDirs = [
  path.resolve(process.cwd(), 'dist'),
  path.resolve(__dirname, 'dist'),
  path.resolve(__dirname, './dist'),
  path.resolve(__dirname, '../dist'),
  path.resolve(process.cwd(), '../dist')
];

// Favicon handler
app.get('/favicon.ico', (req, res) => {
  for (const base of candidateDistDirs) {
    const iconPath = path.join(base, 'icon.svg');
    if (fs.existsSync(iconPath)) {
      return res.sendFile(iconPath);
    }
  }
  res.status(204).end();
});

// 1. Mount standard Express static directories
candidateDistDirs.forEach(dir => {
  if (fs.existsSync(dir)) {
    app.use(express.static(dir));
    const assetsDir = path.join(dir, 'assets');
    if (fs.existsSync(assetsDir)) {
      app.use('/assets', express.static(assetsDir));
      app.use(express.static(assetsDir));
    }
  }
});

// 2. Direct bulletproof static file server
app.use((req, res, next) => {
  if (req.path.startsWith('/api')) {
    return next();
  }

  const basename = path.basename(req.path);

  for (const base of candidateDistDirs) {
    if (!fs.existsSync(base)) continue;

    // Check direct path inside dist
    const directPath = path.join(base, req.path);
    if (fs.existsSync(directPath) && fs.statSync(directPath).isFile()) {
      return res.sendFile(directPath);
    }

    // Check inside /assets/
    const inAssetsPath = path.join(base, 'assets', req.path);
    if (fs.existsSync(inAssetsPath) && fs.statSync(inAssetsPath).isFile()) {
      return res.sendFile(inAssetsPath);
    }

    // Check by basename inside assets
    const byBasename = path.join(base, 'assets', basename);
    if (fs.existsSync(byBasename) && fs.statSync(byBasename).isFile()) {
      return res.sendFile(byBasename);
    }

    // Smart fallback for JS bundle hash mismatch: if any index-*.js requested, serve whatever bundle exists
    if (basename.startsWith('index-') && basename.endsWith('.js')) {
      const assetsDir = path.join(base, 'assets');
      if (fs.existsSync(assetsDir)) {
        const jsFiles = fs.readdirSync(assetsDir).filter(f => f.startsWith('index-') && f.endsWith('.js'));
        if (jsFiles.length > 0) {
          return res.sendFile(path.join(assetsDir, jsFiles[0]));
        }
      }
    }

    // Smart fallback for CSS bundle hash mismatch
    if (basename.startsWith('index-') && basename.endsWith('.css')) {
      const assetsDir = path.join(base, 'assets');
      if (fs.existsSync(assetsDir)) {
        const cssFiles = fs.readdirSync(assetsDir).filter(f => f.startsWith('index-') && f.endsWith('.css'));
        if (cssFiles.length > 0) {
          return res.sendFile(path.join(assetsDir, cssFiles[0]));
        }
      }
    }
  }

  next();
});

// 3. SPA wildcard route: serves index.html for all page routes
app.get('*', (req, res, next) => {
  if (req.originalUrl.includes('/api') || req.url.includes('/api') || req.path.includes('/api')) {
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

// Boot server immediately for Passenger, then initialize database in background
const server = app.listen(PORT, () => {
  console.log(`=======================================================`);
  console.log(`🌸 Enat Agar Fullstack Backend running on port ${PORT}`);
  console.log(`🔗 API Base: http://localhost:${PORT}/api`);
  console.log(`=======================================================`);
  
  // Non-blocking database init so Passenger never times out with 503
  initDatabase().then(() => {
    console.log(`🗄️ PostgreSQL Status: ${isConnectedToPostgres ? 'CONNECTED ✅' : 'WAITING / MEMORY-SYNC ACTIVE ⚡'}`);
  }).catch((err) => {
    console.warn('Database initialization warning:', err.message);
  });
});

export default app;
