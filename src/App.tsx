import { GamePanel } from './components/GamePanel';
import { Header } from './components/Header';
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
      </main>
    </div>
  );
}
