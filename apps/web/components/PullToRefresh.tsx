'use client';

import { useEffect, useRef, useState } from 'react';
import { RefreshCw } from 'lucide-react';

// Pull distance (in css px) at which we commit a refresh on release.
const THRESHOLD = 70;
// Hard cap so the indicator doesn't fly off-screen.
const MAX_PULL = 130;
// Damping factor — finger-pixel → indicator-pixel.
const DAMPING = 0.5;

// Always-on, app-wide pull-to-refresh.
// Activates only when:
//   - touch device
//   - scrolled to top of the document (window.scrollY === 0)
//   - the gesture didn't start inside a horizontal scroller (carousel)
//   - not currently refreshing
export function PullToRefresh() {
  const [pull, setPull] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  // Refs are needed because the touch handlers are bound once;
  // we keep the live state out of the React closure.
  const startY = useRef(0);
  const startX = useRef(0);
  const currentPull = useRef(0);
  const tracking = useRef(false);
  const ignored = useRef(false);
  const refreshingRef = useRef(false);

  useEffect(() => { refreshingRef.current = refreshing; }, [refreshing]);

  useEffect(() => {
    function isInsideHorizontalScroller(target: EventTarget | null): boolean {
      let el: HTMLElement | null = target as HTMLElement | null;
      while (el && el !== document.body) {
        // Skip overlay containers — they're usually full-screen and we still want PTR
        if (el.dataset?.noPtr === 'true') return true;
        // If any ancestor scrolls horizontally, treat as scroller (carousel etc)
        const style = window.getComputedStyle(el);
        const overflowX = style.overflowX;
        if ((overflowX === 'auto' || overflowX === 'scroll') && el.scrollWidth > el.clientWidth) {
          return true;
        }
        el = el.parentElement;
      }
      return false;
    }

    function onTouchStart(e: TouchEvent) {
      if (refreshingRef.current) return;
      if (window.scrollY > 0) return;
      if (e.touches.length !== 1) return;
      if (isInsideHorizontalScroller(e.target)) {
        ignored.current = true;
        return;
      }
      ignored.current = false;
      startY.current = e.touches[0].clientY;
      startX.current = e.touches[0].clientX;
      tracking.current = true;
      currentPull.current = 0;
    }

    function onTouchMove(e: TouchEvent) {
      if (!tracking.current || ignored.current) return;
      const t = e.touches[0];
      const dy = t.clientY - startY.current;
      const dx = t.clientX - startX.current;

      // Cancel if user is mostly swiping horizontally (e.g. for a slider)
      if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 12) {
        tracking.current = false;
        currentPull.current = 0;
        setPull(0);
        return;
      }

      if (dy <= 0) {
        if (currentPull.current !== 0) { currentPull.current = 0; setPull(0); }
        return;
      }

      // We're pulling down at the top of the page → take over the gesture
      const damped = Math.min(dy * DAMPING, MAX_PULL);
      currentPull.current = damped;
      setPull(damped);

      // Prevent the body's natural scroll while we own the pull
      if (e.cancelable && damped > 4) e.preventDefault();
    }

    function onTouchEnd() {
      if (!tracking.current) return;
      tracking.current = false;
      const final = currentPull.current;
      if (final >= THRESHOLD) {
        setRefreshing(true);
        setPull(THRESHOLD); // park indicator at the threshold while refreshing
        // Small delay so the user sees the spinner kick in before the page reloads
        setTimeout(() => {
          try { window.location.reload(); } catch {}
        }, 250);
      } else {
        setPull(0);
        currentPull.current = 0;
      }
    }

    // touchmove must be `passive: false` so we can preventDefault when actively pulling.
    window.addEventListener('touchstart', onTouchStart, { passive: true });
    window.addEventListener('touchmove', onTouchMove, { passive: false });
    window.addEventListener('touchend', onTouchEnd);
    window.addEventListener('touchcancel', onTouchEnd);

    return () => {
      window.removeEventListener('touchstart', onTouchStart);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', onTouchEnd);
      window.removeEventListener('touchcancel', onTouchEnd);
    };
  }, []);

  if (pull === 0 && !refreshing) return null;

  const progress = Math.min(pull / THRESHOLD, 1);
  // Indicator follows the pull (with extra damping)
  const indicatorY = Math.min(pull * 0.7, 60);
  const opacity = refreshing ? 1 : Math.min(pull / 24, 1);

  return (
    <div
      aria-hidden="true"
      className="fixed left-1/2 z-[60] pointer-events-none"
      style={{
        top: 'calc(env(safe-area-inset-top, 0) + 8px)',
        transform: `translate(-50%, ${indicatorY}px)`,
        opacity,
        transition: tracking.current ? 'none' : 'transform 0.25s ease-out, opacity 0.2s',
      }}
    >
      <div className="w-10 h-10 rounded-full bg-white shadow-md border border-border flex items-center justify-center">
        <RefreshCw
          size={18}
          className={refreshing ? 'animate-spin text-accent' : 'text-accent'}
          style={
            refreshing
              ? undefined
              : {
                  transform: `rotate(${progress * 270}deg)`,
                  transition: tracking.current ? 'none' : 'transform 0.2s',
                }
          }
        />
      </div>
    </div>
  );
}
