export const THEME_STORAGE_KEY = 'sophran-tools-theme';

export const themes = ['frost', 'graphite', 'sandstone'] as const;
export type ThemeName = (typeof themes)[number];
export const DEFAULT_THEME: ThemeName = 'graphite';

export function isThemeName(value: unknown): value is ThemeName {
  return typeof value === 'string' && themes.includes(value as ThemeName);
}
