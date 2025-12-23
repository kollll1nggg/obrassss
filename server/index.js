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
const ALBUMS_JSON = path.join(DATA_DIR, 'albums.json');
const USERS_JSON = path.join(DATA_DIR, 'users.json');
const STORIES_JSON = path.join(DATA_DIR, 'stories.json');
const EVENTS_JSON = path.join(DATA_DIR, 'events.json');
const MUSIC_JSON = path.join(DATA_DIR, 'music.json');

function ensureDir(d) {
  if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
}

ensureDir(PHOTOS_DIR);
ensureDir(VIDEOS_DIR);
ensureDir(OTHERS_DIR);

if (!fs.existsSync(MEDIA_JSON)) fs.writeFileSync(MEDIA_JSON, JSON.stringify([]));
if (!fs.existsSync(ALBUMS_JSON)) fs.writeFileSync(ALBUMS_JSON, JSON.stringify([]));
if (!fs.existsSync(USERS_JSON)) fs.writeFileSync(USERS_JSON, JSON.stringify([]));
if (!fs.existsSync(STORIES_JSON)) fs.writeFileSync(STORIES_JSON, JSON.stringify([]));
if (!fs.existsSync(EVENTS_JSON)) fs.writeFileSync(EVENTS_JSON, JSON.stringify([]));
if (!fs.existsSync(MUSIC_JSON)) fs.writeFileSync(MUSIC_JSON, JSON.stringify([]));

// Helpers to read/write JSON metadata atomically
function readJson(p) {
  try {
    const raw = fs.readFileSync(p, 'utf-8') || '[]';
    return JSON.parse(raw);
  } catch (e) {
    console.error('Failed to read JSON', p, e);
    return [];
  }
}

function writeJson(p, data) {
  try {
    fs.writeFileSync(p, JSON.stringify(data, null, 2));
    return true;
  } catch (e) {
    console.error('Failed to write JSON', p, e);
    return false;
  }
}

// S3 configuration (optional). If these env vars are present we upload to S3 instead of disk.
const S3_BUCKET = process.env.S3_BUCKET;
const S3_REGION = process.env.AWS_REGION || process.env.S3_REGION;
const S3_ENDPOINT = process.env.S3_ENDPOINT; // optional custom endpoint (Spaces, MinIO)
const USE_S3 = !!(S3_BUCKET && S3_REGION);

let upload;
let uploadBufferToS3 = null;
if (USE_S3) {
  // Dynamically import AWS SDK only when S3 is enabled to avoid startup errors
  // in environments where the package is not installed (e.g., Railway without S3 configured).
  const { S3Client, PutObjectCommand } = await import('@aws-sdk/client-s3');
  const s3Client = new S3Client({ region: S3_REGION, endpoint: S3_ENDPOINT });
  const memoryStorage = multer.memoryStorage();
  upload = multer({ storage: memoryStorage });

  // helper to upload a buffer to S3
  uploadBufferToS3 = async (buffer, originalName, mimeType) => {
    const safeName = `${Date.now()}-${originalName.replace(/[^a-zA-Z0-9.\-\_]/g, '_')}`;
    const key = `${safeName}`;
    const put = new PutObjectCommand({ Bucket: S3_BUCKET, Key: key, Body: buffer, ContentType: mimeType });
    await s3Client.send(put);
    // construct URL
    let url;
    if (S3_ENDPOINT) {
      url = `${S3_ENDPOINT.replace(/\/$/, '')}/${key}`;
    } else {
      url = `https://${S3_BUCKET}.s3.${S3_REGION}.amazonaws.com/${key}`;
    }
    return { filename: safeName, url };
  };
} else {
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
  upload = multer({ storage });
}

app.use('/uploads', express.static(DATA_DIR));

// Healthcheck for platforms (Railway etc.) to verify the process is up
app.get('/health', (req, res) => res.json({ ok: true, uptime: process.uptime() }));

// Accept both 'files' (array) and 'file' (single) field names to be forgiving
app.post('/api/upload/media', upload.fields([{ name: 'files' }, { name: 'file', maxCount: 1 }]), async (req, res) => {
  try {
    // Helpful debug logging to trace upload attempts and common failures
    console.log('Upload media request headers:', {
      'content-type': req.headers['content-type'],
      'content-length': req.headers['content-length']
    });

    // Normalize files into a single array regardless of whether client used 'files' or 'file'
    let incomingFiles = [];
    if (req.files) {
      // req.files when using upload.fields is an object with arrays
      if (Array.isArray(req.files.files)) incomingFiles.push(...req.files.files);
      if (Array.isArray(req.files.file)) incomingFiles.push(...req.files.file);
    }
    // multer may also set req.file for single-file middleware in some cases
    if (!incomingFiles.length && req.file) incomingFiles.push(req.file);

    if (!incomingFiles.length) {
      console.warn('Upload media: no files received in request');
      return res.status(400).json({ error: 'No files received' });
    }

    let files = [];
    if (USE_S3) {
      const uploaded = [];
      for (const f of incomingFiles) {
        const result = await uploadBufferToS3(f.buffer, f.originalname || f.originalName || 'file', f.mimetype || 'application/octet-stream');
        const type = (f.mimetype || '').startsWith('video/') ? 'video' : ((f.mimetype || '').startsWith('image/') ? 'image' : 'other');
        uploaded.push({ filename: result.filename, url: result.url, type });
      }
      files = uploaded;
    } else {
      files = incomingFiles.map(f => {
        // f.path is available for diskStorage; for memoryStorage it will be undefined
        const savedPath = f.path || path.join(PHOTOS_DIR, f.filename || '');
        const type = (f.mimetype || '').startsWith('video/') ? 'video' : ((f.mimetype || '').startsWith('image/') ? 'image' : 'other');
        // Use DATA_DIR as the base so the URL is /uploads/<relative path under DATA_DIR>
        const rel = path.relative(DATA_DIR, savedPath).split(path.sep).join('/');
        return { filename: f.filename || (f.originalname || 'unknown'), url: `/uploads/${rel}`, type };
      });
    }

    console.log('Received upload (media):', files.map(f => f.filename));

    // Append metadata to media.json (best-effort; note: on Railway this file may be ephemeral)
    try {
      const current = readJson(MEDIA_JSON) || [];

      // Read optional metadata fields from the request body (multer will populate req.body for text fields)
      const bodyAlbumId = req.body && req.body.albumId ? req.body.albumId : undefined;
      const bodyUploadedBy = req.body && req.body.uploadedBy ? req.body.uploadedBy : undefined;
      const bodyUploadedAt = req.body && req.body.uploadedAt ? req.body.uploadedAt : undefined;
      const bodyTaggedUsers = req.body && req.body.taggedUsers ? (() => {
        try { return JSON.parse(req.body.taggedUsers); } catch (e) { return undefined; }
      })() : undefined;

      const toPush = files.map(f => ({
        id: `${Date.now()}-${Math.random().toString(36).slice(2,9)}`,
        filename: f.filename || f.originalname || 'file',
        url: f.url,
        type: f.type,
        albumId: bodyAlbumId,
        uploadedBy: bodyUploadedBy,
        taggedUsers: bodyTaggedUsers || [],
        uploadedAt: bodyUploadedAt || new Date().toISOString()
      }));

      writeJson(MEDIA_JSON, [...toPush, ...current]);
    } catch (e) {
      console.error('Failed to write media.json', e && e.message ? e.message : e);
    }

    res.json({ files });
  } catch (err) {
    console.error('Upload failed', err);
    // Provide more info in the response to help debugging from the client
    res.status(500).json({ error: 'Upload failed', details: err && err.message ? err.message : undefined });
  }
});

app.post('/api/upload/story', upload.single('file'), async (req, res) => {
  try {
    if (USE_S3) {
      const f = req.file;
      if (!f) return res.status(400).json({ error: 'No file' });
      const result = await uploadBufferToS3(f.buffer, f.originalname, f.mimetype);
      const out = { filename: result.filename, url: result.url, type: f.mimetype.startsWith('video/') ? 'video' : 'image' };
      console.log('Received upload (story):', out.filename);
      return res.json({ file: out });
    }
    const f = req.file;
    if (!f) return res.status(400).json({ error: 'No file' });
    const rel = path.relative(process.cwd(), f.path).split(path.sep).join('/');
    const out = { filename: f.filename, url: `/uploads/${path.relative(DATA_DIR, f.path).split(path.sep).join('/')}`, type: f.mimetype.startsWith('video/') ? 'video' : 'image' };
    console.log('Received upload (story):', out.filename);
    res.json({ file: out });
  } catch (err) {
    console.error('Story upload failed', err);
    res.status(500).json({ error: 'Upload failed' });
  }
});

app.post('/api/upload/music', upload.single('file'), async (req, res) => {
  try {
    if (USE_S3) {
      const f = req.file;
      if (!f) return res.status(400).json({ error: 'No file' });
      const result = await uploadBufferToS3(f.buffer, f.originalname, f.mimetype);
      const out = { filename: result.filename, originalName: f.originalname, url: result.url, type: 'audio' };
      console.log('Received upload (music):', out.filename);
      return res.json({ file: out });
    }
    const f = req.file;
    if (!f) return res.status(400).json({ error: 'No file' });
    const rel = path.relative(process.cwd(), f.path).split(path.sep).join('/');
    const out = { filename: f.filename, originalName: f.originalname, url: `/uploads/${path.relative(DATA_DIR, f.path).split(path.sep).join('/')}`, type: 'audio' };
    console.log('Received upload (music):', out.filename);
    res.json({ file: out });
  } catch (err) {
    console.error('Music upload failed', err);
    res.status(500).json({ error: 'Upload failed' });
  }
});

app.get('/api/media/list', (req, res) => {
  try {
    const current = JSON.parse(fs.readFileSync(MEDIA_JSON, 'utf-8') || '[]');
    res.json({ media: current });
  } catch (e) {
    res.status(500).json({ error: 'Failed to read media metadata' });
  }
});

// --- Albums, Users, Stories, Events, Music persistence endpoints ---

app.get('/api/albums', (req, res) => {
  try {
    const albums = readJson(ALBUMS_JSON);
    const media = readJson(MEDIA_JSON);
    // attach photos for each album
    const enriched = albums.map(a => ({
      ...a,
      photos: media.filter(m => m.albumId === a.id).sort((p1, p2) => new Date(p2.uploadedAt).getTime() - new Date(p1.uploadedAt).getTime())
    }));
    res.json({ albums: enriched });
  } catch (e) {
    res.status(500).json({ error: 'Failed to read albums' });
  }
});

app.get('/api/albums/:id', (req, res) => {
  try {
    const albums = readJson(ALBUMS_JSON);
    const media = readJson(MEDIA_JSON);
    const album = albums.find(a => a.id === req.params.id);
    if (!album) return res.status(404).json({ error: 'Album not found' });
    const photos = media.filter(m => m.albumId === album.id).sort((a,b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime());
    res.json({ album: { ...album, photos } });
  } catch (e) {
    res.status(500).json({ error: 'Failed to read album' });
  }
});

app.post('/api/albums', express.json(), (req, res) => {
  try {
    const { title, description, permission, isEventAlbum, createdBy } = req.body || {};
    if (!title) return res.status(400).json({ error: 'title required' });
    const albums = readJson(ALBUMS_JSON);
    const newAlbum = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2,9)}`,
      title,
      description: description || '',
      isEventAlbum: !!isEventAlbum,
      createdBy: createdBy || 'server',
      createdAt: new Date().toISOString(),
      permission: permission || 'MEMBER',
      visibleTo: [],
      taggedUsers: []
    };
    albums.unshift(newAlbum);
    writeJson(ALBUMS_JSON, albums);
    res.json({ album: newAlbum });
  } catch (e) {
    res.status(500).json({ error: 'Failed to create album' });
  }
});

// Users
app.get('/api/users', (req, res) => {
  try {
    const users = readJson(USERS_JSON);
    res.json({ users });
  } catch (e) {
    res.status(500).json({ error: 'Failed to read users' });
  }
});

app.post('/api/register', express.json(), (req, res) => {
  try {
    const { name, pass } = req.body || {};
    if (!name) return res.status(400).json({ error: 'name required' });
    const users = readJson(USERS_JSON);
    if (users.some(u => u.name && u.name.toLowerCase() === name.toLowerCase())) return res.status(400).json({ error: 'user exists' });
    const newUser = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2,9)}`,
      name,
      email: `${name.toLowerCase().replace(/\s/g, '.')}@obras.com`,
      avatar: `https://i.pravatar.cc/150?u=${Date.now()}`,
      role: 'READER',
      status: 'PENDING',
      createdAt: new Date().toISOString()
    };
    users.unshift(newUser);
    writeJson(USERS_JSON, users);
    res.json({ user: newUser });
  } catch (e) {
    res.status(500).json({ error: 'Failed to register user' });
  }
});

app.put('/api/users/:id', express.json(), (req, res) => {
  try {
    const users = readJson(USERS_JSON);
    const idx = users.findIndex(u => u.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: 'user not found' });
    users[idx] = { ...users[idx], ...req.body };
    writeJson(USERS_JSON, users);
    res.json({ user: users[idx] });
  } catch (e) {
    res.status(500).json({ error: 'Failed to update user' });
  }
});

// Stories
app.get('/api/stories', (req, res) => {
  try {
    const stories = readJson(STORIES_JSON);
    res.json({ stories });
  } catch (e) {
    res.status(500).json({ error: 'Failed to read stories' });
  }
});

app.post('/api/stories', express.json(), (req, res) => {
  try {
    const { userId, fileUrl, type } = req.body || {};
    if (!userId || !fileUrl) return res.status(400).json({ error: 'userId and fileUrl required' });
    const stories = readJson(STORIES_JSON);
    const now = new Date();
    const newStory = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2,9)}`,
      userId,
      filePath: fileUrl,
      type: type || (fileUrl && /\.(mp4|webm|ogg|mov)$/i.test(fileUrl) ? 'video' : 'image'),
      createdAt: now.toISOString(),
      expiresAt: new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString()
    };
    stories.unshift(newStory);
    writeJson(STORIES_JSON, stories);
    res.json({ story: newStory });
  } catch (e) {
    res.status(500).json({ error: 'Failed to create story' });
  }
});

// Events
app.get('/api/events', (req, res) => {
  try {
    const events = readJson(EVENTS_JSON);
    res.json({ events });
  } catch (e) {
    res.status(500).json({ error: 'Failed to read events' });
  }
});

app.post('/api/events', express.json(), (req, res) => {
  try {
    const { title, location, date, albumId } = req.body || {};
    if (!title || !date) return res.status(400).json({ error: 'title and date required' });
    const events = readJson(EVENTS_JSON);
    const newEvent = { id: `${Date.now()}-${Math.random().toString(36).slice(2,9)}`, title, location: location || '', date, albumId };
    events.unshift(newEvent);
    writeJson(EVENTS_JSON, events);
    res.json({ event: newEvent });
  } catch (e) {
    res.status(500).json({ error: 'Failed to create event' });
  }
});

// Music metadata (uploads handled by /api/upload/music)
app.get('/api/music', (req, res) => {
  try {
    const music = readJson(MUSIC_JSON);
    res.json({ music });
  } catch (e) {
    res.status(500).json({ error: 'Failed to read music' });
  }
});

app.post('/api/music', express.json(), (req, res) => {
  try {
    const { title, artist, url, duration } = req.body || {};
    if (!title || !url) return res.status(400).json({ error: 'title and url required' });
    const music = readJson(MUSIC_JSON);
    const newTrack = { id: `${Date.now()}-${Math.random().toString(36).slice(2,9)}`, title, artist: artist || 'Desconhecido', url, duration: duration || 0 };
    music.unshift(newTrack);
    writeJson(MUSIC_JSON, music);
    res.json({ track: newTrack });
  } catch (e) {
    res.status(500).json({ error: 'Failed to create music track' });
  }
});

// Debug endpoints - enabled only when DEBUG=true in env (safe for temporary diagnostics)
if (process.env.DEBUG === 'true') {
  app.get('/api/_debug/media-json', (req, res) => {
    try {
      const current = JSON.parse(fs.readFileSync(MEDIA_JSON, 'utf-8') || '[]');
      res.json({ mediaJson: current });
    } catch (e) {
      res.status(500).json({ error: 'Failed to read media.json', details: e.message });
    }
  });

  app.get('/api/_debug/list-files', (req, res) => {
    try {
      const photos = fs.existsSync(PHOTOS_DIR) ? fs.readdirSync(PHOTOS_DIR) : [];
      const videos = fs.existsSync(VIDEOS_DIR) ? fs.readdirSync(VIDEOS_DIR) : [];
      const others = fs.existsSync(OTHERS_DIR) ? fs.readdirSync(OTHERS_DIR) : [];
      res.json({ photos, videos, others, dataDir: DATA_DIR });
    } catch (e) {
      res.status(500).json({ error: 'Failed to list files', details: e.message });
    }
  });

  app.get('/api/_debug/exists', (req, res) => {
    const p = req.query.path;
    if (!p) return res.status(400).json({ error: 'path query required' });
    try {
      const target = path.join(DATA_DIR, p);
      const exists = fs.existsSync(target);
      res.json({ path: p, target, exists });
    } catch (e) {
      res.status(500).json({ error: 'failed', details: e.message });
    }
  });
}

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
