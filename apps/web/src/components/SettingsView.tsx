'use client';
import { Languages } from 'lucide-react';
import { useLang } from '@/lib/lang';

const OPTIONS = [
  { value: 'es' as const, label: 'Español', example: 'M01-COSTADO · FRENTE_CAJON_2 · TAPA_PISO', hint: 'Recomendado. Así salen en pantalla, dibujos, despiece, PDF y archivos CSV.' },
  { value: 'en' as const, label: 'Inglés (códigos técnicos)', example: 'M01-SIDE · DRAWER_FRONT_2 · HORIZONTAL', hint: 'Para compartir con programas o personas que usan los códigos originales.' },
];

/** Ajustes de la aplicación (por dispositivo). */
export function SettingsView() {
  const { lang, setLang } = useLang();
  return (
    <div className="mx-auto grid max-w-2xl gap-4">
      <h1 className="text-[20px] font-bold">Ajustes</h1>
      <section className="rounded-2xl border border-line bg-panel p-4">
        <h2 className="mb-1 flex items-center gap-2 text-[15px] font-bold"><Languages aria-hidden className="h-5 w-5 text-[#5fd4ef]" />Idioma de los códigos de pieza</h2>
        <p className="mb-3 text-[12.5px] text-muted">Toda la aplicación está en español. Aquí eliges cómo se nombran las piezas en etiquetas, tablas y archivos exportados.</p>
        <div role="radiogroup" aria-label="Idioma de los códigos" className="grid gap-2">
          {OPTIONS.map((o) => (
            <button key={o.value} type="button" role="radio" aria-checked={lang === o.value} onClick={() => setLang(o.value)} data-testid={`lang-${o.value}`}
              className={`grid gap-0.5 rounded-xl border p-3 text-left ${lang === o.value ? 'border-accent bg-[#173342] ring-2 ring-accent/40' : 'border-line bg-panel-2 hover:border-[#4b6a7d]'}`}>
              <span className="text-[14px] font-bold">{o.label}</span>
              <code className="text-[12px] text-[#bce8f2]">{o.example}</code>
              <span className="text-[12px] text-muted">{o.hint}</span>
            </button>
          ))}
        </div>
        <p className="mt-3 text-[11.5px] text-muted">Se guarda en este dispositivo. El respaldo JSON del proyecto siempre conserva los códigos técnicos para poder reimportarlo.</p>
      </section>
    </div>
  );
}
