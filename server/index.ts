import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { initDatabase, isConnectedToPostgres, lastPgError, poolConfig } from './db.js';
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
// This runs before all route handlers so Express always sees clean /api/... paths
app.use((req, _res, next) => {
  const originalUrl = req.url;
  const apiIndex = req.url.indexOf('/api/');
  if (apiIndex > 0) {
    req.url = req.url.substring(apiIndex);
  } else if (req.url.endsWith('/api')) {
    req.url = '/api';
  }
  if (originalUrl !== req.url) {
    console.log(`[URL-REWRITE] ${req.method} ${originalUrl} -> ${req.url}`);
  }
  next();
});

// Debug: log every incoming request (remove after confirming routing works)
app.use((req, _res, next) => {
  console.log(`[REQ] ${req.method} ${req.url} | orig: ${req.originalUrl}`);
  next();
});

// Health check endpoint
const handleHealth = async (req: express.Request, res: express.Response) => {
  if (!isConnectedToPostgres) {
    try {
      await initDatabase();
    } catch (err: any) {
      console.warn('On-demand database init error:', err.message);
    }
  }

  res.json({
    status: 'ok',
    appName: 'Enat Agar Fullstack Maternal Health Platform',
    postgresConnected: isConnectedToPostgres,
    postgresError: isConnectedToPostgres ? null : lastPgError,
    dbTarget: {
      host: poolConfig.host || 'from DATABASE_URL',
      user: poolConfig.user || 'from DATABASE_URL',
      database: poolConfig.database || 'from DATABASE_URL',
    },
    timestamp: new Date().toISOString()
  });
};

// API Routes: mounted at /api/* only.
// The URL-rewrite middleware above strips any subfolder prefix (e.g. /Enat1/api/... -> /api/...)
// so by the time Express reaches these routes, the URL is always clean.
app.use('/api/auth', authRoutes);
app.use('/api/patients', patientRoutes);
app.use('/api/clinician', clinicianRoutes);
app.use('/api/admin', adminRoutes);
app.get('/api/health', handleHealth);

// Catch-all for unmatched /api/* routes — returns JSON 404 instead of HTML
app.use('/api/*', (req: express.Request, res: express.Response) => {
  res.status(404).json({ error: `API route not found: ${req.method} ${req.originalUrl}` });
});

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

// Boot database immediately on startup
initDatabase().then(() => {
  console.log(`🗄️ PostgreSQL Status: ${isConnectedToPostgres ? 'CONNECTED ✅' : 'WAITING / MEMORY-SYNC ACTIVE ⚡'}`);
}).catch((err) => {
  console.warn('Database initialization warning:', err.message);
});

const server = app.listen(PORT, () => {
  console.log(`=======================================================`);
  console.log(`🌸 Enat Agar Fullstack Backend running on port ${PORT}`);
  console.log(`🔗 API Base: http://localhost:${PORT}/api`);
  console.log(`=======================================================`);
});

export default app;
