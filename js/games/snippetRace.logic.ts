/**
 * snippetRace.logic.ts — estado y handlers de Snippet Race.
 */

import type { GameUi } from '../types/game.js';
import audioManager from '../audioManager.js';
import {
  checkAnswer,
  filterPool,
  renderSnippetHtml,
  shufflePool,
  type SnippetChallenge,
} from './snippetRace.challenges.js';

type Phase = 'idle' | 'countdown' | 'playing' | 'feedback' | 'finished';

interface DiffConfig {
  timeSec: number;
  maxDiff: 1 | 2 | 3;
}

const DIFF: Record<number, DiffConfig> = {
  1: { timeSec: 28, maxDiff: 1 },
  2: { timeSec: 20, maxDiff: 2 },
  3: { timeSec: 14, maxDiff: 3 },
};

let cleanup: (() => void) | null = null;

function el<T extends HTMLElement>(ui: GameUi, key: string): T | null {
  return (ui[key] as T) ?? null;
}

function setHidden(node: HTMLElement | null, hidden: boolean) {
  if (!node) return;
  node.hidden = hidden;
}

function formatTime(sec: number): string {
  const s = Math.max(0, Math.ceil(sec));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}`;
}

export function init(ui: GameUi) {
  const setup = el(ui, 'setup');
  const play = el(ui, 'play');
  const result = el(ui, 'result');
  const countdown = el(ui, 'countdown');
  const startBtn = el<HTMLButtonElement>(ui, 'start');
  const submitBtn = el<HTMLButtonElement>(ui, 'submit');
  const skipBtn = el<HTMLButtonElement>(ui, 'skip');
  const retryBtn = el<HTMLButtonElement>(ui, 'retry');
  const input = el<HTMLTextAreaElement>(ui, 'input');
  const snippet = el(ui, 'snippet');
  const prompt = el(ui, 'prompt');
  const message = el(ui, 'message');
  const roundLabel = el(ui, 'roundLabel');
  const scoreLabel = el(ui, 'scoreLabel');
  const timerLabel = el(ui, 'timerLabel');
  const streakLabel = el(ui, 'streakLabel');
  const progressBar = el(ui, 'progressBar');
  const resultTitle = el(ui, 'resultTitle');
  const resultStats = el(ui, 'resultStats');
  const roundsSelect = el<HTMLSelectElement>(ui, 'roundsSelect');
  const difficultySelect = el<HTMLSelectElement>(ui, 'difficultySelect');
  const langBadge = el(ui, 'langBadge');

  if (!setup || !play || !result || !startBtn || !input) return;

  let phase: Phase = 'idle';
  let challenges: SnippetChallenge[] = [];
  let round = 0;
  let score = 0;
  let streak = 0;
  let hits = 0;
  let attempts = 0;
  let failCount = 0;
  let totalHitTime = 0;
  let difficulty = 2;
  let roundLimit = 20;
  let roundStartedAt = 0;
  let remaining = 0;
  let tickTimer: ReturnType<typeof setInterval> | null = null;
  let feedbackTimer: ReturnType<typeof setTimeout> | null = null;
  let countdownTimer: ReturnType<typeof setInterval> | null = null;
  let typeThrottle = 0;

  function clearTimers() {
    if (tickTimer) clearInterval(tickTimer);
    if (feedbackTimer) clearTimeout(feedbackTimer);
    if (countdownTimer) clearInterval(countdownTimer);
    tickTimer = null;
    feedbackTimer = null;
    countdownTimer = null;
  }

  function setPlayingControls(enabled: boolean) {
    input.disabled = !enabled;
    if (submitBtn) submitBtn.disabled = !enabled;
    if (skipBtn) skipBtn.disabled = !enabled;
  }

  function showPhase(next: Phase) {
    phase = next;
    setHidden(setup, next !== 'idle');
    setHidden(countdown, next !== 'countdown');
    setHidden(play, next !== 'playing' && next !== 'feedback');
    setHidden(result, next !== 'finished');
    if (next === 'playing') setPlayingControls(true);
    if (next === 'feedback' || next === 'countdown' || next === 'finished') {
      setPlayingControls(false);
    }
  }

  function updateHud() {
    if (roundLabel) {
      roundLabel.textContent =
        challenges.length > 0
          ? `RONDA ${Math.min(round + 1, challenges.length)}/${challenges.length}`
          : 'RONDA —';
    }
    if (scoreLabel) scoreLabel.textContent = `${score} PTS`;
    if (timerLabel) timerLabel.textContent = formatTime(remaining);
    if (streakLabel) {
      if (streak >= 2) {
        streakLabel.hidden = false;
        streakLabel.textContent = `×${streak}`;
      } else {
        streakLabel.hidden = true;
      }
    }
    if (progressBar && challenges.length) {
      progressBar.style.width = `${(round / challenges.length) * 100}%`;
    }
  }

  function current(): SnippetChallenge | null {
    return challenges[round] ?? null;
  }

  function paintChallenge(ch: SnippetChallenge) {
    if (prompt) prompt.textContent = ch.prompt;
    if (snippet) snippet.innerHTML = renderSnippetHtml(ch);
    if (langBadge) langBadge.textContent = ch.lang;
    input.value = '';
    if (message) {
      message.textContent = '';
      message.className = 'sr-message';
    }
    failCount = 0;
    input.focus();
  }

  function stopRoundTimer() {
    if (tickTimer) clearInterval(tickTimer);
    tickTimer = null;
  }

  function startRoundTimer() {
    stopRoundTimer();
    roundStartedAt = performance.now();
    remaining = roundLimit;
    updateHud();
    tickTimer = setInterval(() => {
      if (phase !== 'playing') return;
      const elapsed = (performance.now() - roundStartedAt) / 1000;
      remaining = Math.max(0, roundLimit - elapsed);
      updateHud();
      if (remaining <= 0) {
        onTimeout();
      }
    }, 100);
  }

  function scoreCorrect(elapsed: number) {
    const base = 100;
    const timeBonus = Math.max(0, (roundLimit - elapsed) * 4);
    const streakBonus = streak * 15;
    const difficultyMult = 1 + (difficulty - 1) * 0.25;
    return Math.floor((base + timeBonus + streakBonus) * difficultyMult);
  }

  function nextRound() {
    if (round >= challenges.length) {
      finish();
      return;
    }
    const ch = current()!;
    roundLimit = ch.timeLimitSec ?? DIFF[difficulty].timeSec;
    showPhase('playing');
    paintChallenge(ch);
    updateHud();
    startRoundTimer();
  }

  function goFeedback(ok: boolean, text: string, then: () => void) {
    phase = 'feedback';
    setPlayingControls(false);
    stopRoundTimer();
    if (message) {
      message.textContent = text;
      message.className = `sr-message ${ok ? 'sr-ok' : 'sr-bad'}`;
    }
    if (feedbackTimer) clearTimeout(feedbackTimer);
    feedbackTimer = setTimeout(() => {
      feedbackTimer = null;
      then();
    }, ok ? 420 : 520);
  }

  function onCorrect() {
    const elapsed = (performance.now() - roundStartedAt) / 1000;
    streak++;
    hits++;
    attempts++;
    totalHitTime += elapsed;
    const gained = scoreCorrect(elapsed);
    score += gained;
    audioManager.play(streak >= 3 ? 'perfect' : 'good');
    updateHud();
    goFeedback(true, `CORRECTO +${gained}`, () => {
      round++;
      if (progressBar && challenges.length) {
        progressBar.style.width = `${(round / challenges.length) * 100}%`;
      }
      nextRound();
    });
  }

  function onWrong() {
    attempts++;
    failCount++;
    streak = 0;
    score = Math.max(0, score - 25);
    audioManager.play('miss');
    updateHud();
    const ch = current();
    const hint =
      failCount >= 2 && ch?.hint ? ` · Hint: ${ch.hint}` : '';
    goFeedback(false, `INCORRECTO −25${hint}`, () => {
      if (phase === 'finished') return;
      phase = 'playing';
      setPlayingControls(true);
      // Castigo: adelantar el reloj de la ronda 2s (menos tiempo restante).
      roundStartedAt -= 2000;
      const elapsed = (performance.now() - roundStartedAt) / 1000;
      remaining = Math.max(0, roundLimit - elapsed);
      updateHud();
      if (remaining <= 0) {
        onTimeout();
        return;
      }
      startRoundTimer();
      input.focus();
    });
  }

  function onTimeout() {
    if (phase !== 'playing') return;
    streak = 0;
    attempts++;
    audioManager.play('miss');
    updateHud();
    goFeedback(false, 'TIEMPO AGOTADO', () => {
      round++;
      nextRound();
    });
  }

  function onSkip() {
    if (phase !== 'playing') return;
    streak = 0;
    score = Math.max(0, score - 40);
    attempts++;
    audioManager.play('miss');
    updateHud();
    goFeedback(false, 'SALTADO −40', () => {
      round++;
      nextRound();
    });
  }

  function finish() {
    clearTimers();
    showPhase('finished');
    const accuracy = attempts > 0 ? hits / attempts : 0;
    const avgTime = hits > 0 ? totalHitTime / hits : 0;
    if (resultTitle) resultTitle.textContent = 'MISIÓN COMPLETA';
    if (resultStats) {
      resultStats.textContent =
        `${score} pts · ${hits}/${challenges.length} aciertos · ` +
        `precisión ${(accuracy * 100).toFixed(0)}% · ` +
        `prom. ${avgTime.toFixed(1)}s`;
    }
    if (progressBar) progressBar.style.width = '100%';
    if (window.Leaderboard) {
      window.Leaderboard.save('snippet-race', score, challenges.length, {
        total: challenges.length,
        accuracy,
        avgTime,
        hits,
        attempts,
      });
    }
    audioManager.play('perfect');
  }

  function beginCountdown() {
    showPhase('countdown');
    let n = 3;
    if (countdown) countdown.textContent = String(n);
    audioManager.play('beep');
    countdownTimer = setInterval(() => {
      n--;
      if (n <= 0) {
        if (countdownTimer) clearInterval(countdownTimer);
        countdownTimer = null;
        nextRound();
        return;
      }
      if (countdown) countdown.textContent = String(n);
      audioManager.play('beep');
    }, 700);
  }

  function start() {
    if (phase !== 'idle' && phase !== 'finished') return;
    clearTimers();
    difficulty = Number(difficultySelect?.value || 2) as 1 | 2 | 3;
    const roundsWanted = Number(roundsSelect?.value || 10);
    const pool = filterPool(difficulty);
    challenges = shufflePool(pool).slice(0, Math.min(roundsWanted, pool.length));
    if (challenges.length === 0) {
      showPhase('idle');
      if (message) {
        message.hidden = false;
        message.textContent = 'No hay desafíos para esta dificultad.';
      }
      return;
    }
    round = 0;
    score = 0;
    streak = 0;
    hits = 0;
    attempts = 0;
    failCount = 0;
    totalHitTime = 0;
    updateHud();
    beginCountdown();
  }

  function submit() {
    if (phase !== 'playing') return;
    const ch = current();
    if (!ch) return;
    const raw = input.value;
    if (!raw.trim()) return;
    if (checkAnswer(raw, ch)) onCorrect();
    else onWrong();
  }

  const onStart = () => start();
  const onSubmit = () => submit();
  const onSkipClick = () => onSkip();
  const onRetry = () => {
    showPhase('idle');
    updateHud();
  };

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  };

  const onType = () => {
    const now = performance.now();
    if (now - typeThrottle > 90) {
      typeThrottle = now;
      audioManager.play('click');
    }
  };

  startBtn.addEventListener('click', onStart);
  submitBtn?.addEventListener('click', onSubmit);
  skipBtn?.addEventListener('click', onSkipClick);
  retryBtn?.addEventListener('click', onRetry);
  input.addEventListener('keydown', onKeyDown);
  input.addEventListener('input', onType);

  showPhase('idle');
  updateHud();

  cleanup = () => {
    clearTimers();
    startBtn.removeEventListener('click', onStart);
    submitBtn?.removeEventListener('click', onSubmit);
    skipBtn?.removeEventListener('click', onSkipClick);
    retryBtn?.removeEventListener('click', onRetry);
    input.removeEventListener('keydown', onKeyDown);
    input.removeEventListener('input', onType);
    phase = 'idle';
  };
}

export function stop() {
  if (cleanup) cleanup();
  cleanup = null;
}
