import React from 'react';
import { useStore } from '../store/useStore';
import type { SeedDomain } from '@engine/kernel/seed';

const DOMAINS: SeedDomain[] = [
  'visual2d', 'audio', 'fullgame', 'animation', 'geometry3d',
  'sprite', 'ui', 'game', 'procedural',
];

export function Header() {
  const { seed, domain, generation, isGenerating, lastGenerateMs,
          createNewSeed, mutateSeed, randomizeSeed, evolveSeed } = useStore();

  return (
    <div style={styles.header}>
      <div style={styles.logo}>PARADIGM</div>

      <div style={styles.controls}>
        <select
          value={domain}
          onChange={(e) => createNewSeed('Seed_' + Math.random().toString(36).slice(2, 6), e.target.value as SeedDomain)}
          style={styles.select}
        >
          {DOMAINS.map(d => (
            <option key={d} value={d}>{d}</option>
          ))}
        </select>

        <button style={styles.btn} onClick={() => createNewSeed('Seed_' + Math.random().toString(36).slice(2, 6), domain)}>
          New
        </button>
        <button style={styles.btnPrimary} onClick={() => mutateSeed()}>
          Mutate
        </button>
        <button style={styles.btn} onClick={randomizeSeed}>
          Randomize
        </button>
        <button style={styles.btnAccent} onClick={() => evolveSeed(10, 8)}>
          Evolve x10
        </button>
      </div>

      <div style={styles.info}>
        {seed && (
          <>
            <span style={styles.label}>{seed.$name}</span>
            <span style={styles.dim}>gen {generation}</span>
            <span style={styles.dim}>{seed.$hash.slice(0, 8)}</span>
            {isGenerating
              ? <span style={{ ...styles.dim, color: '#f59e0b' }}>generating...</span>
              : <span style={styles.dim}>{lastGenerateMs}ms</span>
            }
          </>
        )}
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  header: {
    height: 52,
    display: 'flex',
    alignItems: 'center',
    gap: 16,
    padding: '0 20px',
    borderBottom: '1px solid rgba(255,255,255,0.06)',
    background: 'rgba(9,9,11,0.95)',
    flexShrink: 0,
  },
  logo: {
    fontSize: 15,
    fontWeight: 800,
    letterSpacing: 3,
    background: 'linear-gradient(135deg, #6366f1, #a855f7, #ec4899)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    marginRight: 8,
  },
  controls: {
    display: 'flex',
    gap: 6,
    alignItems: 'center',
  },
  select: {
    padding: '6px 10px',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 5,
    background: 'rgba(255,255,255,0.05)',
    color: '#e4e4e7',
    fontSize: 12,
    fontFamily: 'inherit',
  },
  btn: {
    padding: '6px 12px',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 5,
    background: 'rgba(255,255,255,0.05)',
    color: '#e4e4e7',
    fontSize: 12,
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  btnPrimary: {
    padding: '6px 12px',
    border: '1px solid #6366f1',
    borderRadius: 5,
    background: 'linear-gradient(135deg, #6366f1, #7c3aed)',
    color: '#fff',
    fontSize: 12,
    fontWeight: 600,
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  btnAccent: {
    padding: '6px 12px',
    border: '1px solid #ec4899',
    borderRadius: 5,
    background: 'linear-gradient(135deg, #ec4899, #a855f7)',
    color: '#fff',
    fontSize: 12,
    fontWeight: 600,
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  info: {
    display: 'flex',
    gap: 12,
    alignItems: 'center',
    marginLeft: 'auto',
    fontSize: 11,
  },
  label: {
    color: '#e4e4e7',
    fontWeight: 600,
  },
  dim: {
    color: '#52525b',
  },
};
