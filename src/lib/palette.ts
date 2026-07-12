import type { Theme } from './theme'
import type { UniversId } from '../db/types'

// Categorical palette (validated with the dataviz skill's validator, both
// modes ALL CHECKS PASS). Slots assigned in fixed order to the expense univers;
// identity is always reinforced by legend + direct labels (relief rule).
const UNIVERS_HEX: Record<UniversId, { light: string; dark: string }> = {
  logement: { light: '#2a78d6', dark: '#3987e5' }, // blue
  vehicule: { light: '#1baf7a', dark: '#199e70' }, // aqua
  quotidien: { light: '#eda100', dark: '#c98500' }, // yellow
  loisirs: { light: '#008300', dark: '#008300' }, // green
  autre: { light: '#4a3aa7', dark: '#9085e9' }, // violet
  revenus: { light: '#1baf7a', dark: '#199e70' }, // income (own context)
}

export function universColor(id: UniversId, theme: Theme): string {
  return UNIVERS_HEX[id][theme]
}

export function incomeColor(theme: Theme): string {
  return theme === 'dark' ? '#199e70' : '#1baf7a'
}
export function expenseColor(theme: Theme): string {
  return theme === 'dark' ? '#d95926' : '#eb6834'
}

// Chart chrome & ink (from the reference palette), theme-aware.
export function chartInk(theme: Theme) {
  return theme === 'dark'
    ? {
        surface: '#1a1a19',
        text: '#ffffff',
        textSecondary: '#c3c2b7',
        muted: '#898781',
        grid: '#2c2c2a',
        axis: '#383835',
        tooltipBg: '#1a1a19',
        tooltipBorder: 'rgba(255,255,255,0.14)',
      }
    : {
        surface: '#fcfcfb',
        text: '#0b0b0b',
        textSecondary: '#52514e',
        muted: '#898781',
        grid: '#e1e0d9',
        axis: '#c3c2b7',
        tooltipBg: '#ffffff',
        tooltipBorder: 'rgba(11,11,11,0.12)',
      }
}
