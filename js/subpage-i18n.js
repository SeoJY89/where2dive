// Shared i18n for subpages (about, terms, privacy, guide, contact)
const LANG_KEY = 'where2dive_lang';

const footerStrings = {
  ko: {
    'footer.section.service': '서비스',
    'footer.desc': '전 세계 다이빙 스팟을 찾고, 날씨와 해양 정보를 확인하세요.',
    'footer.section.legal': '법적 고지',
    'footer.privacy': '개인정보 처리방침',
    'footer.terms': '이용약관',
    'footer.section.info': '정보',
    'footer.about': 'Where2Dive 소개',
    'footer.guide': '다이빙 가이드',
    'footer.contact': '문의하기',
    'footer.section.data': '데이터',
  },
  en: {
    'footer.section.service': 'Service',
    'footer.desc': 'Find diving spots worldwide with weather and marine information.',
    'footer.section.legal': 'Legal',
    'footer.privacy': 'Privacy Policy',
    'footer.terms': 'Terms of Service',
    'footer.section.info': 'Info',
    'footer.about': 'About Where2Dive',
    'footer.guide': 'Diving Guide',
    'footer.contact': 'Contact Us',
    'footer.section.data': 'Data',
  },
};

export function getLang() {
  return localStorage.getItem(LANG_KEY) || 'ko';
}

export function setLang(lang) {
  localStorage.setItem(LANG_KEY, lang);
}

export function applySubpageI18n() {
  const lang = getLang();
  document.documentElement.lang = lang;

  // Footer
  const dict = footerStrings[lang] || footerStrings.ko;
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    if (dict[key]) el.textContent = dict[key];
  });

  // Nav
  document.querySelectorAll('[data-i18n-nav]').forEach(a => {
    const map = lang === 'en'
      ? { home: 'Home', about: 'About', guide: 'Guide', contact: 'Contact', privacy: 'Privacy', terms: 'Terms' }
      : { home: '홈', about: '소개', guide: '가이드', contact: '문의', privacy: '개인정보', terms: '이용약관' };
    const key = a.getAttribute('data-i18n-nav');
    if (map[key]) a.textContent = map[key];
  });

  // Page body toggle (ko/en dual divs)
  const bodyKo = document.getElementById('page-body-ko');
  const bodyEn = document.getElementById('page-body-en');
  if (bodyKo && bodyEn) {
    bodyKo.style.display = lang === 'en' ? 'none' : 'block';
    bodyEn.style.display = lang === 'en' ? 'block' : 'none';
  }

  // Page title
  const titleEl = document.getElementById('page-title');
  const titleKey = titleEl?.getAttribute('data-i18n-title');
  if (titleEl && titleKey) {
    const titles = {
      about: { ko: 'Where2Dive 소개', en: 'About Where2Dive' },
      terms: { ko: '이용약관', en: 'Terms of Service' },
      privacy: { ko: '개인정보 처리방침', en: 'Privacy Policy' },
      guide: { ko: '다이빙 가이드', en: 'Diving Guide' },
      contact: { ko: '문의하기', en: 'Contact Us' },
    };
    if (titles[titleKey]) titleEl.textContent = titles[titleKey][lang];
  }

  // Page update text
  const updateEl = document.getElementById('page-update');
  if (updateEl) {
    updateEl.textContent = lang === 'en' ? 'Last updated: February 2025' : '최종 업데이트: 2025년 2월';
  }

  // Lang toggle button
  const toggleBtn = document.getElementById('lang-toggle');
  if (toggleBtn) toggleBtn.textContent = lang === 'ko' ? 'EN' : 'KO';
}

export function initLangToggle() {
  const btn = document.getElementById('lang-toggle');
  if (!btn) return;
  btn.addEventListener('click', () => {
    const next = getLang() === 'ko' ? 'en' : 'ko';
    setLang(next);
    applySubpageI18n();
    // Contact page has its own applyLabels
    if (typeof window._applyContactLabels === 'function') window._applyContactLabels();
  });
}
