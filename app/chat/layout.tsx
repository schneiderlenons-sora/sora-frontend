import ForceLightTheme from './ForceLightTheme';

// Layout exclusivo do /chat: garante TEMA CLARO fixo, desacoplado do tema do
// forsora.com (que pode estar em 'black' = classe .dark no <html>).
export default function ChatLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {/* Antes do paint: remove .dark que o next-themes tenha aplicado no <html>
          (evita 1 frame bugado no carregamento direto do /chat com tema black). */}
      <script
        dangerouslySetInnerHTML={{
          __html: `try{var e=document.documentElement;e.classList.remove('dark');e.classList.add('light');}catch(_){}`,
        }}
      />
      <ForceLightTheme />
      {children}
    </>
  );
}
