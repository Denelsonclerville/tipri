import { initializeApp } from 'https://www.gstatic.com/firebasejs/11.0.2/firebase-app.js';
import { getAuth, GoogleAuthProvider, FacebookAuthProvider, signInWithPopup, signInWithEmailAndPassword, createUserWithEmailAndPassword, onAuthStateChanged, signOut, updateProfile, setPersistence, browserLocalPersistence } from 'https://www.gstatic.com/firebasejs/11.0.2/firebase-auth.js';
import { firebaseConfig } from './firebase-config.js';

const isConfigured = !firebaseConfig.apiKey.startsWith('YOUR_');
let auth;
const LOCAL_USERS_KEY = 'marketplaceLocalUsers';
const LOCAL_SESSION_KEY = 'marketplaceLocalSession';
let persistenceReady = Promise.resolve();

if (isConfigured) {
  auth = getAuth(initializeApp(firebaseConfig));
  persistenceReady = setPersistence(auth, browserLocalPersistence);
}

function requireConfiguration() {
  if (!isConfigured) throw new Error('Add your Firebase configuration in /js/firebase-config.js first.');
}

function readLocalUsers() {
  try { return JSON.parse(localStorage.getItem(LOCAL_USERS_KEY)) || []; } catch (error) { return []; }
}

function saveLocalSession(user) {
  localStorage.setItem(LOCAL_SESSION_KEY, JSON.stringify(user));
  window.dispatchEvent(new CustomEvent('marketplace-auth-change'));
  return { user };
}

function getLocalSession() {
  try { return JSON.parse(localStorage.getItem(LOCAL_SESSION_KEY)); } catch (error) { return null; }
}

export async function signInWithGoogle() {
  if (!isConfigured) return saveLocalSession({ displayName: 'Google demo user', email: 'google-demo@local' });
  requireConfiguration();
  await persistenceReady;
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  return signInWithPopup(auth, provider);
}

export async function signInWithFacebook() {
  if (!isConfigured) return saveLocalSession({ displayName: 'Facebook demo user', email: 'facebook-demo@local' });
  requireConfiguration();
  await persistenceReady;
  const provider = new FacebookAuthProvider();
  provider.setCustomParameters({ display: 'popup' });
  return signInWithPopup(auth, provider);
}

export async function signInWithEmail(email, password) {
  if (!isConfigured) {
    const user = readLocalUsers().find((item) => item.email === email && item.password === password);
    if (!user) throw new Error('No local account matches that email and password.');
    return saveLocalSession({ displayName: user.name, email: user.email });
  }
  requireConfiguration();
  await persistenceReady;
  return signInWithEmailAndPassword(auth, email, password);
}

export async function signInWithProviderCredentials(providerName, identifier, password) {
  if (!isConfigured) {
    const normalizedIdentifier = identifier.toLowerCase();
    const user = readLocalUsers().find((item) => item.email.toLowerCase() === normalizedIdentifier || item.name.toLowerCase() === normalizedIdentifier);
    if (!user || user.password !== password) throw new Error('The username/email or password is incorrect.');
    return saveLocalSession({ displayName: user.name, email: user.email });
  }
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
  await persistenceReady;
  const result = await createUserWithEmailAndPassword(auth, email, password);
  await updateProfile(result.user, { displayName: name });
  return result;
}

export function observeAuth(callback) {
  if (!isConfigured) {
    callback(getLocalSession());
    const handleLocalAuthChange = () => callback(getLocalSession());
    window.addEventListener('marketplace-auth-change', handleLocalAuthChange);
    return () => window.removeEventListener('marketplace-auth-change', handleLocalAuthChange);
  }
  return onAuthStateChanged(auth, callback);
}

export function logOut() {
  if (auth) return signOut(auth);
  localStorage.removeItem(LOCAL_SESSION_KEY);
  window.dispatchEvent(new CustomEvent('marketplace-auth-change'));
  return Promise.resolve();
}

export function getAuthSetupMessage() {
  return isConfigured ? '' : 'Local demo authentication is active. Add Firebase configuration for real Google and Facebook verification.';
}
