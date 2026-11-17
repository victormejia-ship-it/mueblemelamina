import { localizeIds, partCodeLabel, type CodeLang, type MaterialNesting, type PanelPart } from '@ms/domain';

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
const fmt = (n: number) => (Math.round(n * 10) / 10).toString();

/** Paleta por material (tablero claro, delgado más cálido). */
const PIECE_FILL = ['#cfe6ee', '#e7dcc4', '#d9e8cf', '#e6d3e8', '#f0dcc8'];

export interface CutPlanOptions { title?: string; lang?: CodeLang; width?: number }

/**
 * Plan de corte en UN solo diagrama: todos los tableros necesarios, uno debajo de otro (agrupados por material),
 * con piezas numeradas, sobrantes reutilizables y leyenda. Si el proyecto necesita otro tablero, aparece como
 * una lámina más en el mismo diagrama.
 */
export function cutPlanSvg(nesting: MaterialNesting[], parts: PanelPart[], opts: CutPlanOptions = {}): string {
  const W = opts.width ?? 900, pad = 20;
  const lang = opts.lang ?? 'es';
  const byId = new Map(parts.map((p) => [p.id, p]));
  const mats = nesting.filter((n) => n.layout && n.layout.sheets.length);
  const totalSheets = mats.reduce((s, n) => s + n.layout!.sheets.length, 0);
  // Número por modelo de pieza (todas las piezas iguales llevan el mismo número)
  const num = new Map<string, number>();
  for (const n of mats) for (const s of n.layout!.sheets) for (const p of s.placements) if (!num.has(p.partId)) num.set(p.partId, num.size + 1);

  const out: string[] = [];
  let y = 64;
  const body: string[] = [];
  mats.forEach((n, mi) => {
    const L = n.layout!;
    const sheet = L.sheet;
    const sc = (W - 2 * pad) / sheet.lengthMm;
    const fill = PIECE_FILL[mi % PIECE_FILL.length]!;
    const used = L.sheets.reduce((s, x) => s + x.usedAreaMm2, 0);
    const util = used / (sheet.lengthMm * sheet.widthMm);
    body.push(`<text x="${pad}" y="${y + 18}" font-size="16" font-weight="700" fill="#0f2f3a">${esc(n.materialName)} · ${L.sheets.length} tablero${L.sheets.length > 1 ? 's' : ''} de ${sheet.lengthMm} × ${sheet.widthMm} mm</text>`);
    y += 28;
    if (L.sheets.length === 1 && util < 0.35) {
      const p = L.sheets[0]!.placements;
      const bw = Math.ceil((Math.max(...p.map((q) => q.x + q.w)) + sheet.trimMarginMm) / 10) * 10;
      const bh = Math.ceil((Math.max(...p.map((q) => q.y + q.h)) + sheet.trimMarginMm) / 10) * 10;
      body.push(`<text x="${pad}" y="${y + 6}" font-size="12" fill="#a04400" font-weight="600">Ocupa ${Math.round(util * 100)} % del tablero: basta un retazo de ${bw} × ${bh} mm o pedir el corte a medida.</text>`);
      y += 16;
    }
    for (const s of L.sheets) {
      const X = (v: number) => pad + v * sc, Y = (v: number) => y + 22 + v * sc;
      const sh = sheet.widthMm * sc;
      const offcutArea = s.offcuts.reduce((a, o) => a + o.w * o.h, 0) / 1e6;
      body.push(`<text x="${pad}" y="${y + 14}" font-size="12.5" fill="#33424f"><tspan font-weight="700">Tablero ${s.index} de ${L.sheets.length}</tspan> · aprovechamiento ${(s.utilization * 100).toFixed(1)} % · sobrante ${fmt(offcutArea)} m²</text>`);
      // Tablero y margen de escuadrado
      body.push(`<rect x="${X(0)}" y="${Y(0)}" width="${fmt(sheet.lengthMm * sc)}" height="${fmt(sh)}" fill="#f6f1e7" stroke="#6b5b45" stroke-width="1.2"/>`);
      body.push(`<rect x="${X(sheet.trimMarginMm)}" y="${Y(sheet.trimMarginMm)}" width="${fmt((sheet.lengthMm - 2 * sheet.trimMarginMm) * sc)}" height="${fmt((sheet.widthMm - 2 * sheet.trimMarginMm) * sc)}" fill="none" stroke="#b59f7c" stroke-dasharray="4 3" stroke-width="0.8"/>`);
      // Sobrantes
      for (const o of s.offcuts) {
        const ow = o.w * sc, oh = o.h * sc;
        const reusable = o.w >= 300 && o.h >= 300;
        body.push(`<rect x="${fmt(X(o.x))}" y="${fmt(Y(o.y))}" width="${fmt(ow)}" height="${fmt(oh)}" fill="url(#ms-hatch)" stroke="${reusable ? '#3d8b5a' : '#c9b89a'}" stroke-width="${reusable ? 1 : 0.6}" stroke-dasharray="${reusable ? '' : '3 2'}"/>`);
        if (ow > 92 && oh > 30) {
          body.push(`<text x="${fmt(X(o.x) + ow / 2)}" y="${fmt(Y(o.y) + oh / 2)}" font-size="${ow > 160 ? 11.5 : 10}" text-anchor="middle" dominant-baseline="middle" fill="${reusable ? '#2d6b44' : '#8a7a5e'}" font-weight="600">${reusable ? 'Sobrante útil' : 'Sobrante'} ${Math.round(o.w)} × ${Math.round(o.h)}</text>`);
        }
      }
      // Piezas numeradas
      for (const p of s.placements) {
        const pw = p.w * sc, ph = p.h * sc;
        const cx = X(p.x) + pw / 2, cy = Y(p.y) + ph / 2;
        const n0 = num.get(p.partId)!;
        body.push(`<rect data-part-id="${esc(p.partId)}" x="${fmt(X(p.x))}" y="${fmt(Y(p.y))}" width="${fmt(pw)}" height="${fmt(ph)}" fill="${fill}" stroke="#2f6f86" stroke-width="1"/>`);
        const r = Math.max(6, Math.min(12, Math.min(pw, ph) * 0.3));
        const showSize = pw > 60 && ph > 34;
        const ny = showSize ? cy - 7 : cy;
        body.push(`<circle cx="${fmt(cx)}" cy="${fmt(ny)}" r="${fmt(r)}" fill="#0f5c73"/><text x="${fmt(cx)}" y="${fmt(ny)}" font-size="${fmt(r * 1.15)}" font-weight="700" text-anchor="middle" dominant-baseline="central" fill="#fff">${n0}</text>`);
        if (showSize) body.push(`<text x="${fmt(cx)}" y="${fmt(cy + r + 2)}" font-size="${pw > 120 ? 10.5 : 9}" text-anchor="middle" dominant-baseline="hanging" fill="#0f2f3a">${fmt(p.w)} × ${fmt(p.h)}${p.rotated ? ' ↻' : ''}</text>`);
      }
      y += 22 + sh + 18;
    }
    y += 10;
  });

  // Leyenda: una fila por número
  const rows = [...num.entries()].map(([id, n]) => ({ n, part: byId.get(id) }));
  body.push(`<text x="${pad}" y="${y + 16}" font-size="15" font-weight="700" fill="#0f2f3a">Piezas</text>`);
  y += 28;
  const cols = [pad, pad + 34, pad + 230, pad + 470, pad + 560, pad + 680];
  body.push(`<g font-size="11.5" fill="#55636f" font-weight="700"><text x="${cols[0]}" y="${y}">#</text><text x="${cols[1]}" y="${y}">Pieza</text><text x="${cols[2]}" y="${y}">Nombre</text><text x="${cols[3]}" y="${y}">Cant.</text><text x="${cols[4]}" y="${y}">Corte (mm)</text><text x="${cols[5]}" y="${y}">Canto L1 L2 A1 A2</text></g>`);
  y += 8;
  for (const r of rows) {
    y += 20;
    const p = r.part;
    const edges = p ? (['L1', 'L2', 'A1', 'A2'] as const).map((e) => (p.edgeBand[e] ? '●' : '○')).join('  ') : '';
    body.push(`<g font-size="12" fill="#1b2630"><circle cx="${cols[0]! + 8}" cy="${y - 4}" r="8" fill="#0f5c73"/><text x="${cols[0]! + 8}" y="${y - 4}" font-size="10" font-weight="700" text-anchor="middle" dominant-baseline="central" fill="#fff">${r.n}</text>`
      + `<text x="${cols[1]}" y="${y}" font-weight="600">${esc(p ? partCodeLabel(p.code, lang) : '')}</text><text x="${cols[2]}" y="${y}">${esc((p?.name ?? '').length > 36 ? `${(p?.name ?? '').slice(0, 35)}…` : (p?.name ?? ''))}</text>`
      + `<text x="${cols[3]}" y="${y}">${p?.quantity ?? ''}</text><text x="${cols[4]}" y="${y}">${p ? `${fmt(p.cutLengthMm)} × ${fmt(p.cutWidthMm)}` : ''}</text><text x="${cols[5]}" y="${y}" letter-spacing="1">${edges}</text></g>`);
  }
  y += 24;
  body.push(`<text x="${pad}" y="${y}" font-size="11" fill="#55636f">Medidas de corte (ya descuentan el canto). La veta corre a lo largo del tablero (horizontal). ↻ = pieza girada.</text>`);
  y += 16;
  body.push(`<text x="${pad}" y="${y}" font-size="11" fill="#55636f">Línea punteada = margen de escuadrado. Verde = sobrante útil (≥ 300 × 300 mm), guárdalo para otro trabajo.</text>`);
  const H = y + 20;

  out.push(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="100%" style="display:block;height:auto" role="img" aria-label="${esc(`Plan de corte: ${totalSheets} tableros`)}" font-family="Inter, Helvetica, Arial, sans-serif">`);
  out.push(`<defs><pattern id="ms-hatch" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="8" height="8" fill="#efe7d6"/><line x1="0" y1="0" x2="0" y2="8" stroke="#d8c9aa" stroke-width="2"/></pattern></defs>`);
  out.push(`<rect width="100%" height="100%" fill="#ffffff"/>`);
  out.push(`<text x="${pad}" y="30" font-size="20" font-weight="700" fill="#0f2f3a">Plan de corte${opts.title ? ` · ${esc(opts.title)}` : ''}</text>`);
  out.push(`<text x="${pad}" y="50" font-size="12.5" fill="#55636f">${totalSheets} tablero${totalSheets === 1 ? '' : 's'} en total · cada material va en su propio tablero (espesor distinto)</text>`);
  out.push(...body, '</svg>');
  return localizeIds(out.join('\n'), lang);
}
