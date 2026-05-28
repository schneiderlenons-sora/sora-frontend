# Ícones circulares de marcas

Coloque aqui PNGs circulares **full-bleed** (preenchem todo o quadrado) das marcas que aparecem no app — Spotify, Netflix, Nubank, HBO Max, etc.

## Como funciona

1. Salve o PNG nesta pasta com nome em kebab-case: `spotify.png`, `hbo-max.png`, `globo-play.png`.
2. Adicione `local: '/brands/spotify.png'` na entrada da marca em [`components/ui/IconeMarca.tsx`](../../components/ui/IconeMarca.tsx).
3. Pronto — o `CategoriaIcon` renderiza essa imagem diretamente, sem nenhum wrapper de cor extra.

## Requisitos do PNG

- **Quadrado** (recomendo 512×512), com fundo já desenhado dentro da imagem (transparente nos cantos para dar o efeito circular).
- **PNG transparente** nos cantos. A imagem em si pode ter qualquer cor de fundo no círculo.
- Sem texto adicional, sem padding interno desnecessário.

## Marcas com `local` ativo

Streaming: spotify, netflix, disney-plus, hbo-max, prime-video, globo-play, apple-tv, youtube-premium
Bancos: nubank, bradesco, itau, santander, banco-do-brasil
Marketplaces: amazon, mercado-livre, aliexpress, shopee, shein
Roupa/esporte: nike, adidas
Mobilidade/delivery: uber, ifood
Telecom: vivo, claro, tim
Educação: qconcursos
Design: canva
