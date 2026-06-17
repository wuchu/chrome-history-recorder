import { useState, useRef, useEffect } from 'react';
import styles from './ScrollableTabBar.module.css';

export interface Tab {
  id: string;
  label: string;
  count?: number;
}

interface ScrollableTabBarProps {
  tabs: Tab[];
  activeTabId: string;
  onTabChange: (tabId: string) => void;
}

export default function ScrollableTabBar({
  tabs,
  activeTabId,
  onTabChange,
}: ScrollableTabBarProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [showLeftArrow, setShowLeftArrow] = useState(false);
  const [showRightArrow, setShowRightArrow] = useState(true);

  const checkScrollPosition = () => {
    const container = scrollContainerRef.current;
    if (!container) return;

    setShowLeftArrow(container.scrollLeft > 5);
    setShowRightArrow(container.scrollLeft < container.scrollWidth - container.clientWidth - 5);
  };

  useEffect(() => {
    checkScrollPosition();
    window.addEventListener('resize', checkScrollPosition);
    return () => window.removeEventListener('resize', checkScrollPosition);
  }, [tabs]);

  const scrollLeft = () => {
    const container = scrollContainerRef.current;
    if (container) {
      container.scrollBy({ left: -200, behavior: 'smooth' });
    }
  };

  const scrollRight = () => {
    const container = scrollContainerRef.current;
    if (container) {
      container.scrollBy({ left: 200, behavior: 'smooth' });
    }
  };

  return (
    <div className={styles.container}>
      {showLeftArrow && (
        <button
          className={`${styles.arrowButton} ${styles.leftArrow}`}
          onClick={scrollLeft}
          aria-label="Scroll left"
        >
          ←
        </button>
      )}
      <div className={styles.tabsContainer} ref={scrollContainerRef} onScroll={checkScrollPosition}>
        {tabs.map((tab) => (
          <button
            key={tab.id}
            className={`${styles.tabButton} ${activeTabId === tab.id ? styles.active : ''}`}
            onClick={() => onTabChange(tab.id)}
          >
            {tab.label}
            {tab.count !== undefined && <span className={styles.tabCount}>{tab.count}</span>}
          </button>
        ))}
      </div>
      {showRightArrow && (
        <button
          className={`${styles.arrowButton} ${styles.rightArrow}`}
          onClick={scrollRight}
          aria-label="Scroll right"
        >
          →
        </button>
      )}
    </div>
  );
}
