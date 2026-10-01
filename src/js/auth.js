import { firebaseConfig } from './firebase-config.js';

const isConfigured = Boolean(
  firebaseConfig &&
    firebaseConfig.apiKey &&
    !String(firebaseConfig.apiKey).includes('YOUR_') &&
    firebaseConfig.projectId &&
    !String(firebaseConfig.projectId).includes('YOUR_') &&
    firebaseConfig.authDomain &&
    !String(firebaseConfig.authDomain).includes('YOUR_')
);

const LOCAL_USERS_KEY = 'marketplaceLocalUsers';
const LOCAL_SESSION_KEY = 'marketplaceLocalSession';
let auth = null;
let firebaseServices = null;
let persistenceReady = Promise.resolve();
let firebaseReady = Promise.resolve();

if (isConfigured) {
  firebaseReady = Promise.all([
    import('https://www.gstatic.com/firebasejs/11.0.2/firebase-app.js'),
    import('https://www.gstatic.com/firebasejs/11.0.2/firebase-auth.js')
  ]).then(([appServices, authServices]) => {
    firebaseServices = authServices;
    auth = authServices.getAuth(appServices.initializeApp(firebaseConfig));
    persistenceReady = authServices.setPersistence(auth, authServices.browserLocalPersistence).catch(() => undefined);
  });
}

function requireConfiguration() {
  if (!isConfigured) throw new Error('Add your Firebase configuration in /js/firebase-config.js before enabling real auth.');
}

function readLocalUsers() {
  try {
    return JSON.parse(localStorage.getItem(LOCAL_USERS_KEY)) || [];
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
    return JSON.parse(localStorage.getItem(LOCAL_SESSION_KEY));
  } catch (error) {
    return null;
  }
}

export async function signInWithGoogle() {
  if (!isConfigured) return saveLocalSession({ displayName: 'Google demo user', email: 'google-demo@local' });
  requireConfiguration();
  await firebaseReady;
  await persistenceReady;
  const provider = new firebaseServices.GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  return firebaseServices.signInWithPopup(auth, provider);
}

export async function signInWithFacebook() {
  if (!isConfigured) return saveLocalSession({ displayName: 'Facebook demo user', email: 'facebook-demo@local' });
  requireConfiguration();
  await firebaseReady;
  await persistenceReady;
  const provider = new firebaseServices.FacebookAuthProvider();
  provider.setCustomParameters({ display: 'popup' });
  return firebaseServices.signInWithPopup(auth, provider);
}

export async function signInWithEmail(email, password) {
  if (!isConfigured) {
    const user = readLocalUsers().find((item) => item.email === email && item.password === password);
    if (!user) throw new Error('No local account matches that email and password.');
    return saveLocalSession({ displayName: user.name, email: user.email });
  }

  requireConfiguration();
  await firebaseReady;
  await persistenceReady;
  return firebaseServices.signInWithEmailAndPassword(auth, email, password);
}

export async function signInWithProviderCredentials(providerName, identifier, password) {
  if (!isConfigured) {
    const normalizedIdentifier = String(identifier).trim().toLowerCase();
    const user = readLocalUsers().find(
      (item) => item.email.toLowerCase() === normalizedIdentifier || item.name.toLowerCase() === normalizedIdentifier
    );
    if (!user || user.password !== password) throw new Error('The username/email or password is incorrect.');
    return saveLocalSession({ displayName: user.name, email: user.email });
  }

  await firebaseReady;
  return providerName === 'Google' ? signInWithGoogle() : signInWithFacebook();
}

export async function registerWithEmail(name, email, password) {
  if (!isConfigured) {
    const users = readLocalUsers();
    if (users.some((user) => user.email === email)) throw new Error('An account with this email already exists.');
    users.push({ name, email, password });
    localStorage.setItem(LOCAL_USERS_KEY, JSON.stringify(users));
    return saveLocalSession({ displayName: name, email });
  }

  requireConfiguration();
  await firebaseReady;
  await persistenceReady;
  const result = await firebaseServices.createUserWithEmailAndPassword(auth, email, password);
  await firebaseServices.updateProfile(result.user, { displayName: name });
  return result;
}

export function observeAuth(callback) {
  if (!auth) {
    const syncCurrentUser = () => callback(getLocalSession());
    syncCurrentUser();
    window.addEventListener('marketplace-auth-change', syncCurrentUser);
    return () => window.removeEventListener('marketplace-auth-change', syncCurrentUser);
  }

  let active = true;
  let unsubscribe = () => {};
  firebaseReady.then(() => {
    if (active) unsubscribe = firebaseServices.onAuthStateChanged(auth, callback);
  }).catch((error) => console.error('Firebase authentication could not initialize:', error));
  return () => {
    active = false;
    unsubscribe();
  };
}

export async function logOut() {
  if (isConfigured) {
    await firebaseReady;
    return firebaseServices.signOut(auth);
  }
  localStorage.removeItem(LOCAL_SESSION_KEY);
  window.dispatchEvent(new CustomEvent('marketplace-auth-change'));
  return Promise.resolve();
}

export function getAuthSetupMessage() {
  return isConfigured ? '' : 'Local demo authentication is active. Add Firebase config for real Google/Facebook sign-in.';
}
