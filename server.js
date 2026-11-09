const express = require('express');
const path = require('path');
const Database = require('better-sqlite3');

const app = express();
const PORT = process.env.PORT || 3000;

// ---------- Database (the SQLite file is created automatically) ----------
const db = new Database(path.join(__dirname, 'plants.db'));

db.exec(`
  CREATE TABLE IF NOT EXISTS plants (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    name       TEXT    NOT NULL,
    category   TEXT    NOT NULL,
    price      REAL    NOT NULL,   -- price per plant
    quantity   INTEGER NOT NULL,   -- number of plants in stock
    created_at TEXT    DEFAULT CURRENT_TIMESTAMP
  )
`);

// Add sample rows the first time so the demo isn't empty
if (db.prepare('SELECT COUNT(*) AS n FROM plants').get().n === 0) {
  const insert = db.prepare(
    'INSERT INTO plants (name, category, price, quantity) VALUES (?, ?, ?, ?)'
  );
  [
    ['Monstera', 'Indoor', 24.0, 14],
    ['Snake plant', 'Indoor', 15.5, 22],
    ['Aloe vera', 'Succulent', 9.0, 4],
    ['Echeveria', 'Succulent', 6.5, 30],
    ['Peace lily', 'Flowering', 18.0, 9],
    ['Basil', 'Herb', 3.5, 40],
    ['Lemon tree', 'Tree', 45.0, 3],
  ].forEach((row) => insert.run(...row));
}

// ---------- Middleware ----------
app.use(express.json());                                   // read JSON request bodies
app.use(express.static(path.join(__dirname, 'public')));   // serve the front end

// ---------- Validation helper ----------
function validate(body) {
  const name = String(body.name ?? '').trim();
  const category = String(body.category ?? '').trim();
  const price = Number(body.price);
  const quantity = Number(body.quantity);

  if (!name) return { error: 'Name is required.' };
  if (!category) return { error: 'Choose a category.' };
  if (!Number.isFinite(price) || price < 0) return { error: 'Price must be 0 or more.' };
  if (!Number.isInteger(quantity) || quantity < 0)
    return { error: 'Quantity must be a whole number of 0 or more.' };

  return { value: { name, category, price, quantity } };
}
// ---------- CRUD routes ----------

// READ all
app.get('/api/plants', (req, res) => {
  res.json(db.prepare('SELECT * FROM plants ORDER BY name COLLATE NOCASE').all());
});

// READ one
app.get('/api/plants/:id', (req, res) => {
  const row = db.prepare('SELECT * FROM plants WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Plant not found.' });
  res.json(row);
});

// CREATE
app.post('/api/plants', (req, res) => {
  const { error, value } = validate(req.body);
  if (error) return res.status(400).json({ error });

  const info = db
    .prepare('INSERT INTO plants (name, category, price, quantity) VALUES (?, ?, ?, ?)')
    .run(value.name, value.category, value.price, value.quantity);

  res.status(201).json(db.prepare('SELECT * FROM plants WHERE id = ?').get(info.lastInsertRowid));
});

// UPDATE
app.put('/api/plants/:id', (req, res) => {
  const { error, value } = validate(req.body);
  if (error) return res.status(400).json({ error });

  const info = db
    .prepare('UPDATE plants SET name = ?, category = ?, price = ?, quantity = ? WHERE id = ?')
    .run(value.name, value.category, value.price, value.quantity, req.params.id);

  if (info.changes === 0) return res.status(404).json({ error: 'Plant not found.' });
  res.json(db.prepare('SELECT * FROM plants WHERE id = ?').get(req.params.id));
});

// DELETE
app.delete('/api/plants/:id', (req, res) => {
  const info = db.prepare('DELETE FROM plants WHERE id = ?').run(req.params.id);
  if (info.changes === 0) return res.status(404).json({ error: 'Plant not found.' });
  res.status(204).end();
});
// Handles bad JSON and similar errors
app.use((err, req, res, next) => {
  res.status(400).json({ error: 'Invalid request.' });
});

app.listen(PORT, () => console.log(`Plant inventory running at http://localhost:${PORT}`));
