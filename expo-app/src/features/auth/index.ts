export type { AuthRepository, RegisterInput, SignInInput } from './domain/auth-repository';
export {
  FirebaseAuthRepository,
  getFirebaseAuthRepository,
  mapFirebaseUserToAppUser,
} from './data/firebase-auth-repository';
export { AuthRepositoryError, mapFirebaseAuthError } from './data/auth-errors';
