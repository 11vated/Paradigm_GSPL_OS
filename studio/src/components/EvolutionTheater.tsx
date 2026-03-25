import React from 'react';
import { useStore } from '../store/useStore';

export function EvolutionTheater() {
  const { seed, population, generation, history, evolveSeed, mutateSeed,
          selectFromPopulation } = useStore();

  return (
    <div style={styles.panel}>
      <div style={styles.panelHeader}>Evolution</div>

      {/* Controls */}
      <div style={styles.controls}>
        <button style={styles.btn} onClick={() => mutateSeed(0.2, 0.2)}>
          Mutate (light)
        </button>
        <button style={styles.btn} onClick={() => mutateSeed(0.5, 0.5)}>
          Mutate (heavy)
        </button>
        <button style={styles.btnEvl} onClick={() => evolveSeed(5, 6)}>
          Evolve x5
        </button>
        <button style={styles.btnEvl} onClick={() => evolveSeed(20, 8)}>
          Evolve x20
        </button>
        <button style={styles.btnEvl} onClick={() => evolveSeed(50, 12)}>
          Evolve x50
        </button>
      </div>

      {/* Generation counter */}
      <div style={styles.genCounter}>
        <span style={styles.genLabel}>Generation</span>
        <span style={styles.genNum}>{generation}</span>
      </div>

      {/* Population grid */}
      {population.length > 1 && (
        <>
          <div style={styles.sectionHeader}>
            Population ({population.length})
          </div>
          <div style={styles.popGrid}>
            {population.map((s, i) => (
              <div
                key={s.$hash + i}
                style={{
                  ...styles.popItem,
                  ...(s.$hash === seed?.$hash ? styles.popItemActive : {}),
                }}
                onClick={() => selectFromPopulation(i)}
                title={`${s.$name}\nGen: ${s.$lineage.generation}\nHash: ${s.$hash.slice(0, 8)}`}
              >
                <div style={styles.popHash}>{s.$hash.slice(0, 4)}</div>
                <div style={styles.popGen}>g{s.$lineage.generation}</div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* History */}
      {history.length > 1 && (
        <>
          <div style={styles.sectionHeader}>
            Lineage ({history.length})
          </div>
          <div style={styles.lineage}>
            {history.slice(-20).map((s, i) => (
              <div key={s.$hash + i} style={styles.lineageItem}>
                <div style={styles.lineageDot} />
                <div style={styles.lineageInfo}>
                  <span style={styles.lineageName}>{s.$name}</span>
                  <span style={styles.lineageHash}>
                    {s.$hash.slice(0, 8)} &middot; gen {s.$lineage.generation}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  panel: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
  },
  panelHeader: {
    padding: '10px 14px',
    fontSize: 11,
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    color: '#71717a',
    borderBottom: '1px solid rgba(255,255,255,0.04)',
    flexShrink: 0,
  },
  controls: {
    padding: '10px',
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
  },
  btn: {
    padding: '6px 10px',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 4,
    background: 'rgba(255,255,255,0.03)',
    color: '#a1a1aa',
    fontSize: 11,
    cursor: 'pointer',
    textAlign: 'left',
    fontFamily: 'inherit',
  },
  btnEvl: {
    padding: '6px 10px',
    border: '1px solid rgba(168,85,247,0.2)',
    borderRadius: 4,
    background: 'rgba(168,85,247,0.08)',
    color: '#c084fc',
    fontSize: 11,
    cursor: 'pointer',
    textAlign: 'left',
    fontFamily: 'inherit',
  },
  genCounter: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '8px 14px',
    borderTop: '1px solid rgba(255,255,255,0.04)',
    borderBottom: '1px solid rgba(255,255,255,0.04)',
  },
  genLabel: {
    fontSize: 10,
    color: '#52525b',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  genNum: {
    fontSize: 18,
    fontWeight: 800,
    color: '#a855f7',
    fontFamily: 'monospace',
  },
  sectionHeader: {
    padding: '8px 14px 4px',
    fontSize: 10,
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: 1,
    color: '#52525b',
  },
  popGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: 4,
    padding: '4px 10px 10px',
  },
  popItem: {
    padding: '8px 6px',
    borderRadius: 4,
    border: '1px solid rgba(255,255,255,0.06)',
    background: 'rgba(255,255,255,0.02)',
    cursor: 'pointer',
    textAlign: 'center',
    transition: 'border-color 0.15s',
  },
  popItemActive: {
    borderColor: '#6366f1',
    background: 'rgba(99,102,241,0.1)',
  },
  popHash: {
    fontSize: 10,
    fontFamily: 'monospace',
    color: '#818cf8',
    fontWeight: 600,
  },
  popGen: {
    fontSize: 9,
    color: '#52525b',
    marginTop: 2,
  },
  lineage: {
    flex: 1,
    overflow: 'auto',
    padding: '4px 14px',
  },
  lineageItem: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '3px 0',
  },
  lineageDot: {
    width: 6,
    height: 6,
    borderRadius: '50%',
    background: '#6366f1',
    flexShrink: 0,
  },
  lineageInfo: {
    display: 'flex',
    flexDirection: 'column',
  },
  lineageName: {
    fontSize: 10,
    color: '#a1a1aa',
    fontWeight: 600,
  },
  lineageHash: {
    fontSize: 9,
    color: '#3f3f46',
    fontFamily: 'monospace',
  },
};
