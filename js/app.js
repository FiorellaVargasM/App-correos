// Interfaz: une directorio, lectura del oficio y generación del resultado.
(() => {
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  let entries = Directory.load();
  let pdfFileName = '';
  let rows = [];          // resultado por entidad
  let scanWarn = [];      // entidades del directorio nombradas en el texto pero no en la lista
  let rawText = '';

  // ---------- Directorio ----------
  function drawDirectory() {
    $('dirCount').textContent = entries.length ? `${entries.length} entidades` : 'vacío';
    const f = Matcher.normalize($('dirSearch').value);
    const body = entries
      .map((e, i) => ({ e, i }))
      .filter(({ e }) => !f || Matcher.normalize([e.nombre, e.correo, ...(e.alias || [])].join(' ')).includes(f))
      .map(({ e, i }) => `<tr><td>${esc(e.nombre)}</td><td>${esc(e.nit)}</td><td>${esc(e.correo)}</td><td>${esc((e.alias || []).join(' | '))}</td><td><button class="small ghost" data-del="${i}" type="button">Quitar</button></td></tr>`)
      .join('');
    $('dirTable').innerHTML = `<tr><th>Entidad</th><th>NIT</th><th>Correo</th><th>Alias</th><th></th></tr>${body}`;
  }

  $('dirFile').addEventListener('change', async (ev) => {
    const file = ev.target.files[0];
    if (!file) return;
    try {
      const loaded = await Directory.readFile(file);
      if (!loaded.length) throw new Error('No se encontraron las columnas BANCO y CORREO.');
      entries = loaded;
      Directory.save(entries);
      $('dirMsg').textContent = `Directorio cargado desde "${file.name}": ${entries.length} entidades. Guardado en este navegador.`;
      drawDirectory();
    } catch (err) {
      $('dirMsg').textContent = `Error al leer el directorio: ${err.message}`;
    }
    ev.target.value = '';
  });

  $('addForm').addEventListener('submit', (ev) => {
    ev.preventDefault();
    const d = Object.fromEntries(new FormData(ev.target));
    entries.push({ nombre: d.nombre.trim(), nit: d.nit.trim(), correo: d.correo.trim(), alias: d.alias.split('|').map((a) => a.trim()).filter(Boolean) });
    Directory.save(entries);
    ev.target.reset();
    drawDirectory();
    $('dirMsg').textContent = 'Banco añadido. Descarga el CSV actualizado si quieres conservar una copia.';
  });

  $('dirTable').addEventListener('click', (ev) => {
    const i = ev.target.dataset.del;
    if (i === undefined || !confirm(`¿Quitar "${entries[i].nombre}" del directorio guardado?`)) return;
    entries.splice(Number(i), 1);
    Directory.save(entries);
    drawDirectory();
  });

  $('dirSearch').addEventListener('input', drawDirectory);

  $('btnExport').addEventListener('click', () => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([Directory.toCSV(entries)], { type: 'text/csv;charset=utf-8' }));
    a.download = 'directorio_actualizado.csv';
    a.click();
    URL.revokeObjectURL(a.href);
  });

  // ---------- Oficio ----------
  $('pdfFile').addEventListener('change', async (ev) => {
    const file = ev.target.files[0];
    if (!file) return;
    pdfFileName = file.name;
    $('pdfName').textContent = file.name;
    $('pdfMsg').textContent = 'Leyendo PDF…';
    $('review').hidden = true;
    $('result').hidden = true;
    try {
      const { text, ocr } = await PdfReader.read(file, (m) => { $('pdfMsg').textContent = m; });
      rawText = text;
      const dest = Oficio.destinatarios(text);
      $('fOficio').value = Oficio.numero(text, file.name);
      $('fRadicado').value = Oficio.radicado(text);
      $('fEntidades').value = dest.entidades.join('\n');
      $('rawText').textContent = text;
      $('blockMsg').textContent = dest.encontrado
        ? 'Revisa la lista: debe coincidir con los destinatarios del oficio.'
        : 'No se pudo identificar el bloque de destinatarios ("Señores:"). Escríbelos manualmente, uno por línea.';
      $('pdfMsg').textContent = ocr ? 'PDF escaneado leído con OCR: revisa con cuidado los nombres.' : 'PDF leído correctamente.';
      $('review').hidden = false;
    } catch (err) {
      $('pdfMsg').textContent = `No se pudo leer el PDF: ${err.message}`;
    }
    ev.target.value = '';
  });

  // ---------- Resultado ----------
  function emailOf(r) {
    if (!r.entry) return null;
    if (r.status === 'verificar' && !r.accepted) return null;
    return Directory.pickEmail(r.entry.correo);
  }

  function run() {
    if (!entries.length) { alert('Primero carga el directorio.'); return; }
    const list = $('fEntidades').value.split('\n').map((s) => s.trim()).filter(Boolean);
    rows = list.map((q) => ({ query: q, ...Matcher.match(q, entries) }));
    const inList = new Set(rows.flatMap((r) => (r.entry ? [r.entry] : [])));
    scanWarn = Matcher.scanText(rawText, entries).filter((e) => !inList.has(e));
    draw();
    $('result').hidden = false;
    $('result').scrollIntoView({ behavior: 'smooth' });
  }

  function draw() {
    $('resA').innerHTML = `<li><b>Archivo PDF:</b> ${esc(pdfFileName)}</li><li><b>Número de oficio:</b> ${esc($('fOficio').value)}</li><li><b>Radicado:</b> ${esc($('fRadicado').value)}</li>`;

    const found = rows.map(emailOf).filter((p) => p && p.email);
    $('resB').value = found.map((p) => p.email).join(';');

    const obs = [];
    rows.forEach((r, i) => {
      const p = emailOf(r);
      if (r.status === 'no') {
        const c = r.candidates[0] ? ` Parecido: «${r.candidates[0].entry.nombre}».` : '';
        obs.push({ i, r, res: 'No encontrado', cls: 'bad', txt: `No aparece en el directorio.${c}` });
      } else if (r.status === 'verificar' && !r.accepted) {
        obs.push({ i, r, res: 'Coincidencia por verificar', cls: 'warn', txt: r.ambiguo ? 'Varias entidades posibles; elige la correcta:' : 'Nombre parecido, confirma que sea la misma entidad:', pick: true });
      } else {
        const notes = [];
        if (Matcher.normalize(r.query) !== Matcher.normalize(r.entry.nombre) && Matcher.normalize(r.query) !== Matcher.normalize(r.via)) notes.push(`Equivale a «${r.entry.nombre.trim()}» del directorio.`);
        if (r.accepted) notes.push('Confirmado manualmente.');
        if (!p.email) notes.push('La entidad no tiene correo en el directorio.');
        if (p.multiple) notes.push(`Hay varios correos (${p.all.join(', ')}). Se usó ${p.email}${p.preferido ? ' (notificaciones judiciales)' : ' (el primero; no se pudo determinar cuál corresponde)'}.`);
        if (notes.length) obs.push({ i, r, res: p.email ? 'Encontrado' : 'No encontrado', cls: p.email ? 'ok' : 'bad', txt: notes.join(' ') });
      }
    });
    if (scanWarn.length) obs.push({ i: -1, r: { query: scanWarn.map((e) => e.nombre.trim()).join(', ') }, res: 'Coincidencia por verificar', cls: 'warn', txt: 'Aparecen mencionadas en el texto del oficio pero no en la lista de destinatarios. No se incluyeron.' });

    $('resC').innerHTML = obs.length
      ? `<table><tr><th>Entidad mencionada en el oficio</th><th>Resultado de la búsqueda</th><th>Observación</th></tr>${obs.map((o) => `<tr><td>${esc(o.r.query)}</td><td class="${o.cls}">${o.res}</td><td>${esc(o.txt)}${o.pick ? '<br>' + o.r.candidates.map((c, k) => `<button class="small ghost" type="button" data-use="${o.i}:${k}">Usar «${esc(c.entry.nombre.trim())}»</button>`).join(' ') : ''}</td></tr>`).join('')}</table>`
      : 'Sin novedades: todas las entidades se encontraron con el nombre exacto.';

    const sinCorreo = rows.filter((r, i) => r.status === 'no' || (emailOf(r) && !emailOf(r).email)).length;
    const verificar = rows.filter((r) => r.status === 'verificar' && !r.accepted).length;
    $('resD').innerHTML = `<li>Entidades identificadas en el oficio: <b>${rows.length}</b></li><li>Correos encontrados: <b>${found.length}</b></li><li>Entidades sin correo identificado: <b>${sinCorreo}</b></li><li>Coincidencias que requieren verificación: <b>${verificar}</b></li>` +
      (!sinCorreo && !verificar ? '<li class="ok">No se encontraron correos faltantes en el directorio.</li>' : '');
  }

  $('resC').addEventListener('click', (ev) => {
    const u = ev.target.dataset.use;
    if (!u) return;
    const [i, k] = u.split(':').map(Number);
    const c = rows[i].candidates[k];
    Object.assign(rows[i], { entry: c.entry, via: c.via, accepted: true });
    draw();
  });

  $('btnRun').addEventListener('click', run);

  $('btnCopy').addEventListener('click', async () => {
    try { await navigator.clipboard.writeText($('resB').value); } catch (_) { $('resB').select(); document.execCommand('copy'); }
    $('copied').textContent = '¡Copiado!';
    setTimeout(() => { $('copied').textContent = ''; }, 2000);
  });

  drawDirectory();
  if (entries.length) $('dirMsg').textContent = `Directorio guardado en este navegador: ${entries.length} entidades.`;
})();
