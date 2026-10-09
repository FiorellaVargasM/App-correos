// Extracción de texto del PDF (pdf.js) con OCR de respaldo (Tesseract.js) para escaneados.
const PdfReader = (() => {
  pdfjsLib.GlobalWorkerOptions.workerSrc = 'vendor/pdf.worker.min.js';

  async function loadTesseract() {
    if (window.Tesseract) return window.Tesseract;
    await new Promise((ok, fail) => {
      const s = document.createElement('script');
      s.src = 'https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js';
      s.onload = ok;
      s.onerror = () => fail(new Error('No se pudo cargar el OCR (se requiere internet para PDF escaneados).'));
      document.head.appendChild(s);
    });
    return window.Tesseract;
  }

  async function read(file, onStatus = () => {}) {
    const pdf = await pdfjsLib.getDocument({ data: await file.arrayBuffer() }).promise;
    const pages = [];
    for (let p = 1; p <= pdf.numPages; p++) {
      const content = await (await pdf.getPage(p)).getTextContent();
      let out = '', lastY = null;
      for (const it of content.items) {
        const y = it.transform[5];
        if (lastY !== null && Math.abs(y - lastY) > 2) out += '\n';
        else if (out && !out.endsWith(' ') && !it.str.startsWith(' ')) out += ' ';
        out += it.str;
        lastY = y;
      }
      pages.push(out);
    }
    let text = pages.join('\n');
    if (text.replace(/\s/g, '').length >= 50) return { text, ocr: false };

    onStatus('PDF escaneado: aplicando OCR (puede tardar)…');
    const T = await loadTesseract();
    const worker = await T.createWorker('spa');
    const ocr = [];
    for (let p = 1; p <= pdf.numPages; p++) {
      const page = await pdf.getPage(p);
      const vp = page.getViewport({ scale: 2 });
      const canvas = document.createElement('canvas');
      canvas.width = vp.width; canvas.height = vp.height;
      await page.render({ canvasContext: canvas.getContext('2d'), viewport: vp }).promise;
      ocr.push((await worker.recognize(canvas)).data.text);
    }
    await worker.terminate();
    return { text: ocr.join('\n'), ocr: true };
  }

  return { read };
})();
