// Extracción de datos del oficio a partir de su texto.
const Oficio = (() => {
  function numero(text, fileName = '') {
    const m = text.match(/oficio\s*(?:n[\s.°º˚o]*|no\.?\s*|n[úu]mero\s*)?[:#-]?\s*(\d[\d\-\/]*)/i);
    if (m) return m[1].replace(/[-\/]+$/, '');
    const f = fileName.match(/oficio\D*(\d+)/i);
    return f ? f[1] : '';
  }

  function radicado(text) {
    const full = text.match(/\b(\d{5})\s*-?\s*(\d{2})\s*-?\s*(\d{2})\s*-?\s*(\d{3})\s*-?\s*(\d{4})\s*-?\s*(\d{5})\s*-?\s*(\d{2})\b/);
    if (full) return full.slice(1).join('-');
    const m = text.match(/rad(?:icado|\.)?\s*(?:n[°º.o]*\s*)?:?[ \t]*(\d[\d \t\-]*\d)/i);
    return m ? m[1].replace(/\s+/g, '') : '';
  }

  // Lista de destinatarios: bloque entre "Señores" y "Ciudad"/"REF".
  function destinatarios(text) {
    const m = text.match(/se[ñn]or(?:es|a|as)?(?:\s*\(es\))?\s*:?\s*\n?([\s\S]*?)\s+(?:ciudad|ref\b|ref\.|referencia|asunto|rad\b)/i);
    if (!m) return { encontrado: false, entidades: [] };
    let block = m[1].trim();
    const lines = block.split(/\n/).map((l) => l.trim()).filter(Boolean);
    const parts = /[,;]/.test(block) ? lines.join(' ').split(/[,;]|\s+y\s+(?=[A-ZÁÉÍÓÚ])/) : lines;
    const seen = new Set();
    const entidades = parts
      .map((p) => p.replace(/^se[ñn]ores?\s*:?/i, '').replace(/[.\s]+$/, '').replace(/\s+/g, ' ').trim())
      .filter((p) => {
        const k = Matcher.normalize(p);
        if (!k || seen.has(k)) return false;
        seen.add(k);
        return true;
      });
    return { encontrado: entidades.length > 0, entidades };
  }

  return { numero, radicado, destinatarios };
})();
if (typeof module !== 'undefined') module.exports = Oficio;
