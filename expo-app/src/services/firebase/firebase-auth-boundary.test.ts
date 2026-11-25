import type { Auth } from 'firebase/auth';

const mockAsyncStorage = {
  getItem: jest.fn(),
  removeItem: jest.fn(),
  setItem: jest.fn(),
};
const mockFirebaseApp = {};
const mockAuth = {} as Auth;
const mockGetAuth = jest.fn();
const mockGetFirebaseApp = jest.fn(() => mockFirebaseApp);
const mockGetReactNativePersistence = jest.fn();
const mockInitializeAuth = jest.fn();

jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: mockAsyncStorage,
}));

jest.mock('firebase/auth', () => ({
  getAuth: mockGetAuth,
  getReactNativePersistence: mockGetReactNativePersistence,
  initializeAuth: mockInitializeAuth,
}));

jest.mock('./firebase-app', () => ({ getFirebaseApp: mockGetFirebaseApp }));

let getFirebaseAuth: typeof import('./firebase-auth-boundary').getFirebaseAuth;

beforeEach(() => {
  jest.resetModules();
  jest.clearAllMocks();
  mockGetFirebaseApp.mockReturnValue(mockFirebaseApp);

  jest.isolateModules(() => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    ({ getFirebaseAuth } = require('./firebase-auth-boundary'));
  });
});

describe('getFirebaseAuth', () => {
  it('sets React Native AsyncStorage persistence before caching Auth', () => {
    const persistence = {};
    mockGetReactNativePersistence.mockReturnValue(persistence);
    mockInitializeAuth.mockReturnValue(mockAuth);

    expect(getFirebaseAuth()).toBe(mockAuth);
    expect(mockGetReactNativePersistence).toHaveBeenCalledWith(mockAsyncStorage);
    expect(mockInitializeAuth).toHaveBeenCalledWith(mockFirebaseApp, { persistence });
    expect(mockGetAuth).not.toHaveBeenCalled();

    expect(getFirebaseAuth()).toBe(mockAuth);
    expect(mockInitializeAuth).toHaveBeenCalledTimes(1);
  });

  it('uses getAuth only for Firebase already-initialized Fast Refresh recovery', () => {
    mockGetReactNativePersistence.mockReturnValue({});
    mockInitializeAuth.mockImplementation(() => {
      throw { code: 'auth/already-initialized' };
    });
    mockGetAuth.mockReturnValue(mockAuth);

    expect(getFirebaseAuth()).toBe(mockAuth);
    expect(mockGetAuth).toHaveBeenCalledWith(mockFirebaseApp);
  });
});
