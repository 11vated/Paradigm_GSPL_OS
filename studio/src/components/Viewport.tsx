import React, { useRef, useEffect, useCallback } from 'react';
import { useStore } from '../store/useStore';
import { VisualRenderer } from '@engine/renderers/visual-renderer';
import { AudioRenderer, MusicData } from '@engine/renderers/audio-renderer';
import { GameRenderer, GameSpecification } from '@engine/renderers/game-renderer';
import { AnimationPlayer } from '@engine/renderers/animation-player';
import { ThreeRenderer } from '@engine/renderers/three-renderer';

// Persistent renderer instances (survive re-renders)
let audioRenderer: AudioRenderer | null = null;
let gameRenderer: GameRenderer | null = null;
let animPlayer: AnimationPlayer | null = null;
let threeRenderer: ThreeRenderer | null = null;

export function Viewport() {
  const { seed, artifacts, domain, isGenerating, audioPlaying, gamePlaying, gameScore,
    setAudioPlaying, setGamePlaying, setGameScore } = useStore();
  const containerRef = useRef<HTMLDivElement>(null);

  // Clean up on domain change
  useEffect(() => {
    return () => {
      audioRenderer?.stop();
      gameRenderer?.stop();
      animPlayer?.stop();
      threeRenderer?.stop();
    };
  }, [domain]);

  // Render artifacts when they change
  useEffect(() => {
    if (!containerRef.current || !seed || artifacts.size === 0) return;
    const container = containerRef.current;

    // Stop previous renderers
    audioRenderer?.stop();
    gameRenderer?.stop();
    animPlayer?.stop();
    threeRenderer?.stop();

    // Clear container for non-persistent renderers
    if (domain !== 'fullgame' && domain !== 'game' && domain !== 'geometry3d' && domain !== 'animation') {
      container.innerHTML = '';
    }

    switch (domain) {
      case 'visual2d':
      case 'sprite': {
        const svg = (artifacts.get('svg') ?? artifacts.get('spriteSheet')) as string | undefined;
        if (svg) {
          const vr = new VisualRenderer({ container, width: 480, height: 480, animate: true });
          vr.renderSVG(svg);
        } else {
          // Fallback: render from shapes
          const shapes = artifacts.get('shapes') as any;
          if (shapes) {
            const vr = new VisualRenderer({ container, width: 480, height: 480 });
            vr.renderShapes(shapes);
          }
        }
        break;
      }

      case 'audio': {
        const music = artifacts.get('music') as MusicData | undefined;
        if (music) {
          if (!audioRenderer) {
            audioRenderer = new AudioRenderer({
              volume: 0.5,
              onPlayStateChange: (playing) => setAudioPlaying(playing),
            });
          }
          audioRenderer.loadMusic(music);
          renderAudioUI(container, music);
        }
        break;
      }

      case 'fullgame':
      case 'game': {
        const spec = (artifacts.get('gameSpec') ?? artifacts.get('gameWorldData')) as GameSpecification | undefined;
        if (spec) {
          container.innerHTML = '';
          gameRenderer?.destroy();
          gameRenderer = new GameRenderer({
            container,
            tileSize: 24,
            viewportTilesX: 24,
            viewportTilesY: 16,
            onScore: (score) => setGameScore(score),
            onGameOver: (won) => { setGamePlaying(false); },
          });
          gameRenderer.loadGame(spec);
        }
        break;
      }

      case 'animation': {
        const anim = (artifacts.get('animation') ?? artifacts.get('frameData')) as any;
        if (anim) {
          container.innerHTML = '';
          animPlayer?.destroy();
          animPlayer = new AnimationPlayer({
            container,
            width: 400,
            height: 400,
            loop: true,
            autoplay: true,
          });
          animPlayer.loadAnimation(anim);
        }
        break;
      }

      case 'geometry3d': {
        const vertices = artifacts.get('vertices') as Float32Array | undefined;
        const faces = artifacts.get('faces') as Uint32Array | undefined;
        const normals = artifacts.get('normals') as Float32Array | undefined;
        const vertexCount = artifacts.get('vertexCount') as number | undefined;
        const faceCount = artifacts.get('faceCount') as number | undefined;
        const material = artifacts.get('material') as any;

        if (vertices && faces && normals) {
          container.innerHTML = '';
          threeRenderer?.destroy();
          threeRenderer = new ThreeRenderer({
            container,
            width: 480,
            height: 480,
            autoRotate: true,
          });
          threeRenderer.loadMesh({
            vertices, faces, normals,
            vertexCount: vertexCount ?? vertices.length / 3,
            faceCount: faceCount ?? faces.length / 3,
            material: material ?? { color: { r: 0.6, g: 0.7, b: 0.9 }, roughness: 0.5, metallic: 0.1 },
          });
        }
        break;
      }

      case 'ui': {
        const html = artifacts.get('html') as string | undefined;
        if (html) {
          container.innerHTML = '';
          const iframe = document.createElement('iframe');
          iframe.style.cssText = 'width:100%;height:100%;border:none;border-radius:8px;background:#fff;';
          container.appendChild(iframe);
          iframe.contentDocument?.open();
          iframe.contentDocument?.write(html);
          iframe.contentDocument?.close();
        }
        break;
      }

      default: {
        // Show artifact keys for unknown domains
        container.innerHTML = `<div style="padding:20px;color:#52525b;font-size:12px;font-family:monospace;">
          ${Array.from(artifacts.keys()).map(k => `<div>${k}</div>`).join('')}
        </div>`;
      }
    }
  }, [artifacts, seed, domain]);

  const handlePlayAudio = useCallback(() => {
    if (audioRenderer?.isPlaying()) {
      audioRenderer.stop();
    } else {
      audioRenderer?.play();
    }
  }, []);

  const handleStartGame = useCallback(() => {
    if (gamePlaying) {
      gameRenderer?.stop();
      setGamePlaying(false);
    } else {
      gameRenderer?.start();
      setGamePlaying(true);
    }
  }, [gamePlaying]);

  const handleRestartGame = useCallback(() => {
    gameRenderer?.restart();
    gameRenderer?.start();
    setGamePlaying(true);
    setGameScore(0);
  }, []);

  return (
    <div style={styles.viewport}>
      <div style={styles.viewportHeader}>
        <span style={styles.domainLabel}>{domain}</span>
        <div style={styles.controls}>
          {domain === 'audio' && (
            <button style={audioPlaying ? styles.btnActive : styles.btn} onClick={handlePlayAudio}>
              {audioPlaying ? 'Stop' : 'Play'}
            </button>
          )}
          {(domain === 'fullgame' || domain === 'game') && (
            <>
              <button style={gamePlaying ? styles.btnActive : styles.btn} onClick={handleStartGame}>
                {gamePlaying ? 'Stop' : 'Start'}
              </button>
              <button style={styles.btn} onClick={handleRestartGame}>Restart</button>
              <span style={styles.score}>Score: {gameScore}</span>
            </>
          )}
          {isGenerating && <span style={styles.spinner}>generating...</span>}
        </div>
      </div>
      <div ref={containerRef} style={styles.canvas}>
        {!seed && (
          <div style={styles.empty}>
            <div style={styles.emptyIcon}>&#9670;</div>
            <div>Select a domain and create a seed</div>
          </div>
        )}
      </div>
      {(domain === 'fullgame' || domain === 'game') && gamePlaying && (
        <div style={styles.hint}>Arrow keys / WASD to move, Space to jump, R to restart</div>
      )}
    </div>
  );
}

function renderAudioUI(container: HTMLElement, music: MusicData): void {
  const meta = music.metadata;
  const tracks = music.tracks;
  const totalNotes = tracks.reduce((sum, t) => sum + t.notes.length, 0);

  container.innerHTML = `<div style="padding:30px;text-align:center;width:100%;">
    <div style="font-size:64px;opacity:0.2;margin-bottom:20px;">&#9835;</div>
    <div style="font-size:20px;font-weight:700;color:#f472b6;margin-bottom:8px;">
      ${meta.key} ${meta.scale}
    </div>
    <div style="font-size:32px;font-weight:800;color:#e4e4e7;margin-bottom:16px;">
      ${meta.tempo} BPM
    </div>
    <div style="font-size:12px;color:#71717a;margin-bottom:20px;">
      ${tracks.length} tracks &middot; ${totalNotes} notes &middot; ${meta.bars} bars &middot; ${meta.timeSignature}
    </div>
    <div style="display:flex;justify-content:center;gap:16px;flex-wrap:wrap;">
      ${tracks.map(t => `
        <div style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.06);border-radius:8px;padding:10px 16px;min-width:80px;">
          <div style="font-size:10px;color:#52525b;text-transform:uppercase;letter-spacing:1px;margin-bottom:4px;">${t.name}</div>
          <div style="font-size:13px;color:#a1a1aa;">${t.notes.length} notes</div>
          <div style="font-size:10px;color:#52525b;">${t.instrument.type}</div>
        </div>
      `).join('')}
    </div>
    <div style="margin-top:20px;font-size:11px;color:#3f3f46;">
      Click <strong style="color:#f472b6;">Play</strong> above to hear this seed
    </div>
  </div>`;
}

const styles: Record<string, React.CSSProperties> = {
  viewport: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },
  viewportHeader: {
    padding: '8px 16px',
    fontSize: 11,
    color: '#52525b',
    borderBottom: '1px solid rgba(255,255,255,0.04)',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexShrink: 0,
  },
  domainLabel: {
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    fontWeight: 700,
  },
  controls: {
    display: 'flex',
    gap: 6,
    alignItems: 'center',
  },
  btn: {
    padding: '4px 10px',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 4,
    background: 'rgba(255,255,255,0.05)',
    color: '#a1a1aa',
    fontSize: 11,
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  btnActive: {
    padding: '4px 10px',
    border: '1px solid #ec4899',
    borderRadius: 4,
    background: 'rgba(236,72,153,0.15)',
    color: '#f472b6',
    fontSize: 11,
    cursor: 'pointer',
    fontFamily: 'inherit',
    fontWeight: 600,
  },
  score: {
    fontSize: 11,
    color: '#4ade80',
    fontWeight: 600,
    fontFamily: 'monospace',
    marginLeft: 4,
  },
  spinner: {
    color: '#f59e0b',
    fontSize: 10,
  },
  canvas: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'auto',
    padding: 16,
    background: 'rgba(0,0,0,0.3)',
  },
  empty: {
    textAlign: 'center',
    color: '#3f3f46',
    fontSize: 13,
  },
  emptyIcon: {
    fontSize: 40,
    opacity: 0.3,
    marginBottom: 12,
  },
  hint: {
    padding: '6px 16px',
    fontSize: 10,
    color: '#52525b',
    textAlign: 'center',
    borderTop: '1px solid rgba(255,255,255,0.04)',
    flexShrink: 0,
  },
};
