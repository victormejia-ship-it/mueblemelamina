'use client';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { localizeIds, type CodeLang } from '@ms/domain';

const KEY = 'ms-code-lang';
interface LangCtx { lang: CodeLang; setLang: (l: CodeLang) => void; t: (s: string) => string }
const Ctx = createContext<LangCtx>({ lang: 'es', setLang: () => {}, t: (s) => localizeIds(s, 'es') });

/** Idioma de los códigos de pieza (por dispositivo). Español por defecto. */
export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<CodeLang>('es');
  useEffect(() => {
    try { const v = localStorage.getItem(KEY); if (v === 'en' || v === 'es') setLangState(v); } catch { /* sin almacenamiento: español */ }
  }, []);
  const setLang = useCallback((l: CodeLang) => {
    setLangState(l);
    try { localStorage.setItem(KEY, l); } catch { /* sin almacenamiento */ }
  }, []);
  const value = useMemo(() => ({ lang, setLang, t: (s: string) => localizeIds(s, lang) }), [lang, setLang]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useLang = () => useContext(Ctx);
