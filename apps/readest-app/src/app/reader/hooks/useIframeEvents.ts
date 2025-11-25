import { useEffect, useRef } from 'react';
import { useReaderStore } from '@/store/readerStore';
import { useBookDataStore } from '@/store/bookDataStore';
import { debounce } from '@/utils/debounce';
import { ScrollSource } from './usePagination';

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

export const useTouchEvent = (
  bookKey: string,
  handlePageFlip: (msg: CustomEvent) => void,
  handleContinuousScroll: (source: ScrollSource, delta: number, threshold: number) => void,
) => {
  const { getBookData } = useBookDataStore();
  const { hoveredBookKey, setHoveredBookKey, getViewSettings } = useReaderStore();

  const touchStartRef = useRef<IframeTouch | null>(null);
  const touchEndRef = useRef<IframeTouch | null>(null);
  const touchStartTimeRef = useRef<number | null>(null);
  const touchEndTimeRef = useRef<number | null>(null);
  const isScrollingRef = useRef<boolean>(false);
  const scrollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const onTouchStart = (e: IframeTouchEvent | React.TouchEvent<HTMLDivElement>) => {
    const touch = e.targetTouches[0];
    if (!touch) return;
    touchStartRef.current = touch;
    touchStartTimeRef.current = 'timeStamp' in e ? e.timeStamp : Date.now();
  };

  const onTouchMove = (e: IframeTouchEvent | React.TouchEvent<HTMLDivElement>) => {
    if (!touchStartRef.current) return;
    const touch = e.targetTouches[0];
    if (touch) {
      touchEndRef.current = touch;
      touchEndTimeRef.current = 'timeStamp' in e ? e.timeStamp : Date.now();
    }
    const { current: touchStart } = touchStartRef;
    const { current: touchEnd } = touchEndRef;

    // Mark as scrolling when user moves their finger
    if (touchEnd) {
      const viewSettings = getViewSettings(bookKey);
      const scrollThreshold = viewSettings?.gestureScrollThreshold ?? 5;
      const scrollTimeout = viewSettings?.gestureScrollTimeout ?? 150;

      const deltaY = Math.abs(touchEnd.screenY - touchStart.screenY);
      const deltaX = Math.abs(touchEnd.screenX - touchStart.screenX);
      // Consider it scrolling if movement exceeds threshold
      if (deltaY > scrollThreshold || deltaX > scrollThreshold) {
        isScrollingRef.current = true;

        // Clear any existing timeout
        if (scrollTimeoutRef.current) {
          clearTimeout(scrollTimeoutRef.current);
        }

        // Reset scrolling state after movement stops
        scrollTimeoutRef.current = setTimeout(() => {
          isScrollingRef.current = false;
        }, scrollTimeout);
      }
    }

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

      // Check if user was actively scrolling
      const wasScrolling = isScrollingRef.current;

      // also check for deltaX to prevent swipe page turn from triggering the toggle
      if (
        deltaY < -10 &&
        Math.abs(deltaY) > Math.abs(deltaX) * 2 &&
        Math.abs(deltaX) < windowWidth * 0.3 &&
        !wasScrolling // Don't toggle menu if user was scrolling
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
        if (hoveredBookKey && !wasScrolling) {
          setHoveredBookKey(null);
        }
      }

      // Don't handle page flip if user was scrolling
      if (!wasScrolling) {
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
      }
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
