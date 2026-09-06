import React, { useRef, useState } from 'react';
import { Animated, Image, PanResponder, StyleSheet } from 'react-native';
import { LAYOUT } from '../../constants/layout';

export interface DraggableImageProps {
  image: any;
  index: number;
  name: string;
  onDrop: (imageIndex: number, targetZoneIndex: number, sourceZoneIndex?: number) => boolean | void;
  onDragStart?: (sourceZoneIndex?: number) => void;
  onDragEnd?: () => void;
  disabled?: boolean;
  sourceZoneIndex?: number;
  checkDropZone: (x: number, y: number) => number;
  debug?: boolean;
}

export default function DraggableImage({
  image,
  index,
  name: imageName,
  onDrop,
  onDragStart,
  onDragEnd,
  disabled,
  sourceZoneIndex,
  checkDropZone,
  debug = false,
}: DraggableImageProps) {
  const pan = useRef(new Animated.ValueXY()).current;
  const [isDragging, setIsDragging] = useState(false);
  const disabledRef = useRef(disabled);
  disabledRef.current = disabled;

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => !disabledRef.current,
      onPanResponderGrant: () => {
        setIsDragging(true);
        onDragStart?.(sourceZoneIndex);
      },
      onPanResponderMove: Animated.event([null, { dx: pan.x, dy: pan.y }], { useNativeDriver: false }),
      onPanResponderRelease: (e, gestureState) => {
        const x = e.nativeEvent.pageX ?? gestureState.moveX;
        const y = e.nativeEvent.pageY ?? gestureState.moveY;
        const dropZoneIndex = checkDropZone(x, y);
        if (debug) {
          console.log('[DROP] release', {
            imageName,
            pageX: e.nativeEvent.pageX,
            pageY: e.nativeEvent.pageY,
            moveX: gestureState.moveX,
            moveY: gestureState.moveY,
            used: { x, y },
            dropZoneIndex,
          });
        }
        const consumed = onDrop(index, dropZoneIndex, sourceZoneIndex);
        if (consumed && sourceZoneIndex === undefined) {
          pan.setValue({ x: 0, y: 0 });
        } else {
          Animated.spring(pan, { toValue: { x: 0, y: 0 }, useNativeDriver: false }).start();
        }
        setIsDragging(false);
        onDragEnd?.();
      },
    })
  ).current;

  return (
    <Animated.View
      {...panResponder.panHandlers}
      accessible={true}
      accessibilityRole="imagebutton"
      // 순서 칸에 놓인 카드는 몇 번째인지까지 읽는다 (그리드에 있는 것은 이름만)
      accessibilityLabel={
        sourceZoneIndex !== undefined ? `${sourceZoneIndex + 1}번째 자리, ${imageName}` : imageName
      }
      accessibilityState={{ disabled: !!disabled }}
      accessibilityHint="끌어서 순서 칸에 놓습니다"
      style={[
        { transform: pan.getTranslateTransform() },
        styles.imageContainer,
        isDragging && { zIndex: 999, elevation: 999 },
      ]}
    >
      <Image source={image} style={[styles.image, disabled && { opacity: 0.3 }]} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  imageContainer: {
    width: LAYOUT.orderGameCardSize,
    height: LAYOUT.orderGameCardSize,
    justifyContent: 'center',
    alignItems: 'center',
  },
  image: {
    width: LAYOUT.orderGameImageSize,
    height: LAYOUT.orderGameImageSize,
  },
});
