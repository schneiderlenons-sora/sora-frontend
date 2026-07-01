'use client';

import { CheckCheck, BadgeCheck, Plus, Smile, Mic } from 'lucide-react';

const BRAND = '#61ce70';

export type Msg = { who: 'user' | 'sora'; node: React.ReactNode };

export function Avatar() {
  return (
    <div className="w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center overflow-hidden shadow-sm"
         style={{ background: `linear-gradient(135deg, ${BRAND} 0%, #4DAE61 100%)` }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/brands/sora.png" alt="Sora" className="w-5 h-5 object-contain" draggable={false} />
    </div>
  );
}

function NomeSora() {
  return (
    <span className="flex items-center gap-1 mb-0.5">
      <span className="font-bold text-[13px] text-zinc-900 dark:text-white">Sora</span>
      <BadgeCheck size={13} className="text-[#3b9eff] flex-shrink-0" fill="#3b9eff" stroke="white" />
    </span>
  );
}

export function BolhaSora({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-end gap-2 animate-[slide-up_450ms_ease-out_both]">
      <Avatar />
      <div className="max-w-[80%] rounded-2xl rounded-bl-md px-3.5 py-2.5 bg-white dark:bg-[#1e2530] border border-zinc-100 dark:border-white/[0.06] shadow-sm">
        <NomeSora />
        <div className="text-[13px] leading-snug text-zinc-700 dark:text-zinc-200">{children}</div>
      </div>
    </div>
  );
}

export function BolhaUsuario({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex justify-end animate-[slide-up_450ms_ease-out_both]">
      <div className="max-w-[80%] rounded-2xl rounded-br-md px-3.5 py-2.5 shadow-sm bg-[#d7f8cf] text-zinc-800 dark:bg-[#075c46] dark:text-white">
        <p className="text-[13px] leading-snug">{children}</p>
        <span className="flex items-center justify-end gap-1 mt-1 text-[10px] text-zinc-500 dark:text-white/50">
          12:37 <CheckCheck size={13} className="text-[#3b9eff]" />
        </span>
      </div>
    </div>
  );
}

export function Digitando() {
  return (
    <div className="flex items-end gap-2 animate-[slide-up_300ms_ease-out_both]">
      <Avatar />
      <div className="rounded-2xl rounded-bl-md px-3.5 py-3 bg-white dark:bg-[#1e2530] border border-zinc-100 dark:border-white/[0.06] shadow-sm">
        <NomeSora />
        <div className="flex items-center gap-1 pt-0.5">
          <span className="w-1.5 h-1.5 rounded-full bg-zinc-400 dark:bg-white/50 animate-bounce" />
          <span className="w-1.5 h-1.5 rounded-full bg-zinc-400 dark:bg-white/50 animate-bounce" style={{ animationDelay: '150ms' }} />
          <span className="w-1.5 h-1.5 rounded-full bg-zinc-400 dark:bg-white/50 animate-bounce" style={{ animationDelay: '300ms' }} />
        </div>
      </div>
    </div>
  );
}

export function InputBar() {
  return (
    <div className="flex items-center gap-2.5 px-4 py-3 rounded-full bg-white dark:bg-[#1e2530] border border-zinc-200/70 dark:border-white/[0.06] shadow-sm">
      <Plus size={18} className="text-zinc-400 dark:text-white/40" />
      <Smile size={18} className="text-zinc-400 dark:text-white/40" />
      <span className="flex-1" />
      <Mic size={18} className="text-zinc-400 dark:text-white/40" />
    </div>
  );
}

// Corpo do chat CONTROLADO: recebe as mensagens + "digitando" e renderiza a área
// (empurra pro rodapé, corta antigas sem scroll) + a barra de input, que fica
// centralizada quando não há mensagens e desliza pro rodapé quando abre.
export function ChatMessages({ msgs, typing }: { msgs: Msg[]; typing: boolean }) {
  const vazio = msgs.length === 0 && !typing;
  return (
    <div className="relative h-full">
      <div className="absolute inset-0 flex flex-col justify-end gap-2.5 overflow-hidden pb-[72px]">
        {!vazio && <p className="text-center text-[11px] text-zinc-400 dark:text-white/40 mb-1">12:37</p>}
        {msgs.map((m, i) => (
          m.who === 'user'
            ? <BolhaUsuario key={i}>{m.node}</BolhaUsuario>
            : <BolhaSora key={i}>{m.node}</BolhaSora>
        ))}
        {typing && <Digitando />}
      </div>
      <div className="absolute left-0 right-0 bottom-0 transition-transform duration-[600ms] ease-out"
           style={{ transform: vazio ? 'translateY(-204px)' : 'translateY(0)' }}>
        <InputBar />
      </div>
    </div>
  );
}
