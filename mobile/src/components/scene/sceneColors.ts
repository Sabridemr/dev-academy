import type { NodeStatus } from '@devacademy/shared';
import { mixColors, type ThemeColors } from '@/theme/tokens';

/**
 * Düğüm durum renkleri — web STATUS_COLORS ile aynı mantık.
 * Web'deki color-mix(in srgb, X p%, surface) ifadeleri burada önceden hesaplanır (RN SVG color-mix desteklemez).
 */
export interface StatusColor {
  stroke: string;
  fill: string;
}

export function statusColors(c: ThemeColors): Record<NodeStatus, StatusColor> {
  return {
    idle: { stroke: c.border, fill: c.surface },
    active: { stroke: c.primary, fill: mixColors(c.primary, c.surface, 0.12) },
    busy: { stroke: c.accent, fill: mixColors(c.accent, c.surface, 0.14) },
    success: { stroke: c.success, fill: mixColors(c.success, c.surface, 0.14) },
    warning: { stroke: c.warning, fill: mixColors(c.warning, c.surface, 0.16) },
    error: { stroke: c.danger, fill: mixColors(c.danger, c.surface, 0.14) },
    down: { stroke: c.danger, fill: mixColors(c.danger, c.surface, 0.22) },
    muted: { stroke: c.border, fill: c.elevated },
  };
}

/** Sahnenin kendi tema eşlemesini (scene.theme.light/dark) uygular */
export function sceneThemeColors(
  base: ThemeColors,
  overrides: Record<string, string> | undefined,
): ThemeColors & Record<string, string> {
  return { ...base, ...(overrides ?? {}) };
}
