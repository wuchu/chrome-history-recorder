import { memo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import styles from './ConfigSection.module.css';

type ThemeMode = 'auto' | 'light' | 'dark';

interface VideoTypes {
  mp4: boolean;
  webm: boolean;
  mov: boolean;
  avi: boolean;
}

interface ConfigSectionProps {
  themeMode: ThemeMode;
  storagePath: string;
  proxyEndpoint: string;
  minImageSizeKB: number;
  minVideoSizeMB: number;
  videoTypes: VideoTypes;
  serviceOnline: boolean;
  onThemeChange: (mode: ThemeMode) => void;
  onStoragePathChange: (path: string) => void;
  onProxyEndpointChange: (endpoint: string) => void;
  onMinImageSizeChange: (size: number) => void;
  onMinVideoSizeChange: (size: number) => void;
  onVideoTypesChange: (types: VideoTypes) => void;
  onSaveStoragePath: () => void;
  onSaveProxyEndpoint: () => void;
  onSaveImageFilters: () => void;
  onSaveVideoFilters: () => void;
}

/**
 * 配置面板组件
 * 语言跟随 Chrome DevTools，无需配置
 */
const ConfigSection = memo(function ConfigSection({
  themeMode,
  storagePath,
  proxyEndpoint,
  minImageSizeKB,
  minVideoSizeMB,
  videoTypes,
  serviceOnline,
  onThemeChange,
  onStoragePathChange,
  onProxyEndpointChange,
  onMinImageSizeChange,
  onMinVideoSizeChange,
  onVideoTypesChange,
  onSaveStoragePath,
  onSaveProxyEndpoint,
  onSaveImageFilters,
  onSaveVideoFilters,
}: ConfigSectionProps) {
  const { t } = useTranslation();

  const handleVideoTypeChange = useCallback(
    (type: keyof VideoTypes, checked: boolean) => {
      onVideoTypesChange({ ...videoTypes, [type]: checked });
    },
    [videoTypes, onVideoTypesChange]
  );

  const handleThemeChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      onThemeChange(e.target.value as ThemeMode);
    },
    [onThemeChange]
  );

  const handleStoragePathChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      onStoragePathChange(e.target.value);
    },
    [onStoragePathChange]
  );

  const handleProxyEndpointChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      onProxyEndpointChange(e.target.value);
    },
    [onProxyEndpointChange]
  );

  const handleMinImageSizeChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      onMinImageSizeChange(Number(e.target.value));
    },
    [onMinImageSizeChange]
  );

  const handleMinVideoSizeChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      onMinVideoSizeChange(Number(e.target.value));
    },
    [onMinVideoSizeChange]
  );

  return (
    <div className={styles.container}>
      <h3 className={styles.title}>{t('config.title')}</h3>

      {/* Theme setting */}
      <div className={styles.configItem}>
        <label className={styles.label}>{t('theme.label')}:</label>
        <select value={themeMode} onChange={handleThemeChange} className={styles.select}>
          <option value="auto">{t('theme.auto')}</option>
          <option value="light">{t('theme.light')}</option>
          <option value="dark">{t('theme.dark')}</option>
        </select>
      </div>

      <div className={styles.divider}></div>

      <div className={styles.configItem}>
        <label className={styles.label}>{t('config.storagePath')}:</label>
        <input
          type="text"
          value={storagePath}
          onChange={handleStoragePathChange}
          placeholder="~/Downloads/chrome-history"
          className={styles.textInput}
        />
        <button onClick={onSaveStoragePath} disabled={!serviceOnline} className={styles.button}>
          {t('config.save')}
        </button>
      </div>
      <div className={styles.configItem}>
        <label className={styles.label}>{t('config.proxyEndpoint')}:</label>
        <input
          type="text"
          value={proxyEndpoint}
          onChange={handleProxyEndpointChange}
          placeholder="http://localhost:3777"
          className={styles.textInput}
        />
        <button onClick={onSaveProxyEndpoint} className={styles.button}>
          {t('config.apply')}
        </button>
      </div>

      <h4 className={styles.subTitle}>{t('config.imageFilter')}</h4>
      <div className={styles.configItem}>
        <label className={styles.label}>{t('config.minSize')}:</label>
        <input
          type="number"
          value={minImageSizeKB}
          onChange={handleMinImageSizeChange}
          placeholder="10"
          min="1"
          className={styles.numberInput}
        />
        <span className={styles.unit}>KB</span>
        <button onClick={onSaveImageFilters} className={styles.button}>
          {t('config.apply')}
        </button>
      </div>

      <h4 className={styles.subTitle}>{t('config.videoFilter')}</h4>
      <div className={styles.configItem}>
        <label className={styles.label}>{t('config.minSize')}:</label>
        <input
          type="number"
          value={minVideoSizeMB}
          onChange={handleMinVideoSizeChange}
          placeholder="1"
          min="0.1"
          step="0.1"
          className={styles.numberInput}
        />
        <span className={styles.unit}>MB</span>
        <button onClick={onSaveVideoFilters} className={styles.button}>
          {t('config.apply')}
        </button>
      </div>
      <div className={`${styles.configItem} ${styles.videoTypes}`}>
        <label className={styles.label}>{t('config.videoTypes')}:</label>
        <div className={styles.checkboxGroup}>
          <label className={styles.checkboxLabel}>
            <input
              type="checkbox"
              checked={videoTypes.mp4}
              onChange={(e) => handleVideoTypeChange('mp4', e.target.checked)}
            />
            MP4
          </label>
          <label className={styles.checkboxLabel}>
            <input
              type="checkbox"
              checked={videoTypes.webm}
              onChange={(e) => handleVideoTypeChange('webm', e.target.checked)}
            />
            WebM
          </label>
          <label className={styles.checkboxLabel}>
            <input
              type="checkbox"
              checked={videoTypes.mov}
              onChange={(e) => handleVideoTypeChange('mov', e.target.checked)}
            />
            MOV
          </label>
          <label className={styles.checkboxLabel}>
            <input
              type="checkbox"
              checked={videoTypes.avi}
              onChange={(e) => handleVideoTypeChange('avi', e.target.checked)}
            />
            AVI
          </label>
        </div>
      </div>
    </div>
  );
});

export default ConfigSection;
