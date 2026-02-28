// 앱 엔트리 포인트
import { spots, COUNTRY_MAP, REGIONS } from './data.js';
import { initMap, updateMarkers, setMapSpotClickHandler, flyToSpot, invalidateMapSize, updatePersonalMarkers, setPersonalSpotClickHandler, getMapInstance } from './map.js';
import { renderCards, renderFavEmpty, openModal, initModal, setDetailClickHandler, updateFavCount, setPersonalSpotCardHandlers, refreshReviews } from './ui.js';
import { initFilters, filterSpots, setFilterListener, refreshFilterLabels, getActivityCounts, filterMySpots, setSearchToggleListener, setCountry, resetFilters } from './filters.js';
import { addReview, updateReview, deleteReview, clearReviewCache, validateFile, isVideoFile } from './reviews.js';
import { getFavorites, loadFavorites, clearFavorites } from './favorites.js';
import { getLang, setLang, setLangChangeListener, t } from './i18n.js';
import { isLoggedIn, login, signup, loginWithGoogle, logout, onAuthChange, waitForAuth, checkNickname, resetPassword, findEmailByNickname, getCurrentUid } from './auth.js';
import { getLogEntries, getLogEntry, addLogEntry, updateLogEntry, deleteLogEntry, getLogStats, loadLogbook, clearLogbook } from './logbook.js';
import { getMySpots, getMySpot, addMySpot, updateMySpot, deleteMySpot, loadMySpots, clearMySpots } from './myspots.js';
import { migrateLocalStorageToFirestore } from './migrate.js';
import { loadProfile, getCachedProfile, clearProfileCache, saveProfile, uploadProfilePhoto, uploadCertPhoto, addCertification, removeCertification, loadPublicProfile, getUserReviewCount, getUserRecentReviews, CERT_ORGS } from './profile.js';
import { escapeHtml, renderStars, formatReviewDate } from './ui.js';
import { loadAchievements, clearAchievementsCache, checkAchievements, buildAchievementStats, countUserReviews, ACHIEVEMENT_DEFS, CATEGORIES, getUserAchievements, isUnlocked, getUnlockedCount, getTotalCount, getFeaturedBadges, saveFeaturedBadges } from './achievements.js';

// ── Analytics helpers ──
function trackEvent(event, params) {
  if (typeof gtag === 'function') gtag('event', event, params);
}

// ── State ──
let currentView = 'map'; // 'map' | 'list' | 'favorites' | 'logbook'
let listVisible = false;
let booted = false;
let mapPickingState = null; // { target: 'log'|'spot' }
let authMode = 'login'; // 'login' | 'signup'

// Logbook media state
let logPendingFiles = [];   // new File objects to upload
let logExistingMedia = [];  // existing {url,path} from edit mode
let logRemovedPaths = [];   // paths to delete on save

// Convert custom time selects → "HH:mm" 24h string (or '' if incomplete)
function getTimeFromSelects(prefix) {
  const ampm = document.getElementById(`${prefix}-ampm`).value;
  const hour = document.getElementById(`${prefix}-hour`).value;
  const min = document.getElementById(`${prefix}-min`).value;
  if (!ampm || !hour || !min) return '';
  let h = parseInt(hour);
  if (ampm === 'AM' && h === 12) h = 0;
  else if (ampm === 'PM' && h !== 12) h += 12;
  return `${String(h).padStart(2, '0')}:${String(parseInt(min)).padStart(2, '0')}`;
}

// Set custom time selects from "HH:mm" 24h string
function setTimeToSelects(prefix, value) {
  const ampmSel = document.getElementById(`${prefix}-ampm`);
  const hourSel = document.getElementById(`${prefix}-hour`);
  const minSel = document.getElementById(`${prefix}-min`);
  if (!value) { ampmSel.value = ''; hourSel.value = ''; minSel.value = ''; return; }
  const [hStr, mStr] = value.split(':');
  let h = parseInt(hStr);
  const ampm = h >= 12 ? 'PM' : 'AM';
  if (h === 0) h = 12;
  else if (h > 12) h -= 12;
  ampmSel.value = ampm;
  hourSel.value = String(h);
  // Snap to nearest 5-min option
  const m = parseInt(mStr);
  const snapped = Math.round(m / 5) * 5;
  minSel.value = String(snapped >= 60 ? 55 : snapped);
}

// Format "HH:mm" 24h → "h:mm AM/PM" with localized label
function formatTime12(value) {
  if (!value) return '';
  const [hStr, mStr] = value.split(':');
  let h = parseInt(hStr);
  const ampm = h >= 12 ? t('logbook.time.pm') : t('logbook.time.am');
  if (h === 0) h = 12;
  else if (h > 12) h -= 12;
  return `${h}:${mStr} ${ampm}`;
}

// Update AM/PM option labels based on current language
function updateTimeSelectLabels() {
  const amLabel = t('logbook.time.am');
  const pmLabel = t('logbook.time.pm');
  ['log-entry-ampm', 'log-exit-ampm'].forEach(id => {
    const sel = document.getElementById(id);
    if (!sel) return;
    sel.querySelectorAll('option').forEach(opt => {
      if (opt.value === 'AM') opt.textContent = amLabel;
      else if (opt.value === 'PM') opt.textContent = pmLabel;
    });
  });
}

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
  await Promise.all([loadFavorites(), loadLogbook(), loadMySpots(), loadProfile(), loadAchievements()]);
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
  initReviewModal();
  initMediaViewer();
  initProfileModal();
  initProfileEditModal();
  initCertModal();
  initAchievementsModal();
  initAchievementDetailModal();

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
      trackEvent('view_spot', { spot_name: spot.name, spot_country: spot.country });
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

  // Logo click → reset map to initial view
  document.getElementById('logo-home').addEventListener('click', e => {
    e.preventDefault();
    switchView('map');
    getMapInstance().flyTo([0, 130], 2, { duration: 1 });
    resetFilters();
  });

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
      clearReviewCache();
      clearProfileCache();
      clearAchievementsCache();
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

  // ── Info modal ──
  initInfoModal();

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
        trackEvent('view_spot', { spot_name: s.name, spot_country: s.country });
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
  const sheetDifficultySel = document.getElementById('sheet-difficulty-select');
  const sheetSeasonSel = document.getElementById('sheet-season-select');
  const sheetTempSel = document.getElementById('sheet-temp-select');
  const sheetVisSel = document.getElementById('sheet-visibility-select');

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

  // New filter selects → sync to main filters
  sheetDifficultySel.addEventListener('change', () => {
    document.getElementById('difficulty-select').value = sheetDifficultySel.value;
    document.getElementById('difficulty-select').dispatchEvent(new Event('change'));
  });
  sheetSeasonSel.addEventListener('change', () => {
    document.getElementById('season-select').value = sheetSeasonSel.value;
    document.getElementById('season-select').dispatchEvent(new Event('change'));
  });
  sheetTempSel.addEventListener('change', () => {
    document.getElementById('temp-select').value = sheetTempSel.value;
    document.getElementById('temp-select').dispatchEvent(new Event('change'));
  });
  sheetVisSel.addEventListener('change', () => {
    document.getElementById('visibility-select').value = sheetVisSel.value;
    document.getElementById('visibility-select').dispatchEvent(new Event('change'));
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
    sheetDifficultySel.value = '';
    sheetSeasonSel.value = '';
    sheetTempSel.value = '';
    sheetVisSel.value = '';
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
  setText('mobile-profile-text', 'nav.profile');
  setText('mobile-achievements-text', 'nav.achievements');
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
  const sheetCountryEl = document.getElementById('sheet-country-input');
  if (sheetCountryEl) sheetCountryEl.placeholder = t('search.countryPlaceholder');
  const sheetRegionSel = document.getElementById('sheet-region-select');
  if (sheetRegionSel) {
    sheetRegionSel.options[0].textContent = t('filter.region.all');
    REGIONS.forEach((r, i) => {
      if (sheetRegionSel.options[i + 1]) {
        sheetRegionSel.options[i + 1].textContent = getLang() === 'en' ? r.labelEn : r.label;
      }
    });
  }
  // New filter labels in search sheet
  setText('search-sheet-difficulty-label', 'search.difficulty');
  setText('search-sheet-season-label', 'search.season');
  setText('search-sheet-temp-label', 'search.temp');
  setText('search-sheet-visibility-label', 'search.visibility');

  // Sync new sheet filter option labels
  const sheetDiffSel = document.getElementById('sheet-difficulty-select');
  if (sheetDiffSel) {
    sheetDiffSel.options[0].textContent = t('filter.difficulty.all');
    for (let i = 1; i < sheetDiffSel.options.length; i++) {
      sheetDiffSel.options[i].textContent = t('difficulty.' + sheetDiffSel.options[i].value);
    }
  }
  const sheetSeasonSel = document.getElementById('sheet-season-select');
  if (sheetSeasonSel) {
    sheetSeasonSel.options[0].textContent = t('filter.season.all');
    for (let i = 1; i <= 12; i++) {
      if (sheetSeasonSel.options[i]) sheetSeasonSel.options[i].textContent = t('filter.month.' + i);
    }
  }
  const sheetTempSel = document.getElementById('sheet-temp-select');
  if (sheetTempSel) sheetTempSel.options[0].textContent = t('filter.temp.all');
  const sheetVisSel = document.getElementById('sheet-visibility-select');
  if (sheetVisSel) sheetVisSel.options[0].textContent = t('filter.visibility.all');

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

  // 지도 마커는 항상 현재 필터 기준 (pass favSet so 'favorites' activity works)
  updateMarkers(isFavView ? filtered : filterSpots(false, favSet), fitToMarkers);
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
  const countFav = document.getElementById('count-favorites');
  if (countFav) countFav.textContent = counts.favorites;

  // Mobile activity tab counts
  const mobAll = document.getElementById('mob-count-all');
  const mobSkin = document.getElementById('mob-count-skin');
  const mobScuba = document.getElementById('mob-count-scuba');
  const mobMyspot = document.getElementById('mob-count-myspot');
  const mobFav = document.getElementById('mob-count-favorites');
  if (mobAll) mobAll.textContent = counts.total;
  if (mobSkin) mobSkin.textContent = counts.skin;
  if (mobScuba) mobScuba.textContent = counts.scuba;
  if (mobMyspot) mobMyspot.textContent = counts.myspot;
  if (mobFav) mobFav.textContent = counts.favorites;
}

// ═══ Logbook View ═══

function renderLogMediaPreview() {
  const container = document.getElementById('log-media-preview');
  if (!container) return;
  container.innerHTML = '';
  // Existing media (edit mode)
  logExistingMedia.forEach((m, i) => {
    const item = document.createElement('div');
    item.className = 'log-media-preview__item';
    const isVid = isVideoFile(m.url);
    item.innerHTML = `
      ${isVid ? `<video src="${m.url}" muted></video>` : `<img src="${m.url}" alt="" />`}
      <span class="log-media-preview__remove" data-type="existing" data-index="${i}">&times;</span>
    `;
    item.querySelector('.log-media-preview__remove').addEventListener('click', () => {
      logRemovedPaths.push(m.path);
      logExistingMedia.splice(i, 1);
      renderLogMediaPreview();
    });
    container.appendChild(item);
  });
  // Pending new files
  logPendingFiles.forEach((f, i) => {
    const item = document.createElement('div');
    item.className = 'log-media-preview__item';
    const url = URL.createObjectURL(f);
    const isVid = isVideoFile(f);
    item.innerHTML = `
      ${isVid ? `<video src="${url}" muted></video>` : `<img src="${url}" alt="" />`}
      <span class="log-media-preview__remove" data-type="pending" data-index="${i}">&times;</span>
    `;
    item.querySelector('.log-media-preview__remove').addEventListener('click', () => {
      logPendingFiles.splice(i, 1);
      renderLogMediaPreview();
    });
    container.appendChild(item);
  });
}

function renderLogbook() {
  const view = document.getElementById('logbook-view');
  const statsEl = document.getElementById('logbook-stats');
  const listEl = document.getElementById('logbook-list');
  const emptyEl = document.getElementById('logbook-empty-state');
  const addBtn = document.getElementById('add-log-btn');

  // Update button text
  addBtn.textContent = t('logbook.addNew');

  // Stats dashboard
  const stats = getLogStats();
  if (!stats) {
    statsEl.innerHTML = '';
  } else {
    const fmtTime = min => min >= 60 ? `${Math.floor(min / 60)}h ${min % 60}m` : `${min}min`;
    const maxBar = Math.max(...stats.months12.map(m => m.count), 1);
    const monthBars = stats.months12.map(m =>
      `<div class="stat-chart__col">
        <div class="stat-chart__bar" style="height:${Math.round(m.count / maxBar * 100)}%">${m.count || ''}</div>
        <div class="stat-chart__label">${m.label}</div>
      </div>`
    ).join('');

    const topSpotsHtml = stats.topSpots.length > 0
      ? stats.topSpots.map(([name, cnt]) => `<li>${name} <span class="stat-detail__count">${cnt}${t('logbook.stats.dives')}</span></li>`).join('')
      : '';

    const yearlyHtml = stats.yearly.map(([y, cnt]) => `<li>${y} <span class="stat-detail__count">${cnt}${t('logbook.stats.dives')}</span></li>`).join('');

    statsEl.innerHTML = `
      <div class="logbook-stats__grid">
        <div class="logbook-stats__card"><div class="logbook-stats__icon">🤿</div><div class="logbook-stats__value">${stats.totalDives}</div><div class="logbook-stats__label">${t('logbook.stats.totalDives')}</div></div>
        <div class="logbook-stats__card"><div class="logbook-stats__icon">⏱️</div><div class="logbook-stats__value">${stats.totalTime > 0 ? fmtTime(stats.totalTime) : '-'}</div><div class="logbook-stats__label">${t('logbook.stats.totalTime')}</div></div>
        <div class="logbook-stats__card"><div class="logbook-stats__icon">🌊</div><div class="logbook-stats__value">${stats.maxDepth > 0 ? stats.maxDepth + 'm' : '-'}</div><div class="logbook-stats__label">${t('logbook.stats.maxDepth')}</div></div>
        <div class="logbook-stats__card"><div class="logbook-stats__icon">📍</div><div class="logbook-stats__value">${stats.spotsCount}</div><div class="logbook-stats__label">${t('logbook.stats.spots')}</div></div>
      </div>
      <div class="stat-details">
        <div class="stat-details__section">
          <div class="stat-detail__row"><span>${t('logbook.stats.avgDepth')}</span><span>${stats.avgDepth > 0 ? stats.avgDepth + 'm' : '-'}</span></div>
          <div class="stat-detail__row"><span>${t('logbook.stats.avgTime')}</span><span>${stats.avgTime > 0 ? stats.avgTime + 'min' : '-'}</span></div>
          <div class="stat-detail__row"><span>${t('logbook.stats.skinDives')}</span><span>${stats.skinDives}</span></div>
          <div class="stat-detail__row"><span>${t('logbook.stats.scubaDives')}</span><span>${stats.scubaDives}</span></div>
          <div class="stat-detail__row"><span>${t('logbook.stats.firstDive')}</span><span>${stats.firstDate || '-'}</span></div>
          <div class="stat-detail__row"><span>${t('logbook.stats.lastDive')}</span><span>${stats.lastDate || '-'}</span></div>
        </div>
        ${topSpotsHtml ? `<div class="stat-details__section"><h4>${t('logbook.stats.topSpots')}</h4><ol class="stat-detail__list">${topSpotsHtml}</ol></div>` : ''}
        <div class="stat-details__section">
          <h4>${t('logbook.stats.monthly')}</h4>
          <div class="stat-chart">${monthBars}</div>
        </div>
        ${yearlyHtml ? `<div class="stat-details__section"><h4>${t('logbook.stats.yearly')}</h4><ul class="stat-detail__list">${yearlyHtml}</ul></div>` : ''}
      </div>
    `;
  }

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
    const hasMedia = entry.media && entry.media.length > 0;
    card.className = hasMedia ? 'log-card log-card--has-media' : 'log-card';

    const actLabel = entry.activityType === 'scuba' ? t('activity.scuba') : t('activity.skin');

    // Build media grid HTML
    let mediaHtml = '';
    if (hasMedia) {
      const thumbs = entry.media.map((m, idx) => {
        const isVid = isVideoFile(m.url);
        return `<div class="log-card__thumb${isVid ? ' log-card__thumb--video' : ''}" data-media-index="${idx}">
          ${isVid ? `<video src="${m.url}" muted preload="metadata"></video>` : `<img src="${m.url}" alt="" />`}
        </div>`;
      }).join('');
      mediaHtml = `<div class="log-card__media">${thumbs}</div>`;
    }

    card.innerHTML = `
      <div class="log-card__body">
        <div class="log-card__header">
          <span class="log-card__date">${entry.date}</span>
          <span class="badge badge--activity badge--activity-${entry.activityType}">${actLabel}</span>
        </div>
        <div class="log-card__spot">${entry.spotName || '-'}</div>
        <div class="log-card__stats">
          ${entry.maxDepth != null ? `<div class="card__stat"><span class="card__stat-label">${t('logbook.depth')}</span><span class="card__stat-value">${entry.maxDepth}m</span></div>` : ''}
          ${entry.diveTime != null ? `<div class="card__stat"><span class="card__stat-label">${t('logbook.time')}</span><span class="card__stat-value">${entry.diveTime}min</span></div>` : ''}
          ${entry.entryTime ? `<div class="card__stat"><span class="card__stat-label">${t('logbook.form.entryTime')}</span><span class="card__stat-value">${formatTime12(entry.entryTime)}</span></div>` : ''}
          ${entry.exitTime ? `<div class="card__stat"><span class="card__stat-label">${t('logbook.form.exitTime')}</span><span class="card__stat-value">${formatTime12(entry.exitTime)}</span></div>` : ''}
          ${entry.waterTemp != null ? `<div class="card__stat"><span class="card__stat-label">${t('logbook.temp')}</span><span class="card__stat-value">${entry.waterTemp}°C</span></div>` : ''}
        </div>
        ${entry.memo ? `<div class="log-card__memo">${entry.memo}</div>` : ''}
        ${mediaHtml}
        <div class="log-card__actions">
          <button class="log-edit-btn" data-id="${entry.id}">${t('logbook.card.edit')}</button>
          <button class="log-delete-btn" data-id="${entry.id}">${t('logbook.card.delete')}</button>
        </div>
      </div>
    `;

    // Thumbnail click → open media viewer
    if (hasMedia) {
      card.querySelectorAll('.log-card__thumb').forEach(thumb => {
        thumb.addEventListener('click', () => {
          const idx = parseInt(thumb.dataset.mediaIndex);
          document.dispatchEvent(new CustomEvent('open-media-viewer', {
            detail: { media: entry.media, index: idx }
          }));
        });
      });
    }

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
  const fileInput = document.getElementById('log-file-input');
  const addMediaBtn = document.getElementById('log-add-media-btn');
  const progressWrap = document.getElementById('log-upload-progress');
  const progressFill = document.getElementById('log-upload-fill');
  const progressText = document.getElementById('log-upload-text');

  function close() {
    overlay.classList.add('hidden');
    overlay.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
  }

  closeBtn.addEventListener('click', close);
  cancelBtn.addEventListener('click', close);

  // Populate hour (1-12) and minute (00-55) options for custom time selects
  ['log-entry-hour', 'log-exit-hour'].forEach(id => {
    const sel = document.getElementById(id);
    for (let h = 1; h <= 12; h++) sel.insertAdjacentHTML('beforeend', `<option value="${h}">${h}</option>`);
  });
  ['log-entry-min', 'log-exit-min'].forEach(id => {
    const sel = document.getElementById(id);
    for (let m = 0; m < 60; m += 5) sel.insertAdjacentHTML('beforeend', `<option value="${m}">${String(m).padStart(2, '0')}</option>`);
  });

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

  // File input for media
  addMediaBtn.addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', () => {
    const totalCount = logPendingFiles.length + logExistingMedia.length;
    const newFiles = Array.from(fileInput.files);
    for (const f of newFiles) {
      if (totalCount + logPendingFiles.length >= 4) {
        alert(t('logbook.validation.fileCount'));
        break;
      }
      const err = validateFile(f);
      if (err === 'type') { alert(t('logbook.validation.fileType')); continue; }
      if (err === 'size') { alert(t('logbook.validation.fileSize')); continue; }
      logPendingFiles.push(f);
    }
    fileInput.value = '';
    renderLogMediaPreview();
  });

  form.addEventListener('submit', async e => {
    e.preventDefault();
    const editId = document.getElementById('log-edit-id').value;
    const saveBtn = document.getElementById('log-save');

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
      entryTime: getTimeFromSelects('log-entry') || null,
      exitTime: getTimeFromSelects('log-exit') || null,
      buddy: document.getElementById('log-buddy').value,
      weather: document.getElementById('log-weather').value,
      lat: parseFloat(document.getElementById('log-lat').value) || null,
      lng: parseFloat(document.getElementById('log-lng').value) || null,
      memo: document.getElementById('log-memo').value,
    };

    saveBtn.disabled = true;

    // Show progress if there are files
    if (logPendingFiles.length > 0) {
      progressWrap.classList.remove('hidden');
      progressFill.style.width = '0%';
      progressText.textContent = '0%';
    }

    try {
      if (editId) {
        await updateLogEntry(editId, data, logPendingFiles, logRemovedPaths, (p) => {
          const pct = Math.round(p * 100);
          progressFill.style.width = pct + '%';
          progressText.textContent = pct + '%';
        });
      } else {
        await addLogEntry(data, logPendingFiles, (p) => {
          const pct = Math.round(p * 100);
          progressFill.style.width = pct + '%';
          progressText.textContent = pct + '%';
        });
      }
      close();
      if (currentView === 'logbook') renderLogbook();
      // Check achievements after log save (non-blocking)
      runAchievementCheck();
      if (!editId) trackEvent('create_logbook', { activity_type: data.activityType });
    } catch (err) {
      console.error('Log save error:', err);
      alert(t('logbook.error.upload'));
    } finally {
      saveBtn.disabled = false;
      progressWrap.classList.add('hidden');
    }
  });
}

function openLogFormModal(editId) {
  const overlay = document.getElementById('log-modal-overlay');
  const title = document.getElementById('log-modal-title');
  const form = document.getElementById('log-form');
  const scubaFields = document.getElementById('log-scuba-fields');

  form.reset();
  document.getElementById('log-edit-id').value = '';

  // Reset media state
  logPendingFiles = [];
  logExistingMedia = [];
  logRemovedPaths = [];
  document.getElementById('log-media-preview').innerHTML = '';
  document.getElementById('log-upload-progress').classList.add('hidden');

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
  document.getElementById('log-entry-time-label').textContent = t('logbook.form.entryTime');
  document.getElementById('log-exit-time-label').textContent = t('logbook.form.exitTime');
  updateTimeSelectLabels();
  document.getElementById('log-tank-start-label').textContent = t('logbook.form.tankStart');
  document.getElementById('log-tank-end-label').textContent = t('logbook.form.tankEnd');
  document.getElementById('log-buddy-label').textContent = t('logbook.form.buddy');
  document.getElementById('log-weather-label').textContent = t('logbook.form.weather');
  document.getElementById('log-location-label').textContent = t('logbook.form.location');
  document.getElementById('log-pick-map-btn').textContent = t('logbook.form.pickOnMap');
  document.getElementById('log-memo-label').textContent = t('logbook.form.memo');
  document.getElementById('log-media-label').textContent = t('logbook.form.media');
  document.getElementById('log-media-hint').textContent = t('logbook.form.mediaHint');
  document.getElementById('log-save').textContent = t('logbook.form.save');
  document.getElementById('log-cancel').textContent = t('logbook.form.cancel');
  document.getElementById('log-skin-text').textContent = t('activity.skin');
  document.getElementById('log-scuba-text').textContent = t('activity.scuba');

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
    setTimeToSelects('log-entry', entry.entryTime || '');
    setTimeToSelects('log-exit', entry.exitTime || '');
    document.getElementById('log-buddy').value = entry.buddy || '';
    document.getElementById('log-weather').value = entry.weather || '';
    document.getElementById('log-lat').value = entry.lat ?? '';
    document.getElementById('log-lng').value = entry.lng ?? '';
    document.getElementById('log-memo').value = entry.memo || '';
    scubaFields.classList.toggle('hidden', entry.activityType !== 'scuba');
    // Populate existing media for edit
    logExistingMedia = [...(entry.media || [])];
    renderLogMediaPreview();
  } else {
    title.textContent = t('logbook.form.title');
    document.getElementById('log-date').value = new Date().toISOString().slice(0, 10);
    document.getElementById('log-activity-value').value = 'skin';
    document.querySelectorAll('#log-activity-switch .log-activity-switch__btn').forEach(b => {
      b.classList.toggle('active', b.dataset.value === 'skin');
    });
    setTimeToSelects('log-entry', '');
    setTimeToSelects('log-exit', '');
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
  document.getElementById('spot-skin-text').textContent = t('activity.skin');
  document.getElementById('spot-scuba-text').textContent = t('activity.scuba');
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

// ═══ Review Modal ═══

function initReviewModal() {
  const overlay = document.getElementById('review-modal-overlay');
  const closeBtn = document.getElementById('review-modal-close');
  const cancelBtn = document.getElementById('review-cancel');
  const form = document.getElementById('review-form');
  const starInput = document.getElementById('review-star-input');
  const ratingValue = document.getElementById('review-rating-value');
  const titleInput = document.getElementById('review-title-input');
  const contentInput = document.getElementById('review-content-input');
  const fileInput = document.getElementById('review-file-input');
  const addMediaBtn = document.getElementById('review-add-media-btn');
  const previewContainer = document.getElementById('review-media-preview');
  const progressWrap = document.getElementById('review-upload-progress');
  const progressFill = document.getElementById('review-upload-fill');
  const progressText = document.getElementById('review-upload-text');

  let pendingFiles = [];    // new File objects to upload
  let existingMedia = [];   // existing {url,path} from edit mode
  let removedPaths = [];    // paths to delete on save

  function close() {
    overlay.classList.add('hidden');
    overlay.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
  }

  closeBtn.addEventListener('click', close);
  cancelBtn.addEventListener('click', close);

  // Star rating interaction
  starInput.addEventListener('click', e => {
    const star = e.target.closest('.review-star');
    if (!star) return;
    const val = parseInt(star.dataset.value);
    ratingValue.value = val;
    updateStarDisplay(val);
  });

  starInput.addEventListener('mouseover', e => {
    const star = e.target.closest('.review-star');
    if (!star) return;
    updateStarDisplay(parseInt(star.dataset.value));
  });

  starInput.addEventListener('mouseleave', () => {
    updateStarDisplay(parseInt(ratingValue.value) || 0);
  });

  function updateStarDisplay(val) {
    starInput.querySelectorAll('.review-star').forEach(s => {
      const sv = parseInt(s.dataset.value);
      s.classList.toggle('review-star--active', sv <= val);
      s.textContent = sv <= val ? '\u2605' : '\u2606';
    });
  }

  // Character counters
  titleInput.addEventListener('input', () => {
    document.getElementById('review-title-count').textContent = titleInput.value.length;
  });
  contentInput.addEventListener('input', () => {
    document.getElementById('review-content-count').textContent = contentInput.value.length;
  });

  // File input
  addMediaBtn.addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', () => {
    const totalCount = pendingFiles.length + existingMedia.length;
    const newFiles = Array.from(fileInput.files);
    for (const f of newFiles) {
      if (totalCount + pendingFiles.length >= 5) {
        alert(t('review.validation.fileCount'));
        break;
      }
      const err = validateFile(f);
      if (err === 'type') { alert(t('review.validation.fileType')); continue; }
      if (err === 'size') { alert(t('review.validation.fileSize')); continue; }
      pendingFiles.push(f);
    }
    fileInput.value = '';
    renderMediaPreview();
  });

  function renderMediaPreview() {
    previewContainer.innerHTML = '';
    // Existing media (edit mode)
    existingMedia.forEach((m, i) => {
      const item = document.createElement('div');
      item.className = 'review-media-preview__item';
      const isVid = isVideoFile(m.url);
      item.innerHTML = `
        ${isVid ? `<video src="${m.url}" muted></video>` : `<img src="${m.url}" alt="" />`}
        <span class="review-media-preview__remove" data-type="existing" data-index="${i}">&times;</span>
      `;
      item.querySelector('.review-media-preview__remove').addEventListener('click', () => {
        removedPaths.push(m.path);
        existingMedia.splice(i, 1);
        renderMediaPreview();
      });
      previewContainer.appendChild(item);
    });
    // Pending new files
    pendingFiles.forEach((f, i) => {
      const item = document.createElement('div');
      item.className = 'review-media-preview__item';
      const url = URL.createObjectURL(f);
      const isVid = isVideoFile(f);
      item.innerHTML = `
        ${isVid ? `<video src="${url}" muted></video>` : `<img src="${url}" alt="" />`}
        <span class="review-media-preview__remove" data-type="pending" data-index="${i}">&times;</span>
      `;
      item.querySelector('.review-media-preview__remove').addEventListener('click', () => {
        pendingFiles.splice(i, 1);
        renderMediaPreview();
      });
      previewContainer.appendChild(item);
    });
  }

  function openReviewFormModal(spotId, spotName, editReview) {
    form.reset();
    pendingFiles = [];
    existingMedia = [];
    removedPaths = [];
    ratingValue.value = '0';
    updateStarDisplay(0);
    document.getElementById('review-title-count').textContent = '0';
    document.getElementById('review-content-count').textContent = '0';
    previewContainer.innerHTML = '';
    progressWrap.classList.add('hidden');

    document.getElementById('review-spot-id').value = spotId;
    document.getElementById('review-edit-id').value = '';

    // Update labels
    document.getElementById('review-rating-label').textContent = t('review.form.rating');
    document.getElementById('review-title-label').textContent = t('review.form.reviewTitle');
    titleInput.placeholder = t('review.form.reviewTitlePlaceholder');
    document.getElementById('review-content-label').textContent = t('review.form.content');
    contentInput.placeholder = t('review.form.contentPlaceholder');
    document.getElementById('review-visit-date-label').textContent = t('review.form.visitDate');
    document.getElementById('review-media-label').textContent = t('review.form.media');
    document.getElementById('review-media-hint').textContent = t('review.form.mediaHint');
    document.getElementById('review-save').textContent = t('review.form.save');
    document.getElementById('review-cancel').textContent = t('review.form.cancel');

    if (editReview) {
      document.getElementById('review-modal-title').textContent = t('review.form.titleEdit');
      document.getElementById('review-edit-id').value = editReview.id;
      ratingValue.value = editReview.rating || 0;
      updateStarDisplay(editReview.rating || 0);
      titleInput.value = editReview.title || '';
      contentInput.value = editReview.content || '';
      document.getElementById('review-visit-date').value = editReview.visitDate || '';
      document.getElementById('review-title-count').textContent = (editReview.title || '').length;
      document.getElementById('review-content-count').textContent = (editReview.content || '').length;
      existingMedia = [...(editReview.media || [])];
      renderMediaPreview();
    } else {
      document.getElementById('review-modal-title').textContent = t('review.form.title');
      document.getElementById('review-visit-date').value = new Date().toISOString().slice(0, 10);
    }

    overlay.classList.remove('hidden');
    overlay.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
  }

  // Form submit
  form.addEventListener('submit', async e => {
    e.preventDefault();
    const rating = parseInt(ratingValue.value);
    if (!rating || rating < 1) { alert(t('review.validation.rating')); return; }
    const title = titleInput.value.trim();
    if (!title) { alert(t('review.validation.title')); return; }
    const content = contentInput.value.trim();
    if (!content) { alert(t('review.validation.content')); return; }

    const spotId = document.getElementById('review-spot-id').value;
    const editId = document.getElementById('review-edit-id').value;
    const visitDate = document.getElementById('review-visit-date').value;

    const saveBtn = document.getElementById('review-save');
    saveBtn.disabled = true;

    // Show progress if there are files
    if (pendingFiles.length > 0) {
      progressWrap.classList.remove('hidden');
      progressFill.style.width = '0%';
      progressText.textContent = '0%';
    }

    try {
      const data = { rating, title, content, visitDate };
      if (editId) {
        await updateReview(editId, spotId, data, pendingFiles, removedPaths, (p) => {
          const pct = Math.round(p * 100);
          progressFill.style.width = pct + '%';
          progressText.textContent = pct + '%';
        });
      } else {
        await addReview(spotId, data, pendingFiles, (p) => {
          const pct = Math.round(p * 100);
          progressFill.style.width = pct + '%';
          progressText.textContent = pct + '%';
        });
      }
      close();
      refreshReviews(spotId);
      // Check achievements after review save (non-blocking)
      runAchievementCheck();
      if (!editId) trackEvent('write_review', { spot_id: spotId, rating });
    } catch (err) {
      console.error('Review save error:', err);
      alert(t('review.error.save'));
    } finally {
      saveBtn.disabled = false;
      progressWrap.classList.add('hidden');
    }
  });

  // Listen for custom events
  document.addEventListener('open-review-modal', e => {
    const { spotId, spotName } = e.detail;
    openReviewFormModal(spotId, spotName);
  });

  document.addEventListener('open-log-from-spot', e => {
    const { spotName, lat, lng } = e.detail;
    openLogFormModal();
    document.getElementById('log-spot-name').value = spotName || '';
    if (lat != null) document.getElementById('log-lat').value = lat;
    if (lng != null) document.getElementById('log-lng').value = lng;
    const coordsText = document.getElementById('log-coords-text');
    if (lat != null && lng != null && coordsText) {
      coordsText.textContent = `${parseFloat(lat).toFixed(4)}, ${parseFloat(lng).toFixed(4)}`;
    }
  });

  document.addEventListener('edit-review', e => {
    const { review, spotId } = e.detail;
    openReviewFormModal(spotId, '', review);
  });

  document.addEventListener('delete-review', async e => {
    const { reviewId, spotId } = e.detail;
    if (!confirm(t('review.delete.confirm'))) return;
    try {
      await deleteReview(reviewId, spotId);
      refreshReviews(spotId);
    } catch (err) {
      console.error('Review delete error:', err);
      alert(t('review.error.delete'));
    }
  });
}

// ═══ Media Viewer ═══

function initMediaViewer() {
  const overlay = document.getElementById('media-viewer-overlay');
  const closeBtn = document.getElementById('media-viewer-close');
  const prevBtn = document.getElementById('media-viewer-prev');
  const nextBtn = document.getElementById('media-viewer-next');
  const content = document.getElementById('media-viewer-content');
  const counter = document.getElementById('media-viewer-counter');

  let mediaItems = [];
  let currentIndex = 0;

  function open(media, index) {
    mediaItems = media;
    currentIndex = index || 0;
    overlay.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
    render();
  }

  function close() {
    overlay.classList.add('hidden');
    document.body.style.overflow = '';
    content.innerHTML = '';
    mediaItems = [];
  }

  function render() {
    if (!mediaItems.length) return;
    const item = mediaItems[currentIndex];
    const isVid = item.url && (item.url.includes('.mp4') || item.url.includes('.mov') || item.url.includes('video'));
    if (isVid) {
      content.innerHTML = `<video src="${item.url}" controls autoplay playsinline style="max-width:90vw;max-height:85vh;"></video>`;
    } else {
      content.innerHTML = `<img src="${item.url}" alt="" />`;
    }
    counter.textContent = `${currentIndex + 1} / ${mediaItems.length}`;
    prevBtn.style.display = mediaItems.length > 1 ? '' : 'none';
    nextBtn.style.display = mediaItems.length > 1 ? '' : 'none';
  }

  function prev() {
    currentIndex = (currentIndex - 1 + mediaItems.length) % mediaItems.length;
    render();
  }

  function next() {
    currentIndex = (currentIndex + 1) % mediaItems.length;
    render();
  }

  closeBtn.addEventListener('click', close);
  overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
  prevBtn.addEventListener('click', prev);
  nextBtn.addEventListener('click', next);

  document.addEventListener('keydown', e => {
    if (overlay.classList.contains('hidden')) return;
    if (e.key === 'Escape') close();
    else if (e.key === 'ArrowLeft') prev();
    else if (e.key === 'ArrowRight') next();
  });

  // Touch swipe support
  let touchStartX = 0;
  overlay.addEventListener('touchstart', e => {
    touchStartX = e.touches[0].clientX;
  }, { passive: true });
  overlay.addEventListener('touchend', e => {
    const dx = e.changedTouches[0].clientX - touchStartX;
    if (Math.abs(dx) > 50) {
      if (dx > 0) prev(); else next();
    }
  }, { passive: true });

  // Listen for open event
  document.addEventListener('open-media-viewer', e => {
    const { media, index } = e.detail;
    open(media, index);
  });
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

// ═══ Info Modal ═══

function initInfoModal() {
  const fab = document.getElementById('info-fab');
  const overlay = document.getElementById('info-modal-overlay');
  const closeBtn = document.getElementById('info-modal-close');
  const okBtn = document.getElementById('info-modal-ok');
  const titleEl = document.getElementById('info-modal-title');
  const contentEl = document.getElementById('info-modal-content');
  if (!fab || !overlay) return;

  function open() {
    titleEl.textContent = t('info.title');
    contentEl.textContent = t('info.content');
    okBtn.textContent = t('info.close');
    overlay.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
  }

  function close() {
    overlay.classList.add('hidden');
    document.body.style.overflow = '';
  }

  fab.addEventListener('click', open);
  closeBtn.addEventListener('click', close);
  okBtn.addEventListener('click', close);
  overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
  document.addEventListener('keydown', e => {
    if (!overlay.classList.contains('hidden') && e.key === 'Escape') close();
  });
}

// ═══ Profile Modal ═══

function openProfileOverlay() {
  const overlay = document.getElementById('profile-modal-overlay');
  overlay.classList.remove('hidden');
  overlay.setAttribute('aria-hidden', 'false');
  document.body.style.overflow = 'hidden';
}

function closeProfileOverlay() {
  const overlay = document.getElementById('profile-modal-overlay');
  overlay.classList.add('hidden');
  overlay.setAttribute('aria-hidden', 'true');
  document.body.style.overflow = '';
}

function openProfileEditOverlay() {
  const overlay = document.getElementById('profile-edit-overlay');
  overlay.classList.remove('hidden');
  overlay.setAttribute('aria-hidden', 'false');
  document.body.style.overflow = 'hidden';
}

function closeProfileEditOverlay() {
  const overlay = document.getElementById('profile-edit-overlay');
  overlay.classList.add('hidden');
  overlay.setAttribute('aria-hidden', 'true');
  document.body.style.overflow = '';
}

function openCertOverlay() {
  const overlay = document.getElementById('cert-modal-overlay');
  overlay.classList.remove('hidden');
  overlay.setAttribute('aria-hidden', 'false');
  document.body.style.overflow = 'hidden';
}

function closeCertOverlay() {
  const overlay = document.getElementById('cert-modal-overlay');
  overlay.classList.add('hidden');
  overlay.setAttribute('aria-hidden', 'true');
  document.body.style.overflow = '';
}

async function openProfileModal(userId) {
  const uid = getCurrentUid();
  const body = document.getElementById('profile-modal-body');

  if (!userId || userId === uid) {
    // Own profile
    const profile = getCachedProfile();
    renderOwnProfile(profile, body);
  } else {
    // Other user's profile
    body.innerHTML = `<div class="profile-private-msg">${t('modal.weather.loading')}</div>`;
    openProfileOverlay();
    try {
      const profile = await loadPublicProfile(userId);
      if (!profile.isPublic) {
        body.innerHTML = `<div class="profile-private-msg">${t('profile.private')}</div>`;
        return;
      }
      await renderPublicProfile(profile, body);
    } catch {
      body.innerHTML = `<div class="profile-private-msg">${t('profile.error.save')}</div>`;
    }
    return;
  }
  openProfileOverlay();
}

function renderOwnProfile(profile, body) {
  const nickname = profile?.nickname || 'User';
  const photoURL = profile?.photoURL;
  const bio = profile?.bio;
  const country = profile?.country || '';
  const certs = profile?.certifications || [];
  const isPublic = profile?.isPublic || false;
  const showCerts = profile?.showCerts !== false;
  const showReviews = profile?.showReviews !== false;

  // Stats from logbook
  const stats = getLogStats();
  const logs = getLogEntries().slice(0, 3);

  let html = `
    <div class="profile-header">
      <div class="profile-avatar">
        ${photoURL ? `<img src="${escapeHtml(photoURL)}" alt="" />` : `<svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`}
      </div>
      <div class="profile-header__info">
        <div class="profile-header__nickname">${escapeHtml(nickname)}</div>
        ${country ? `<div class="profile-header__country">${escapeHtml(country)}</div>` : ''}
        ${renderFeaturedBadgesHtml()}
      </div>
      <div class="profile-header__actions">
        <button class="btn btn--secondary btn--sm" id="profile-edit-trigger">${t('profile.editBtn')}</button>
      </div>
    </div>

    <div class="profile-section">
      <div class="profile-section__title">${t('profile.bio')}</div>
      ${bio ? `<div class="profile-bio">${escapeHtml(bio)}</div>` : `<div class="profile-section__empty">${t('profile.noBio')}</div>`}
    </div>

    <div class="profile-section">
      <div class="profile-section__title">${t('profile.certs')}</div>
      ${certs.length > 0 ? certs.map(c => `
        <div class="profile-cert-card">
          <div class="profile-cert-card__info">
            <div class="profile-cert-card__org">${escapeHtml(c.org)}</div>
            <div class="profile-cert-card__level">${escapeHtml(c.level)}</div>
            ${c.date ? `<div class="profile-cert-card__meta">${escapeHtml(c.date)}${c.certNumber ? ' · #' + escapeHtml(c.certNumber) : ''}</div>` : ''}
          </div>
          <button class="profile-cert-card__delete" data-cert-id="${c.id}" title="Delete">&times;</button>
        </div>
      `).join('') : `<div class="profile-section__empty">${t('profile.noCerts')}</div>`}
      <button class="btn btn--secondary btn--sm" id="profile-add-cert-btn" style="margin-top:var(--sp-2)">${t('profile.addCert')}</button>
    </div>
  `;

  // Stats section
  if (stats) {
    html += `
      <div class="profile-section">
        <div class="profile-section__title">${t('profile.stats.title')}</div>
        <div class="profile-stats__grid">
          <div class="profile-stats__item">
            <div class="profile-stats__value">${stats.totalDives}</div>
            <div class="profile-stats__label">${t('profile.stats.totalDives')}</div>
          </div>
          <div class="profile-stats__item">
            <div class="profile-stats__value">${stats.maxDepth}m</div>
            <div class="profile-stats__label">${t('profile.stats.maxDepth')}</div>
          </div>
          <div class="profile-stats__item">
            <div class="profile-stats__value">${stats.totalTime}min</div>
            <div class="profile-stats__label">${t('profile.stats.totalTime')}</div>
          </div>
          <div class="profile-stats__item">
            <div class="profile-stats__value">${stats.spotsCount}</div>
            <div class="profile-stats__label">${t('profile.stats.spots')}</div>
          </div>
        </div>
      </div>
    `;
  }

  // Recent logs
  html += `
    <div class="profile-section">
      <div class="profile-section__title">${t('profile.recentLogs')}</div>
      ${logs.length > 0 ? logs.map(l => `
        <div class="profile-recent-item">
          <span class="profile-recent-item__name">${escapeHtml(l.spotName || '-')}</span>
          <span class="profile-recent-item__date">${escapeHtml(l.date || '')}</span>
        </div>
      `).join('') : `<div class="profile-section__empty">${t('profile.noLogs')}</div>`}
    </div>
  `;

  // Recent reviews (async load)
  html += `
    <div class="profile-section">
      <div class="profile-section__title">${t('profile.recentReviews')}</div>
      <div id="profile-own-reviews"><div class="profile-section__empty">${t('modal.weather.loading')}</div></div>
    </div>
  `;

  // Privacy summary
  html += `
    <div class="profile-section">
      <div class="profile-section__title">${t('profile.privacy.title')}</div>
      <div style="font-size:0.85rem;color:var(--c-gray-300);">
        ${t('profile.privacy.public')}: ${isPublic ? 'ON' : 'OFF'} &nbsp;|&nbsp;
        ${t('profile.privacy.showCerts')}: ${showCerts ? 'ON' : 'OFF'} &nbsp;|&nbsp;
        ${t('profile.privacy.showReviews')}: ${showReviews ? 'ON' : 'OFF'}
      </div>
    </div>
  `;

  body.innerHTML = html;

  // Bind edit button
  body.querySelector('#profile-edit-trigger')?.addEventListener('click', () => {
    closeProfileOverlay();
    populateProfileEditForm();
    openProfileEditOverlay();
  });

  // Bind add cert button
  body.querySelector('#profile-add-cert-btn')?.addEventListener('click', () => {
    closeProfileOverlay();
    resetCertForm();
    openCertOverlay();
  });

  // Bind cert delete buttons
  body.querySelectorAll('.profile-cert-card__delete').forEach(btn => {
    btn.addEventListener('click', async () => {
      const certId = btn.dataset.certId;
      if (!certId) return;
      btn.disabled = true;
      try {
        await removeCertification(certId);
        openProfileModal(); // re-render
      } catch {
        alert(t('profile.error.cert'));
      }
    });
  });

  // Load reviews async
  loadOwnReviews();
}

async function loadOwnReviews() {
  const uid = getCurrentUid();
  const el = document.getElementById('profile-own-reviews');
  if (!el || !uid) return;
  try {
    const reviews = await getUserRecentReviews(uid, 3);
    if (reviews.length === 0) {
      el.innerHTML = `<div class="profile-section__empty">${t('profile.noReviews')}</div>`;
      return;
    }
    el.innerHTML = reviews.map(r => `
      <div class="profile-recent-item">
        <span class="profile-recent-item__name">${renderStars(r.rating, 'review-card')} ${escapeHtml(r.title || '')}</span>
        <span class="profile-recent-item__date">${formatReviewDate(r.createdAt)}</span>
      </div>
    `).join('');
  } catch {
    el.innerHTML = `<div class="profile-section__empty">${t('profile.noReviews')}</div>`;
  }
}

async function renderPublicProfile(profile, body) {
  const nickname = profile.nickname || 'User';
  const photoURL = profile.photoURL;
  const bio = profile.bio;
  const country = profile.country || '';
  const certs = profile.certifications || [];
  const showCerts = profile.showCerts !== false;
  const showReviews = profile.showReviews !== false;

  let html = `
    <div class="profile-header">
      <div class="profile-avatar">
        ${photoURL ? `<img src="${escapeHtml(photoURL)}" alt="" />` : `<svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`}
      </div>
      <div class="profile-header__info">
        <div class="profile-header__nickname">${escapeHtml(nickname)}</div>
        ${country ? `<div class="profile-header__country">${escapeHtml(country)}</div>` : ''}
        ${(profile.featuredBadges || []).length > 0 ? `<div class="profile-featured-badges">${profile.featuredBadges.map(id => ACHIEVEMENT_DEFS[id] ? `<span class="profile-featured-badge" title="${t('achievements.' + id + '.name')}">${ACHIEVEMENT_DEFS[id].icon}</span>` : '').join('')}</div>` : ''}
      </div>
    </div>
  `;

  if (bio) {
    html += `
      <div class="profile-section">
        <div class="profile-section__title">${t('profile.bio')}</div>
        <div class="profile-bio">${escapeHtml(bio)}</div>
      </div>
    `;
  }

  if (showCerts && certs.length > 0) {
    html += `
      <div class="profile-section">
        <div class="profile-section__title">${t('profile.certs')}</div>
        ${certs.map(c => `
          <div class="profile-cert-card">
            <div class="profile-cert-card__info">
              <div class="profile-cert-card__org">${escapeHtml(c.org)}</div>
              <div class="profile-cert-card__level">${escapeHtml(c.level)}</div>
              ${c.date ? `<div class="profile-cert-card__meta">${escapeHtml(c.date)}</div>` : ''}
            </div>
          </div>
        `).join('')}
      </div>
    `;
  }

  if (showReviews) {
    html += `
      <div class="profile-section">
        <div class="profile-section__title">${t('profile.recentReviews')}</div>
        <div id="profile-public-reviews"><div class="profile-section__empty">${t('modal.weather.loading')}</div></div>
      </div>
    `;
  }

  body.innerHTML = html;

  // Load reviews async
  if (showReviews) {
    try {
      const [reviewCount, reviews] = await Promise.all([
        getUserReviewCount(profile.id),
        getUserRecentReviews(profile.id, 3),
      ]);
      const el = document.getElementById('profile-public-reviews');
      if (!el) return;
      if (reviews.length === 0) {
        el.innerHTML = `<div class="profile-section__empty">${t('profile.noReviews')}</div>`;
        return;
      }
      let reviewHtml = `<div style="font-size:0.8rem;color:var(--c-gray-300);margin-bottom:var(--sp-2);">${t('profile.reviewCount').replace('{n}', reviewCount)}</div>`;
      reviewHtml += reviews.map(r => `
        <div class="profile-recent-item">
          <span class="profile-recent-item__name">${renderStars(r.rating, 'review-card')} ${escapeHtml(r.title || '')}</span>
          <span class="profile-recent-item__date">${formatReviewDate(r.createdAt)}</span>
        </div>
      `).join('');
      el.innerHTML = reviewHtml;
    } catch {
      const el = document.getElementById('profile-public-reviews');
      if (el) el.innerHTML = `<div class="profile-section__empty">${t('profile.noReviews')}</div>`;
    }
  }
}

function initProfileModal() {
  const overlay = document.getElementById('profile-modal-overlay');
  const closeBtn = document.getElementById('profile-modal-close');
  closeBtn.addEventListener('click', closeProfileOverlay);
  overlay.addEventListener('click', e => { if (e.target === overlay) closeProfileOverlay(); });

  // Listen for open-profile custom event (from review author clicks)
  document.addEventListener('open-profile', e => {
    const userId = e.detail?.userId;
    if (userId) openProfileModal(userId);
  });

  // Nav handlers
  document.getElementById('header-profile-btn')?.addEventListener('click', () => openProfileModal());
  document.getElementById('mobile-profile-btn')?.addEventListener('click', () => {
    closeMobileDrawer();
    openProfileModal();
  });
}

function populateProfileEditForm() {
  const profile = getCachedProfile() || {};

  // Title
  document.getElementById('profile-edit-title').textContent = t('profile.edit.title');
  document.getElementById('profile-edit-photo-label').textContent = t('profile.edit.photo');
  document.getElementById('profile-edit-photo-btn').textContent = t('profile.edit.changePhoto');
  document.getElementById('profile-edit-nickname-label').textContent = t('profile.edit.nickname');
  document.getElementById('profile-edit-bio-label').textContent = t('profile.edit.bio');
  document.getElementById('profile-edit-country-label').textContent = t('profile.edit.country');
  document.getElementById('profile-privacy-label').textContent = t('profile.privacy.title');
  document.getElementById('profile-privacy-public-label').textContent = t('profile.privacy.public');
  document.getElementById('profile-privacy-certs-label').textContent = t('profile.privacy.showCerts');
  document.getElementById('profile-privacy-reviews-label').textContent = t('profile.privacy.showReviews');
  document.getElementById('profile-edit-save').textContent = t('profile.edit.save');
  document.getElementById('profile-edit-cancel').textContent = t('profile.edit.cancel');

  // Photo preview
  const preview = document.getElementById('profile-edit-preview');
  if (profile.photoURL) {
    preview.innerHTML = `<img src="${escapeHtml(profile.photoURL)}" alt="" />`;
  } else {
    preview.innerHTML = `<svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`;
  }

  // Nickname (read-only)
  document.getElementById('profile-edit-nickname').value = profile.nickname || '';

  // Bio
  const bioInput = document.getElementById('profile-edit-bio');
  bioInput.value = profile.bio || '';
  bioInput.placeholder = t('profile.edit.bioPlaceholder');
  document.getElementById('profile-bio-count').textContent = (profile.bio || '').length;

  // Country select
  const countrySel = document.getElementById('profile-edit-country');
  countrySel.innerHTML = `<option value="">${t('profile.edit.countryPlaceholder')}</option>`;
  COUNTRY_MAP.forEach(c => {
    const opt = document.createElement('option');
    opt.value = c.en;
    opt.textContent = `${c.en} (${c.ko})`;
    if (c.en === profile.country) opt.selected = true;
    countrySel.appendChild(opt);
  });

  // Privacy toggles
  document.getElementById('profile-privacy-public').checked = !!profile.isPublic;
  document.getElementById('profile-privacy-certs').checked = profile.showCerts !== false;
  document.getElementById('profile-privacy-reviews').checked = profile.showReviews !== false;

  // Hide progress bar
  document.getElementById('profile-upload-progress').classList.add('hidden');
}

function initProfileEditModal() {
  const overlay = document.getElementById('profile-edit-overlay');
  const closeBtn = document.getElementById('profile-edit-close');
  const cancelBtn = document.getElementById('profile-edit-cancel');
  const form = document.getElementById('profile-edit-form');
  const photoBtn = document.getElementById('profile-edit-photo-btn');
  const photoInput = document.getElementById('profile-photo-input');
  const bioInput = document.getElementById('profile-edit-bio');

  closeBtn.addEventListener('click', closeProfileEditOverlay);
  cancelBtn.addEventListener('click', closeProfileEditOverlay);
  overlay.addEventListener('click', e => { if (e.target === overlay) closeProfileEditOverlay(); });

  // Bio char count
  bioInput.addEventListener('input', () => {
    document.getElementById('profile-bio-count').textContent = bioInput.value.length;
  });

  // Photo button
  photoBtn.addEventListener('click', () => photoInput.click());

  // Photo selected → upload immediately + show preview
  photoInput.addEventListener('change', async () => {
    const file = photoInput.files?.[0];
    if (!file) return;
    const progressEl = document.getElementById('profile-upload-progress');
    const fillEl = document.getElementById('profile-upload-fill');
    const textEl = document.getElementById('profile-upload-text');
    progressEl.classList.remove('hidden');
    try {
      const result = await uploadProfilePhoto(file, p => {
        fillEl.style.width = `${Math.round(p * 100)}%`;
        textEl.textContent = `${Math.round(p * 100)}%`;
      });
      const preview = document.getElementById('profile-edit-preview');
      preview.innerHTML = `<img src="${escapeHtml(result.url)}" alt="" />`;
    } catch {
      alert(t('profile.error.upload'));
    } finally {
      progressEl.classList.add('hidden');
      photoInput.value = '';
    }
  });

  // Form submit
  form.addEventListener('submit', async e => {
    e.preventDefault();
    const saveBtn = document.getElementById('profile-edit-save');
    saveBtn.disabled = true;
    try {
      await saveProfile({
        bio: bioInput.value.trim(),
        country: document.getElementById('profile-edit-country').value,
        isPublic: document.getElementById('profile-privacy-public').checked,
        showCerts: document.getElementById('profile-privacy-certs').checked,
        showReviews: document.getElementById('profile-privacy-reviews').checked,
      });
      closeProfileEditOverlay();
      openProfileModal(); // refresh view
    } catch {
      alert(t('profile.error.save'));
    } finally {
      saveBtn.disabled = false;
    }
  });
}

function resetCertForm() {
  document.getElementById('cert-modal-title').textContent = t('profile.cert.title');
  document.getElementById('cert-org-label').textContent = t('profile.cert.org');
  document.getElementById('cert-level-label').textContent = t('profile.cert.level');
  document.getElementById('cert-date-label').textContent = t('profile.cert.date');
  document.getElementById('cert-number-label').textContent = t('profile.cert.number');
  document.getElementById('cert-photo-label').textContent = t('profile.cert.photo');
  document.getElementById('cert-save').textContent = t('profile.cert.save');
  document.getElementById('cert-cancel').textContent = t('profile.cert.cancel');

  const orgSel = document.getElementById('cert-org');
  orgSel.innerHTML = `<option value="">${t('profile.cert.orgPlaceholder')}</option>`;
  Object.keys(CERT_ORGS).forEach(org => {
    const opt = document.createElement('option');
    opt.value = org;
    opt.textContent = org;
    orgSel.appendChild(opt);
  });

  const levelSel = document.getElementById('cert-level');
  levelSel.innerHTML = `<option value="">${t('profile.cert.levelPlaceholder')}</option>`;
  levelSel.disabled = true;

  document.getElementById('cert-date').value = '';
  document.getElementById('cert-number').value = '';
  document.getElementById('cert-photo-input').value = '';
  document.getElementById('cert-upload-progress').classList.add('hidden');
}

function initCertModal() {
  const overlay = document.getElementById('cert-modal-overlay');
  const closeBtn = document.getElementById('cert-modal-close');
  const cancelBtn = document.getElementById('cert-cancel');
  const form = document.getElementById('cert-form');
  const orgSel = document.getElementById('cert-org');
  const levelSel = document.getElementById('cert-level');

  closeBtn.addEventListener('click', closeCertOverlay);
  cancelBtn.addEventListener('click', closeCertOverlay);
  overlay.addEventListener('click', e => { if (e.target === overlay) closeCertOverlay(); });

  // Org → Level cascade
  orgSel.addEventListener('change', () => {
    const org = orgSel.value;
    levelSel.innerHTML = `<option value="">${t('profile.cert.levelPlaceholder')}</option>`;
    if (org && CERT_ORGS[org]) {
      CERT_ORGS[org].forEach(level => {
        const opt = document.createElement('option');
        opt.value = level;
        opt.textContent = level;
        levelSel.appendChild(opt);
      });
      levelSel.disabled = false;
    } else {
      levelSel.disabled = true;
    }
  });

  // Form submit
  form.addEventListener('submit', async e => {
    e.preventDefault();
    const org = orgSel.value;
    const level = levelSel.value;
    if (!org || !level) return;

    const saveBtn = document.getElementById('cert-save');
    saveBtn.disabled = true;

    try {
      let photoURL = '';
      let photoPath = '';
      const photoFile = document.getElementById('cert-photo-input').files?.[0];
      if (photoFile) {
        const progressEl = document.getElementById('cert-upload-progress');
        const fillEl = document.getElementById('cert-upload-fill');
        const textEl = document.getElementById('cert-upload-text');
        progressEl.classList.remove('hidden');
        const result = await uploadCertPhoto(photoFile, p => {
          fillEl.style.width = `${Math.round(p * 100)}%`;
          textEl.textContent = `${Math.round(p * 100)}%`;
        });
        photoURL = result.url;
        photoPath = result.path;
        progressEl.classList.add('hidden');
      }

      await addCertification({
        org,
        level,
        date: document.getElementById('cert-date').value,
        certNumber: document.getElementById('cert-number').value.trim(),
        photoURL,
        photoPath,
      });

      closeCertOverlay();
      openProfileModal(); // refresh
    } catch {
      alert(t('profile.error.cert'));
    } finally {
      saveBtn.disabled = false;
    }
  });
}

// ═══ Achievements ═══

function renderFeaturedBadgesHtml() {
  const badges = getFeaturedBadges();
  if (!badges || badges.length === 0) return '';
  return `<div class="profile-featured-badges">${badges.map(id => {
    const def = ACHIEVEMENT_DEFS[id];
    if (!def) return '';
    return `<span class="profile-featured-badge" title="${t('achievements.' + id + '.name')}">${def.icon}</span>`;
  }).join('')}</div>`;
}

function openAchievementsOverlay() {
  const overlay = document.getElementById('achievements-modal-overlay');
  overlay.classList.remove('hidden');
  overlay.setAttribute('aria-hidden', 'false');
  document.body.style.overflow = 'hidden';
}

function closeAchievementsOverlay() {
  const overlay = document.getElementById('achievements-modal-overlay');
  overlay.classList.add('hidden');
  overlay.setAttribute('aria-hidden', 'true');
  document.body.style.overflow = '';
}

function openAchievementDetailOverlay() {
  const overlay = document.getElementById('achievement-detail-overlay');
  overlay.classList.remove('hidden');
  overlay.setAttribute('aria-hidden', 'false');
}

function closeAchievementDetailOverlay() {
  const overlay = document.getElementById('achievement-detail-overlay');
  overlay.classList.add('hidden');
  overlay.setAttribute('aria-hidden', 'true');
}

function renderAchievementsPage() {
  const body = document.getElementById('achievements-modal-body');
  const unlocked = getUnlockedCount();
  const total = getTotalCount();
  const achievements = getUserAchievements();

  let html = `
    <h2 class="modal__section-title">${t('achievements.title')}</h2>
    <div class="achievements-counter">${t('achievements.counter').replace('{n}', unlocked).replace('{total}', total)}</div>
  `;

  // Render each category
  for (const cat of CATEGORIES) {
    const defs = Object.entries(ACHIEVEMENT_DEFS).filter(([, d]) => d.category === cat);
    if (defs.length === 0) continue;

    html += `
      <div class="achievements-category">
        <div class="achievements-category__title">${t('achievements.category.' + cat)}</div>
        <div class="achievements-grid">
    `;

    for (const [id, def] of defs) {
      const ach = achievements[id];
      const unlck = !!ach?.unlockedAt;
      const progress = ach?.progress || 0;
      const target = def.condition.value;
      const pctNum = typeof target === 'number' && target > 0 ? Math.min(100, Math.round((progress / target) * 100)) : 0;

      html += `
        <div class="achievement-card ${unlck ? 'achievement-card--unlocked' : 'achievement-card--locked'}" data-achievement-id="${id}">
          ${unlck ? '<div class="achievement-card__check">\u2713</div>' : ''}
          <div class="achievement-card__icon">${def.icon}</div>
          <div class="achievement-card__name">${t('achievements.' + id + '.name')}</div>
          ${!unlck && typeof target === 'number' ? `
            <div class="achievement-card__progress">
              <div class="achievement-card__progress-fill" style="width:${pctNum}%"></div>
            </div>
          ` : ''}
        </div>
      `;
    }

    html += '</div></div>';
  }

  // Featured badges selection
  const currentFeatured = getFeaturedBadges();
  const unlockedIds = Object.entries(achievements).filter(([, a]) => a.unlockedAt).map(([id]) => id);

  if (unlockedIds.length > 0) {
    html += `
      <div class="achievements-featured-section">
        <div class="achievements-category__title">${t('achievements.featured')}</div>
        <div class="achievements-featured-hint">${t('achievements.featuredHint')}</div>
        <div class="achievements-grid" id="featured-badge-grid">
    `;

    for (const id of unlockedIds) {
      const def = ACHIEVEMENT_DEFS[id];
      if (!def) continue;
      const selected = currentFeatured.includes(id);
      html += `
        <div class="achievement-card achievement-card--unlocked achievement-card--selectable ${selected ? 'achievement-card--selected' : ''}" data-featured-id="${id}">
          <div class="achievement-card__icon">${def.icon}</div>
          <div class="achievement-card__name">${t('achievements.' + id + '.name')}</div>
        </div>
      `;
    }

    html += `</div>
      <button class="btn btn--primary btn--sm" id="save-featured-btn" style="margin-top:var(--sp-3)">${t('achievements.featuredSave')}</button>
    </div>`;
  }

  body.innerHTML = html;

  // Bind badge card clicks → open detail
  body.querySelectorAll('.achievement-card[data-achievement-id]').forEach(card => {
    card.addEventListener('click', () => {
      const id = card.dataset.achievementId;
      showAchievementDetail(id);
    });
  });

  // Bind featured selection
  const featuredGrid = document.getElementById('featured-badge-grid');
  if (featuredGrid) {
    let selectedIds = [...currentFeatured];

    featuredGrid.querySelectorAll('[data-featured-id]').forEach(card => {
      card.addEventListener('click', () => {
        const id = card.dataset.featuredId;
        if (selectedIds.includes(id)) {
          selectedIds = selectedIds.filter(x => x !== id);
          card.classList.remove('achievement-card--selected');
        } else if (selectedIds.length < 3) {
          selectedIds.push(id);
          card.classList.add('achievement-card--selected');
        }
      });
    });

    document.getElementById('save-featured-btn')?.addEventListener('click', async () => {
      try {
        await saveFeaturedBadges(selectedIds);
      } catch { /* ignore */ }
    });
  }
}

function showAchievementDetail(id) {
  const def = ACHIEVEMENT_DEFS[id];
  if (!def) return;
  const ach = getUserAchievements()[id];
  const unlck = !!ach?.unlockedAt;

  document.getElementById('achievement-detail-icon').textContent = def.icon;
  document.getElementById('achievement-detail-name').textContent = t('achievements.' + id + '.name');
  document.getElementById('achievement-detail-desc').textContent = t('achievements.' + id + '.desc');

  if (unlck && ach.unlockedAt?.seconds) {
    const d = new Date(ach.unlockedAt.seconds * 1000);
    document.getElementById('achievement-detail-date').textContent =
      `${t('achievements.unlockedAt')}: ${d.toLocaleDateString()}`;
  } else if (unlck) {
    document.getElementById('achievement-detail-date').textContent = t('achievements.unlocked');
  } else {
    const progress = ach?.progress || 0;
    const target = def.condition.value;
    if (typeof target === 'number') {
      document.getElementById('achievement-detail-date').textContent =
        `${t('achievements.progress')}: ${progress}/${target}`;
    } else {
      document.getElementById('achievement-detail-date').textContent = t('achievements.locked');
    }
  }

  document.getElementById('achievement-detail-ok').textContent = t('achievements.confirm');
  openAchievementDetailOverlay();
}

function showAchievementToast(id) {
  const def = ACHIEVEMENT_DEFS[id];
  if (!def) return;

  const toast = document.getElementById('achievement-toast');
  document.getElementById('achievement-toast-icon').textContent = def.icon;
  document.getElementById('achievement-toast-title').textContent = t('achievements.newAchievement');
  document.getElementById('achievement-toast-desc').textContent =
    `${def.icon} ${t('achievements.' + id + '.name')} - ${t('achievements.' + id + '.desc')}`;

  toast.classList.remove('hidden');
  requestAnimationFrame(() => {
    toast.classList.add('visible');
  });

  setTimeout(() => {
    toast.classList.remove('visible');
    setTimeout(() => toast.classList.add('hidden'), 400);
  }, 4000);
}

async function runAchievementCheck() {
  try {
    const entries = getLogEntries();
    const { reviewCount, photoCount } = await countUserReviews();
    const stats = buildAchievementStats(entries, reviewCount, photoCount);
    const newlyUnlocked = await checkAchievements(stats);
    // Show toasts for newly unlocked achievements (stagger)
    for (let i = 0; i < newlyUnlocked.length; i++) {
      setTimeout(() => showAchievementToast(newlyUnlocked[i]), i * 4500);
    }
  } catch (err) {
    console.error('Achievement check error:', err);
  }
}

function initAchievementsModal() {
  const overlay = document.getElementById('achievements-modal-overlay');
  const closeBtn = document.getElementById('achievements-modal-close');
  closeBtn.addEventListener('click', closeAchievementsOverlay);
  overlay.addEventListener('click', e => { if (e.target === overlay) closeAchievementsOverlay(); });

  // Nav handlers
  document.getElementById('header-achievements-btn')?.addEventListener('click', () => {
    renderAchievementsPage();
    openAchievementsOverlay();
  });
  document.getElementById('mobile-achievements-btn')?.addEventListener('click', () => {
    closeMobileDrawer();
    renderAchievementsPage();
    openAchievementsOverlay();
  });
}

function initAchievementDetailModal() {
  const overlay = document.getElementById('achievement-detail-overlay');
  const okBtn = document.getElementById('achievement-detail-ok');
  okBtn.addEventListener('click', closeAchievementDetailOverlay);
  overlay.addEventListener('click', e => { if (e.target === overlay) closeAchievementDetailOverlay(); });
}
