// Demo authentication — localStorage-based
const KEY = 'where2dive_auth';
const DEMO = { email: 'demo@where2dive.com', password: '1234' };

export function isLoggedIn() {
  return localStorage.getItem(KEY) === 'true';
}

export function login(email, pw) {
  if (email === DEMO.email && pw === DEMO.password) {
    localStorage.setItem(KEY, 'true');
    return true;
  }
  return false;
}

export function logout() {
  localStorage.removeItem(KEY);
}
