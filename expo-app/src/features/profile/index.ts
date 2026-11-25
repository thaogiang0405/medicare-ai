export type {
  UpdateOwnUserProfileInput,
  UserProfileRepository,
} from './domain/user-profile-repository';
export {
  FirestoreUserProfileRepository,
  getFirestoreUserProfileRepository,
  mapUserProfileDocument,
  type FirestoreUserProfilePort,
} from './data/firestore-user-profile-repository';
export { UserProfileRepositoryError, mapUserProfileError } from './data/user-profile-errors';
