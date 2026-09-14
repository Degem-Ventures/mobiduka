import { useTheme } from '../context/ThemeContext'

export function useColors() {
  const { isDark } = useTheme()
  return colors(isDark)
}

export function colors(isDark: boolean) {
  return {
    isDark,
    bg:       isDark ? '#09152A' : '#F5F7FA',
    card:     isDark ? '#0F2040' : '#FFFFFF',
    cardAlt:  isDark ? '#132850' : '#F5F7FA',
    text:     isDark ? '#DCE6FF' : '#0D1B3D',
    muted:    isDark ? '#7A8FBF' : '#6B7A99',
    faint:    isDark ? '#4A5F8A' : '#B0BAD3',
    border:   isDark ? '#1A3366' : '#F0F3F9',
    divider:  `1px solid ${isDark ? '#1A3366' : '#F0F3F9'}`,
    iconBg:   isDark ? '#162B5A' : '#E3EAF8',
    inputBg:  isDark ? '#0D1B3D' : '#FFFFFF',
    // semantic
    successBg:  isDark ? 'rgba(46,125,50,0.18)'  : '#E8F5E9',
    warningBg:  isDark ? 'rgba(249,168,37,0.15)' : '#FFF8E1',
    errorBg:    isDark ? 'rgba(211,47,47,0.15)'  : '#FFEBEE',
    infoBg:     isDark ? 'rgba(18,58,143,0.2)'   : '#E3EAF8',
    // tinted icon bg helper (pass the hex color)
    tint: (hex: string) => isDark ? `${hex}28` : `${hex}15`,
  }
}
