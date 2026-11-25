/**
 * Shared MediCare AI design tokens.
 * Calm, high-contrast colours and generous touch targets keep the app
 * comfortable to use for older adults and their caregivers.
 */
export const medicareColors = {
  primary: '#0D6B63',
  primaryPressed: '#0A554F',
  primaryContainer: '#DDF3ED',
  onPrimary: '#FFFFFF',
  onPrimaryContainer: '#123B35',
  secondary: '#355F8A',
  secondaryContainer: '#EAF1FA',
  onSecondaryContainer: '#243F5E',
  error: '#B42318',
  errorContainer: '#FFF0EF',
  onErrorContainer: '#7D211B',
  success: '#176B48',
  successContainer: '#E2F4E9',
  warning: '#805600',
  warningContainer: '#FFF5DF',
  surface: '#F5F8F6',
  surfaceMuted: '#EDF3F0',
  surfaceElevated: '#FFFFFF',
  text: '#1B2D29',
  textMuted: '#52635D',
  border: '#DCE6E1',
  disabled: '#E4EBE7',
  disabledText: '#697771',
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
  page: 22,
} as const;

export const medicareRadius = {
  sm: 14,
  md: 18,
  lg: 24,
  pill: 999,
} as const;

export const medicareTypography = {
  display: 32,
  heading: 27,
  subheading: 22,
  body: 18,
  bodySmall: 16,
  label: 17,
  caption: 14,
  lineHeightBody: 27,
  lineHeightHeading: 35,
} as const;

export const medicareAccessibility = {
  minTouchTarget: 56,
  iconSize: 28,
} as const;

export const medicareShadow = {
  shadowColor: '#183A32',
  shadowOffset: { width: 0, height: 3 },
  shadowOpacity: 0.055,
  shadowRadius: 12,
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
