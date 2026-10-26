# MCTS Lab

Monte Carlo Tree Search (MCTS), passo a passo, no jogo da velha. Um laboratório interativo para ver a árvore de busca crescer, acompanhar cada etapa do algoritmo e entender por que a IA escolhe uma jogada.

## Funcionalidades

- **Três modos de jogo**
  - **Você × IA**: jogue contra a IA e veja a árvore que ela construiu.
  - **IA × IA**: duas IAs, cada uma com sua própria configuração.
  - **Análise**: monte qualquer posição (validada) e rode a busca sobre ela.
- **Algoritmo visível**: seleção (UCT), expansão, simulação e retropropagação, com a árvore destacando o que está acontecendo.
- **Árvore interativa**: expanda e recolha nós, arraste para mover, use a roda do mouse ou os botões para zoom, enquadre tudo, volte à raiz, siga a busca em tempo real e localize o caminho da jogada escolhida. As estatísticas nos nós podem ser ocultadas.
- **Controle da busca**: iniciar, pausar, continuar, cancelar, avançar uma iteração ou apenas a próxima etapa, e ajustar a velocidade (lenta, normal, rápida, turbo).
- **Estatísticas por nó**: visitas, vitórias/empates/derrotas, taxa de vitória com intervalo de Wilson de 95%, valor UCT e aviso de amostra pequena.
- **Configuração por jogador**: número de iterações (1 a 50.000), constante de exploração `C` (padrão √2) e política de simulação.
  - `random`: jogadas aleatórias.
  - `heuristic`: vence se puder, bloqueia se precisar, senão joga aleatoriamente.
- **Decisão final** pela jogada mais visitada, com log de eventos da busca.

## Como o MCTS funciona aqui

Cada iteração executa quatro etapas:

1. **Seleção**: desce pela árvore escolhendo o filho com maior UCT, `W/N + C·√(ln Np / N)`, até um nó expansível ou terminal.
2. **Expansão**: cria um filho para uma jogada ainda não tentada.
3. **Simulação**: joga até o fim da partida segundo a política de simulação.
4. **Retropropagação**: atualiza visitas e recompensas (vitória 1, empate 0,5, derrota 0) até a raiz, sempre pela perspectiva de quem fez a jogada.

## Começando

Requer Node.js e npm.

```bash
npm install
npm run dev
```

O app abre em `http://localhost:5173`.

## Scripts

| Comando | O que faz |
| --- | --- |
| `npm run dev` | Servidor de desenvolvimento (Vite) |
| `npm run build` | Checagem de tipos e build de produção |
| `npm run preview` | Serve o build localmente |
| `npm run typecheck` | Checagem de tipos com `tsc` |
| `npm run lint` | ESLint |
| `npm test` | Roda os testes uma vez (Vitest) |
| `npm run test:watch` | Testes em modo watch |

## Estrutura

```
src/
├── game/            regras, tipos e validação de posições do jogo da velha
├── mcts/            árvore, UCT, rollout, estatísticas, RNG e controlador da busca
├── visualization/   layout da árvore e modelo de exibição dos nós
├── hooks/           useLab: estado da partida, modos e configuração
├── components/      Board, GamePanel, SearchControls, Header e afins
├── styles/          CSS global
└── tests/           testes de regras, MCTS, estatísticas, controlador e visualização
```

O motor (`game/` e `mcts/`) não depende de React. O gerador de números aleatórios e o simulador são injetáveis, o que torna os testes determinísticos.

## Stack

React 19, TypeScript, Vite, Vitest com Testing Library, ESLint e lucide-react para ícones.
