# MCTS Lab — Monte Carlo Tree Search no jogo da velha

Monte Carlo Tree Search (MCTS), passo a passo, no jogo da velha. Um laboratório interativo para ver a árvore de busca crescer, acompanhar cada etapa do algoritmo e entender por que a IA escolhe uma jogada.

A interface é propositalmente simples, para quem não conhece programação nem inteligência artificial. Tudo o que aparece — árvore, chances e explicações — vem das simulações reais do algoritmo. Nada é inventado ou pré‑calculado.

## O que tem na página

- **Tabuleiro**: você joga com X, a IA com O. Escolha quem começa e jogue quantas partidas quiser. A casa escolhida pela IA pisca antes de ela jogar.
- **As 4 etapas do MCTS**: Seleção, Expansão, Simulação e Retropropagação, com a etapa em andamento destacada no modo *Passo a passo*.
- **Explicação em linguagem simples**: uma frase diz o que a IA está fazendo agora e por que está olhando para um lance. No fim, ela explica a jogada escolhida usando os números reais.
- **Árvore de busca**: cada nó é uma posição do jogo, com miniatura do tabuleiro, número de visitas e uma barra de vitória/empate/derrota *da IA*. Clique num nó para ver as chances em uma frase. Arraste para mover, role para aproximar, e use "Ver jogada escolhida" para destacar a decisão.
- **Controles**: Iniciar/Pausar, Reiniciar (refaz a análise da posição), velocidade e número de partidas simuladas por jogada (10 a 10.000).
  - *Passo a passo*: cada etapa aparece devagar.
  - *Normal*: a árvore cresce de forma visível.
  - *Rápida*: a análise termina quase na hora.

## Como rodar

Requer Node.js 20+ e npm.

```bash
npm install
npm run dev        # abre em http://localhost:5173
```

| Comando | O que faz |
| --- | --- |
| `npm run dev` | Servidor de desenvolvimento (Vite) |
| `npm test` | Testes (Vitest + Testing Library) |
| `npm run lint` | ESLint |
| `npm run typecheck` | Checagem de tipos |
| `npm run build` | Checagem de tipos + build de produção em `dist/` |
| `npm run preview` | Serve o build localmente |

## Como o MCTS funciona aqui

A cada jogada, a IA simula **500 partidas imaginárias** (ajustável no painel Simulação). Cada uma passa pelas quatro etapas:

1. **Seleção** — desce pela árvore escolhendo o lance com maior valor UCT: `W/N + C·√(ln Nₚ / N)`, com C = √2. O UCT equilibra lances que deram bons resultados e lances pouco testados. Lances nunca testados vêm primeiro.
2. **Expansão** — acrescenta à árvore um lance legal ainda não testado.
3. **Simulação** — joga a partida até o fim com lances aleatórios.
4. **Retropropagação** — anota o resultado (vitória 1, empate 0,5, derrota 0) em todos os nós do caminho, sempre do ponto de vista de quem fez cada lance.

No fim, a IA joga a casa **analisada mais vezes**.

**As chances na árvore** são contagens reais: em cada nó, vitória, empate e derrota *da IA* são a fração das partidas simuladas que passaram por ali e terminaram assim. Somam 100%. Nós ainda não visitados aparecem como "não estimada", e fins de jogo mostram o resultado exato. São estimativas que mudam a cada simulação. Como as partidas imaginárias são aleatórias, elas não são as probabilidades exatas do jogo perfeito.

## Estrutura

```
src/
├── game/            regras do jogo da velha
├── mcts/            árvore, UCT, simulação, estatísticas, RNG e controlador da busca (sem React)
├── visualization/   layout e desenho da árvore
├── hooks/           useLab (partida + busca) e useTreeUi (seleção/expansão de nós)
├── components/      tabuleiro, controles, etapas e narração
├── styles/          CSS global
└── tests/           testes
```

Cada iteração da busca é um *gerador* que avisa a interface após cada mudança real (seleção, expansão, simulação, retropropagação). A animação e as explicações seguem esses eventos. O trabalho é dividido em pequenos blocos, então a página não trava.

Os testes cobrem as regras, o MCTS (UCT, expansão sem repetição, simulações, retropropagação, perspectiva de X e O, decisão final), as probabilidades por nó, pausa e reinício da busca, as frases do narrador e o jogo contra a IA na interface. São determinísticos: usam RNG com semente e resultados controlados.

## Stack

React 19, TypeScript, Vite, Vitest com Testing Library, ESLint e lucide-react para ícones. A árvore é desenhada em SVG próprio, sem bibliotecas adicionais.
