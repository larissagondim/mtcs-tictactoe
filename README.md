# MCTS Lab — Monte Carlo Tree Search no jogo da velha

Laboratório visual e interativo do algoritmo **Monte Carlo Tree Search (MCTS)**. Você joga contra uma IA (ou assiste a duas IAs jogando) e acompanha, em tempo real, como a busca seleciona ramos pelo UCT, expande a árvore, simula partidas e retropropaga os resultados.

Tudo o que aparece na tela — árvore, probabilidades, gráficos e mensagens do console — vem do estado real do mecanismo MCTS. Não há árvores predefinidas nem números ilustrativos.

## Funcionalidades

- **Jogo da velha completo**: você × IA (escolha seu lado e quem começa), IA × IA (estratégia configurável por lado) e **modo de análise**, com edição livre do tabuleiro e validação da posição. A validação avisa quando a posição é artificial (não alcançável por jogadas legais).
- **MCTS real** com as quatro etapas, rollout aleatório ou heurístico (vencer/bloquear) e política final por número de visitas.
- **Árvore interativa em SVG**: zoom, arraste, recolher/expandir subárvores, voltar à raiz, localizar o caminho da jogada escolhida, ocultar estatísticas e seguir a busca. Destaques sincronizados com a etapa em curso: seleção em ciano, expansão em roxo, simulação em âmbar e retropropagação em ciano tracejado.
- **Probabilidades em cada nó**: vitória/empate/derrota, visitas e UCT, com "Não estimada" para nós sem visitas e resultado exato para estados terminais.
- **Painel de jogadas candidatas** ordenável por visitas, taxa de vitória ou UCT, com indicador de baixa amostragem.
- **Estatísticas globais e gráficos**: taxa de vitória e visitas por jogada ao longo da busca, distribuição dos rollouts e crescimento da árvore.
- **Controles**: iniciar, pausar, continuar, cancelar, executar 1 iteração, avançar 1 etapa, reiniciar busca/partida, iterações máximas (100 a 10.000 ou valor personalizado até 50.000), C, política de rollout, velocidade e detalhamento por etapa.
- **Console de eventos** com filtros por etapa, limpeza apenas visual e modo "congelar".
- **Seção educativa** com experimentos ao vivo: efeito de C na distribuição das visitas e busca curta × longa (variação das estimativas).

## Requisitos

- Node.js 20 ou superior (desenvolvido com Node 22)
- npm

## Instalação e execução

```bash
npm install
npm run dev        # servidor de desenvolvimento (http://localhost:5173)
```

| Comando | O que faz |
|---|---|
| `npm run dev` | Servidor de desenvolvimento Vite |
| `npm test` | Suíte de testes (Vitest + Testing Library) |
| `npm run test:watch` | Testes em modo observação |
| `npm run lint` | ESLint |
| `npm run typecheck` | Verificação de tipos (`tsc --noEmit`) |
| `npm run build` | Typecheck + build de produção em `dist/` |
| `npm run preview` | Serve o build de produção |

## Arquitetura

```
src/
  game/            regras do jogo (independentes de UI)
    types.ts         Player, Board, Move, Outcome, GameState
    rules.ts         vitória/empate, jogadas legais, aplicação de jogadas
    validation.ts    alcançabilidade de posições (modo análise)
  mcts/            algoritmo (independente de React)
    types.ts         MCTSConfig, SearchNode, SimulationResult, NodeStatistics, SearchEvent, Decision
    tree.ts          MCTSTree: seleção, expansão, simulação, retropropagação, decisão
    rollout.ts       políticas de rollout aleatória e heurística
    statistics.ts    probabilidades por nó, intervalo de Wilson, baixa amostragem
    controller.ts    SearchController: execução fatiada, pausa/continuação/cancelamento, log, amostras
    experiments.ts   experimentos da seção educativa
    rng.ts           PRNG com semente (mulberry32)
  visualization/   árvore: layout, projeção serializável dos nós, componentes SVG
  hooks/           useLab (jogo + controller), useTreeUi (seleção/expansão da árvore)
  components/      tabuleiro, painéis, console, gráficos, seção educativa
  tests/           testes automatizados
```

**Integração com a interface.** Cada iteração de `MCTSTree.iterate()` é um *gerador* que altera a árvore e emite um `SearchEvent` logo após cada mudança real de estado: um passo de seleção, a criação do nó, o fim do rollout, a atualização de cada nó na retropropagação. O `SearchController` consome esses eventos de três formas:

- **Detalhado**: um evento por tick, com o atraso da velocidade escolhida. A animação mostra exatamente o estado intermediário (por exemplo, o nó recém-expandido ainda com N = 0).
- **Em lote**: várias iterações por tick.
- **Turbo**: tantas iterações quanto couberem em ~12 ms por tick.

O trabalho é fatiado com `setTimeout`, então a interface continua responsiva. A interface é notificada uma vez por tick e lê a árvore por meio de projeções próprias, sem referências circulares (`toNodeView`). Para o tamanho do jogo da velha isso é suficiente; um Web Worker não foi necessário.

**Pausa, continuação e cancelamento.** Pausar só para de agendar ticks: a iteração em andamento fica preservada no gerador e continua de onde parou. Cancelar conclui a iteração em andamento de forma síncrona, para que nenhum nó fique com estatísticas parciais, e não agenda mais nada. "1 iteração" executa exatamente um ciclo completo; se houver uma iteração pela metade, ela é concluída.

**Árvore entre jogadas.** Toda mudança de posição cria uma árvore nova, e isso fica registrado no console. Depois que a IA joga, a árvore que gerou a jogada continua visível, com um aviso, até a próxima busca começar.

## As quatro etapas

1. **Selection** — a partir da raiz, desce escolhendo o filho com maior UCT enquanto o nó estiver totalmente expandido e não for terminal.
2. **Expansion** — se o nó tem jogadas legais ainda sem filho, uma delas (escolhida pelo RNG) vira um novo nó. A jogada sai da lista `untriedMoves`, então nunca é expandida duas vezes.
3. **Simulation** — rollout até um estado terminal: aleatório uniforme, ou heurístico (vence se puder, senão bloqueia, senão aleatório). Retorna exatamente um resultado: vitória de X, vitória de O ou empate. Nós terminais devolvem o resultado exato, sem rollout.
4. **Backpropagation** — do nó simulado até a raiz, cada nó soma 1 visita, incrementa a contagem do resultado (`outcomes.X / O / draw`) e soma a recompensa na perspectiva de quem jogou até ele.

**Decisão final**: o filho da raiz com **mais visitas**. Empates são desfeitos pela recompensa média e depois pela menor célula. O UCT não é usado na decisão. Sem iterações, com a raiz terminal ou sem jogadas legais, `decide()` devolve `move: null` com o motivo explícito (`no-iterations`, `terminal`, `no-legal-moves`).

## Fórmula UCT

$$
UCT_i = \frac{W_i}{N_i} + C\sqrt{\frac{\ln N_p}{N_i}}
$$

- `W_i`: soma das recompensas do filho na perspectiva do jogador que escolhe no pai (vitória 1, empate 0,5, derrota 0).
- `N_i`, `N_p`: visitas do filho e do pai.
- `C`: constante de exploração (padrão √2 ≈ 1,41; ajustável de 0 a 3 nos controles).
- Filhos não visitados têm UCT = +∞ e são tentados antes dos já visitados.

## Convenção de recompensas e probabilidades

- **Recompensa (usada no UCT)**: cada nó guarda `totalReward` na perspectiva de `playerJustMoved`, o jogador que fez a jogada que levou ao nó. Como esse é exatamente o jogador que escolhe no pai, o pai sempre maximiza a recompensa do próprio ponto de vista, e X e O nunca se misturam.
- **Probabilidades exibidas**: sempre na **perspectiva do jogador que decide na raiz da busca atual**, em toda a árvore. Cada nó guarda as contagens brutas de resultados por vencedor absoluto. Assim:

  ```
  P(vitória) = V / N     P(empate) = E / N     P(derrota) = D / N
  ```

  com V, E e D contados para o jogador da raiz. As três somam 100% (salvo arredondamento). A taxa de vitória **não** é a recompensa média × 100, que conta empate como 0,5; a recompensa média aparece separadamente no painel de detalhes.
- Nós com N = 0 aparecem como **Não estimada**, nunca como 0%.
- Estados terminais mostram o **resultado exato**, separado das contagens de rollouts.
- Com menos de 10 visitas, a estimativa recebe o selo de **baixa amostra**. O painel de detalhes mostra o intervalo de confiança de Wilson (95%).

## Limitações da interpretação estatística

- As taxas são **frequências empíricas dos rollouts**, não probabilidades teóricas do jogo. Com rollouts aleatórios, ambos os lados jogam mal nas simulações. Por isso uma posição teoricamente empatada pode mostrar muitas vitórias e derrotas.
- As estimativas dependem da política de rollout, de C, do número de iterações e da sorte. Elas mudam a cada nova simulação, e nós pouco visitados são instáveis.
- As amostras não são independentes nem identicamente distribuídas: o UCT concentra visitas nos ramos promissores, então o intervalo de Wilson é uma referência de incerteza, não uma garantia formal.
- A taxa de vitória de um nó mistura rollouts que passaram por subárvores diferentes à medida que a árvore cresce abaixo dele.

## Testes

`npm test` cobre:

- **Regras**: vitórias horizontais, verticais e diagonais, empate, tabuleiro cheio, jogadas legais, rejeição de células ocupadas, bloqueio após o fim e validação de posições.
- **MCTS**: criação da raiz, UCT (inclusive ∞ para não visitados), expansão sem duplicação, seleção, simulações terminando corretamente, retropropagação, contadores de visitas, perspectiva das recompensas para X e O, estados terminais, decisão final por visitas e ausência de estados ilegais na árvore.
- **Probabilidades**: sequências controladas de resultados (simulador injetável), conversão de perspectiva, "não estimada", baixa amostragem e intervalo de Wilson.
- **Controller**: pausa e continuação sem perder a árvore, cancelamento controlado sem trabalho em segundo plano, iteração única exata, animação por etapa sincronizada, reinício e amostras dos gráficos.
- **Interface**: a IA responde a uma jogada com um lance legal; células bloqueadas fora da vez do usuário.

Os testes não dependem de sequências aleatórias frágeis: usam um RNG com semente (`mulberry32`), um simulador injetável com resultados roteirizados e um agendador manual.
