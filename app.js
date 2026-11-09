const API = '/api/plants';
const CATEGORIES = {
  Indoor: '#3f8f5a', Succulent: '#8fae3b', Flowering: '#c2457a',
  Herb: '#2c7a7b', Tree: '#7a5a3a',
};
const LOW_STOCK = 5;   // plants at or below this many get a "Low" tag

let items = [];
let editingId = null;

const $ = (s) => document.querySelector(s);
const money = (n) => '$' + n.toFixed(2);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const color = (cat) => CATEGORIES[cat] || '#8a948d';

// Small helper for talking to the backend
async function api(url, opts = {}) {
  const res = await fetch(url, { headers: { 'Content-Type': 'application/json' }, ...opts });
  if (res.status === 204) return null;
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Something went wrong. Try again.');
  return data;
}

function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => t.classList.remove('show'), 2400);
}

// ----- Draw the page -----
function render() {
  // Summary strip and category bar use all items
  const totalStock = items.reduce((s, v) => s + v.quantity, 0);
  const value = items.reduce((s, v) => s + v.quantity * v.price, 0);
  const low = items.filter((v) => v.quantity <= LOW_STOCK).length;

  $('#stats').innerHTML = [
    ['Plant types', items.length],
    ['Total plants', totalStock],
    ['Stock value', money(value)],
    ['Running low', low],
  ].map(([label, n]) => `<div><strong>${n}</strong><span>${label}</span></div>`).join('');

  const byCat = {};
  items.forEach((v) => { byCat[v.category] = (byCat[v.category] || 0) + v.quantity; });
  const parts = Object.entries(byCat).filter(([, n]) => n > 0);

  $('#bar').innerHTML = parts.map(([c, n]) =>
    `<i style="width:${(n / totalStock) * 100}%;background:${color(c)}" title="${esc(c)}: ${n}"></i>`
  ).join('');
  $('#legend').innerHTML = parts.map(([c, n]) =>
    `<li><span class="dot" style="background:${color(c)}"></span>${esc(c)} ${n}</li>`
  ).join('');

  // Table respects search + category filter
  const q = $('#q').value.trim().toLowerCase();
  const cat = $('#filter').value;
  const rows = items.filter((v) => (!cat || v.category === cat) && v.name.toLowerCase().includes(q));

  $('#rows').innerHTML = rows.length
    ? rows.map((v) => `
      <tr>
        <td><span class="dot" style="background:${color(v.category)}"></span>${esc(v.name)}</td>
        <td>${esc(v.category)}</td>
        <td class="num">${money(v.price)}</td>
        <td class="num">${v.quantity}${v.quantity <= LOW_STOCK ? '<span class="low">Low</span>' : ''}</td>
        <td class="act">
          <button class="btn small" data-edit="${v.id}">Edit</button>
          <button class="btn small danger" data-delete="${v.id}">Delete</button>
        </td>
      </tr>`).join('')
    : '<tr><td colspan="5" class="empty">No plants match. Clear the search or add a new one.</td></tr>';
}

// READ: load everything from the server
async function load() {
  try { items = await api(API); render(); }
  catch (e) { toast(e.message); }
}

// ----- Add / Edit dialog -----
const dlg = $('#dlg');
const form = $('#form');

function openDialog(plant) {
  editingId = plant ? plant.id : null;
  form.reset();
  $('#err').textContent = '';
  $('#dlgTitle').textContent = plant ? 'Edit ' + plant.name : 'Add plant';
  $('#saveBtn').textContent = plant ? 'Save changes' : 'Add plant';
  if (plant) {
    form.name.value = plant.name;
    form.category.value = plant.category;
    form.price.value = plant.price;
    form.quantity.value = plant.quantity;
  }
  dlg.showModal();
  form.name.focus();
}

// CREATE or UPDATE
form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const body = JSON.stringify({
    name: form.name.value,
    category: form.category.value,
    price: form.price.value,
    quantity: form.quantity.value,
  });
  try {
    const saved = editingId
      ? await api(`${API}/${editingId}`, { method: 'PUT', body })
      : await api(API, { method: 'POST', body });
    dlg.close();
    toast((editingId ? 'Saved ' : 'Added ') + saved.name);
    load();
  } catch (err) {
    $('#err').textContent = err.message;
  }
});

// ----- Button and input events -----
$('#addBtn').onclick = () => openDialog(null);
$('#cancel').onclick = () => dlg.close();
$('#q').oninput = render;
$('#filter').onchange = render;

// Edit and Delete buttons inside the table
$('#rows').addEventListener('click', async (e) => {
  const editId = e.target.dataset.edit;
  const delId = e.target.dataset.delete;

  if (editId) openDialog(items.find((v) => v.id == editId));

  if (delId) {                                   // DELETE
    const v = items.find((x) => x.id == delId);
    if (!confirm(`Delete ${v.name}? This can’t be undone.`)) return;
    try {
      await api(`${API}/${delId}`, { method: 'DELETE' });
      toast('Deleted ' + v.name);
      load();
    } catch (err) { toast(err.message); }
  }
});

// ----- Start -----
const options = Object.keys(CATEGORIES).map((c) => `<option>${c}</option>`).join('');
$('#filter').innerHTML = '<option value="">All categories</option>' + options;
form.category.innerHTML = options;
load();