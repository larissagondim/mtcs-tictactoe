import { moveLabel } from '../game/rules';
import type { Outcome, Player } from '../game/types';
import type { SearchController } from '../mcts/controller';
import type { SearchEvent } from '../mcts/types';
import { num, pct } from './format';

const who = (p: Player, ai: Player) => (p === ai ? 'a IA' : 'você');

const resultForAi = (o: Outcome, ai: Player) => (o === 'draw' ? 'empate' : o === ai ? 'a IA venceu' : 'a IA perdeu');

/** Plain-language explanation of what the search is really doing right now. */
export function narrate(c: SearchController): string {
  const tree = c.tree;
  const ai = tree.rootPlayer;

  if (tree.root.terminal !== null) return 'A partida terminou. Clique em “Nova partida” para jogar de novo.';

  if (c.status === 'completed' && c.decision?.move != null) {
    const chosen = tree.getNode(c.decision.nodeId!)!;
    return (
      `A IA escolheu ${moveLabel(c.decision.move)}: foi a casa que ela analisou mais vezes ` +
      `(${num(chosen.visits)} de ${num(tree.iterations)} partidas simuladas). ` +
      `Nessas partidas ela venceu ${pct(chosen.outcomes[ai] / chosen.visits, 0)}, empatou ${pct(chosen.outcomes.draw / chosen.visits, 0)} e perdeu ${pct(
        (chosen.visits - chosen.outcomes[ai] - chosen.outcomes.draw) / chosen.visits,
        0,
      )}.`
    );
  }

  if (c.status === 'idle') return 'Faça sua jogada. Depois, a IA vai simular centenas de partidas imaginárias para decidir onde jogar.';

  if (!c.detailed || c.speed === 'turbo') {
    const leader = tree.iterations > 0 ? tree.decide() : null;
    const node = leader?.nodeId != null ? tree.getNode(leader.nodeId) : undefined;
    return (
      `Simulando partidas rapidamente: ${num(tree.iterations)} de ${num(c.config.iterations)}.` +
      (node && node.move !== null
        ? ` Até agora, a casa mais estudada é ${moveLabel(node.move)} (a IA venceu ${pct(node.outcomes[ai] / node.visits, 0)} das partidas que passaram por ela).`
        : '')
    );
  }

  const last = [...c.log].reverse().find((e) => e.kind === 'event');
  if (!last || last.kind !== 'event') return 'Começando a análise…';
  return describeEvent(last.event, c, ai);
}

function describeEvent(e: SearchEvent, c: SearchController, ai: Player): string {
  const tree = c.tree;
  switch (e.type) {
    case 'selection': {
      const node = tree.getNode(e.chosenId);
      const mover = node ? who(node.playerJustMoved, ai) : 'alguém';
      const chosen = e.candidates.find((x) => x.nodeId === e.chosenId);
      const avg = e.candidates.reduce((s, x) => s + x.visits, 0) / e.candidates.length;
      const reason =
        chosen && chosen.visits < avg
          ? 'Esse lance foi pouco testado até agora, então vale conferir.'
          : 'Esse lance tem dado bons resultados até agora.';
      return `Seleção: seguindo o caminho em que ${mover} joga em ${moveLabel(e.move)}. ${reason}`;
    }
    case 'selection-end':
      return e.reason === 'terminal'
        ? 'Seleção: chegou a um fim de jogo; o resultado aqui já é conhecido.'
        : 'Seleção: chegou a uma posição que ainda tem lances nunca testados.';
    case 'expansion': {
      const node = tree.getNode(e.nodeId);
      return `Expansão: nova possibilidade na árvore — e se ${node ? who(node.playerJustMoved, ai) : 'alguém'} jogar em ${moveLabel(e.move)}?`;
    }
    case 'simulation':
      return e.result.moves.length === 0
        ? `Simulação: esta posição já é o fim do jogo (${resultForAi(e.result.outcome, ai)}).`
        : `Simulação: partida imaginária com ${e.result.moves.length} lance(s) aleatório(s) até o fim. Resultado: ${resultForAi(e.result.outcome, ai)}.`;
    case 'backpropagation':
      return 'Retropropagação: anotando esse resultado em cada lance do caminho, até o topo da árvore.';
    case 'iteration-complete':
      return `Partida simulada nº ${num(e.iteration)} anotada. As chances de cada nó do caminho foram atualizadas.`;
  }
}
