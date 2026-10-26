import { CandidatesPanel } from './components/CandidatesPanel';
import { Education } from './components/Education';
import { EventConsole } from './components/EventConsole';
import { GamePanel } from './components/GamePanel';
import { Header } from './components/Header';
import { NodeDetails } from './components/NodeDetails';
import { StatsPanel } from './components/StatsPanel';
import { SearchControls } from './components/SearchControls';
import { useLab } from './hooks/useLab';
import { useTreeUi } from './hooks/useTreeUi';
import { TreeView } from './visualization/TreeView';

export default function App() {
  const lab = useLab();
  const treeUi = useTreeUi(lab.controller.tree);
  return (
    <div className="app">
      <Header lab={lab} />
      <main className="layout">
        <div className="col col--left">
          <GamePanel lab={lab} />
          <SearchControls lab={lab} />
        </div>
        <div className="col col--center">
          <TreeView controller={lab.controller} ui={treeUi} stale={!lab.treeIsCurrent} />
        </div>
        <div className="col col--right">
          <CandidatesPanel controller={lab.controller} ui={treeUi} />
          <NodeDetails controller={lab.controller} ui={treeUi} />
        </div>
        <StatsPanel controller={lab.controller} />
        <EventConsole controller={lab.controller} />
        <Education lab={lab} />
      </main>
    </div>
  );
}
