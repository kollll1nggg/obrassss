const fs = require('fs');
const path = require('path');
const fetch = require('node-fetch');
const FormData = require('form-data');

const BASE_URL = process.env.MIRROR_BASE_URL || 'https://obrassss-production.up.railway.app';
const DATA_DIR = path.join(process.cwd(), 'dados');

function readJsonSafe(p) {
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch(e) { return null; }
}
// helper that strips BOM and parses JSON safely
function readJsonSafeStripBOM(p) {
  try {
    let raw = fs.readFileSync(p, 'utf8');
    raw = raw.replace(/^\uFEFF/, '');
    return JSON.parse(raw);
  } catch (e) {
    return null;
  }
}

async function createAlbumIfNotExists(album) {
  try {
    const resp = await fetch(`${BASE_URL}/api/albums`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: album.title, description: album.description, permission: album.permission || 'MEMBER', isEventAlbum: album.isEventAlbum || false, createdBy: album.createdBy || 'script' })
    });
    if (!resp.ok) {
      const txt = await resp.text();
      console.warn('Failed to create album', album.title, resp.status, txt);
      // Try a sanitized fallback (strip non-ascii from title) before giving up
      try {
        const safeTitle = (album.title || '').replace(/[^\x20-\x7E]/g, '');
        if (safeTitle && safeTitle !== (album.title || '')) {
          const retry = await fetch(`${BASE_URL}/api/albums`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title: safeTitle, description: album.description || '', permission: album.permission || 'MEMBER', isEventAlbum: album.isEventAlbum || false, createdBy: album.createdBy || 'script' })
          });
          if (retry.ok) {
            const dd = await retry.json();
            return dd.album && dd.album.id ? dd.album.id : null;
          }
        }
      } catch (e) {
        console.warn('Retry creating album failed', e && e.message ? e.message : e);
      }
      return null;
    }
    const data = await resp.json();
    return data.album && data.album.id ? data.album.id : null;
  } catch (e) {
    console.warn('Error creating album', e.message);
    return null;
  }
}

async function uploadFile(localPath, albumId, meta) {
  if (!fs.existsSync(localPath)) return { ok: false, error: 'file-missing' };
  const form = new FormData();
  form.append('files', fs.createReadStream(localPath));
  if (albumId) form.append('albumId', albumId);
  // preserve original metadata if present
  if (meta && meta.uploadedAt) form.append('uploadedAt', meta.uploadedAt);
  if (meta && meta.uploadedBy) form.append('uploadedBy', meta.uploadedBy);
  if (meta && meta.taggedUsers) form.append('taggedUsers', JSON.stringify(meta.taggedUsers));

  try {
    const resp = await fetch(`${BASE_URL}/api/upload/media`, { method: 'POST', body: form });
    const txt = await resp.text();
    try { var json = JSON.parse(txt); } catch(e) { json = { raw: txt }; }
    if (!resp.ok) return { ok: false, status: resp.status, body: json };
    return { ok: true, body: json };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

(async function main() {
  console.log('Base URL:', BASE_URL);
  const media = readJsonSafeStripBOM(path.join(DATA_DIR, 'media.json')) || [];
  const albumsObj = readJsonSafeStripBOM(path.join(DATA_DIR, 'albums.json')) || { albums: [] };
  const albums = Array.isArray(albumsObj) ? albumsObj : (albumsObj.albums || []);

  const albumMap = {};
  for (const a of albums) {
    console.log('Creating album:', a.title || a.id);
    const newId = await createAlbumIfNotExists(a);
    if (newId) albumMap[a.id] = newId;
  }

  const report = { uploaded: [], errors: [] };

  // If TARGET_FILE env var specified, upload only that file (search photos/videos/others)
  const targetFile = process.env.TARGET_FILE;
  if (targetFile) {
    const possibleDirs = ['photos','videos','others'];
    let found = false;
    for (const d of possibleDirs) {
      const p = path.join(DATA_DIR, d, targetFile);
      if (fs.existsSync(p)) {
        console.log('Uploading target file', p);
        const res = await uploadFile(p, undefined, null);
        if (res.ok) console.log('Uploaded target file', res.body);
        else console.warn('Failed target upload', res);
        found = true;
        break;
      }
    }
    if (!found) console.warn('TARGET_FILE not found in dados folders:', targetFile);
  }

  for (const m of media) {
    const filename = m.filename || (m.url && path.basename(m.url));
    const typeSub = m.type === 'video' ? 'videos' : (m.type === 'image' ? 'photos' : 'others');
    const localPath = path.join(DATA_DIR, typeSub, filename);
    const origAlbumId = m.albumId;
    const mappedAlbumId = origAlbumId && albumMap[origAlbumId] ? albumMap[origAlbumId] : undefined;
    console.log('Uploading', filename, 'album:', mappedAlbumId || '(none)');
  const res = await uploadFile(localPath, mappedAlbumId, m);
    if (res.ok) {
      report.uploaded.push({ filename, url: res.body.files ? res.body.files.map(f => f.url) : res.body });
      console.log('Uploaded', filename, '->', res.body && res.body.files ? res.body.files.map(f=>f.url).join(', ') : JSON.stringify(res.body));
    } else {
      console.warn('Failed', filename, res);
      report.errors.push({ filename, error: res });
    }
  }

  fs.writeFileSync(path.join(process.cwd(), 'reupload-report.json'), JSON.stringify(report, null, 2));
  console.log('Done. Report saved to reupload-report.json');
})();
