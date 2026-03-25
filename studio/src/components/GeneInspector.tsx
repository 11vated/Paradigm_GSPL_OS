import React from 'react';
import { useStore } from '../store/useStore';

export function GeneInspector() {
  const { seed, artifacts, lastGenerateMs } = useStore();

  if (!seed) return null;

  const artifactEntries = Array.from(artifacts.entries());

  return (
    <div style={styles.panel}>
      <div style={styles.panelHeader}>Artifacts</div>
      <div style={styles.list}>
        {artifactEntries.length === 0 ? (
          <div style={styles.empty}>No artifacts generated yet</div>
        ) : (
          artifactEntries.map(([key, data]) => {
            const size = typeof data === 'string'
              ? data.length
              : (data instanceof Float32Array || data instanceof Uint32Array)
                ? data.byteLength
                : JSON.stringify(data).length;

            return (
              <div key={key} style={styles.artifact}>
                <span style={styles.artifactName}>{key}</span>
                <span style={styles.artifactSize}>{formatSize(size)}</span>
              </div>
            );
          })
        )}
      </div>
      {lastGenerateMs > 0 && (
        <div style={styles.timing}>
          Generated in {lastGenerateMs}ms
        </div>
      )}
    </div>
  );
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}K`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}M`;
}

const styles: Record<string, React.CSSProperties> = {
  panel: {
    borderTop: '1px solid rgba(255,255,255,0.04)',
  },
  panelHeader: {
    padding: '10px 14px',
    fontSize: 11,
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    color: '#71717a',
    borderBottom: '1px solid rgba(255,255,255,0.04)',
  },
  list: {
    padding: '6px 14px',
    maxHeight: 200,
    overflow: 'auto',
  },
  artifact: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '3px 0',
    fontSize: 11,
  },
  artifactName: {
    color: '#818cf8',
    fontFamily: 'monospace',
  },
  artifactSize: {
    color: '#52525b',
    fontFamily: 'monospace',
    fontSize: 10,
  },
  empty: {
    color: '#3f3f46',
    fontSize: 11,
    padding: '8px 0',
  },
  timing: {
    padding: '6px 14px',
    fontSize: 10,
    color: '#3f3f46',
    borderTop: '1px solid rgba(255,255,255,0.03)',
  },
};
