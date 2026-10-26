import { GamePanel } from './components/GamePanel';
import { Header } from './components/Header';
import { SearchControls } from './components/SearchControls';
import { useLab } from './hooks/useLab';

export default function App() {
  const lab = useLab();
  return (
    <div className="app">
      <Header lab={lab} />
      <main className="layout">
        <div className="col col--left">
          <GamePanel lab={lab} />
          <SearchControls lab={lab} />
        </div>
      </main>
    </div>
  );
}
