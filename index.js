const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;
const BASE = process.env.BASE_URL || `http://localhost:${PORT}`;

app.use(express.json({ limit: '10mb' }));
app.use(express.static('public'));
app.use((req, res, next) => { res.header('Access-Control-Allow-Origin', '*'); next(); });

// ── Parse config from URL ─────────────────────────────────────────────────────
function parseConfig(encoded) {
  try { return JSON.parse(Buffer.from(encoded, 'base64').toString()); }
  catch { return null; }
}

// ── Manifest ──────────────────────────────────────────────────────────────────
app.get('/profiles/:config/manifest.json', (req, res) => {
  const config = parseConfig(req.params.config);
  if (!config) return res.status(400).json({ error: 'Invalid config' });

  res.json({
    id: 'com.stremio.profiles.' + req.params.config.slice(0, 16),
    version: '1.0.0',
    name: '👤 My Profiles',
    description: 'Switch between profiles from your Stremio home screen.',
    resources: ['catalog'],
    types: ['other'],
    catalogs: [{ type: 'other', id: 'profile-switcher', name: '👤 Switch Profile' }]
  });
});

// ── Catalog ───────────────────────────────────────────────────────────────────
app.get('/profiles/:config/catalog/other/profile-switcher.json', (req, res) => {
  const config = parseConfig(req.params.config);
  if (!config) return res.status(400).json({ error: 'Invalid config' });

  const metas = (config.profiles || []).map((p, i) => {
    // If profile has an uploaded image, serve it via a dedicated route
    // If emoji, generate an SVG
    const poster = p.image
      ? `${BASE}/profiles/${req.params.config}/avatar/${i}.${getImgExt(p.image)}`
      : `${BASE}/avatar.svg?emoji=${encodeURIComponent(p.emoji || '👤')}`;

    return {
      id: `profile-${i}`,
      type: 'other',
      name: p.emoji ? `${p.emoji} ${p.name}` : p.name,
      description: `Viewing as ${p.name}`,
      poster,
      posterShape: 'square'
    };
  });

  res.json({ metas });
});

// ── Serve uploaded image by index ─────────────────────────────────────────────
// This decodes the base64 image from the config and serves it as the real image
// so Stremio can display it as a poster
app.get('/profiles/:config/avatar/:filename', (req, res) => {
  const config = parseConfig(req.params.config);
  if (!config) return res.status(400).send('Not found');

  const index = parseInt(req.params.filename.split('.')[0], 10);
  const profile = (config.profiles || [])[index];
  if (!profile || !profile.image) return res.status(404).send('Not found');

  // Data URL format: data:<mime>;base64,<data>
  const match = profile.image.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) return res.status(400).send('Invalid image');

  const [, mime, data] = match;
  const buf = Buffer.from(data, 'base64');

  res.setHeader('Content-Type', mime);
  res.setHeader('Cache-Control', 'public, max-age=86400');
  res.send(buf);
});

// ── Emoji SVG avatar ──────────────────────────────────────────────────────────
app.get('/avatar.svg', (req, res) => {
  const emoji = req.query.emoji || '👤';
  const color = req.query.color || '#7c6dfa';
  res.setHeader('Content-Type', 'image/svg+xml');
  res.setHeader('Cache-Control', 'public, max-age=3600');
  res.send(`<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200">
  <rect width="200" height="200" rx="20" fill="${color}22"/>
  <rect width="200" height="200" rx="20" fill="none" stroke="${color}" stroke-width="2" stroke-opacity="0.4"/>
  <text x="100" y="125" font-size="100" text-anchor="middle">${emoji}</text>
</svg>`);
});

function getImgExt(dataUrl) {
  if (dataUrl.includes('image/gif'))  return 'gif';
  if (dataUrl.includes('image/png'))  return 'png';
  if (dataUrl.includes('image/webp')) return 'webp';
  return 'jpg';
}

app.listen(PORT, () => console.log(`Running on port ${PORT} — open http://localhost:${PORT}`));
