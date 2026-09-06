import React, { forwardRef, useCallback, useImperativeHandle, useRef } from 'react';
import { StyleProp, StyleSheet, ViewStyle } from 'react-native';
import Rive, { Fit, RiveRef } from 'rive-react-native';

const STATE_MACHINE = 'AnimalStatus';

type TriggerName = 'isCorrect' | 'isError';

/** 담아 둔 트리거. 쏘는 시점을 부른 쪽이 알아야 해서 알림을 함께 든다 */
type PendingTrigger = { name: TriggerName; onFired?: () => void };

export interface RiveAnimalGameRef {
  /** `onFired`는 **실제로 쏜 순간** 불린다 — 담겼다 나가는 경우 `onPlay` 시점이다 */
  triggerCorrect: (onFired?: () => void) => void;
  triggerError: (onFired?: () => void) => void;
}

interface RiveAnimalGameProps {
  style?: StyleProp<ViewStyle>;
  /** Rive 로드 후 재생 시작 시 한 번 적용할 동물 인덱스 (예: 12 = 투명) */
  initialAnimalIndex?: number;
}

const RiveAnimalGame = forwardRef<RiveAnimalGameRef, RiveAnimalGameProps>(
  ({ style, initialAnimalIndex }, ref) => {
    const riveRef = useRef<RiveRef>(null);
    const hasSetInitialIndex = useRef(false);
    // 상태머신이 붙기 전에 들어온 트리거는 여기 담았다가 onPlay에서 쏜다.
    // 담지 않으면 fireState가 조용히 사라져 모션이 통째로 빠진다.
    const isStateMachineReady = useRef(false);
    const pendingTriggers = useRef<PendingTrigger[]>([]);

    const fire = useCallback((name: TriggerName, onFired?: () => void) => {
      if (!isStateMachineReady.current) {
        pendingTriggers.current.push({ name, onFired });
        return;
      }
      riveRef.current?.fireState(STATE_MACHINE, name);
      onFired?.();
    }, []);

    const triggerCorrect = useCallback(
      (onFired?: () => void) => fire('isCorrect', onFired),
      [fire],
    );
    const triggerError = useCallback(
      (onFired?: () => void) => fire('isError', onFired),
      [fire],
    );

    useImperativeHandle(ref, () => ({
      triggerCorrect,
      triggerError,
    }), [triggerCorrect, triggerError]);

    const onPlay = useCallback(
      (_animationName: string, isStateMachine: boolean) => {
        if (!isStateMachine) return;
        isStateMachineReady.current = true;

        // 동물 인덱스를 트리거보다 먼저 넣는다 — 순서가 바뀌면 이전 동물이 모션을 탄다.
        if (initialAnimalIndex !== undefined && !hasSetInitialIndex.current) {
          hasSetInitialIndex.current = true;
          riveRef.current?.setInputState(STATE_MACHINE, 'animalIndex', initialAnimalIndex);
        }

        if (pendingTriggers.current.length > 0) {
          const queued = pendingTriggers.current;
          pendingTriggers.current = [];
          queued.forEach(({ name, onFired }) => {
            riveRef.current?.fireState(STATE_MACHINE, name);
            onFired?.();
          });
        }
      },
      [initialAnimalIndex]
    );

    return (
      <Rive
        ref={riveRef}
        resourceName="animals_motion"
        stateMachineName={STATE_MACHINE}
        autoplay
        fit={Fit.Contain}
        style={StyleSheet.flatten([styles.container, style]) as ViewStyle}
        onPlay={onPlay}
      />
    );
  },
);

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'transparent',
  },
});

export default RiveAnimalGame;
