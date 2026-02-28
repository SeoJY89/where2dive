// 앱 엔트리 포인트
import { spots, COUNTRY_MAP } from './data.js';
import { initMap, updateMarkers, setMapSpotClickHandler, flyToSpot, invalidateMapSize, updatePersonalMarkers, setPersonalSpotClickHandler, getMapInstance } from './map.js';
import { renderCards, renderFavEmpty, openModal, initModal, setDetailClickHandler, updateFavCount, setPersonalSpotCardHandlers } from './ui.js';
import { initFilters, filterSpots, setFilterListener, refreshFilterLabels, getActivityCounts, filterMySpots, setSearchToggleListener, setCountry, resetFilters } from './filters.js';
import { getFavorites, loadFavorites, clearFavorites } from './favorites.js';
import { getLang, setLang, setLangChangeListener, t } from './i18n.js';
import { isLoggedIn, login, signup, loginWithGoogle, logout, onAuthChange, waitForAuth, checkNickname, resetPassword, findEmailByNickname } from './auth.js';
import { getLogEntries, getLogEntry, addLogEntry, updateLogEntry, deleteLogEntry, getLogStats, loadLogbook, clearLogbook } from './logbook.js';
import { getMySpots, getMySpot, addMySpot, updateMySpot, deleteMySpot, loadMySpots, clearMySpots } from './myspots.js';
import { migrateLocalStorageToFirestore } from './migrate.js';

// ── State ──
let currentView = 'map'; // 'map' | 'list' | 'favorites' | 'logbook'
let listVisible = false;
let booted = false;
let mapPickingState = null; // { target: 'log'|'spot' }
let authMode = 'login'; // 'login' | 'signup'

// ── Landing / App visibility ──
function showLanding() {
  document.getElementById('landing').classList.remove('hidden');
  document.querySelector('.header').classList.add('app-hidden');
  document.querySelector('.filter-bar').classList.add('app-hidden');
  document.querySelector('.mobile-activity-tabs').classList.add('app-hidden');
  document.querySelector('.main').classList.add('app-hidden');
  document.querySelector('.footer').classList.add('app-hidden');
}

function hideLanding() {
  document.getElementById('landing').classList.add('hidden');
  document.querySelector('.header').classList.remove('app-hidden');
  document.querySelector('.filter-bar').classList.remove('app-hidden');
  document.querySelector('.mobile-activity-tabs').classList.remove('app-hidden');
  document.querySelector('.main').classList.remove('app-hidden');
  document.querySelector('.footer').classList.remove('app-hidden');
}

function updateLandingLabels() {
  const landing = document.getElementById('landing');
  if (!landing) return;
  const tagline = landing.querySelector('.landing__tagline');
  if (tagline) tagline.textContent = t('landing.tagline');

  const tabLogin = document.getElementById('tab-login');
  if (tabLogin) tabLogin.textContent = t('landing.login');
  const tabSignup = document.getElementById('tab-signup');
  if (tabSignup) tabSignup.textContent = t('landing.signup');

  const submit = document.getElementById('login-submit');
  if (submit) submit.textContent = authMode === 'signup' ? t('landing.signup') : t('landing.login');

  const error = landing.querySelector('.landing__error');
  if (error && !error.dataset.dynamic) error.textContent = t('landing.error');

  const orEl = document.getElementById('landing-or');
  if (orEl) orEl.textContent = t('landing.or');

  const googleText = document.getElementById('google-login-text');
  if (googleText) googleText.textContent = t('landing.google');

  const logoutBtn = document.getElementById('logout-btn');
  if (logoutBtn) logoutBtn.textContent = t('nav.logout');

  // Signup field labels
  const nicknameInput = document.getElementById('login-nickname');
  if (nicknameInput) nicknameInput.placeholder = t('landing.nickname.placeholder');
  const checkBtn = document.getElementById('nickname-check-btn');
  if (checkBtn) checkBtn.textContent = t('landing.nickname.check');
  const pwConfirmInput = document.getElementById('login-password-confirm');
  if (pwConfirmInput) pwConfirmInput.placeholder = t('landing.passwordConfirm.placeholder');

  // Terms labels
  const termsAllLabel = document.getElementById('terms-all-label');
  if (termsAllLabel) termsAllLabel.textContent = t('terms.agreeAll');
  const termsReq1 = document.getElementById('terms-req-1');
  if (termsReq1) termsReq1.textContent = t('terms.required');
  const termsReq2 = document.getElementById('terms-req-2');
  if (termsReq2) termsReq2.textContent = t('terms.required');
  const termsOpt1 = document.getElementById('terms-opt-1');
  if (termsOpt1) termsOpt1.textContent = t('terms.optional');
  const termsServiceLabel = document.getElementById('terms-service-label');
  if (termsServiceLabel) termsServiceLabel.textContent = t('terms.service');
  const termsPrivacyLabel = document.getElementById('terms-privacy-label');
  if (termsPrivacyLabel) termsPrivacyLabel.textContent = t('terms.privacy');
  const termsMarketingLabel = document.getElementById('terms-marketing-label');
  if (termsMarketingLabel) termsMarketingLabel.textContent = t('terms.marketing');
  const termsServiceLink = document.getElementById('terms-service-link');
  if (termsServiceLink) termsServiceLink.textContent = t('terms.view');
  const termsPrivacyLink = document.getElementById('terms-privacy-link');
  if (termsPrivacyLink) termsPrivacyLink.textContent = t('terms.view');

  // Recovery links & forms
  const findEmailLink = document.getElementById('find-email-link');
  if (findEmailLink) findEmailLink.textContent = t('landing.findEmail');
  const resetPwLink = document.getElementById('reset-pw-link');
  if (resetPwLink) resetPwLink.textContent = t('landing.resetPw');
  const findEmailTitle = document.getElementById('find-email-title');
  if (findEmailTitle) findEmailTitle.textContent = t('findEmail.title');
  const findEmailNickname = document.getElementById('find-email-nickname');
  if (findEmailNickname) findEmailNickname.placeholder = t('findEmail.nickname.placeholder');
  const findEmailSubmit = document.getElementById('find-email-submit');
  if (findEmailSubmit) findEmailSubmit.textContent = t('findEmail.submit');
  const findEmailBack = document.getElementById('find-email-back');
  if (findEmailBack) findEmailBack.textContent = '\u2190 ' + t('landing.backToLogin');
  const resetPwTitle = document.getElementById('reset-pw-title');
  if (resetPwTitle) resetPwTitle.textContent = t('resetPw.title');
  const resetPwEmail = document.getElementById('reset-pw-email');
  if (resetPwEmail) resetPwEmail.placeholder = t('resetPw.email.placeholder');
  const resetPwSubmit = document.getElementById('reset-pw-submit');
  if (resetPwSubmit) resetPwSubmit.textContent = t('resetPw.submit');
  const resetPwBack = document.getElementById('reset-pw-back');
  if (resetPwBack) resetPwBack.textContent = '\u2190 ' + t('landing.backToLogin');
}

// ── Firebase Auth 에러 → i18n 메시지 변환 ──
function getAuthErrorMessage(error) {
  const code = error?.code?.replace('auth/', '') || '';
  const key = `auth.error.${code}`;
  const msg = t(key);
  return msg !== key ? msg : t('auth.error.generic');
}

// ── 사용자 데이터 로드 ──
async function loadUserData() {
  await migrateLocalStorageToFirestore();
  await Promise.all([loadFavorites(), loadLogbook(), loadMySpots()]);
}

// ── Boot app (only once) ──
function bootApp() {
  if (booted) return;
  booted = true;

  initMap();
  initFilters();
  initModal();
  initLogModal();
  initSpotModal();

  // 초기 렌더 (첫 로딩 시 모든 마커 보이도록)
  updateFavCount();
  refresh(true);  // fitToMarkers = true

  // 필터 변경 시 갱신
  setFilterListener(() => refresh(false));

  // 상세보기 핸들러
  function handleDetail(id) {
    const spot = spots.find(s => s.id === id);
    if (spot) {
      openModal(spot);
      flyToSpot(spot.lat, spot.lng);
    }
  }
  setDetailClickHandler(handleDetail);
  setMapSpotClickHandler(handleDetail);

  // Personal spot handlers
  setPersonalSpotClickHandler(id => {
    openSpotFormModal(id);
  });
  setPersonalSpotCardHandlers(
    id => openSpotFormModal(id),
    id => {
      if (confirm(t('myspot.delete.confirm'))) {
        deleteMySpot(id).then(() => refresh(false));
      }
    }
  );

  // 초기 map 뷰: cards-panel 숨김
  document.getElementById('cards-panel').classList.add('map-hidden');

  // 네비게이션 (desktop)
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const view = btn.dataset.view;
      switchView(view);
    });
  });

  // 모바일 하단 탭 네비게이션
  initMobileTabBar();

  // Search bottom sheet
  initSearchSheet();
  setSearchToggleListener(() => openSearchSheet());

  // 리스트 토글
  document.getElementById('list-toggle').addEventListener('click', toggleList);

  // FAB — add personal spot
  document.getElementById('add-spot-btn').addEventListener('click', () => {
    openSpotFormModal();
  });

  // Add log button
  document.getElementById('add-log-btn').addEventListener('click', () => {
    openLogFormModal();
  });

  // Map picking cancel
  document.getElementById('map-pick-cancel').addEventListener('click', () => {
    cancelMapPicking();
  });

  // My spots toggle
  const myspotToggle = document.querySelector('#myspot-toggle input[type="checkbox"]');
  if (myspotToggle) {
    myspotToggle.addEventListener('change', () => {
      refresh(false);
    });
  }
}

// ── Boot ──
document.addEventListener('DOMContentLoaded', async () => {
  // Apply saved language on load
  applyLangToggleState();
  updateStaticLabels();
  updateLandingLabels();
  updateMobileLabels();

  // Landing tabs
  initLandingTabs();

  // Wait for Firebase Auth to determine initial state
  await waitForAuth();

  // Auth gate
  if (isLoggedIn()) {
    await loadUserData();
    hideLanding();
    bootApp();
  } else {
    showLanding();
  }

  // Auth state change listener
  onAuthChange(async (user) => {
    if (user) {
      await loadUserData();
      hideLanding();
      bootApp();
      updateFavCount();
      refresh(true);
    } else {
      clearFavorites();
      clearLogbook();
      clearMySpots();
      showLanding();
    }
  });

  // Signup validation init
  initSignupValidation();

  // Login form
  document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('login-email').value.trim();
    const pw = document.getElementById('login-password').value;
    const errorEl = document.getElementById('login-error');
    const submitBtn = document.getElementById('login-submit');

    submitBtn.disabled = true;
    errorEl.classList.add('hidden');

    try {
      if (authMode === 'signup') {
        const nickname = document.getElementById('login-nickname').value.trim();

        // Final validation check
        if (!nicknameChecked || nicknameCheckedValue !== nickname) {
          showFieldError('nickname-error', t('signup.error.nickname.checkRequired'));
          submitBtn.disabled = false;
          return;
        }

        const marketingConsent = document.getElementById('terms-marketing').checked;
        await signup(email, pw, nickname, { marketingConsent });
      } else {
        await login(email, pw);
      }
      // onAuthChange callback will handle the rest
    } catch (err) {
      errorEl.textContent = getAuthErrorMessage(err);
      errorEl.dataset.dynamic = 'true';
      errorEl.classList.remove('hidden');
    } finally {
      submitBtn.disabled = false;
    }
  });

  // Recovery forms
  initRecoveryForms();

  // Google login
  document.getElementById('google-login-btn').addEventListener('click', async () => {
    const errorEl = document.getElementById('login-error');
    errorEl.classList.add('hidden');
    try {
      await loginWithGoogle();
    } catch (err) {
      errorEl.textContent = getAuthErrorMessage(err);
      errorEl.dataset.dynamic = 'true';
      errorEl.classList.remove('hidden');
    }
  });

  // Logout
  document.getElementById('logout-btn').addEventListener('click', async () => {
    await logout();
    // onAuthChange callback will handle the rest
  });

  // ── Language toggle (header) ──
  document.querySelectorAll('#lang-toggle .lang-toggle__btn').forEach(btn => {
    btn.addEventListener('click', () => {
      setLang(btn.dataset.lang);
    });
  });

  // ── Language toggle (landing) ──
  document.querySelectorAll('#landing-lang-toggle .lang-toggle__btn').forEach(btn => {
    btn.addEventListener('click', () => {
      setLang(btn.dataset.lang);
    });
  });

  // ── Cookie consent ──
  initCookieBanner();

  setLangChangeListener(() => {
    applyLangToggleState();
    updateStaticLabels();
    updateLandingLabels();
    updateMobileLabels();
    refreshFilterLabels();
    if (booted) refresh(false);
  });
});

// ── Landing Tabs (login/signup toggle) ──
let nicknameChecked = false;
let nicknameCheckedValue = '';

function initLandingTabs() {
  const tabLogin = document.getElementById('tab-login');
  const tabSignup = document.getElementById('tab-signup');
  if (!tabLogin || !tabSignup) return;

  function setMode(mode) {
    authMode = mode;
    tabLogin.classList.toggle('active', mode === 'login');
    tabSignup.classList.toggle('active', mode === 'signup');
    const submitBtn = document.getElementById('login-submit');
    if (submitBtn) submitBtn.textContent = mode === 'signup' ? t('landing.signup') : t('landing.login');

    // Toggle signup-only fields
    document.querySelectorAll('.landing__signup-field').forEach(el => {
      el.classList.toggle('hidden', mode !== 'signup');
    });

    // Clear all errors on mode switch
    const errorEl = document.getElementById('login-error');
    if (errorEl) errorEl.classList.add('hidden');
    document.querySelectorAll('.landing__field-error').forEach(el => {
      el.classList.add('hidden');
      el.textContent = '';
      el.classList.remove('landing__field-error--success');
    });

    // Reset nickname check state
    nicknameChecked = false;
    nicknameCheckedValue = '';

    // Reset terms checkboxes
    ['terms-all', 'terms-service', 'terms-privacy', 'terms-marketing'].forEach(id => {
      const cb = document.getElementById(id);
      if (cb) cb.checked = false;
    });

    // Show/hide recovery links (login only)
    const recoveryLinks = document.getElementById('recovery-links');
    if (recoveryLinks) recoveryLinks.classList.toggle('hidden', mode !== 'login');

    // Hide recovery panels if open
    hideRecoveryPanels();

    // Update submit button state
    updateSubmitState();
  }

  tabLogin.addEventListener('click', () => setMode('login'));
  tabSignup.addEventListener('click', () => setMode('signup'));
}

// ── Signup Validation ──
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const NICKNAME_RE = /^[가-힣a-zA-Z0-9]+$/;
const PASSWORD_RE = /^(?=.*[a-zA-Z])(?=.*\d).{8,}$/;

function validateEmail(value) {
  if (!value) return null;
  if (!EMAIL_RE.test(value)) return t('signup.error.email.invalid');
  return '';
}

function validateNickname(value) {
  if (!value) return null;
  if (value.length < 2 || value.length > 12) return t('signup.error.nickname.length');
  if (!NICKNAME_RE.test(value)) return t('signup.error.nickname.chars');
  return '';
}

function validatePassword(value) {
  if (!value) return null;
  if (!PASSWORD_RE.test(value)) return t('signup.error.password.weak');
  return '';
}

function validatePasswordConfirm(pw, pwConfirm) {
  if (!pwConfirm) return null;
  if (pw !== pwConfirm) return t('signup.error.password.mismatch');
  return '';
}

function showFieldError(id, msg, isSuccess) {
  const el = document.getElementById(id);
  if (!el) return;
  if (msg === null || msg === undefined) {
    el.classList.add('hidden');
    el.textContent = '';
    el.classList.remove('landing__field-error--success');
    return;
  }
  el.textContent = msg;
  el.classList.toggle('hidden', msg === '');
  el.classList.toggle('landing__field-error--success', !!isSuccess);
}

function updateSubmitState() {
  const submitBtn = document.getElementById('login-submit');
  if (!submitBtn) return;

  if (authMode !== 'signup') {
    submitBtn.disabled = false;
    return;
  }

  const email = document.getElementById('login-email').value.trim();
  const nickname = document.getElementById('login-nickname').value.trim();
  const pw = document.getElementById('login-password').value;
  const pwConfirm = document.getElementById('login-password-confirm').value;

  const emailOk = EMAIL_RE.test(email);
  const nicknameOk = nickname.length >= 2 && nickname.length <= 12 && NICKNAME_RE.test(nickname);
  const nicknameCheckOk = nicknameChecked && nicknameCheckedValue === nickname;
  const pwOk = PASSWORD_RE.test(pw);
  const pwMatchOk = pw === pwConfirm && pwConfirm.length > 0;

  // Required terms check
  const termsOk = document.getElementById('terms-service').checked
    && document.getElementById('terms-privacy').checked;

  submitBtn.disabled = !(emailOk && nicknameOk && nicknameCheckOk && pwOk && pwMatchOk && termsOk);
}

function initSignupValidation() {
  const emailInput = document.getElementById('login-email');
  const nicknameInput = document.getElementById('login-nickname');
  const pwInput = document.getElementById('login-password');
  const pwConfirmInput = document.getElementById('login-password-confirm');
  const checkBtn = document.getElementById('nickname-check-btn');

  emailInput.addEventListener('input', () => {
    if (authMode === 'signup') {
      const err = validateEmail(emailInput.value.trim());
      showFieldError('email-error', err);
    }
    updateSubmitState();
  });

  nicknameInput.addEventListener('input', () => {
    // Reset check state when nickname changes
    if (nicknameCheckedValue !== nicknameInput.value.trim()) {
      nicknameChecked = false;
      nicknameCheckedValue = '';
    }
    const err = validateNickname(nicknameInput.value.trim());
    showFieldError('nickname-error', err);
    updateSubmitState();
  });

  pwInput.addEventListener('input', () => {
    if (authMode === 'signup') {
      const err = validatePassword(pwInput.value);
      showFieldError('password-error', err);
      // Re-validate confirm if it has a value
      if (pwConfirmInput.value) {
        const confirmErr = validatePasswordConfirm(pwInput.value, pwConfirmInput.value);
        showFieldError('password-confirm-error', confirmErr);
      }
    }
    updateSubmitState();
  });

  pwConfirmInput.addEventListener('input', () => {
    const err = validatePasswordConfirm(pwInput.value, pwConfirmInput.value);
    showFieldError('password-confirm-error', err);
    updateSubmitState();
  });

  // Nickname check button
  checkBtn.addEventListener('click', async () => {
    const nickname = nicknameInput.value.trim();
    const validErr = validateNickname(nickname);
    if (validErr !== '') {
      showFieldError('nickname-error', validErr || t('signup.error.nickname.length'));
      return;
    }

    checkBtn.disabled = true;
    try {
      const available = await checkNickname(nickname);
      if (available) {
        nicknameChecked = true;
        nicknameCheckedValue = nickname;
        showFieldError('nickname-error', t('signup.error.nickname.available'), true);
      } else {
        nicknameChecked = false;
        nicknameCheckedValue = '';
        showFieldError('nickname-error', t('signup.error.nickname.duplicate'));
      }
    } catch {
      showFieldError('nickname-error', t('auth.error.generic'));
    } finally {
      checkBtn.disabled = false;
      updateSubmitState();
    }
  });

  // Terms checkboxes
  initTermsCheckboxes();
}

function initTermsCheckboxes() {
  const allCb = document.getElementById('terms-all');
  const serviceCb = document.getElementById('terms-service');
  const privacyCb = document.getElementById('terms-privacy');
  const marketingCb = document.getElementById('terms-marketing');
  const items = [serviceCb, privacyCb, marketingCb];

  // "전체 동의" toggles all
  allCb.addEventListener('change', () => {
    items.forEach(cb => { cb.checked = allCb.checked; });
    updateSubmitState();
  });

  // Individual checkboxes sync "전체 동의"
  items.forEach(cb => {
    cb.addEventListener('change', () => {
      allCb.checked = items.every(c => c.checked);
      updateSubmitState();
    });
  });
}

// ── Recovery Forms (Find Email / Reset Password) ──

function showRecoveryPanel(panelId) {
  // Hide login form, tabs, recovery links, divider, google btn
  document.getElementById('login-form').classList.add('hidden');
  document.querySelector('.landing__tabs').classList.add('hidden');
  document.getElementById('recovery-links').classList.add('hidden');
  document.getElementById('landing-or')?.closest('.landing__divider')?.classList.add('hidden');
  document.getElementById('google-login-btn').classList.add('hidden');

  // Hide all recovery panels, show the target
  document.getElementById('find-email-panel').classList.add('hidden');
  document.getElementById('reset-pw-panel').classList.add('hidden');
  document.getElementById(panelId).classList.remove('hidden');
}

function hideRecoveryPanels() {
  document.getElementById('find-email-panel').classList.add('hidden');
  document.getElementById('reset-pw-panel').classList.add('hidden');

  // Restore login form and related elements
  document.getElementById('login-form').classList.remove('hidden');
  document.querySelector('.landing__tabs').classList.remove('hidden');
  document.getElementById('recovery-links').classList.remove('hidden');
  document.getElementById('landing-or')?.closest('.landing__divider')?.classList.remove('hidden');
  document.getElementById('google-login-btn').classList.remove('hidden');

  // Clear messages
  ['find-email-msg', 'reset-pw-msg'].forEach(id => {
    const el = document.getElementById(id);
    el.classList.add('hidden');
    el.textContent = '';
    el.className = 'landing__recovery-msg hidden';
  });
}

function showRecoveryMsg(id, msg, isSuccess) {
  const el = document.getElementById(id);
  el.textContent = msg;
  el.classList.remove('hidden', 'landing__recovery-msg--success', 'landing__recovery-msg--error');
  el.classList.add(isSuccess ? 'landing__recovery-msg--success' : 'landing__recovery-msg--error');
}

function initRecoveryForms() {
  // Open panels
  document.getElementById('find-email-link').addEventListener('click', () => {
    showRecoveryPanel('find-email-panel');
  });
  document.getElementById('reset-pw-link').addEventListener('click', () => {
    showRecoveryPanel('reset-pw-panel');
  });

  // Back buttons
  document.getElementById('find-email-back').addEventListener('click', hideRecoveryPanels);
  document.getElementById('reset-pw-back').addEventListener('click', hideRecoveryPanels);

  // Find Email form
  document.getElementById('find-email-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const nickname = document.getElementById('find-email-nickname').value.trim();
    if (!nickname) return;

    const btn = document.getElementById('find-email-submit');
    btn.disabled = true;

    try {
      const maskedEmail = await findEmailByNickname(nickname);
      if (maskedEmail) {
        showRecoveryMsg('find-email-msg', t('findEmail.success').replace('{email}', maskedEmail), true);
      } else {
        showRecoveryMsg('find-email-msg', t('findEmail.notFound'), false);
      }
    } catch {
      showRecoveryMsg('find-email-msg', t('auth.error.generic'), false);
    } finally {
      btn.disabled = false;
    }
  });

  // Reset Password form
  document.getElementById('reset-pw-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('reset-pw-email').value.trim();
    if (!email) return;

    const btn = document.getElementById('reset-pw-submit');
    btn.disabled = true;

    try {
      await resetPassword(email);
      showRecoveryMsg('reset-pw-msg', t('resetPw.success'), true);
    } catch (err) {
      const code = err?.code?.replace('auth/', '') || '';
      if (code === 'user-not-found') {
        showRecoveryMsg('reset-pw-msg', t('resetPw.notFound'), false);
      } else {
        showRecoveryMsg('reset-pw-msg', getAuthErrorMessage(err), false);
      }
    } finally {
      btn.disabled = false;
    }
  });
}

// ── Mobile Tab Bar + More Drawer ──

function initMobileTabBar() {
  // Tab navigation
  document.querySelectorAll('.mobile-tab[data-view]').forEach(tab => {
    tab.addEventListener('click', () => {
      const view = tab.dataset.view;
      switchView(view);
    });
  });

  // More button → open drawer
  document.getElementById('mob-tab-more').addEventListener('click', () => {
    openMobileDrawer();
  });

  // Close drawer
  document.getElementById('mobile-drawer-close').addEventListener('click', closeMobileDrawer);
  document.getElementById('mobile-drawer-overlay').addEventListener('click', closeMobileDrawer);

  // Drawer logout
  document.getElementById('mobile-logout-btn').addEventListener('click', async () => {
    closeMobileDrawer();
    await logout();
  });

  // Drawer language toggle
  document.querySelectorAll('#mobile-lang-toggle .lang-toggle__btn').forEach(btn => {
    btn.addEventListener('click', () => {
      setLang(btn.dataset.lang);
    });
  });
}

function openMobileDrawer() {
  const overlay = document.getElementById('mobile-drawer-overlay');
  const drawer = document.getElementById('mobile-drawer');
  overlay.classList.remove('hidden');
  drawer.classList.remove('hidden');
  // Trigger reflow for animation
  requestAnimationFrame(() => {
    overlay.classList.add('visible');
    drawer.classList.add('visible');
  });
}

function closeMobileDrawer() {
  const overlay = document.getElementById('mobile-drawer-overlay');
  const drawer = document.getElementById('mobile-drawer');
  overlay.classList.remove('visible');
  drawer.classList.remove('visible');
  setTimeout(() => {
    overlay.classList.add('hidden');
    drawer.classList.add('hidden');
  }, 300);
}

// ═══ Search Bottom Sheet ═══

function openSearchSheet() {
  const overlay = document.getElementById('search-sheet-overlay');
  const sheet = document.getElementById('search-sheet');
  overlay.classList.remove('hidden');
  sheet.classList.remove('hidden');
  requestAnimationFrame(() => {
    overlay.classList.add('visible');
    sheet.classList.add('visible');
  });
  setTimeout(() => {
    document.getElementById('search-sheet-input').focus();
  }, 300);
}

function closeSearchSheet() {
  const overlay = document.getElementById('search-sheet-overlay');
  const sheet = document.getElementById('search-sheet');
  overlay.classList.remove('visible');
  sheet.classList.remove('visible');
  setTimeout(() => {
    overlay.classList.add('hidden');
    sheet.classList.add('hidden');
  }, 300);
}

function renderSearchResults(query) {
  const list = document.getElementById('search-sheet-results');
  list.innerHTML = '';

  if (!query || query.length === 0) {
    return;
  }

  const q = query.toLowerCase();
  const results = [];

  // Search countries
  for (const c of COUNTRY_MAP) {
    if (c.en.toLowerCase().includes(q) || c.ko.toLowerCase().includes(q)) {
      results.push({ type: 'country', ko: c.ko, en: c.en });
    }
    if (results.length >= 20) break;
  }

  // Search spots
  if (results.length < 20) {
    for (const s of spots) {
      const name = s.name || '';
      const nameEn = s.nameEn || '';
      const country = s.country || '';
      const countryEn = s.countryEn || '';
      if (name.toLowerCase().includes(q) || nameEn.toLowerCase().includes(q) ||
          country.toLowerCase().includes(q) || countryEn.toLowerCase().includes(q)) {
        results.push({ type: 'spot', spot: s });
      }
      if (results.length >= 20) break;
    }
  }

  if (results.length === 0) {
    const li = document.createElement('li');
    li.className = 'search-sheet__no-results';
    li.textContent = t('search.noResults');
    list.appendChild(li);
    return;
  }

  for (const r of results) {
    const li = document.createElement('li');
    li.className = 'search-sheet__result-item';

    if (r.type === 'country') {
      li.innerHTML = `
        <div class="search-sheet__result-icon search-sheet__result-icon--country">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M2 12h20"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
        </div>
        <div class="search-sheet__result-text">
          <span class="search-sheet__result-name">${r.en} (${r.ko})</span>
          <span class="search-sheet__result-sub">${t('search.result.country')}</span>
        </div>`;
      li.addEventListener('click', () => {
        setCountry(r.ko);
        closeSearchSheet();
        refresh(false);
      });
    } else {
      const s = r.spot;
      const displayName = getLang() === 'en' && s.nameEn ? s.nameEn : s.name;
      const displayCountry = getLang() === 'en' && s.countryEn ? s.countryEn : s.country;
      li.innerHTML = `
        <div class="search-sheet__result-icon search-sheet__result-icon--spot">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
        </div>
        <div class="search-sheet__result-text">
          <span class="search-sheet__result-name">${displayName}</span>
          <span class="search-sheet__result-sub">${displayCountry} · ${t('search.result.spot')}</span>
        </div>`;
      li.addEventListener('click', () => {
        closeSearchSheet();
        flyToSpot(s.lat, s.lng);
        openModal(s);
      });
    }

    list.appendChild(li);
  }
}

function initSearchSheet() {
  const overlay = document.getElementById('search-sheet-overlay');
  const closeBtn = document.getElementById('search-sheet-close');
  const input = document.getElementById('search-sheet-input');
  const clearBtn = document.getElementById('search-sheet-clear');
  const resetBtn = document.getElementById('search-sheet-reset');
  const sheetRegionSel = document.getElementById('sheet-region-select');
  const sheetCountryInput = document.getElementById('sheet-country-input');
  const sheetCountryClear = document.getElementById('sheet-country-clear');
  const sheetCountryList = document.getElementById('sheet-country-list');

  // Close handlers
  closeBtn.addEventListener('click', closeSearchSheet);
  overlay.addEventListener('click', closeSearchSheet);

  // Search input
  input.addEventListener('input', () => {
    const q = input.value.trim();
    clearBtn.classList.toggle('hidden', !q);
    renderSearchResults(q);
  });

  clearBtn.addEventListener('click', () => {
    input.value = '';
    clearBtn.classList.add('hidden');
    document.getElementById('search-sheet-results').innerHTML = '';
    input.focus();
  });

  // Populate region select from main region-select
  const mainRegionSel = document.getElementById('region-select');
  for (let i = 1; i < mainRegionSel.options.length; i++) {
    const opt = document.createElement('option');
    opt.value = mainRegionSel.options[i].value;
    opt.textContent = mainRegionSel.options[i].textContent;
    sheetRegionSel.appendChild(opt);
  }

  // Region change → sync to main filter
  sheetRegionSel.addEventListener('change', () => {
    mainRegionSel.value = sheetRegionSel.value;
    mainRegionSel.dispatchEvent(new Event('change'));
  });

  // Sheet country autocomplete
  let sheetAcHighlight = -1;

  function getFilteredCountries(q) {
    const lower = q.toLowerCase();
    return COUNTRY_MAP.filter(c =>
      c.en.toLowerCase().includes(lower) || c.ko.toLowerCase().includes(lower)
    );
  }

  function renderSheetCountryList(matches) {
    sheetCountryList.innerHTML = '';
    if (matches.length === 0) {
      sheetCountryList.classList.add('hidden');
      return;
    }
    matches.forEach((c, i) => {
      const li = document.createElement('li');
      li.className = 'autocomplete__item';
      li.setAttribute('role', 'option');
      li.dataset.ko = c.ko;
      li.textContent = `${c.en} (${c.ko})`;
      if (i === sheetAcHighlight) li.classList.add('active');
      li.addEventListener('mousedown', e => {
        e.preventDefault();
        selectSheetCountry(c);
      });
      sheetCountryList.appendChild(li);
    });
    sheetCountryList.classList.remove('hidden');
  }

  function selectSheetCountry(c) {
    setCountry(c.ko);
    sheetCountryInput.value = `${c.en} (${c.ko})`;
    sheetCountryClear.classList.remove('hidden');
    sheetCountryList.classList.add('hidden');
    sheetAcHighlight = -1;
    refresh(false);
  }

  sheetCountryInput.addEventListener('input', () => {
    const q = sheetCountryInput.value.trim();
    if (!q) {
      sheetCountryList.classList.add('hidden');
    } else {
      sheetAcHighlight = -1;
      renderSheetCountryList(getFilteredCountries(q));
    }
  });

  sheetCountryInput.addEventListener('focus', () => {
    const q = sheetCountryInput.value.trim();
    if (q) renderSheetCountryList(getFilteredCountries(q));
  });

  sheetCountryInput.addEventListener('blur', () => {
    setTimeout(() => sheetCountryList.classList.add('hidden'), 150);
  });

  sheetCountryClear.addEventListener('click', () => {
    sheetCountryInput.value = '';
    sheetCountryClear.classList.add('hidden');
    sheetCountryList.classList.add('hidden');
    setCountry('');
    refresh(false);
  });

  // Reset button
  resetBtn.addEventListener('click', () => {
    input.value = '';
    clearBtn.classList.add('hidden');
    sheetCountryInput.value = '';
    sheetCountryClear.classList.add('hidden');
    sheetCountryList.classList.add('hidden');
    sheetRegionSel.value = '';
    document.getElementById('search-sheet-results').innerHTML = '';
    resetFilters();
  });
}

function updateMobileLabels() {
  const setText = (id, key) => { const el = document.getElementById(id); if (el) el.textContent = t(key); };
  setText('mob-tab-map-text', 'nav.map');
  setText('mob-tab-list-text', 'nav.list');
  setText('mob-tab-fav-text', 'nav.favorites');
  setText('mob-tab-log-text', 'nav.logbook');
  setText('mob-tab-more-text', 'nav.more');
  setText('mobile-drawer-title', 'nav.more');
  setText('mobile-lang-label', 'nav.language');
  setText('mobile-logout-text', 'nav.logout');
  setText('mobile-link-about', 'footer.about');
  setText('mobile-link-guide', 'footer.guide');
  setText('mobile-link-privacy', 'footer.privacy');
  setText('mobile-link-terms', 'footer.terms');
  setText('mobile-link-contact', 'footer.contact');

  // Search sheet labels
  setText('search-sheet-title', 'search.title');
  setText('search-sheet-country-label', 'search.country');
  setText('search-sheet-region-label', 'search.region');
  const searchInput = document.getElementById('search-sheet-input');
  if (searchInput) searchInput.placeholder = t('search.placeholder');
  const sheetReset = document.getElementById('search-sheet-reset');
  if (sheetReset) sheetReset.textContent = t('filter.reset');
}

function applyLangToggleState() {
  const lang = getLang();
  // Update all lang toggle buttons (header + landing + drawer)
  document.querySelectorAll('.lang-toggle__btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.lang === lang);
  });
}

function updateStaticLabels() {
  const lang = getLang();

  // html lang attribute
  document.documentElement.lang = lang === 'en' ? 'en' : 'ko';

  // page title
  document.title = t('title');

  // nav buttons
  document.querySelectorAll('.nav-btn').forEach(btn => {
    const view = btn.dataset.view;
    if (view === 'map') btn.childNodes[0].textContent = t('nav.map');
    else if (view === 'list') btn.childNodes[0].textContent = t('nav.list');
    else if (view === 'favorites') {
      // Preserve fav-count span
      const span = btn.querySelector('#fav-count');
      const count = span ? span.textContent : '0';
      btn.innerHTML = `${t('nav.favorites')}(<span id="fav-count">${count}</span>)`;
    } else if (view === 'logbook') {
      btn.textContent = t('nav.logbook');
    }
  });

  // list toggle text
  const listToggleText = document.getElementById('list-toggle-text');
  if (listToggleText) listToggleText.textContent = t('nav.listToggle');

  // my spot toggle text
  const myspotToggleText = document.getElementById('myspot-toggle-text');
  if (myspotToggleText) myspotToggleText.textContent = t('myspot.toggle');

  // empty state texts
  const emptyP = document.querySelector('#empty-state p');
  if (emptyP) emptyP.textContent = t('empty.noSpots');
  const emptyResetBtn = document.getElementById('empty-reset');
  if (emptyResetBtn) emptyResetBtn.textContent = t('empty.reset');

  const favEmptyP = document.querySelector('#fav-empty-state p');
  if (favEmptyP) favEmptyP.textContent = t('empty.noFavorites');
  const favEmptySub = document.querySelector('#fav-empty-state .empty-state__sub');
  if (favEmptySub) favEmptySub.textContent = t('empty.noFavoritesSub');

  // logbook empty state
  const logEmptyText = document.getElementById('logbook-empty-text');
  if (logEmptyText) logEmptyText.textContent = t('logbook.empty');
  const logEmptySub = document.getElementById('logbook-empty-sub');
  if (logEmptySub) logEmptySub.textContent = t('logbook.emptySub');

  // footer labels
  const el = (id) => document.getElementById(id);
  const setText = (id, key) => { const e = el(id); if (e) e.textContent = t(key); };
  setText('footer-section-service', 'footer.section.service');
  setText('footer-section-legal', 'footer.section.legal');
  setText('footer-section-info', 'footer.section.info');
  setText('footer-section-data', 'footer.section.data');
  setText('footer-desc', 'footer.desc');
  setText('footer-privacy', 'footer.privacy');
  setText('footer-terms', 'footer.terms');
  setText('footer-about', 'footer.about');
  setText('footer-guide', 'footer.guide');
  setText('footer-contact', 'footer.contact');
  setText('footer-copyright', 'footer.copyright');

  // cookie banner labels
  const cookieText = el('cookie-text');
  if (cookieText) {
    const learnMore = el('cookie-learn-more');
    cookieText.childNodes[0].textContent = t('cookie.text') + ' ';
    if (learnMore) learnMore.textContent = t('cookie.learnMore');
  }
  setText('cookie-accept', 'cookie.accept');
}

function toggleList() {
  listVisible = !listVisible;
  const mainInner = document.querySelector('.main__inner');
  const cardsPanel = document.getElementById('cards-panel');
  const btn = document.getElementById('list-toggle');

  mainInner.classList.toggle('show-list', listVisible);
  cardsPanel.classList.toggle('map-hidden', !listVisible);
  btn.setAttribute('aria-pressed', listVisible);
  invalidateMapSize();
}

function switchView(view) {
  currentView = view;

  // 네비 활성화 (desktop)
  document.querySelectorAll('.nav-btn').forEach(btn => {
    const isActive = btn.dataset.view === view;
    btn.classList.toggle('active', isActive);
    btn.setAttribute('aria-pressed', isActive);
  });

  // 모바일 탭 활성화 동기화
  document.querySelectorAll('.mobile-tab[data-view]').forEach(tab => {
    tab.classList.toggle('active', tab.dataset.view === view);
  });

  const mapPanel = document.getElementById('map-panel');
  const cardsPanel = document.getElementById('cards-panel');
  const mainInner = document.querySelector('.main__inner');
  const listToggleBtn = document.getElementById('list-toggle');
  const filterBar = document.getElementById('filter-bar');
  const logbookView = document.getElementById('logbook-view');

  // Hide logbook view by default
  logbookView.classList.add('hidden');

  // Show/hide filter bar for logbook
  filterBar.classList.toggle('logbook-hidden', view === 'logbook');

  // Show/hide mobile activity tabs for logbook
  const mobileActivityTabs = document.getElementById('mobile-activity-tabs');
  if (mobileActivityTabs) mobileActivityTabs.classList.toggle('logbook-hidden', view === 'logbook');

  if (view === 'map') {
    mapPanel.classList.remove('hidden');
    mainInner.style.gridTemplateColumns = '';
    listToggleBtn.classList.remove('hidden');

    // 리스트 토글 상태에 따라 표시/숨김
    mainInner.classList.toggle('show-list', listVisible);
    cardsPanel.classList.toggle('map-hidden', !listVisible);
    listToggleBtn.setAttribute('aria-pressed', listVisible);
    invalidateMapSize();
  } else if (view === 'logbook') {
    mapPanel.classList.add('hidden');
    cardsPanel.classList.remove('hidden');
    cardsPanel.classList.remove('map-hidden');
    mainInner.classList.remove('show-list');
    mainInner.style.gridTemplateColumns = '1fr';
    listToggleBtn.classList.add('hidden');
    logbookView.classList.remove('hidden');
  } else {
    mapPanel.classList.add('hidden');
    cardsPanel.classList.remove('hidden');
    cardsPanel.classList.remove('map-hidden');
    mainInner.classList.remove('show-list');
    mainInner.style.gridTemplateColumns = '1fr';
    listToggleBtn.classList.add('hidden');
  }

  refresh(false);
}

function refresh(fitToMarkers = false) {
  if (currentView === 'logbook') {
    // Hide normal card elements
    document.getElementById('cards-grid').innerHTML = '';
    document.getElementById('spot-count').textContent = '';
    document.getElementById('empty-state').classList.add('hidden');
    document.getElementById('fav-empty-state').classList.add('hidden');
    renderLogbook();
    return;
  }

  // Hide logbook view when not in logbook
  document.getElementById('logbook-view').classList.add('hidden');

  const isFavView = currentView === 'favorites';
  const favSet = getFavorites();
  const filtered = filterSpots(isFavView, favSet);

  // Personal spots
  const showMySpots = document.querySelector('#myspot-toggle input[type="checkbox"]')?.checked;
  const mySpots = showMySpots ? filterMySpots(getMySpots()) : [];

  if (isFavView && filtered.length === 0) {
    renderFavEmpty();
  } else {
    renderCards(filtered, currentView === 'favorites' ? [] : mySpots);
  }

  // 지도 마커는 항상 현재 필터 기준
  updateMarkers(isFavView ? filtered : filterSpots(false), fitToMarkers);
  updateFavCount();

  // Personal markers on map
  if (showMySpots && currentView !== 'favorites') {
    updatePersonalMarkers(filterMySpots(getMySpots()));
  } else {
    updatePersonalMarkers([]);
  }

  // Activity tab counts (desktop + mobile)
  const counts = getActivityCounts(isFavView, favSet);
  document.getElementById('count-all').textContent = counts.total;
  document.getElementById('count-skin').textContent = counts.skin;
  document.getElementById('count-scuba').textContent = counts.scuba;
  const countMyspot = document.getElementById('count-myspot');
  if (countMyspot) countMyspot.textContent = counts.myspot;

  // Mobile activity tab counts
  const mobAll = document.getElementById('mob-count-all');
  const mobSkin = document.getElementById('mob-count-skin');
  const mobScuba = document.getElementById('mob-count-scuba');
  const mobMyspot = document.getElementById('mob-count-myspot');
  if (mobAll) mobAll.textContent = counts.total;
  if (mobSkin) mobSkin.textContent = counts.skin;
  if (mobScuba) mobScuba.textContent = counts.scuba;
  if (mobMyspot) mobMyspot.textContent = counts.myspot;
}

// ═══ Logbook View ═══

function renderLogbook() {
  const view = document.getElementById('logbook-view');
  const statsEl = document.getElementById('logbook-stats');
  const listEl = document.getElementById('logbook-list');
  const emptyEl = document.getElementById('logbook-empty-state');
  const addBtn = document.getElementById('add-log-btn');

  // Update button text
  addBtn.textContent = t('logbook.addNew');

  // Stats
  const stats = getLogStats();
  statsEl.innerHTML = `
    <div class="logbook-stats__card">
      <div class="logbook-stats__label">${t('logbook.stats.totalDives')}</div>
      <div class="logbook-stats__value">${stats.totalDives}</div>
    </div>
    <div class="logbook-stats__card">
      <div class="logbook-stats__label">${t('logbook.stats.maxDepth')}</div>
      <div class="logbook-stats__value">${stats.maxDepth > 0 ? stats.maxDepth + 'm' : '-'}</div>
    </div>
    <div class="logbook-stats__card">
      <div class="logbook-stats__label">${t('logbook.stats.totalTime')}</div>
      <div class="logbook-stats__value">${stats.totalTime > 0 ? stats.totalTime + 'min' : '-'}</div>
    </div>
  `;

  // Entries
  const entries = getLogEntries();
  listEl.innerHTML = '';

  if (entries.length === 0) {
    emptyEl.classList.remove('hidden');
    return;
  }

  emptyEl.classList.add('hidden');

  entries.forEach(entry => {
    const card = document.createElement('div');
    card.className = 'log-card';

    const actLabel = entry.activityType === 'scuba' ? t('activity.scuba') : t('activity.skin');

    card.innerHTML = `
      <div class="log-card__header">
        <span class="log-card__date">${entry.date}</span>
        <span class="badge badge--activity badge--activity-${entry.activityType}">${actLabel}</span>
      </div>
      <div class="log-card__spot">${entry.spotName || '-'}</div>
      <div class="log-card__stats">
        ${entry.maxDepth != null ? `<div class="card__stat"><span class="card__stat-label">${t('logbook.depth')}</span><span class="card__stat-value">${entry.maxDepth}m</span></div>` : ''}
        ${entry.diveTime != null ? `<div class="card__stat"><span class="card__stat-label">${t('logbook.time')}</span><span class="card__stat-value">${entry.diveTime}min</span></div>` : ''}
        ${entry.waterTemp != null ? `<div class="card__stat"><span class="card__stat-label">${t('logbook.temp')}</span><span class="card__stat-value">${entry.waterTemp}°C</span></div>` : ''}
      </div>
      ${entry.memo ? `<div class="log-card__memo">${entry.memo}</div>` : ''}
      <div class="log-card__actions">
        <button class="log-edit-btn" data-id="${entry.id}">${t('logbook.card.edit')}</button>
        <button class="log-delete-btn" data-id="${entry.id}">${t('logbook.card.delete')}</button>
      </div>
    `;

    card.querySelector('.log-edit-btn').addEventListener('click', () => {
      openLogFormModal(entry.id);
    });
    card.querySelector('.log-delete-btn').addEventListener('click', async () => {
      if (confirm(t('logbook.delete.confirm'))) {
        await deleteLogEntry(entry.id);
        renderLogbook();
      }
    });

    listEl.appendChild(card);
  });
}

// ═══ Log Form Modal ═══

function initLogModal() {
  const overlay = document.getElementById('log-modal-overlay');
  const closeBtn = document.getElementById('log-modal-close');
  const cancelBtn = document.getElementById('log-cancel');
  const form = document.getElementById('log-form');

  function close() {
    overlay.classList.add('hidden');
    overlay.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
  }

  closeBtn.addEventListener('click', close);
  cancelBtn.addEventListener('click', close);
  overlay.addEventListener('click', e => { if (e.target === overlay) close(); });

  // Log pick-on-map button
  document.getElementById('log-pick-map-btn').addEventListener('click', () => {
    startMapPicking('log');
  });

  // Activity type toggle — show/hide scuba fields
  document.querySelectorAll('#log-activity-switch .log-activity-switch__btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#log-activity-switch .log-activity-switch__btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const val = btn.dataset.value;
      document.getElementById('log-activity-value').value = val;
      const scubaFields = document.getElementById('log-scuba-fields');
      scubaFields.classList.toggle('hidden', val !== 'scuba');
    });
  });

  form.addEventListener('submit', async e => {
    e.preventDefault();
    const editId = document.getElementById('log-edit-id').value;

    const data = {
      date: document.getElementById('log-date').value,
      spotName: document.getElementById('log-spot-name').value,
      activityType: document.getElementById('log-activity-value').value,
      maxDepth: parseFloat(document.getElementById('log-depth').value) || null,
      diveTime: parseInt(document.getElementById('log-time').value) || null,
      waterTemp: parseFloat(document.getElementById('log-temp').value) || null,
      visibility: parseFloat(document.getElementById('log-visibility').value) || null,
      equipment: document.getElementById('log-equipment').value,
      weight: parseFloat(document.getElementById('log-weight').value) || null,
      tankPressureStart: parseInt(document.getElementById('log-tank-start').value) || null,
      tankPressureEnd: parseInt(document.getElementById('log-tank-end').value) || null,
      buddy: document.getElementById('log-buddy').value,
      weather: document.getElementById('log-weather').value,
      lat: parseFloat(document.getElementById('log-lat').value) || null,
      lng: parseFloat(document.getElementById('log-lng').value) || null,
      memo: document.getElementById('log-memo').value,
    };

    if (editId) {
      await updateLogEntry(editId, data);
    } else {
      await addLogEntry(data);
    }

    close();
    if (currentView === 'logbook') renderLogbook();
  });
}

function openLogFormModal(editId) {
  const overlay = document.getElementById('log-modal-overlay');
  const title = document.getElementById('log-modal-title');
  const form = document.getElementById('log-form');
  const scubaFields = document.getElementById('log-scuba-fields');

  form.reset();
  document.getElementById('log-edit-id').value = '';

  // Populate spot datalist
  const datalist = document.getElementById('log-spot-datalist');
  datalist.innerHTML = '';
  spots.forEach(s => {
    const opt = document.createElement('option');
    opt.value = s.name;
    datalist.appendChild(opt);
  });
  getMySpots().forEach(s => {
    const opt = document.createElement('option');
    opt.value = s.name;
    datalist.appendChild(opt);
  });

  // Update form labels
  document.getElementById('log-date-label').textContent = t('logbook.form.date');
  document.getElementById('log-spot-label').textContent = t('logbook.form.spotName');
  document.getElementById('log-activity-label').textContent = t('logbook.form.activityType');
  document.getElementById('log-depth-label').textContent = t('logbook.form.maxDepth');
  document.getElementById('log-time-label').textContent = t('logbook.form.diveTime');
  document.getElementById('log-temp-label').textContent = t('logbook.form.waterTemp');
  document.getElementById('log-vis-label').textContent = t('logbook.form.visibility');
  document.getElementById('log-equip-label').textContent = t('logbook.form.equipment');
  document.getElementById('log-weight-label').textContent = t('logbook.form.weight');
  document.getElementById('log-tank-start-label').textContent = t('logbook.form.tankStart');
  document.getElementById('log-tank-end-label').textContent = t('logbook.form.tankEnd');
  document.getElementById('log-buddy-label').textContent = t('logbook.form.buddy');
  document.getElementById('log-weather-label').textContent = t('logbook.form.weather');
  document.getElementById('log-location-label').textContent = t('logbook.form.location');
  document.getElementById('log-pick-map-btn').textContent = t('logbook.form.pickOnMap');
  document.getElementById('log-memo-label').textContent = t('logbook.form.memo');
  document.getElementById('log-save').textContent = t('logbook.form.save');
  document.getElementById('log-cancel').textContent = t('logbook.form.cancel');

  if (editId) {
    const entry = getLogEntry(editId);
    if (!entry) return;
    title.textContent = t('logbook.form.titleEdit');
    document.getElementById('log-edit-id').value = editId;
    document.getElementById('log-date').value = entry.date || '';
    document.getElementById('log-spot-name').value = entry.spotName || '';
    document.getElementById('log-activity-value').value = entry.activityType || 'skin';
    document.querySelectorAll('#log-activity-switch .log-activity-switch__btn').forEach(b => {
      b.classList.toggle('active', b.dataset.value === (entry.activityType || 'skin'));
    });
    document.getElementById('log-depth').value = entry.maxDepth ?? '';
    document.getElementById('log-time').value = entry.diveTime ?? '';
    document.getElementById('log-temp').value = entry.waterTemp ?? '';
    document.getElementById('log-visibility').value = entry.visibility ?? '';
    document.getElementById('log-equipment').value = entry.equipment || '';
    document.getElementById('log-weight').value = entry.weight ?? '';
    document.getElementById('log-tank-start').value = entry.tankPressureStart ?? '';
    document.getElementById('log-tank-end').value = entry.tankPressureEnd ?? '';
    document.getElementById('log-buddy').value = entry.buddy || '';
    document.getElementById('log-weather').value = entry.weather || '';
    document.getElementById('log-lat').value = entry.lat ?? '';
    document.getElementById('log-lng').value = entry.lng ?? '';
    document.getElementById('log-memo').value = entry.memo || '';
    scubaFields.classList.toggle('hidden', entry.activityType !== 'scuba');
  } else {
    title.textContent = t('logbook.form.title');
    document.getElementById('log-date').value = new Date().toISOString().slice(0, 10);
    document.getElementById('log-activity-value').value = 'skin';
    document.querySelectorAll('#log-activity-switch .log-activity-switch__btn').forEach(b => {
      b.classList.toggle('active', b.dataset.value === 'skin');
    });
    scubaFields.classList.add('hidden');
  }

  // Show coords text if editing with existing coordinates
  const latVal = document.getElementById('log-lat').value;
  const lngVal = document.getElementById('log-lng').value;
  const coordsText = document.getElementById('log-coords-text');
  if (latVal && lngVal) {
    coordsText.textContent = `${parseFloat(latVal).toFixed(4)}, ${parseFloat(lngVal).toFixed(4)}`;
  } else {
    coordsText.textContent = '';
  }

  overlay.classList.remove('hidden');
  overlay.setAttribute('aria-hidden', 'false');
  document.body.style.overflow = 'hidden';
}

// ═══ Spot Form Modal ═══

function initSpotModal() {
  const overlay = document.getElementById('spot-modal-overlay');
  const closeBtn = document.getElementById('spot-modal-close');
  const cancelBtn = document.getElementById('spot-cancel');
  const form = document.getElementById('spot-form');

  function close() {
    overlay.classList.add('hidden');
    overlay.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
  }

  closeBtn.addEventListener('click', close);
  cancelBtn.addEventListener('click', close);
  overlay.addEventListener('click', e => { if (e.target === overlay) close(); });

  // Spot pick-on-map button
  document.getElementById('spot-pick-map-btn').addEventListener('click', () => {
    startMapPicking('spot');
  });

  form.addEventListener('submit', async e => {
    e.preventDefault();
    const editId = document.getElementById('spot-edit-id').value;

    const activityTypes = [];
    document.querySelectorAll('input[name="spot-activity"]:checked').forEach(cb => {
      activityTypes.push(cb.value);
    });
    if (activityTypes.length === 0) activityTypes.push('skin');

    const data = {
      name: document.getElementById('spot-name').value,
      lat: parseFloat(document.getElementById('spot-lat').value) || 0,
      lng: parseFloat(document.getElementById('spot-lng').value) || 0,
      depth: document.getElementById('spot-depth').value,
      waterTemp: {
        min: parseFloat(document.getElementById('spot-temp-min').value) || null,
        max: parseFloat(document.getElementById('spot-temp-max').value) || null,
      },
      difficulty: document.getElementById('spot-difficulty').value,
      activityTypes,
      memo: document.getElementById('spot-memo').value,
    };

    if (editId) {
      await updateMySpot(editId, data);
    } else {
      await addMySpot(data);
    }

    close();
    refresh(false);
  });
}

function openSpotFormModal(editId) {
  const overlay = document.getElementById('spot-modal-overlay');
  const title = document.getElementById('spot-modal-title');
  const form = document.getElementById('spot-form');

  form.reset();
  document.getElementById('spot-edit-id').value = '';

  // Update form labels
  document.getElementById('spot-name-label').textContent = t('myspot.form.name');
  document.getElementById('spot-location-label').textContent = t('myspot.form.location');
  document.getElementById('spot-pick-map-btn').textContent = t('myspot.form.pickOnMap');
  document.getElementById('spot-depth-label').textContent = t('myspot.form.depth');
  document.getElementById('spot-temp-min-label').textContent = t('myspot.form.tempMin');
  document.getElementById('spot-temp-max-label').textContent = t('myspot.form.tempMax');
  document.getElementById('spot-difficulty-label').textContent = t('myspot.form.difficulty');
  document.getElementById('spot-activity-label').textContent = t('myspot.form.activityTypes');
  document.getElementById('spot-memo-label').textContent = t('myspot.form.memo');
  document.getElementById('spot-save').textContent = t('myspot.form.save');
  document.getElementById('spot-cancel').textContent = t('myspot.form.cancel');

  // Update difficulty select labels
  const diffSelect = document.getElementById('spot-difficulty');
  diffSelect.options[0].textContent = t('difficulty.beginner');
  diffSelect.options[1].textContent = t('difficulty.intermediate');
  diffSelect.options[2].textContent = t('difficulty.advanced');

  if (editId) {
    const spot = getMySpot(editId);
    if (!spot) return;
    title.textContent = t('myspot.form.titleEdit');
    document.getElementById('spot-edit-id').value = editId;
    document.getElementById('spot-name').value = spot.name || '';
    document.getElementById('spot-lat').value = spot.lat || '';
    document.getElementById('spot-lng').value = spot.lng || '';
    document.getElementById('spot-depth').value = spot.depth || '';
    document.getElementById('spot-temp-min').value = spot.waterTemp?.min ?? '';
    document.getElementById('spot-temp-max').value = spot.waterTemp?.max ?? '';
    document.getElementById('spot-difficulty').value = spot.difficulty || 'beginner';
    document.querySelectorAll('input[name="spot-activity"]').forEach(cb => {
      cb.checked = spot.activityTypes?.includes(cb.value);
    });
    document.getElementById('spot-memo').value = spot.memo || '';
  } else {
    title.textContent = t('myspot.form.title');
  }

  // Show coords text if editing with existing coordinates
  const latVal = document.getElementById('spot-lat').value;
  const lngVal = document.getElementById('spot-lng').value;
  const coordsText = document.getElementById('spot-coords-text');
  if (latVal && lngVal) {
    coordsText.textContent = `${parseFloat(latVal).toFixed(4)}, ${parseFloat(lngVal).toFixed(4)}`;
  } else {
    coordsText.textContent = '';
  }

  overlay.classList.remove('hidden');
  overlay.setAttribute('aria-hidden', 'false');
  document.body.style.overflow = 'hidden';
}

// ═══ Full-screen Map Picking ═══

function startMapPicking(target) {
  mapPickingState = { target };

  // Hide the current modal
  const overlayId = target === 'log' ? 'log-modal-overlay' : 'spot-modal-overlay';
  document.getElementById(overlayId).classList.add('hidden');
  document.getElementById(overlayId).setAttribute('aria-hidden', 'true');
  document.body.style.overflow = '';

  // Ensure map panel is visible and full-screen
  const mapPanel = document.getElementById('map-panel');
  const cardsPanel = document.getElementById('cards-panel');
  const mainInner = document.querySelector('.main__inner');
  const filterBar = document.getElementById('filter-bar');

  mapPanel.classList.remove('hidden');
  cardsPanel.classList.add('hidden');
  filterBar.classList.add('hidden');
  mainInner.classList.remove('show-list');
  mainInner.style.gridTemplateColumns = '1fr';
  invalidateMapSize();

  // Show existing markers on the map
  const isFavView = currentView === 'favorites';
  const favSet = getFavorites();
  updateMarkers(isFavView ? filterSpots(true, favSet) : filterSpots(false), false);
  const showMySpots = document.querySelector('#myspot-toggle input[type="checkbox"]')?.checked;
  if (showMySpots) {
    updatePersonalMarkers(filterMySpots(getMySpots()));
  } else {
    updatePersonalMarkers([]);
  }

  // Add crosshair cursor
  document.getElementById('map').classList.add('map--picking');

  // Show banner
  const banner = document.getElementById('map-pick-banner');
  document.getElementById('map-pick-banner-text').textContent = t('logbook.form.pickBanner');
  document.getElementById('map-pick-cancel').textContent = t('logbook.form.pickCancel');
  banner.classList.remove('hidden');

  // Register one-time click handler on main map
  const map = getMapInstance();
  map.once('click', finishMapPicking);
}

function finishMapPicking(e) {
  if (!mapPickingState) return;
  const { target } = mapPickingState;
  const { lat, lng } = e.latlng;

  // Set coordinates
  const prefix = target === 'log' ? 'log' : 'spot';
  document.getElementById(`${prefix}-lat`).value = lat.toFixed(6);
  document.getElementById(`${prefix}-lng`).value = lng.toFixed(6);
  document.getElementById(`${prefix}-coords-text`).textContent = `${lat.toFixed(4)}, ${lng.toFixed(4)}`;

  // Clean up picking UI
  document.getElementById('map').classList.remove('map--picking');
  document.getElementById('map-pick-banner').classList.add('hidden');

  // Restore filter-bar
  document.getElementById('filter-bar').classList.remove('hidden');

  // Re-open the modal
  const overlayId = target === 'log' ? 'log-modal-overlay' : 'spot-modal-overlay';
  document.getElementById(overlayId).classList.remove('hidden');
  document.getElementById(overlayId).setAttribute('aria-hidden', 'false');
  document.body.style.overflow = 'hidden';

  // Restore original view layout
  switchView(currentView);

  mapPickingState = null;
}

function cancelMapPicking() {
  if (!mapPickingState) return;
  const { target } = mapPickingState;

  // Remove click handler
  const map = getMapInstance();
  map.off('click', finishMapPicking);

  // Clean up picking UI
  document.getElementById('map').classList.remove('map--picking');
  document.getElementById('map-pick-banner').classList.add('hidden');

  // Restore filter-bar
  document.getElementById('filter-bar').classList.remove('hidden');

  // Re-open the modal
  const overlayId = target === 'log' ? 'log-modal-overlay' : 'spot-modal-overlay';
  document.getElementById(overlayId).classList.remove('hidden');
  document.getElementById(overlayId).setAttribute('aria-hidden', 'false');
  document.body.style.overflow = 'hidden';

  // Restore original view layout
  switchView(currentView);

  mapPickingState = null;
}

// ═══ Cookie Consent Banner ═══

function initCookieBanner() {
  const banner = document.getElementById('cookie-banner');
  const acceptBtn = document.getElementById('cookie-accept');
  if (!banner || !acceptBtn) return;

  if (localStorage.getItem('where2dive_cookie_consent') === 'accepted') {
    banner.classList.add('hidden');
    return;
  }

  banner.classList.remove('hidden');

  acceptBtn.addEventListener('click', () => {
    localStorage.setItem('where2dive_cookie_consent', 'accepted');
    banner.classList.add('hidden');
  });
}
