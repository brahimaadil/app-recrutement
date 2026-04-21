const express = require('express');
const multer  = require('multer');
const fs      = require('fs');
const path    = require('path');

const app      = express();
const PORT     = 3000;
const DATA_DIR = path.join(__dirname, 'data');
const VIEWS    = ['avaliance', 'sodexo'];

// ── Bootstrap folder structure ──────────────────────────────────────────────
VIEWS.forEach(view => {
  fs.mkdirSync(path.join(DATA_DIR, view, 'cvs'), { recursive: true });
  for (const file of ['candidates.json', 'priorities.json']) {
    const p = path.join(DATA_DIR, view, file);
    if (!fs.existsSync(p)) fs.writeFileSync(p, '[]', 'utf8');
  }
});

// ── Middleware ───────────────────────────────────────────────────────────────
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ── Helpers ──────────────────────────────────────────────────────────────────
function readJson(filePath) {
  try { return JSON.parse(fs.readFileSync(filePath, 'utf8')); }
  catch { return []; }
}
function writeJson(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
}
function viewFile(view, name) {
  return path.join(DATA_DIR, view, name);
}
function guardView(req, res, next) {
  if (!VIEWS.includes(req.params.view)) return res.status(400).json({ error: 'Vue invalide' });
  next();
}

// ── Multer: CV upload ─────────────────────────────────────────────────────────
const cvStorage = multer.diskStorage({
  destination(req, _file, cb) {
    const dir = path.join(DATA_DIR, req.params.view, 'cvs', req.params.id);
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename(_req, file, cb) {
    // Keep original name but sanitise
    const safe = file.originalname.replace(/[^a-zA-Z0-9._\-\s]/g, '_');
    cb(null, safe);
  }
});
const upload = multer({ storage: cvStorage, limits: { fileSize: 25 * 1024 * 1024 } });

// ════════════════════════════════════════════════════════════════════════════
//  CANDIDATES
// ════════════════════════════════════════════════════════════════════════════

// GET  /api/:view/candidates
app.get('/api/:view/candidates', guardView, (req, res) => {
  res.json(readJson(viewFile(req.params.view, 'candidates.json')));
});

// POST /api/:view/candidates
app.post('/api/:view/candidates', guardView, (req, res) => {
  const list      = readJson(viewFile(req.params.view, 'candidates.json'));
  const candidate = { ...req.body, id: Date.now().toString(), createdAt: new Date().toISOString() };
  list.push(candidate);
  writeJson(viewFile(req.params.view, 'candidates.json'), list);
  res.status(201).json(candidate);
});

// PUT  /api/:view/candidates/:id
app.put('/api/:view/candidates/:id', guardView, (req, res) => {
  const file = viewFile(req.params.view, 'candidates.json');
  const list = readJson(file);
  const idx  = list.findIndex(c => c.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Candidat introuvable' });
  list[idx] = { ...list[idx], ...req.body };
  writeJson(file, list);
  res.json(list[idx]);
});

// DELETE /api/:view/candidates/:id
app.delete('/api/:view/candidates/:id', guardView, (req, res) => {
  const file = viewFile(req.params.view, 'candidates.json');
  let list   = readJson(file);
  list       = list.filter(c => c.id !== req.params.id);
  writeJson(file, list);
  // Remove CV folder if exists
  const cvDir = path.join(DATA_DIR, req.params.view, 'cvs', req.params.id);
  if (fs.existsSync(cvDir)) fs.rmSync(cvDir, { recursive: true, force: true });
  res.json({ ok: true });
});

// ════════════════════════════════════════════════════════════════════════════
//  CV FILES
// ════════════════════════════════════════════════════════════════════════════

// POST /api/:view/candidates/:id/cv   (multipart/form-data, field "cv")
app.post('/api/:view/candidates/:id/cv', guardView, upload.single('cv'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Aucun fichier reçu' });
  const file = viewFile(req.params.view, 'candidates.json');
  const list = readJson(file);
  const idx  = list.findIndex(c => c.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Candidat introuvable' });
  list[idx].cvFile = req.file.filename;
  list[idx].cvMime = req.file.mimetype;
  list[idx].cvSize = req.file.size;
  writeJson(file, list);
  res.json({ cvFile: req.file.filename, cvMime: req.file.mimetype });
});

// GET  /api/:view/candidates/:id/cv
app.get('/api/:view/candidates/:id/cv', guardView, (req, res) => {
  const list      = readJson(viewFile(req.params.view, 'candidates.json'));
  const candidate = list.find(c => c.id === req.params.id);
  if (!candidate?.cvFile) return res.status(404).json({ error: 'Aucun CV' });
  const cvPath = path.join(DATA_DIR, req.params.view, 'cvs', req.params.id, candidate.cvFile);
  if (!fs.existsSync(cvPath)) return res.status(404).json({ error: 'Fichier manquant' });
  res.sendFile(cvPath);
});

// ════════════════════════════════════════════════════════════════════════════
//  PRIORITIES
// ════════════════════════════════════════════════════════════════════════════

app.get('/api/:view/priorities', guardView, (req, res) => {
  res.json(readJson(viewFile(req.params.view, 'priorities.json')));
});

app.post('/api/:view/priorities', guardView, (req, res) => {
  const file = viewFile(req.params.view, 'priorities.json');
  const list = readJson(file);
  const prio = { ...req.body, id: Date.now().toString(), createdAt: new Date().toISOString() };
  list.push(prio);
  writeJson(file, list);
  res.status(201).json(prio);
});

app.put('/api/:view/priorities/:id', guardView, (req, res) => {
  const file = viewFile(req.params.view, 'priorities.json');
  const list = readJson(file);
  const idx  = list.findIndex(p => p.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Priorité introuvable' });
  list[idx] = { ...list[idx], ...req.body };
  writeJson(file, list);
  res.json(list[idx]);
});

app.delete('/api/:view/priorities/:id', guardView, (req, res) => {
  const file = viewFile(req.params.view, 'priorities.json');
  let list   = readJson(file);
  list       = list.filter(p => p.id !== req.params.id);
  writeJson(file, list);
  res.json({ ok: true });
});

// ── Start ─────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n✅  Suivi Entretiens démarré`);
  console.log(`   → http://localhost:${PORT}\n`);
  console.log(`   Données : ${DATA_DIR}`);
});
