import express from 'express';
import cors from 'cors';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const app = express();
app.use(cors());
app.use(express.json());

// Allow configuring the storage directory via DATA_DIR env var (useful on VPS or in containers).
const DATA_DIR = process.env.DATA_DIR ? path.resolve(process.env.DATA_DIR) : path.join(process.cwd(), 'dados');
const PHOTOS_DIR = path.join(DATA_DIR, 'photos');
const VIDEOS_DIR = path.join(DATA_DIR, 'videos');
const OTHERS_DIR = path.join(DATA_DIR, 'others');
const MEDIA_JSON = path.join(DATA_DIR, 'media.json');

function ensureDir(d) {
  if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
}

ensureDir(PHOTOS_DIR);
ensureDir(VIDEOS_DIR);
ensureDir(OTHERS_DIR);

if (!fs.existsSync(MEDIA_JSON)) fs.writeFileSync(MEDIA_JSON, JSON.stringify([]));

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const type = file.mimetype;
    if (type.startsWith('image/')) cb(null, PHOTOS_DIR);
    else if (type.startsWith('video/')) cb(null, VIDEOS_DIR);
    else cb(null, OTHERS_DIR);
  },
  filename: function (req, file, cb) {
    const safeName = `${Date.now()}-${file.originalname.replace(/[^a-zA-Z0-9.\-\_]/g, '_')}`;
    cb(null, safeName);
  }
});

const upload = multer({ storage });

app.use('/uploads', express.static(DATA_DIR));

// Healthcheck for platforms (Railway etc.) to verify the process is up
app.get('/health', (req, res) => res.json({ ok: true, uptime: process.uptime() }));

app.post('/api/upload/media', upload.array('files'), (req, res) => {
  const files = (req.files || []).map(f => {
    const rel = path.relative(process.cwd(), f.path).split(path.sep).join('/');
    const type = f.mimetype.startsWith('video/') ? 'video' : (f.mimetype.startsWith('image/') ? 'image' : 'other');
    return { filename: f.filename, url: `/uploads/${path.relative(DATA_DIR, f.path).split(path.sep).join('/')}`, type };
  });
  console.log('Received upload (media):', files.map(f => f.filename));

  // Append metadata to media.json
  try {
    const current = JSON.parse(fs.readFileSync(MEDIA_JSON, 'utf-8') || '[]');
    const toPush = files.map(f => ({ id: `${Date.now()}-${Math.random().toString(36).slice(2,9)}`, ...f, uploadedAt: new Date().toISOString() }));
    fs.writeFileSync(MEDIA_JSON, JSON.stringify([...toPush, ...current], null, 2));
  } catch (e) {
    console.error('Failed to write media.json', e);
  }

  res.json({ files });
});

app.post('/api/upload/story', upload.single('file'), (req, res) => {
  const f = req.file;
  if (!f) return res.status(400).json({ error: 'No file' });
  const rel = path.relative(process.cwd(), f.path).split(path.sep).join('/');
  const out = { filename: f.filename, url: `/uploads/${path.relative(DATA_DIR, f.path).split(path.sep).join('/')}`, type: f.mimetype.startsWith('video/') ? 'video' : 'image' };
  console.log('Received upload (story):', out.filename);
  res.json({ file: out });
});

app.post('/api/upload/music', upload.single('file'), (req, res) => {
  const f = req.file;
  if (!f) return res.status(400).json({ error: 'No file' });
  const rel = path.relative(process.cwd(), f.path).split(path.sep).join('/');
  const out = { filename: f.filename, originalName: f.originalname, url: `/uploads/${path.relative(DATA_DIR, f.path).split(path.sep).join('/')}`, type: 'audio' };
  console.log('Received upload (music):', out.filename);
  res.json({ file: out });
});

app.get('/api/media/list', (req, res) => {
  try {
    const current = JSON.parse(fs.readFileSync(MEDIA_JSON, 'utf-8') || '[]');
    res.json({ media: current });
  } catch (e) {
    res.status(500).json({ error: 'Failed to read media metadata' });
  }
});

const PORT = process.env.PORT || 4000;
// If running as an ES module, provide __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Serve frontend static files when available (so a single process can serve API + SPA)
const DIST_DIR = path.join(process.cwd(), 'dist');
if (fs.existsSync(DIST_DIR)) {
  app.use(express.static(DIST_DIR));

  // Ensure that API and uploads routes have priority; for other paths return index.html
  // Serve index.html for non-API routes using a middleware (avoids path-to-regexp parsing issues)
  app.use((req, res, next) => {
    if (req.path.startsWith('/api/') || req.path.startsWith('/uploads/')) return next();
    // For GET requests (and navigation), return index.html so the SPA can handle routing
    if (req.method === 'GET') {
      return res.sendFile(path.join(DIST_DIR, 'index.html'));
    }
    return next();
  });
}

// Global error handlers to make crashes visible in logs
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
  // exit(1) could be used to let the process manager restart the app
});

app.listen(PORT, () => console.log(`Server listening on http://localhost:${PORT}`));
