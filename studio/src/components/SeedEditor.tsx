import React from 'react';
import { useStore } from '../store/useStore';

export function SeedEditor() {
  const { seed, domain } = useStore();

  if (!seed) {
    return (
      <div style={styles.panel}>
        <div style={styles.panelHeader}>Seed Editor</div>
        <div style={styles.empty}>No seed loaded</div>
      </div>
    );
  }

  const scalarGenes = Object.entries(seed.genes).filter(([, g]) => g.type === 'scalar');

  return (
    <div style={styles.panel}>
      <div style={styles.panelHeader}>
        <span>Seed Editor</span>
        <span style={styles.badge}>{domain}</span>
      </div>
      <div style={styles.info}>
        <div style={styles.infoRow}>
          <span style={styles.infoLabel}>Name</span>
          <span style={styles.infoValue}>{seed.$name}</span>
        </div>
        <div style={styles.infoRow}>
          <span style={styles.infoLabel}>Hash</span>
          <span style={styles.infoValue}>{seed.$hash.slice(0, 12)}</span>
        </div>
        <div style={styles.infoRow}>
          <span style={styles.infoLabel}>Genes</span>
          <span style={styles.infoValue}>{Object.keys(seed.genes).length}</span>
        </div>
        <div style={styles.infoRow}>
          <span style={styles.infoLabel}>Generation</span>
          <span style={styles.infoValue}>{seed.$lineage.generation}</span>
        </div>
        {seed.$lineage.parents.length > 0 && (
          <div style={styles.infoRow}>
            <span style={styles.infoLabel}>Parents</span>
            <span style={styles.infoValue}>{seed.$lineage.parents.length}</span>
          </div>
        )}
      </div>

      <div style={styles.divider} />

      <div style={styles.genesHeader}>
        Genes ({scalarGenes.length})
      </div>
      <div style={styles.geneList}>
        {scalarGenes.map(([key, gene]) => (
          <GeneSlider key={key} name={key} gene={gene as any} />
        ))}
      </div>
    </div>
  );
}

function GeneSlider({ name, gene }: { name: string; gene: { value: number; min: number; max: number } }) {
  const { updateGene } = useStore();
  const pct = ((gene.value - gene.min) / (gene.max - gene.min)) * 100;

  return (
    <div style={styles.geneRow}>
      <label style={styles.geneName}>{name}</label>
      <input
        type="range"
        min={gene.min}
        max={gene.max}
        step={(gene.max - gene.min) / 200}
        value={gene.value}
        onChange={(e) => updateGene(name, parseFloat(e.target.value))}
        style={styles.slider}
      />
      <span style={styles.geneValue}>
        {gene.value.toFixed(gene.max > 10 ? 0 : 2)}
      </span>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  panel: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },
  panelHeader: {
    padding: '10px 14px',
    fontSize: 11,
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    color: '#71717a',
    borderBottom: '1px solid rgba(255,255,255,0.04)',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  badge: {
    fontSize: 9,
    padding: '2px 6px',
    borderRadius: 3,
    background: 'rgba(99,102,241,0.15)',
    color: '#818cf8',
    textTransform: 'uppercase',
    letterSpacing: 1,
    fontWeight: 700,
  },
  info: {
    padding: '10px 14px',
  },
  infoRow: {
    display: 'flex',
    justifyContent: 'space-between',
    padding: '3px 0',
    fontSize: 11,
  },
  infoLabel: { color: '#52525b' },
  infoValue: { color: '#a1a1aa', fontFamily: 'monospace' },
  divider: {
    height: 1,
    background: 'rgba(255,255,255,0.04)',
    margin: '4px 0',
  },
  genesHeader: {
    padding: '8px 14px 4px',
    fontSize: 10,
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: 1,
    color: '#52525b',
  },
  geneList: {
    flex: 1,
    overflow: 'auto',
    padding: '0 14px 14px',
  },
  geneRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    padding: '4px 0',
  },
  geneName: {
    fontSize: 11,
    color: '#71717a',
    minWidth: 72,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  slider: {
    flex: 1,
    height: 4,
    accentColor: '#6366f1',
    cursor: 'pointer',
  },
  geneValue: {
    fontSize: 10,
    color: '#a1a1aa',
    minWidth: 36,
    textAlign: 'right',
    fontFamily: 'monospace',
  },
  empty: {
    padding: 20,
    color: '#3f3f46',
    fontSize: 12,
    textAlign: 'center',
  },
};
