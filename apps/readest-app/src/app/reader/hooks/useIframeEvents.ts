import { useEffect, useRef } from 'react';
import { useReaderStore } from '@/store/readerStore';
import { useBookDataStore } from '@/store/bookDataStore';
import { debounce } from '@/utils/debounce';
import { ScrollSource } from './usePagination';
import { saveViewSettings } from '@/helpers/settings';
import { useEnv } from '@/context/EnvContext';
import { MAX_ZOOM_LEVEL, MIN_ZOOM_LEVEL } from '@/services/constants';

export const useMouseEvent = (
  bookKey: string,
  handlePageFlip: (msg: MessageEvent | React.MouseEvent<HTMLDivElement, MouseEvent>) => void,
  handleContinuousScroll: (source: ScrollSource, delta: number, threshold: number) => void,
) => {
  const { hoveredBookKey } = useReaderStore();
  const debounceScroll = debounce(handleContinuousScroll, 500);
  const debounceFlip = debounce(handlePageFlip, 100);
  const handleMouseEvent = (msg: MessageEvent | React.MouseEvent<HTMLDivElement, MouseEvent>) => {
    if (msg instanceof MessageEvent) {
      if (msg.data && msg.data.bookKey === bookKey) {
        if (msg.data.type === 'iframe-wheel') {
          debounceScroll('mouse', -msg.data.deltaY, 0);
        }
        if (msg.data.type === 'iframe-wheel') {
          debounceFlip(msg);
        } else {
          handlePageFlip(msg);
        }
      }
    } else if (msg.type === 'wheel') {
      const event = msg as React.WheelEvent<HTMLDivElement>;
      debounceScroll('mouse', -event.deltaY, 0);
    } else {
      handlePageFlip(msg);
    }
  };

  useEffect(() => {
    window.addEventListener('message', handleMouseEvent);
    return () => {
      window.removeEventListener('message', handleMouseEvent);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookKey, hoveredBookKey]);

  return {
    onClick: handlePageFlip,
    onWheel: handleMouseEvent,
  };
};

interface IframeTouch {
  clientX: number;
  clientY: number;
  screenX: number;
  screenY: number;
}

interface IframeTouchEvent {
  timeStamp: number;
  targetTouches: IframeTouch[];
}

interface PinchState {
  initialDistance: number;
  initialZoomLevel: number;
  isPinching: boolean;
}

export const useTouchEvent = (
  bookKey: string,
  handlePageFlip: (msg: CustomEvent) => void,
  handleContinuousScroll: (source: ScrollSource, delta: number, threshold: number) => void,
) => {
  const { envConfig } = useEnv();
  const { getBookData } = useBookDataStore();
  const { hoveredBookKey, setHoveredBookKey, getViewSettings, getView, setViewSettings } = useReaderStore();

  const touchStartRef = useRef<IframeTouch | null>(null);
  const touchEndRef = useRef<IframeTouch | null>(null);
  const touchStartTimeRef = useRef<number | null>(null);
  const touchEndTimeRef = useRef<number | null>(null);
  const pinchStateRef = useRef<PinchState | null>(null);

  // Helper function to calculate distance between two touch points
  const getTouchDistance = (touch1: IframeTouch, touch2: IframeTouch): number => {
    const dx = touch2.clientX - touch1.clientX;
    const dy = touch2.clientY - touch1.clientY;
    return Math.sqrt(dx * dx + dy * dy);
  };

  const onTouchStart = (e: IframeTouchEvent | React.TouchEvent<HTMLDivElement>) => {
    const touches = e.targetTouches;
    if (!touches || touches.length === 0) return;

    // Store first touch for single-touch gestures
    touchStartRef.current = touches[0];
    touchStartTimeRef.current = 'timeStamp' in e ? e.timeStamp : Date.now();

    // Check for pinch gesture (two fingers)
    if (touches.length === 2) {
      const bookData = getBookData(bookKey);
      const viewSettings = getViewSettings(bookKey);

      // Only enable pinch-to-zoom for fixed layout (PDF/CBZ)
      if (bookData?.isFixedLayout && viewSettings) {
        const distance = getTouchDistance(touches[0], touches[1]);
        pinchStateRef.current = {
          initialDistance: distance,
          initialZoomLevel: viewSettings.zoomLevel,
          isPinching: true,
        };
      }
    } else {
      // Reset pinch state if not two fingers
      pinchStateRef.current = null;
    }
  };

  const onTouchMove = (e: IframeTouchEvent | React.TouchEvent<HTMLDivElement>) => {
    if (!touchStartRef.current) return;

    const touches = e.targetTouches;

    // Handle pinch-to-zoom for two-finger gestures
    if (touches && touches.length === 2 && pinchStateRef.current?.isPinching) {
      const bookData = getBookData(bookKey);
      const viewSettings = getViewSettings(bookKey);

      if (bookData?.isFixedLayout && viewSettings) {
        const currentDistance = getTouchDistance(touches[0], touches[1]);
        const { initialDistance, initialZoomLevel } = pinchStateRef.current;

        // Calculate zoom scale based on pinch distance change
        const scale = currentDistance / initialDistance;
        let newZoomLevel = Math.round(initialZoomLevel * scale);

        // Clamp zoom level to min/max bounds
        newZoomLevel = Math.max(MIN_ZOOM_LEVEL, Math.min(MAX_ZOOM_LEVEL, newZoomLevel));

        // Apply zoom immediately for smooth feedback
        if (newZoomLevel !== viewSettings.zoomLevel) {
          viewSettings.zoomLevel = newZoomLevel;
          viewSettings.zoomMode = 'custom';
          setViewSettings(bookKey, viewSettings);
          getView(bookKey)?.renderer.setAttribute('scale-factor', newZoomLevel);
          getView(bookKey)?.renderer.setAttribute('zoom', 'custom');
        }
      }
      return; // Don't process single-touch gestures during pinch
    }

    // If we were pinching but now only have 1 finger, end the pinch gesture
    if (pinchStateRef.current?.isPinching && touches && touches.length === 1) {
      const viewSettings = getViewSettings(bookKey);
      const bookData = getBookData(bookKey);

      if (viewSettings && bookData?.isFixedLayout) {
        // Persist zoom level changes
        saveViewSettings(envConfig, bookKey, 'zoomLevel', viewSettings.zoomLevel, true, true);
        saveViewSettings(envConfig, bookKey, 'zoomMode', 'custom', true, false);
      }

      // Reset pinch state
      pinchStateRef.current = null;
    }

    // Handle single-touch gestures
    const touch = touches?.[0];
    if (touch) {
      touchEndRef.current = touch;
      touchEndTimeRef.current = 'timeStamp' in e ? e.timeStamp : Date.now();
    }
    const { current: touchStart } = touchStartRef;
    const { current: touchEnd } = touchEndRef;
    if (hoveredBookKey && touchEnd) {
      const viewSettings = getViewSettings(bookKey)!;
      const deltaY = touchEnd.screenY - touchStart.screenY;
      const deltaX = touchEnd.screenX - touchStart.screenX;
      if (!viewSettings!.scrolled && !viewSettings!.vertical) {
        if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 10) {
          setHoveredBookKey(null);
        }
      } else {
        setHoveredBookKey(null);
      }
    }
  };

  const onTouchEnd = (e: IframeTouchEvent | React.TouchEvent<HTMLDivElement>) => {
    if (!touchStartRef.current) return;

    // If we were pinching, save the zoom level and reset pinch state
    if (pinchStateRef.current?.isPinching) {
      const viewSettings = getViewSettings(bookKey);
      const bookData = getBookData(bookKey);

      if (viewSettings && bookData?.isFixedLayout) {
        // Persist zoom level changes
        saveViewSettings(envConfig, bookKey, 'zoomLevel', viewSettings.zoomLevel, true, true);
        saveViewSettings(envConfig, bookKey, 'zoomMode', 'custom', true, false);
      }

      // Reset pinch state
      pinchStateRef.current = null;

      // Don't process as a swipe if we were pinching
      touchStartRef.current = null;
      touchEndRef.current = null;
      return;
    }

    const touch = e.targetTouches[0];
    if (touch) {
      touchEndRef.current = touch;
      touchEndTimeRef.current = 'timeStamp' in e ? e.timeStamp : Date.now();
    }

    const windowWidth = window.innerWidth;
    const { current: touchStart } = touchStartRef;
    const { current: touchEnd } = touchEndRef;
    const { current: touchStartTime } = touchStartTimeRef;
    const { current: touchEndTime } = touchEndTimeRef;
    if (touchEnd) {
      const viewSettings = getViewSettings(bookKey)!;
      const bookData = getBookData(bookKey)!;
      const deltaY = touchEnd.screenY - touchStart.screenY;
      const deltaX = touchEnd.screenX - touchStart.screenX;
      const deltaT = touchEndTime && touchStartTime ? touchEndTime - touchStartTime : 0;
      // also check for deltaX to prevent swipe page turn from triggering the toggle
      if (
        deltaY < -10 &&
        Math.abs(deltaY) > Math.abs(deltaX) * 2 &&
        Math.abs(deltaX) < windowWidth * 0.3
      ) {
        // swipe up to toggle the header bar and the footer bar, only for horizontal page mode
        if (
          !viewSettings!.scrolled && // not scrolled
          !viewSettings!.vertical && // not vertical
          (!bookData.isFixedLayout || viewSettings.zoomLevel <= 100) // for fixed layout, not when zoomed in
        ) {
          setHoveredBookKey(hoveredBookKey ? null : bookKey);
        }
      } else {
        if (hoveredBookKey) {
          setHoveredBookKey(null);
        }
      }
      handlePageFlip(
        new CustomEvent('touch-swipe', {
          detail: {
            deltaX,
            deltaY,
            deltaT,
            startX: touchStart.screenX,
            startY: touchStart.screenY,
            endX: touchEnd.screenX,
            endY: touchEnd.screenY,
          },
        }),
      );
      handleContinuousScroll('touch', deltaY, 30);
    }

    touchStartRef.current = null;
    touchEndRef.current = null;
  };

  const handleTouch = (msg: MessageEvent) => {
    if (msg.data && msg.data.bookKey === bookKey) {
      if (msg.data.type === 'iframe-touchstart') {
        onTouchStart(msg.data);
      } else if (msg.data.type === 'iframe-touchmove') {
        onTouchMove(msg.data);
      } else if (msg.data.type === 'iframe-touchend') {
        onTouchEnd(msg.data);
      }
    }
  };

  useEffect(() => {
    window.addEventListener('message', handleTouch);
    return () => {
      window.removeEventListener('message', handleTouch);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hoveredBookKey]);

  return {
    onTouchStart,
    onTouchMove,
    onTouchEnd,
  };
};
