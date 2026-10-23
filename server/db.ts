export { affectedRowsOf, getDb, closeDb } from "./db-connection";

export {
  upsertUser,
  getUserByOpenId,
  getUserByEmail,
  linkUserOpenIdByEmail,
  updateUserPasswordHash,
  createUserWithPassword,
  getUserById,
  updateUserPasswordHashById,
  deleteUserById,
} from "./db-users";

export {
  createPasswordResetToken,
  getPasswordResetToken,
  consumePasswordResetToken,
  __clearPasswordResetTokensForTest,
  resetPasswordWithToken,
  createEmailVerificationToken,
  getEmailVerificationToken,
  consumeEmailVerificationToken,
  setUserEmailVerified,
  __clearEmailVerificationTokensForTest,
  purgeExpiredAuthTokens,
} from "./db-auth-tokens";
