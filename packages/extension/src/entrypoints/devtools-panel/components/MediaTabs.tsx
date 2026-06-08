import { memo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import styles from './MediaTabs.module.css';

type ActiveTab = 'images' | 'videos';

interface MediaTabsProps {
  activeTab: ActiveTab;
  onTabChange: (tab: ActiveTab) => void;
  imageCount: number;
  videoCount: number;
}

/**
 * 媒体标签切换组件
 * 规则: rerender-memo - 使用 memo 避免不必要的重渲染
 */
const MediaTabs = memo(function MediaTabs({
  activeTab,
  onTabChange,
  imageCount,
  videoCount,
}: MediaTabsProps) {
  const { t } = useTranslation();

  const handleImagesClick = useCallback(() => onTabChange('images'), [onTabChange]);
  const handleVideosClick = useCallback(() => onTabChange('videos'), [onTabChange]);

  return (
    <div className={styles.container}>
      <button
        className={`${styles.tabButton} ${activeTab === 'images' ? styles.active : ''}`}
        onClick={handleImagesClick}
      >
        {t('stats.images')} {imageCount}
      </button>
      <button
        className={`${styles.tabButton} ${activeTab === 'videos' ? styles.active : ''}`}
        onClick={handleVideosClick}
      >
        {t('stats.videos')} {videoCount}
      </button>
    </div>
  );
});

export default MediaTabs;
