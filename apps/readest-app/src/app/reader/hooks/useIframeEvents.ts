import { useEffect, useRef } from 'react';
import { useReaderStore } from '@/store/readerStore';
import { useBookDataStore } from '@/store/bookDataStore';
import { debounce } from '@/utils/debounce';
import { ScrollSource } from './usePagination';
import { MAX_ZOOM_LEVEL, MIN_ZOOM_LEVEL } from '@/services/constants';
import { getStyles } from '@/utils/style';
import { saveViewSettings } from '@/helpers/settings';
import { useEnv } from '@/context/EnvContext';

export const useMouseEvent = (
  bookKey: string,
  handlePageFlip: (msg: MessageEvent | React.MouseEvent<HTMLDivElement, MouseEvent>) => void,
  handleContinuousScroll: (source: ScrollSource, delta: number, threshold: number) => void,
) => {
  const { envConfig } = useEnv();
  const { hoveredBookKey, getViewSettings, setViewSettings, getView } = useReaderStore();
  const { getBookData } = useBookDataStore();
  const debounceScroll = debounce(handleContinuousScroll, 500);
  const debounceFlip = debounce(handlePageFlip, 100);

  const handleWheelZoom = (deltaY: number, ctrlKey: boolean, metaKey: boolean) => {
    // Ctrl+Wheel or Cmd+Wheel (on Mac) to zoom
    if (!ctrlKey && !metaKey) return false;

    const bookData = getBookData(bookKey);
    if (!bookData?.isFixedLayout) return false;

    const viewSettings = getViewSettings(bookKey);
    if (!viewSettings) return false;

    // Determine zoom direction (negative deltaY = zoom in, positive = zoom out)
    const zoomDelta = deltaY > 0 ? -10 : 10;
    const newZoomLevel = Math.max(MIN_ZOOM_LEVEL, Math.min(MAX_ZOOM_LEVEL, viewSettings.zoomLevel + zoomDelta));

    if (newZoomLevel !== viewSettings.zoomLevel) {
      viewSettings.zoomLevel = newZoomLevel;
      viewSettings.zoomMode = 'custom';
      setViewSettings(bookKey, viewSettings);

      const view = getView(bookKey);
      if (view?.renderer) {
        view.renderer.setStyles?.(getStyles(viewSettings));
        view.renderer.setAttribute('scale-factor', newZoomLevel);
        view.renderer.setAttribute('zoom', 'custom');
      }

      // Save to persistent storage
      saveViewSettings(envConfig, bookKey, 'zoomLevel', newZoomLevel, true, false);
      saveViewSettings(envConfig, bookKey, 'zoomMode', 'custom', true, false);
    }

    return true; // Event was handled
  };

  const handleMouseEvent = (msg: MessageEvent | React.MouseEvent<HTMLDivElement, MouseEvent>) => {
    if (msg instanceof MessageEvent) {
      if (msg.data && msg.data.bookKey === bookKey) {
        if (msg.data.type === 'iframe-wheel') {
          // Check if this is a zoom gesture
          if (handleWheelZoom(msg.data.deltaY, msg.data.ctrlKey, msg.data.metaKey)) {
            return; // Zoom handled, don't process as scroll/flip
          }
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
      // Check if this is a zoom gesture
      if (handleWheelZoom(event.deltaY, event.ctrlKey, event.metaKey)) {
        return; // Zoom handled, don't process as scroll
      }
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

export const useTouchEvent = (
  bookKey: string,
  handlePageFlip: (msg: CustomEvent) => void,
  handleContinuousScroll: (source: ScrollSource, delta: number, threshold: number) => void,
) => {
  const { envConfig } = useEnv();
  const { getBookData } = useBookDataStore();
  const { hoveredBookKey, setHoveredBookKey, getViewSettings, setViewSettings, getView } = useReaderStore();

  const touchStartRef = useRef<IframeTouch | null>(null);
  const touchEndRef = useRef<IframeTouch | null>(null);
  const touchStartTimeRef = useRef<number | null>(null);
  const touchEndTimeRef = useRef<number | null>(null);

  // Pinch-to-zoom state
  const initialPinchDistanceRef = useRef<number | null>(null);
  const initialZoomLevelRef = useRef<number>(100);
  const isPinchingRef = useRef<boolean>(false);

  // Calculate distance between two touch points
  const getTouchDistance = (touch1: IframeTouch, touch2: IframeTouch): number => {
    const dx = touch2.screenX - touch1.screenX;
    const dy = touch2.screenY - touch1.screenY;
    return Math.sqrt(dx * dx + dy * dy);
  };

  const onTouchStart = (e: IframeTouchEvent | React.TouchEvent<HTMLDivElement>) => {
    const touches = e.targetTouches;

    // Handle pinch-to-zoom (two fingers)
    if (touches.length === 2) {
      const bookData = getBookData(bookKey);
      if (bookData?.isFixedLayout) {
        isPinchingRef.current = true;
        initialPinchDistanceRef.current = getTouchDistance(touches[0], touches[1]);
        const viewSettings = getViewSettings(bookKey);
        initialZoomLevelRef.current = viewSettings?.zoomLevel ?? 100;
      }
      return;
    }

    // Handle single touch (existing behavior)
    const touch = touches[0];
    if (!touch) return;
    touchStartRef.current = touch;
    touchStartTimeRef.current = 'timeStamp' in e ? e.timeStamp : Date.now();
  };

  const onTouchMove = (e: IframeTouchEvent | React.TouchEvent<HTMLDivElement>) => {
    const touches = e.targetTouches;

    // Handle pinch-to-zoom
    if (isPinchingRef.current && touches.length === 2) {
      const bookData = getBookData(bookKey);
      if (!bookData?.isFixedLayout) return;

      const currentDistance = getTouchDistance(touches[0], touches[1]);
      const initialDistance = initialPinchDistanceRef.current;

      if (initialDistance && initialDistance > 0) {
        // Calculate zoom scale based on pinch distance change
        const scale = currentDistance / initialDistance;
        const newZoomLevel = Math.round(initialZoomLevelRef.current * scale);

        // Apply zoom level constraints
        const constrainedZoomLevel = Math.max(MIN_ZOOM_LEVEL, Math.min(MAX_ZOOM_LEVEL, newZoomLevel));

        // Apply zoom if changed
        const viewSettings = getViewSettings(bookKey);
        if (viewSettings && viewSettings.zoomLevel !== constrainedZoomLevel) {
          viewSettings.zoomLevel = constrainedZoomLevel;
          viewSettings.zoomMode = 'custom';
          setViewSettings(bookKey, viewSettings);

          const view = getView(bookKey);
          if (view?.renderer) {
            view.renderer.setStyles?.(getStyles(viewSettings));
            view.renderer.setAttribute('scale-factor', constrainedZoomLevel);
            view.renderer.setAttribute('zoom', 'custom');
          }
        }
      }
      return;
    }

    // Handle single touch (existing behavior)
    if (!touchStartRef.current) return;
    const touch = touches[0];
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
    // Handle pinch-to-zoom end
    if (isPinchingRef.current) {
      isPinchingRef.current = false;
      initialPinchDistanceRef.current = null;

      // Save the final zoom level to persistent storage
      const viewSettings = getViewSettings(bookKey);
      if (viewSettings) {
        saveViewSettings(envConfig, bookKey, 'zoomLevel', viewSettings.zoomLevel, true, false);
        saveViewSettings(envConfig, bookKey, 'zoomMode', viewSettings.zoomMode, true, false);
      }
      return;
    }

    if (!touchStartRef.current) return;

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
