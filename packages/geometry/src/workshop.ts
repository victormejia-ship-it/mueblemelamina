import { EQUIPMENT, type WorkshopRoute } from '@ms/domain';

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

/** Corte de texto por ancho aproximado (Inter/Helvetica ≈ 0.55 em por carácter). */
function wrap(text: string, maxPx: number, fontPx: number): string[] {
  const max = Math.max(8, Math.floor(maxPx / (fontPx * 0.55)));
  const out: string[] = [];
  let line = '';
  for (const w of text.split(/\s+/)) {
    if ((line ? `${line} ${w}` : w).length > max && line) { out.push(line); line = w; } else line = line ? `${line} ${w}` : w;
  }
  if (line) out.push(line);
  return out;
}

/**
 * Diagrama de la ruta de taller en SVG (para descargar o imprimir). Flujo vertical de estaciones numeradas,
 * con equipo, cifras del proyecto y avisos. Las estaciones en paralelo se dibujan con borde punteado.
 */
export function routeDiagramSvg(route: WorkshopRoute, title: string, width = 900): string {
  const pad = 24, cardX = 70, cardW = width - cardX - pad;
  const parts: string[] = [];
  let y = 84;
  const cards: string[] = [];
  route.stations.forEach((s, i) => {
    const lines: { text: string; cls: 'goal' | 'eq' | 'metric' | 'alert' }[] = [];
    for (const l of wrap(s.goal, cardW - 32, 13)) lines.push({ text: l, cls: 'goal' });
    const eq = s.equipmentIds.map((id) => EQUIPMENT.find((e) => e.id === id)?.name ?? id).join(' · ');
    for (const l of wrap(`Equipo: ${eq}`, cardW - 32, 12.5)) lines.push({ text: l, cls: 'eq' });
    for (const m of s.metrics) for (const l of wrap(`${m.label}: ${m.value}`, cardW - 32, 12.5)) lines.push({ text: l, cls: 'metric' });
    for (const a of s.alerts) for (const l of wrap(`⚠ ${a}`, cardW - 32, 12.5)) lines.push({ text: l, cls: 'alert' });
    const h = 44 + lines.length * 18 + 12;
    const cy = y;
    cards.push(`<g>
  <circle cx="${cardX - 30}" cy="${cy + 24}" r="18" fill="#2f6f86"/><text x="${cardX - 30}" y="${cy + 29}" text-anchor="middle" font-size="15" font-weight="700" fill="#fff">${s.number}</text>
  <rect x="${cardX}" y="${cy}" width="${cardW}" height="${h}" rx="12" fill="#ffffff" stroke="${s.parallel ? '#b25e00' : '#9fb6c3'}" stroke-width="1.5"${s.parallel ? ' stroke-dasharray="7 5"' : ''}/>
  <text x="${cardX + 16}" y="${cy + 28}" font-size="17" font-weight="700" fill="#0f2f3a">${esc(s.name)}${s.parallel ? ' <tspan font-size="12" fill="#b25e00">(en paralelo con la carpintería)</tspan>' : ''}</text>
  <text x="${cardX + cardW - 16}" y="${cy + 28}" font-size="11.5" text-anchor="end" fill="#55636f">${esc(`${s.input} → ${s.output}`).slice(0, 90)}</text>
${lines.map((l, k) => `  <text x="${cardX + 16}" y="${cy + 54 + k * 18}" font-size="${l.cls === 'goal' ? 13 : 12.5}" fill="${l.cls === 'alert' ? '#a04400' : l.cls === 'eq' ? '#2f6f86' : l.cls === 'goal' ? '#1b2630' : '#33424f'}"${l.cls === 'eq' || l.cls === 'alert' ? ' font-weight="600"' : ''}>${esc(l.text)}</text>`).join('\n')}
</g>`);
    y += h;
    if (i < route.stations.length - 1) {
      cards.push(`<line x1="${cardX - 30}" y1="${cy + 42}" x2="${cardX - 30}" y2="${y + 24}" stroke="#2f6f86" stroke-width="2.5" marker-end="url(#ms-flow)"/>`);
      y += 22;
    }
  });
  const height = y + pad;
  parts.push(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" role="img" aria-label="${esc(`Ruta de taller: ${title}`)}" font-family="Inter, Helvetica, Arial, sans-serif">`);
  parts.push(`<title>${esc(`Ruta de taller: ${title}`)}</title>`);
  parts.push(`<defs><marker id="ms-flow" markerWidth="10" markerHeight="10" refX="5" refY="5" orient="auto"><path d="M0,0 L10,5 L0,10 z" fill="#2f6f86"/></marker></defs>`);
  parts.push(`<rect width="100%" height="100%" fill="#f4f7f9"/>`);
  parts.push(`<text x="${pad}" y="38" font-size="20" font-weight="700" fill="#0f2f3a">Ruta de taller · ${esc(title)}</text>`);
  parts.push(`<text x="${pad}" y="60" font-size="12.5" fill="#55636f">${route.stations.length} estaciones en orden. Cifras calculadas del proyecto. ⚠ = punto de atención en esa estación.</text>`);
  parts.push(...cards, '</svg>');
  return parts.join('\n');
}
