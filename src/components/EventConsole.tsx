import { Eraser, ScrollText, Snowflake } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { SearchController } from '../mcts/controller';
import { CONSOLE_STAGES, formatEntry, type ConsoleStage } from './eventFormat';

const SHOWN = 200;

export function EventConsole({ controller: c }: { controller: SearchController }) {
  const [enabled, setEnabled] = useState<ReadonlySet<ConsoleStage>>(() => new Set(CONSOLE_STAGES.filter((s) => s !== 'BACKPROPAGATION')));
  /** Visual clear only: the controller's log is untouched. */
  const [clearedSeq, setClearedSeq] = useState(0);
  /** While frozen, newer entries are hidden so the history can be read calmly. */
  const [frozenSeq, setFrozenSeq] = useState<number | null>(null);
  const listRef = useRef<HTMLOListElement>(null);

  const lastSeq = c.log.length ? c.log[c.log.length - 1].seq : 0;
  const lines = c.log
    .filter((e) => e.seq > clearedSeq && (frozenSeq === null || e.seq <= frozenSeq))
    .map(formatEntry)
    .filter((l) => enabled.has(l.stage))
    .slice(-SHOWN);
  const hidden = frozenSeq === null ? 0 : c.log.filter((e) => e.seq > frozenSeq).length;

  useEffect(() => {
    const el = listRef.current;
    if (el && frozenSeq === null) el.scrollTop = el.scrollHeight;
  });

  const toggle = (s: ConsoleStage) => {
    const next = new Set(enabled);
    if (next.has(s)) next.delete(s);
    else next.add(s);
    setEnabled(next);
  };

  return (
    <section className="panel console-panel area-console" aria-labelledby="console-title">
      <header className="panel__header">
        <h2 id="console-title">
          <ScrollText size={16} aria-hidden /> Console de eventos
        </h2>
        <div className="button-row">
          <button
            type="button"
            className={`btn btn--small${frozenSeq !== null ? ' is-on' : ''}`}
            aria-pressed={frozenSeq !== null}
            onClick={() => setFrozenSeq(frozenSeq === null ? lastSeq : null)}
          >
            <Snowflake size={14} aria-hidden /> {frozenSeq === null ? 'Congelar' : `Descongelar${hidden ? ` (+${hidden})` : ''}`}
          </button>
          <button type="button" className="btn btn--small" onClick={() => setClearedSeq(lastSeq)} title="Limpa apenas a exibição; os dados da busca são mantidos">
            <Eraser size={14} aria-hidden /> Limpar console
          </button>
        </div>
      </header>

      <div className="chips" role="group" aria-label="Filtrar por etapa">
        {CONSOLE_STAGES.map((s) => (
          <button key={s} type="button" className={`chip chip--stage stage--${s.toLowerCase()}${enabled.has(s) ? ' is-active' : ''}`} aria-pressed={enabled.has(s)} onClick={() => toggle(s)}>
            {s}
          </button>
        ))}
      </div>

      <ol className="console" ref={listRef} aria-live="off">
        {lines.length === 0 && <li className="console__empty">Nenhum evento para os filtros atuais.</li>}
        {lines.map((l) => (
          <li key={l.seq} className="console__line">
            <span className="console__it mono">#{l.iteration}</span>
            <span className={`console__stage stage--${l.stage.toLowerCase()}`}>{l.stage}</span>
            <span className="console__msg">{l.message}</span>
          </li>
        ))}
      </ol>
      <p className="muted small">
        Mostrando até {SHOWN} linhas; o histórico interno guarda os últimos {c.log.length} eventos. Em buscas rápidas, pause ou congele para ler com calma.
      </p>
    </section>
  );
}
