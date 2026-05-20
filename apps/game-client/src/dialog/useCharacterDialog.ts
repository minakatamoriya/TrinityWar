import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  characterDialogActors,
  characterDialogScenes,
  getDialogSceneAdvance,
  getDialogSceneDefaultOptions,
  getDialogSceneEnterDelayMs,
  getDialogSceneInterrupt,
  getDialogSceneMode,
  getDialogScenePriority,
  type CharacterDialogActor,
  type CharacterDialogAdvance,
  type CharacterDialogOptions,
  type CharacterDialogScene,
  type CharacterDialogSceneId,
  type CharacterDialogStep,
} from './dialogLibrary';

export interface CharacterDialogEntry {
  id: number;
  actor: CharacterDialogActor;
  text: string;
  showCloseButton: boolean;
  closeOnMaskClick: boolean;
  autoCloseMs: number | null;
  holdMs: number;
  advance: CharacterDialogAdvance;
  sceneId: CharacterDialogSceneId;
  stepIndex: number;
  stepCount: number;
  canAdvance: boolean;
  phase: 'entering' | 'visible' | 'leaving';
}

export interface CharacterDialogController {
  activeDialog: CharacterDialogEntry | null;
  closeDialog: () => void;
  advanceDialog: () => void;
  playDialogScene: (sceneId: CharacterDialogSceneId, options?: CharacterDialogScenePlayOptions) => boolean;
}

interface CharacterDialogScenePlayOptions extends CharacterDialogOptions {
  force?: boolean;
}

interface CharacterDialogSequence {
  id: number;
  sceneId: CharacterDialogSceneId;
  priority: number;
  options: CharacterDialogOptions;
  steps: CharacterDialogStep[];
  stepIndex: number;
}

const DIALOG_LEAVE_ANIMATION_MS = 240;

let nextDialogId = 1;
let nextSequenceId = 1;

const lastSceneShownAt = new Map<string, number>();

export function useCharacterDialog(): CharacterDialogController {
  const [activeDialog, setActiveDialog] = useState<CharacterDialogEntry | null>(null);
  const activeSequenceRef = useRef<CharacterDialogSequence | null>(null);
  const queueRef = useRef<CharacterDialogSequence[]>([]);
  const startTimerRef = useRef<number | null>(null);
  const leaveTimerRef = useRef<number | null>(null);

  const clearStartTimer = useCallback(() => {
    if (startTimerRef.current !== null) {
      window.clearTimeout(startTimerRef.current);
      startTimerRef.current = null;
    }
  }, []);

  const clearLeaveTimer = useCallback(() => {
    if (leaveTimerRef.current !== null) {
      window.clearTimeout(leaveTimerRef.current);
      leaveTimerRef.current = null;
    }
  }, []);

  const showSequenceStep = useCallback((sequence: CharacterDialogSequence): boolean => {
    const step = sequence.steps[sequence.stepIndex];
    if (!step) {
      return false;
    }

    const scene = characterDialogScenes[sequence.sceneId];
    const actor = characterDialogActors[step.actorId];
    if (!actor) {
      return false;
    }

    const sceneDefaults = getDialogSceneDefaultOptions(scene);
    const advance = step.advance ?? getDialogSceneAdvance(scene);
    const autoCloseMs = step.autoCloseMs ?? sequence.options.autoCloseMs ?? sceneDefaults.autoCloseMs;

    setActiveDialog({
      id: nextDialogId,
      actor,
      text: step.text,
      showCloseButton: step.showCloseButton ?? sequence.options.showCloseButton ?? sceneDefaults.showCloseButton,
      closeOnMaskClick: step.closeOnMaskClick ?? sequence.options.closeOnMaskClick ?? sceneDefaults.closeOnMaskClick,
      autoCloseMs,
      holdMs: step.holdMs ?? sequence.options.holdMs ?? sceneDefaults.holdMs,
      advance,
      sceneId: sequence.sceneId,
      stepIndex: sequence.stepIndex,
      stepCount: sequence.steps.length,
      canAdvance: advance === 'click' || advance === 'auto-or-click',
      phase: 'entering',
    });
    nextDialogId += 1;
    return true;
  }, []);

  const startSequence = useCallback((sequence: CharacterDialogSequence, delayMs = 0): boolean => {
    clearStartTimer();
    activeSequenceRef.current = sequence;

    if (delayMs > 0) {
      startTimerRef.current = window.setTimeout(() => {
        startTimerRef.current = null;
        if (activeSequenceRef.current?.id === sequence.id && !showSequenceStep(sequence)) {
          activeSequenceRef.current = null;
        }
      }, delayMs);
      return true;
    }

    return showSequenceStep(sequence);
  }, [clearStartTimer, showSequenceStep]);

  const playNextQueuedSequence = useCallback(() => {
    const [nextSequence, ...remainingSequences] = queueRef.current;
    queueRef.current = remainingSequences;

    if (!nextSequence) {
      activeSequenceRef.current = null;
      setActiveDialog(null);
      return;
    }

    if (!startSequence(nextSequence)) {
      playNextQueuedSequence();
    }
  }, [startSequence]);

  const finishAfterLeaving = useCallback((nextAction: () => void) => {
    clearLeaveTimer();
    setActiveDialog((current) => current ? { ...current, phase: 'leaving' } : current);

    leaveTimerRef.current = window.setTimeout(() => {
      leaveTimerRef.current = null;
      setActiveDialog(null);
      nextAction();
    }, DIALOG_LEAVE_ANIMATION_MS);
  }, [clearLeaveTimer]);

  const closeDialog = useCallback(() => {
    clearStartTimer();
    activeSequenceRef.current = null;
    finishAfterLeaving(() => {
      playNextQueuedSequence();
    });
  }, [clearStartTimer, finishAfterLeaving, playNextQueuedSequence]);

  const advanceDialog = useCallback(() => {
    const sequence = activeSequenceRef.current;
    if (!sequence) {
      finishAfterLeaving(() => {
        playNextQueuedSequence();
      });
      return;
    }

    const nextSequence = {
      ...sequence,
      stepIndex: sequence.stepIndex + 1,
    };

    if (nextSequence.stepIndex >= nextSequence.steps.length) {
      activeSequenceRef.current = null;
      finishAfterLeaving(() => {
        playNextQueuedSequence();
      });
      return;
    }

    if (!startSequence(nextSequence)) {
      activeSequenceRef.current = null;
      finishAfterLeaving(() => {
        playNextQueuedSequence();
      });
    }
  }, [finishAfterLeaving, playNextQueuedSequence, startSequence]);

  const playDialogScene = useCallback((sceneId: CharacterDialogSceneId, options: CharacterDialogScenePlayOptions = {}) => {
    const scene = characterDialogScenes[sceneId];
    const steps = buildSceneSteps(scene);

    if (steps.length <= 0) {
      return false;
    }

    if (!options.force && !shouldPlayScene(scene)) {
      return false;
    }

    const sequence: CharacterDialogSequence = {
      id: nextSequenceId,
      sceneId,
      priority: getDialogScenePriority(scene),
      options,
      steps,
      stepIndex: 0,
    };
    nextSequenceId += 1;

    const interrupt = getDialogSceneInterrupt(scene);
    const activeSequence = activeSequenceRef.current;

    if (activeSequence) {
      if (interrupt === 'ignore') {
        return false;
      }

      if (interrupt === 'replace') {
        clearStartTimer();
        const shown = startSequence(sequence, getDialogSceneEnterDelayMs(scene));
        if (shown) {
          lastSceneShownAt.set(scene.id, Date.now());
        }
        return shown;
      }

      queueRef.current = [...queueRef.current, sequence].sort((left, right) => right.priority - left.priority || left.id - right.id);
      lastSceneShownAt.set(scene.id, Date.now());
      return true;
    }

    const shown = startSequence(sequence, getDialogSceneEnterDelayMs(scene));
    if (shown) {
      lastSceneShownAt.set(scene.id, Date.now());
    }
    return shown;
  }, [clearStartTimer, startSequence]);

  useEffect(() => {
    if (!activeDialog?.autoCloseMs || activeDialog.advance === 'click' || activeDialog.phase !== 'visible') {
      return;
    }

    const timeoutMs = Math.max(activeDialog.autoCloseMs, activeDialog.holdMs);
    const timer = window.setTimeout(() => {
      advanceDialog();
    }, timeoutMs);

    return () => {
      window.clearTimeout(timer);
    };
  }, [activeDialog, advanceDialog]);

  useEffect(() => {
    if (!activeDialog || activeDialog.phase !== 'entering') {
      return;
    }

    const timer = window.setTimeout(() => {
      setActiveDialog((current) => current?.id === activeDialog.id ? { ...current, phase: 'visible' } : current);
    }, 260);

    return () => {
      window.clearTimeout(timer);
    };
  }, [activeDialog]);

  useEffect(() => {
    return () => {
      clearStartTimer();
      clearLeaveTimer();
    };
  }, [clearLeaveTimer, clearStartTimer]);

  return useMemo(() => ({
    activeDialog,
    closeDialog,
    advanceDialog,
    playDialogScene,
  }), [activeDialog, advanceDialog, closeDialog, playDialogScene]);
}

function shouldPlayScene(scene: CharacterDialogScene): boolean {
  const cooldownMs = scene.cooldownMs ?? 0;

  if (cooldownMs > 0) {
    const lastShownAt = lastSceneShownAt.get(scene.id) ?? 0;
    if (Date.now() - lastShownAt < cooldownMs) {
      return false;
    }
  }

  const chance = clampChance(scene.chance ?? 1);
  return Math.random() <= chance;
}

function clampChance(value: number): number {
  if (!Number.isFinite(value)) {
    return 1;
  }

  return Math.min(Math.max(value, 0), 1);
}

function buildSceneSteps(scene: CharacterDialogScene): CharacterDialogStep[] {
  const steps = [...scene.steps];

  if (steps.length <= 1) {
    return steps;
  }

  const mode = getDialogSceneMode(scene);
  if (mode === 'sequence') {
    return steps;
  }

  if (mode === 'shuffle') {
    return shuffleSteps(steps);
  }

  return [steps[Math.floor(Math.random() * steps.length)] ?? steps[0]].filter(Boolean);
}

function shuffleSteps(steps: CharacterDialogStep[]): CharacterDialogStep[] {
  const nextSteps = [...steps];

  for (let index = nextSteps.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [nextSteps[index], nextSteps[swapIndex]] = [nextSteps[swapIndex], nextSteps[index]];
  }

  return nextSteps;
}
