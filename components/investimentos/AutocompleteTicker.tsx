'use client';

import { useEffect, useRef, useState } from 'react';
import { Search, Loader2, TrendingUp } from 'lucide-react';
import { api } from '@/lib/api';

export interface TickerResult {
  ticker:   string;
  nome:     string;
  tipo?:    string;
  exchange?: string;
  cripto?:  boolean;
  symbol?:  string;    // CoinGecko symbol (BTC)
  id?:      string;    // CoinGecko id (bitcoin)
}

interface Props {
  modo: 'acao' | 'cripto';
  placeholder?: string;
  onSelect: (r: TickerResult) => void;
}

function avatarBg(seed: string) {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = seed.charCodeAt(i) + ((hash << 5) - hash);
  return `hsl(${Math.abs(hash) % 360} 65% 45%)`;
}

export default function AutocompleteTicker({ modo, placeholder, onSelect }: Props) {
  const [query,   setQuery]   = useState('');
  const [results, setResults] = useState<TickerResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [open,    setOpen]    = useState(false);
  const debounceRef = useRef<any>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (query.trim().length < 2) { setResults([]); setLoading(false); return; }
    setLoading(true);
    debounceRef.current = setTimeout(async () => {
      try {
        if (modo === 'cripto') {
          const r = await api.investimentos.buscarCripto(query);
          setResults((r || []).map((c: any) => ({
            ticker: c.symbol?.toUpperCase() || c.id,
            id:     c.id,
            nome:   c.name,
            tipo:   'CRYPTO',
            cripto: true,
            symbol: c.symbol,
          })));
        } else {
          const r = await api.investimentos.buscarTicker(query);
          setResults(r || []);
        }
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 350);
    return () => debounceRef.current && clearTimeout(debounceRef.current);
  }, [query, modo]);

  function handlePick(r: TickerResult) {
    onSelect(r);
    setQuery(`${r.ticker} — ${r.nome}`);
    setOpen(false);
  }

  return (
    <div className="relative">
      <div className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
        <input
          type="text"
          value={query}
          onChange={e => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          placeholder={placeholder || (modo === 'cripto' ? 'Buscar cripto (ex: bitcoin)' : 'Buscar ticker (ex: PETR4, AAPL)')}
          className="input pl-9"
        />
        {loading && (
          <Loader2 size={14} className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-muted-foreground" />
        )}
      </div>

      {open && results.length > 0 && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute left-0 right-0 top-full mt-1 z-20 max-h-72 overflow-y-auto bg-card border border-border rounded-xl shadow-2xl p-1 animate-fade-in">
            {results.map((r, i) => {
              const bg = avatarBg(r.ticker || r.nome || '');
              const initial = (r.ticker || r.nome || '?').charAt(0).toUpperCase();
              return (
                <button
                  key={`${r.ticker}-${i}`}
                  onClick={() => handlePick(r)}
                  className="w-full flex items-center gap-3 p-2.5 rounded-lg hover:bg-muted transition-colors text-left"
                >
                  <div className="w-9 h-9 rounded-lg flex items-center justify-center text-white font-bold text-sm flex-shrink-0"
                       style={{ background: bg }}>
                    {initial}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-foreground tabular">{r.ticker}</span>
                      {r.tipo && (
                        <span className="text-[9px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground">
                          {r.tipo}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground truncate">{r.nome}</p>
                  </div>
                  {r.exchange && (
                    <span className="text-[10px] text-muted-foreground flex-shrink-0">{r.exchange}</span>
                  )}
                </button>
              );
            })}
          </div>
        </>
      )}

      {open && !loading && results.length === 0 && query.trim().length >= 2 && (
        <div className="absolute left-0 right-0 top-full mt-1 z-20 bg-card border border-border rounded-xl shadow-xl p-4 text-center">
          <TrendingUp size={18} className="text-muted-foreground mx-auto mb-1.5" />
          <p className="text-xs text-muted-foreground">Nenhum resultado para <strong className="text-foreground">{query}</strong></p>
        </div>
      )}
    </div>
  );
}
