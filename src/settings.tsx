import { createContext, useContext, useEffect, type ReactNode } from 'react';
import type { PublicSettings } from '../shared/types';
import { useApi } from './api';

const SettingsContext = createContext<PublicSettings | undefined>(undefined);

/** Loads site settings (title, policy text, discount tiers) once for the whole app. */
export function SettingsProvider({ children }: { children: ReactNode }) {
  const { data, error } = useApi<PublicSettings>('/settings');

  useEffect(() => {
    if (data) document.title = data.siteTitle;
  }, [data]);

  if (error) {
    return (
      <div className="page-message">
        <p>网站暂时无法访问：{error.message}</p>
        <button className="btn" onClick={() => location.reload()}>
          重新加载
        </button>
      </div>
    );
  }
  if (!data) return <div className="page-message">加载中…</div>;
  return <SettingsContext.Provider value={data}>{children}</SettingsContext.Provider>;
}

export function useSettings(): PublicSettings {
  const s = useContext(SettingsContext);
  if (!s) throw new Error('useSettings must be used inside SettingsProvider');
  return s;
}
