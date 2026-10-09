// Directorio de bancos: lectura de CSV/Excel, guardado en el navegador y exportación.
// El archivo original nunca se modifica: se trabaja sobre una copia en memoria.
const Directory = (() => {
  const KEY = 'appcorreos.directorio.v1';
  const clean = (s) => String(s ?? '').replace(/\s+/g, ' ').trim();

  function parseCSV(text) {
    text = text.replace(/^﻿/, '');
    const first = text.split(/\r?\n/)[0] || '';
    const delim = [';', ',', '\t'].map((d) => [d, first.split(d).length]).sort((a, b) => b[1] - a[1])[0][0];
    const rows = [];
    let row = [], cell = '', q = false;
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (q) {
        if (c === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += c;
      } else if (c === '"') q = true;
      else if (c === delim) { row.push(cell); cell = ''; }
      else if (c === '\n' || c === '\r') {
        if (c === '\r' && text[i + 1] === '\n') i++;
        row.push(cell); cell = ''; rows.push(row); row = [];
      } else cell += c;
    }
    row.push(cell); rows.push(row);
    return rows;
  }

  const norm = (s) => clean(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

  function rowsToEntries(rows) {
    const hi = rows.findIndex((r) => r.some((c) => /^(banco|entidad|nombre)/.test(norm(c))));
    if (hi < 0) return [];
    const h = rows[hi].map(norm);
    const col = (re) => h.findIndex((x) => re.test(x));
    const iN = col(/^(banco|entidad|nombre)/), iNit = col(/^nit/), iC = col(/^(correo|email|e-mail|mail)/), iA = col(/^alias/);
    if (iN < 0 || iC < 0) return [];
    return rows.slice(hi + 1)
      .map((r) => ({
        nombre: clean(r[iN]),
        nit: iNit >= 0 ? clean(r[iNit]) : '',
        correo: clean(r[iC]),
        alias: iA >= 0 ? clean(r[iA]).split('|').map(clean).filter(Boolean) : [],
      }))
      .filter((e) => e.nombre);
  }

  async function readFile(file) {
    if (/\.(xlsx|xlsm|xls)$/i.test(file.name)) {
      const wb = XLSX.read(await file.arrayBuffer());
      return wb.SheetNames.flatMap((n) =>
        rowsToEntries(XLSX.utils.sheet_to_json(wb.Sheets[n], { header: 1, raw: false, defval: '' })));
    }
    return rowsToEntries(parseCSV(new TextDecoder('utf-8').decode(await file.arrayBuffer())));
  }

  const emails = (correo) => (String(correo).match(/[^\s,;<>]+@[^\s,;<>]+/g) || []).map((e) => e.replace(/[.]+$/, ''));

  // Un solo correo por entidad: si hay varios, prefiere el de notificaciones judiciales.
  function pickEmail(correo) {
    const all = emails(correo);
    if (all.length <= 1) return { email: all[0] || '', multiple: false, all };
    const pref = all.filter((e) => /notific|judicial|embargo|juridic/i.test(e));
    return { email: (pref[0] || all[0]), multiple: true, all, preferido: pref.length > 0 };
  }

  const save = (entries) => { try { localStorage.setItem(KEY, JSON.stringify(entries)); } catch (_) { /* sin almacenamiento */ } };
  const load = () => { try { return JSON.parse(localStorage.getItem(KEY)) || []; } catch (_) { return []; } };

  function toCSV(entries) {
    const q = (v) => (/[;"\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
    const lines = ['BANCO;NIT;CORREO;ALIAS', ...entries.map((e) => [e.nombre, e.nit, e.correo, (e.alias || []).join('|')].map(q).join(';'))];
    return '﻿' + lines.join('\r\n');
  }

  return { readFile, parseCSV, rowsToEntries, pickEmail, emails, save, load, toCSV };
})();
if (typeof module !== 'undefined') module.exports = Directory;
