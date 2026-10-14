const LOCAL_USERS_KEY = 'marketplaceLocalUsers';
const LOCAL_SESSION_KEY = 'tipri_user';
const LEGACY_SESSION_KEY = 'marketplaceLocalSession';

function readLocalUsers() {
  try {
    const users = JSON.parse(localStorage.getItem(LOCAL_USERS_KEY));
    return Array.isArray(users) ? users : [];
  } catch (error) {
    return [];
  }
}

function saveLocalSession(user) {
  localStorage.setItem(LOCAL_SESSION_KEY, JSON.stringify(user));
  window.dispatchEvent(new CustomEvent('marketplace-auth-change'));
  return user;
}

function getLocalSession() {
  try {
    const session = localStorage.getItem(LOCAL_SESSION_KEY) || localStorage.getItem(LEGACY_SESSION_KEY);
    if (!session) return null;
    const user = JSON.parse(session);
    if (!localStorage.getItem(LOCAL_SESSION_KEY)) localStorage.setItem(LOCAL_SESSION_KEY, JSON.stringify(user));
    return user;
  } catch (error) {
    return null;
  }
}

export async function signInWithGoogle() {
  return saveLocalSession({ displayName: 'Google demo user', email: 'google-demo@local' });
}

export async function signInWithFacebook() {
  return saveLocalSession({ displayName: 'Facebook demo user', email: 'facebook-demo@local' });
}

export async function signInWithEmail(email, password) {
  const normalizedEmail = String(email).trim().toLowerCase();
  const user = readLocalUsers().find((item) => item.email.toLowerCase() === normalizedEmail && item.password === password);
  if (!user) throw new Error('No local account matches that email and password.');
  return saveLocalSession({ displayName: user.name, email: user.email });
}

export async function signInWithProviderCredentials(providerName, identifier, password) {
  const normalizedIdentifier = String(identifier).trim().toLowerCase();
  const user = readLocalUsers().find(
    (item) => item.email.toLowerCase() === normalizedIdentifier || item.name.toLowerCase() === normalizedIdentifier
  );
  if (!user || user.password !== password) throw new Error(`The ${providerName} username/email or password is incorrect.`);
  return saveLocalSession({ displayName: user.name, email: user.email });
}

export async function registerWithEmail(name, email, password) {
  const users = readLocalUsers();
  const normalizedEmail = String(email).trim().toLowerCase();
  if (users.some((user) => user.email.toLowerCase() === normalizedEmail)) {
    throw new Error('An account with this email already exists.');
  }
  const user = { name: String(name).trim(), email: normalizedEmail, password };
  users.push(user);
  localStorage.setItem(LOCAL_USERS_KEY, JSON.stringify(users));
  return saveLocalSession({ displayName: user.name, email: user.email });
}

export function observeAuth(callback) {
  const syncCurrentUser = () => callback(getLocalSession());
  syncCurrentUser();
  window.addEventListener('marketplace-auth-change', syncCurrentUser);
  return () => window.removeEventListener('marketplace-auth-change', syncCurrentUser);
}

export async function logOut() {
  localStorage.removeItem(LOCAL_SESSION_KEY);
  localStorage.removeItem(LEGACY_SESSION_KEY);
  window.dispatchEvent(new CustomEvent('marketplace-auth-change'));
}

export function getAuthSetupMessage() {
  return 'Local demo authentication is active. Accounts and sessions are stored in this browser only.';
}
