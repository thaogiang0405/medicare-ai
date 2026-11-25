/**
 * Design tokens for MediCare AI's high-legibility mobile interface.
 *
 * These tokens deliberately prioritise contrast, generous spacing and touch
 * targets suitable for older adults. They are platform-neutral React Native
 * values, so feature screens do not need to duplicate visual decisions.
 */
export const medicareColors = {
  primary: '#006C67',
  primaryPressed: '#00514E',
  primaryContainer: '#B8F2EC',
  onPrimary: '#FFFFFF',
  onPrimaryContainer: '#00201E',
  secondary: '#365F91',
  secondaryContainer: '#D5E3FF',
  onSecondaryContainer: '#001B3C',
  error: '#BA1A1A',
  errorContainer: '#FFDAD6',
  onErrorContainer: '#410002',
  success: '#176B3A',
  successContainer: '#D8F3DC',
  warning: '#7A4E00',
  warningContainer: '#FFE8B6',
  surface: '#FAFDFC',
  surfaceMuted: '#EDF3F1',
  surfaceElevated: '#FFFFFF',
  text: '#191C1C',
  textMuted: '#3F4948',
  border: '#BEC9C7',
  disabled: '#DDE5E3',
  disabledText: '#596462',
  white: '#FFFFFF',
  transparent: 'transparent',
} as const;

export const medicareSpacing = {
  xxs: 4,
  xs: 8,
  sm: 12,
  md: 16,
  lg: 20,
  xl: 24,
  xxl: 32,
  page: 20,
} as const;

export const medicareRadius = {
  sm: 12,
  md: 16,
  lg: 20,
  pill: 999,
} as const;

export const medicareTypography = {
  display: 32,
  heading: 26,
  subheading: 22,
  body: 18,
  bodySmall: 16,
  label: 17,
  caption: 14,
  lineHeightBody: 27,
  lineHeightHeading: 34,
} as const;

export const medicareAccessibility = {
  minTouchTarget: 56,
  iconSize: 28,
} as const;

export const medicareShadow = {
  shadowColor: '#000000',
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.08,
  shadowRadius: 8,
  elevation: 2,
} as const;

export const medicareTheme = {
  colors: medicareColors,
  spacing: medicareSpacing,
  radius: medicareRadius,
  typography: medicareTypography,
  accessibility: medicareAccessibility,
  shadow: medicareShadow,
} as const;

export type MediCareColor = keyof typeof medicareColors;
