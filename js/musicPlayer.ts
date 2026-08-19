/**
 * musicPlayer.ts — Widget de reproductor de música de fondo (BGM)
 * Versión TypeScript (antes: <script> inline en index.html)
 */

import safeStorage from './core/safeStorage.js';

interface Track {
  file: string;
  name: string;
}

const TRACKS: Track[] = [
  { file: 'audio/bg_game-8-bit.mp3', name: 'Game 8-Bit' },
  { file: 'audio/bg_8-bit-game.mp3', name: '8-Bit Game' },
  { file: 'audio/bg_that-game-arcade.mp3', name: 'That Game Arcade' },
  { file: 'audio/bg_retro-game-arcade.mp3', name: 'Retro Game Arcade' },
  { file: 'audio/bg_retro-game-music.mp3', name: 'Retro Game Music' },
  { file: 'audio/bg_8-bit-arcade-mode.mp3', name: '8-Bit Arcade Mode' },
  { file: 'audio/bg_level-iii.mp3', name: 'Level III' },
];

// localStorage keys
const LS_VOL = 'mgb_vol';
const LS_PAUSED = 'mgb_paused'; // '1' = user paused, '0' = was playing
const LS_TRACK = 'mgb_track';
const LS_COLLAPSED = 'mgb_collapsed'; // '1' = colapsado, '0' = expandido

function initMusicPlayer(): void {
  const musicPlayerEl = document.getElementById('musicPlayer');
  const fabEl = document.getElementById('musicPlayerFab');
  const trackSelect = document.getElementById('mpTrackSelect') as HTMLSelectElement | null;
  const trackBadge = document.getElementById('mpTrackBadge');
  const btnPlay = document.getElementById('mpPlayPause');
  const btnPrev = document.getElementById('mpPrev');
  const btnNext = document.getElementById('mpNext');
  const btnMute = document.getElementById('mpMuteBtn');
  const btnCollapse = document.getElementById('mpCollapseBtn');
  const volSlider = document.getElementById('mpVolume') as HTMLInputElement | null;
  const iconPlay = document.getElementById('mpIconPlay');
  const iconPause = document.getElementById('mpIconPause');
  const iconVol = document.getElementById('mpVolIcon');
  const iconMute = document.getElementById('mpMuteIcon');
  const noteIcon = document.getElementById('mpNoteIcon');
  const eqBars = document.getElementById('mpEq');
  const fabNote = document.getElementById('mpFabNote');

  if (
    !musicPlayerEl ||
    !fabEl ||
    !trackSelect ||
    !trackBadge ||
    !btnPlay ||
    !btnPrev ||
    !btnNext ||
    !btnMute ||
    !btnCollapse ||
    !volSlider ||
    !iconPlay ||
    !iconPause ||
    !iconVol ||
    !iconMute ||
    !noteIcon ||
    !fabNote
  ) {
    return;
  }

  // Audio element
  const audio = new Audio();
  audio.loop = false;
  audio.preload = 'auto';

  // State
  let currentIdx = Math.min(safeStorage.getNumber(LS_TRACK, 0), TRACKS.length - 1);
  let isPlaying = false;
  let unlocked = false; // browser autoplay gate
  let muted = false; // track-level mute (not audio.muted)
  let volumeBeforeMute = 0.5;

  // Restore volume
  const savedVol = safeStorage.getNumber(LS_VOL, 0.5);
  // Default '1' (pausado): la música debe empezar SIEMPRE desactivada
  // salvo que el usuario mismo la haya dejado sonando en una sesión
  // anterior (LS_PAUSED='0' persistido explícitamente al hacer play/
  // pause — ver syncPlayUI). Antes el default era '0' ("no estaba
  // pausado"), así que en la primera visita de cualquier persona
  // (sin nada guardado todavía) doUnlock() interpretaba eso como "el
  // usuario la dejó sonando" y arrancaba el audio automáticamente en
  // el primer click/tecla en cualquier parte de la página — sin que
  // nadie hubiera tocado nunca el botón de play.
  const wasPaused = safeStorage.getString(LS_PAUSED, '1') === '1';
  audio.volume = savedVol;

  trackSelect.innerHTML = TRACKS.map(
    (t, i) => `<option value="${i}">${i + 1}. ${t.name}</option>`
  ).join('');
  trackSelect.value = String(currentIdx);

  volSlider.value = String(savedVol);

  /* ── UI sync ─────────────────────────────────── */
  function syncPlayUI(playing: boolean): void {
    isPlaying = playing;
    iconPlay!.style.display = playing ? 'none' : '';
    iconPause!.style.display = playing ? '' : 'none';
    noteIcon!.classList.toggle('mp-note--playing', playing);
    eqBars?.classList.toggle('mp-eq--active', playing);
    musicPlayerEl!.classList.toggle('mp--playing', playing);
    fabEl!.classList.toggle('mp-fab--playing', playing);
    safeStorage.setString(LS_PAUSED, playing ? '0' : '1');
  }

  function syncTrackUI(): void {
    trackSelect!.value = String(currentIdx);
    trackBadge!.textContent = `${currentIdx + 1}/${TRACKS.length}`;
  }

  function syncMuteUI(isMuted: boolean): void {
    muted = isMuted;
    iconVol!.style.display = isMuted ? 'none' : '';
    iconMute!.style.display = isMuted ? '' : 'none';
    btnMute!.classList.toggle('mp-btn--active', isMuted);
  }

  /**
   * Copia la posición en pantalla de un widget flotante a otro. Se usa
   * al colapsar/expandir para que el botón ♪ aparezca exactamente donde
   * estaba el panel (y viceversa) en vez de saltar a la posición por
   * defecto (bottom-left) cada vez.
   */
  function syncPosition(from: HTMLElement, to: HTMLElement): void {
    const r = from.getBoundingClientRect();
    // Centrar el FAB (46px) respecto al punto donde estaba el panel, o
    // viceversa, para que el widget no "salte" al cambiar de tamaño.
    const dw = (from.offsetWidth - to.offsetWidth) / 2;
    const dh = (from.offsetHeight - to.offsetHeight) / 2;
    const left = Math.max(0, Math.min(r.left + dw, window.innerWidth - to.offsetWidth));
    const top = Math.max(0, Math.min(r.top + dh, window.innerHeight - to.offsetHeight));
    to.style.left = `${left}px`;
    to.style.top = `${top}px`;
    to.style.bottom = 'auto';
    to.style.right = 'auto';
  }

  /**
   * Colapsado: el panel completo (#musicPlayer) se oculta y en su lugar
   * aparece el botón ♪ (#musicPlayerFab) — no es el mismo panel
   * encogido, son dos elementos separados que se turnan la posición en
   * pantalla (ver syncPosition), cada uno arrastrable por su cuenta
   * (musicPlayerDrag.ts).
   */
  function syncCollapseUI(collapsed: boolean, opts: { syncPos?: boolean } = {}): void {
    const syncPos = opts.syncPos ?? true;
    if (collapsed) {
      if (syncPos) syncPosition(musicPlayerEl!, fabEl!);
      musicPlayerEl!.hidden = true;
      fabEl!.hidden = false;
    } else {
      if (syncPos) syncPosition(fabEl!, musicPlayerEl!);
      fabEl!.hidden = true;
      musicPlayerEl!.hidden = false;
    }
    btnCollapse!.setAttribute('aria-expanded', String(!collapsed));
    fabEl!.setAttribute(
      'aria-label',
      collapsed ? 'Expandir reproductor de música' : 'Reproductor de música'
    );
  }

  // Restaurar colapso guardado (por defecto expandido, igual que antes
  // de agregar esta función). Sin syncPos: ambos widgets ya están en su
  // posición fija por defecto (CSS) al cargar la página, no hace falta
  // copiar bounding rects todavía.
  syncCollapseUI(safeStorage.getString(LS_COLLAPSED, '0') === '1', { syncPos: false });

  /* ── Load & play ─────────────────────────────── */
  function loadTrack(idx: number, autoPlay: boolean): void {
    currentIdx = ((idx % TRACKS.length) + TRACKS.length) % TRACKS.length;
    safeStorage.setNumber(LS_TRACK, currentIdx);
    audio.src = TRACKS[currentIdx].file;
    syncTrackUI();

    if (autoPlay && unlocked) {
      audio
        .play()
        .then(() => syncPlayUI(true))
        .catch(() => syncPlayUI(false));
    } else if (!autoPlay) {
      syncPlayUI(false);
    }
  }

  /* ── Play / Pause ────────────────────────────── */
  function togglePlay(): void {
    if (!unlocked) {
      // First interaction: unlock + start
      doUnlock(true);
      return;
    }
    if (isPlaying) {
      audio.pause();
      syncPlayUI(false);
    } else {
      audio
        .play()
        .then(() => syncPlayUI(true))
        .catch(() => syncPlayUI(false));
    }
  }

  /* ── Mute toggle ─────────────────────────────── */
  function toggleMute(): void {
    if (!muted) {
      volumeBeforeMute = audio.volume;
      audio.volume = 0;
      syncMuteUI(true);
    } else {
      audio.volume = volumeBeforeMute || savedVol;
      volSlider!.value = String(audio.volume);
      syncMuteUI(false);
    }
  }

  /* ── Unlock autoplay (first user gesture) ────── */
  function doUnlock(forcePlay: boolean): void {
    if (unlocked) return;
    unlocked = true;
    document.removeEventListener('click', onFirstInteraction);
    document.removeEventListener('keydown', onFirstInteraction);

    const shouldPlay = forcePlay || !wasPaused;
    if (shouldPlay) {
      audio
        .play()
        .then(() => syncPlayUI(true))
        .catch(() => syncPlayUI(false));
    }
  }

  function onFirstInteraction(): void {
    doUnlock(false);
  }

  /* ── Auto-advance ────────────────────────────── */
  audio.addEventListener('ended', () => loadTrack(currentIdx + 1, true));

  /* ── Handle unexpected pause (e.g. network stall) ── */
  audio.addEventListener('pause', () => {
    if (isPlaying) syncPlayUI(false);
  });
  audio.addEventListener('playing', () => {
    if (!isPlaying) syncPlayUI(true);
  });

  /* ── Controls ────────────────────────────────── */
  btnPlay.addEventListener('click', togglePlay);
  btnMute.addEventListener('click', toggleMute);

  btnCollapse.addEventListener('click', (e) => {
    // El header entero (.mp-head) es el drag handle del panel — sin
    // stopPropagation acá, el mousedown/touchstart de este click también
    // dispararía musicPlayerDrag.ts y el botón terminaría arrastrando el
    // reproductor en vez de solo colapsarlo.
    e.stopPropagation();
    syncCollapseUI(true);
    safeStorage.setString(LS_COLLAPSED, '1');
  });
  btnCollapse.addEventListener('mousedown', (e) => e.stopPropagation());
  btnCollapse.addEventListener('touchstart', (e) => e.stopPropagation(), { passive: true });

  // El FAB (#musicPlayerFab) es a la vez el drag handle (musicPlayerDrag.ts)
  // y el botón para expandir — un click que no fue arrastre lo expande.
  // dragMoved (seteado por musicPlayerDrag.ts vía data-attribute) evita
  // que soltar el mouse al final de un arrastre cuente como "click para
  // expandir".
  fabEl.addEventListener('click', () => {
    if (fabEl!.dataset.dragMoved === 'true') return;
    syncCollapseUI(false);
    safeStorage.setString(LS_COLLAPSED, '0');
  });

  btnPrev.addEventListener('click', () => {
    unlocked = true; // clicking prev counts as interaction
    loadTrack(currentIdx - 1, isPlaying);
  });
  btnNext.addEventListener('click', () => {
    unlocked = true;
    loadTrack(currentIdx + 1, isPlaying);
  });

  trackSelect.addEventListener('change', () => {
    unlocked = true;
    loadTrack(parseInt(trackSelect.value, 10), isPlaying);
  });

  /* ── Volume slider ───────────────────────────── */
  volSlider.addEventListener('input', () => {
    const v = parseFloat(volSlider.value);
    audio.volume = v;
    safeStorage.setNumber(LS_VOL, v);
    // If was muted and user drags slider, un-mute
    if (muted && v > 0) syncMuteUI(false);
  });

  /* ── First-interaction listeners ─────────────── */
  document.addEventListener('click', onFirstInteraction);
  document.addEventListener('keydown', onFirstInteraction);

  /* ── Initial load ────────────────────────────── */
  loadTrack(currentIdx, false);
}

initMusicPlayer();

export {};
