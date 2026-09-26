'use client';

import type { KeyboardEvent } from 'react';
import { LanguageToggle } from '@/components/LanguageToggle';
import { useI18n } from '@/lib/i18n/provider';
import { useTheme } from '@/lib/theme/provider';
import { themes, type ThemeName } from '@/lib/theme';

const themeLabels: Record<ThemeName, { zh: string; en: string }> = {
  frost: { zh: '冷白', en: 'Frost' },
  graphite: { zh: '石墨', en: 'Graphite' },
  sandstone: { zh: '暖砂', en: 'Sand' },
};

const sectors: Record<ThemeName, {
  path: string;
  color: string;
  indicator: string;
  indicatorPosition: [number, number];
}> = {
  frost: {
    path: 'M 26 26 L 6.08 14.5 A 23 23 0 0 1 45.92 14.5 Z',
    color: '#e3eef0',
    indicator: '#096b78',
    indicatorPosition: [26, 12],
  },
  graphite: {
    path: 'M 26 26 L 45.92 14.5 A 23 23 0 0 1 26 49 Z',
    color: '#172932',
    indicator: '#9ce0e4',
    indicatorPosition: [38, 33],
  },
  sandstone: {
    path: 'M 26 26 L 26 49 A 23 23 0 0 1 6.08 14.5 Z',
    color: '#d5ac7d',
    indicator: '#793b24',
    indicatorPosition: [14, 33],
  },
};

export function AppearanceControls() {
  const { locale } = useI18n();
  const { theme, setTheme } = useTheme();

  function handleKeyDown(event: KeyboardEvent<SVGPathElement>, name: ThemeName) {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      setTheme(name);
    }
  }

  return (
    <div className="flex shrink-0 items-center justify-end gap-2">
      <svg
        viewBox="0 0 52 52"
        className="size-12 shrink-0 overflow-visible rounded-full bg-base-200 shadow-[0_2px_12px_rgba(0,0,0,0.16)]"
        role="group"
        aria-label={locale === 'zh' ? '切换主题' : 'Switch theme'}
      >
        <circle cx="26" cy="26" r="24" fill="none" stroke="currentColor" strokeOpacity="0.28" strokeWidth="1" />
        {themes.map((name) => {
          const sector = sectors[name];
          const label = themeLabels[name][locale];
          return (
            <path
              key={name}
              d={sector.path}
              fill={sector.color}
              stroke={theme === name ? sector.indicator : '#52616a'}
              strokeWidth={theme === name ? 2.2 : 0.6}
              strokeLinejoin="round"
              role="button"
              tabIndex={0}
              aria-label={locale === 'zh' ? `切换到${label}主题` : `Switch to ${label} theme`}
              aria-pressed={theme === name}
              onClick={() => setTheme(name)}
              onKeyDown={(event) => handleKeyDown(event, name)}
              className="cursor-pointer transition-[filter] hover:brightness-110 focus:outline-none focus-visible:stroke-primary focus-visible:stroke-[3.5px] motion-reduce:transition-none"
            >
              <title>{label}</title>
            </path>
          );
        })}
        <circle
          cx={sectors[theme].indicatorPosition[0]}
          cy={sectors[theme].indicatorPosition[1]}
          r="2.7"
          fill={sectors[theme].indicator}
          stroke={sectors[theme].color}
          strokeWidth="1.2"
          pointerEvents="none"
          aria-hidden="true"
        />
      </svg>
      <LanguageToggle />
    </div>
  );
}
