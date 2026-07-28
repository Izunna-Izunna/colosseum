/**
 * Game Engine — Damage calculation and game state management.
 *
 * Base damage: 8 HP per rep (out of 100 HP total)
 * Fatigue bonus: +0.5 HP per rep number (later reps hit harder)
 *
 * ~13 reps to win at base damage, less with fatigue bonus.
 * Typical duel: 15-25 reps total across both players.
 */

export const MAX_HEALTH = 100;
export const BASE_DAMAGE = 8;
export const FATIGUE_BONUS = 0.5;

// PHASE 2: Combo multiplier constants (not used in MVP)
// export const COMBO_THRESHOLD = 3;
// export const COMBO_MULTIPLIER = 1.5;
// export const COMBO_TIMEOUT_MS = 4000;

export interface GameState {
  playerAHealth: number;
  playerBHealth: number;
  playerAReps: number;
  playerBReps: number;
  status: "waiting" | "calibrating" | "countdown" | "active" | "finished";
  winnerId: string | null;
  startTime: number | null;
  duration: number | null;
}

export function createInitialGameState(): GameState {
  return {
    playerAHealth: MAX_HEALTH,
    playerBHealth: MAX_HEALTH,
    playerAReps: 0,
    playerBReps: 0,
    status: "waiting",
    winnerId: null,
    startTime: null,
    duration: null,
  };
}

/**
 * Calculate damage for a given rep number.
 * Damage increases slightly with each rep (fatigue bonus).
 */
export function calculateDamage(repNumber: number): number {
  return Math.round(BASE_DAMAGE + repNumber * FATIGUE_BONUS);
}

/**
 * Apply damage to the target player's health.
 * Returns a new GameState with updated health and potential winner.
 */
export function applyDamage(
  state: GameState,
  targetPlayer: "A" | "B",
  damage: number
): GameState {
  const newState = { ...state };

  if (targetPlayer === "A") {
    newState.playerAHealth = Math.max(0, state.playerAHealth - damage);
  } else {
    newState.playerBHealth = Math.max(0, state.playerBHealth - damage);
  }

  return newState;
}

/**
 * Register a completed rep for a player.
 * Returns new state with updated rep count and applied damage.
 */
export function registerRep(
  state: GameState,
  attacker: "A" | "B",
  repNumber: number
): GameState {
  const damage = calculateDamage(repNumber);
  const target = attacker === "A" ? "B" : "A";
  let newState = applyDamage(state, target, damage);

  if (attacker === "A") {
    newState.playerAReps = repNumber;
  } else {
    newState.playerBReps = repNumber;
  }

  return newState;
}

/**
 * Check if the game has a winner.
 * Returns the winning player slot ("A" or "B") or null.
 */
export function checkWinCondition(state: GameState): "A" | "B" | null {
  if (state.playerAHealth <= 0) return "B"; // Player B wins (A's health depleted)
  if (state.playerBHealth <= 0) return "A"; // Player A wins (B's health depleted)
  return null;
}

/**
 * Get the health bar color class based on current HP percentage.
 */
export function getHealthColor(health: number): string {
  const pct = (health / MAX_HEALTH) * 100;
  if (pct > 60) return "var(--grad-health-full)";
  if (pct > 30) return "var(--grad-health-mid)";
  return "var(--grad-health-low)";
}

/**
 * Format duration in seconds to M:SS display.
 */
export function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}
