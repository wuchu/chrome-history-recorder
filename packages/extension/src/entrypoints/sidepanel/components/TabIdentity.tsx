import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CheckOutlined, CopyOutlined } from '@ant-design/icons';
import type { ActiveTabInfo } from '../hooks/useActiveTab';
import styles from '../cockpit.module.css';

interface TabIdentityProps {
  tab: ActiveTabInfo;
}

export function TabIdentity({ tab }: TabIdentityProps) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);

  const hostLabel = tab.hostname || t('cockpit.unknownHost', '未知站点');
  const hostTitle = tab.title || tab.url || hostLabel;

  const handleCopy = async () => {
    if (!tab.url) return;
    try {
      await navigator.clipboard.writeText(tab.url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1200);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className={styles.identity}>
      <div className={styles.favicon}>
        {tab.favIconUrl ? <img src={tab.favIconUrl} alt="" /> : <span aria-hidden="true">🌐</span>}
      </div>
      <span className={styles.hostname} title={hostTitle}>
        {hostLabel}
      </span>
      {!tab.isSupported && (
        <span className={styles.unsupportedBadge}>{t('cockpit.unsupportedBadge', '不可捕获')}</span>
      )}
      <button
        type="button"
        className={`${styles.copyButton} ${copied ? styles.copyButtonCopied : ''}`}
        onClick={handleCopy}
        disabled={!tab.url}
        title={copied ? t('cockpit.copied', '已复制') : t('cockpit.copyUrl', '复制页面地址')}
        aria-label={copied ? t('cockpit.copied', '已复制') : t('cockpit.copyUrl', '复制页面地址')}
      >
        {copied ? <CheckOutlined /> : <CopyOutlined />}
      </button>
    </div>
  );
}

export default TabIdentity;
