import React, { useEffect } from 'react';
import { useStore } from './store/useStore';
import { SeedEditor } from './components/SeedEditor';
import { Viewport } from './components/Viewport';
import { EvolutionTheater } from './components/EvolutionTheater';
import { GeneInspector } from './components/GeneInspector';
import { Header } from './components/Header';

export default function App() {
  const { seed, createNewSeed } = useStore();

  useEffect(() => {
    if (!seed) {
      createNewSeed('Genesis', 'visual2d');
    }
  }, []);

  return (
    <div style={styles.app}>
      <Header />
      <div style={styles.main}>
        <div style={styles.sidebar}>
          <SeedEditor />
          <GeneInspector />
        </div>
        <div style={styles.center}>
          <Viewport />
        </div>
        <div style={styles.right}>
          <EvolutionTheater />
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  app: {
    display: 'flex',
    flexDirection: 'column',
    height: '100vh',
    overflow: 'hidden',
    background: '#09090b',
  },
  main: {
    display: 'flex',
    flex: 1,
    overflow: 'hidden',
  },
  sidebar: {
    width: 300,
    borderRight: '1px solid rgba(255,255,255,0.06)',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'auto',
  },
  center: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },
  right: {
    width: 280,
    borderLeft: '1px solid rgba(255,255,255,0.06)',
    overflow: 'auto',
  },
};
