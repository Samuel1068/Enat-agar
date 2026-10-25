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

// Serve frontend in production if built
const distPath = fs.existsSync(path.resolve(__dirname, './dist'))
  ? path.resolve(__dirname, './dist')
  : path.resolve(__dirname, '../dist');
app.use(express.static(distPath));

// In development or fallback, handle non-api routes
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api')) {
    return next();
  }
  res.sendFile(path.join(distPath, 'index.html'), (err) => {
    if (err) {
      res.status(200).send('Enat Agar Backend API Running. Start Vite frontend on port 3000.');
    }
  });
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
