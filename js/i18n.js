// i18n — language state + UI string dictionary
const STORAGE_KEY = 'where2dive_lang';

let currentLang = localStorage.getItem(STORAGE_KEY) || 'ko';
let langChangeListener = null;

export function getLang() { return currentLang; }

export function setLang(lang) {
  if (lang !== 'ko' && lang !== 'en') return;
  currentLang = lang;
  localStorage.setItem(STORAGE_KEY, lang);
  if (langChangeListener) langChangeListener(lang);
}

export function setLangChangeListener(fn) {
  langChangeListener = fn;
}

/** Translate a UI string key */
export function t(key) {
  const dict = currentLang === 'en' ? en : ko;
  return dict[key] ?? key;
}

/** Translate a data field — returns spot[field+'En'] when lang=en */
export function td(spot, field) {
  if (currentLang === 'en') {
    const enVal = spot[field + 'En'];
    if (enVal !== undefined && enVal !== null) return enVal;
  }
  return spot[field];
}

/** Convert Korean month string like '6월' to English like 'Jun' */
const MONTH_MAP = {
  '1월': 'Jan', '2월': 'Feb', '3월': 'Mar', '4월': 'Apr',
  '5월': 'May', '6월': 'Jun', '7월': 'Jul', '8월': 'Aug',
  '9월': 'Sep', '10월': 'Oct', '11월': 'Nov', '12월': 'Dec',
};

export function translateMonth(monthStr) {
  if (currentLang === 'en') return MONTH_MAP[monthStr] || monthStr;
  return monthStr;
}

// ── Korean strings ──
const ko = {
  // nav
  'nav.map': '지도',
  'nav.list': '목록',
  'nav.favorites': '즐겨찾기',
  'nav.listToggle': '목록',

  // filter
  'filter.search.placeholder': '스팟 이름, 국가, 해양생물 검색...',
  'filter.country.placeholder': '국가 검색 (EN)...',
  'filter.region.all': '모든 지역',
  'filter.reset': '초기화',
  'filter.activity.all': '전체',
  'filter.activity.skin': '스킨',
  'filter.activity.scuba': '스쿠버',
  'filter.button': '필터',
  'filter.temp.label': '수온',

  // card
  'card.depth': '수심',
  'card.waterTemp': '수온',
  'card.visibility': '시야',
  'card.detail': '상세보기',
  'card.count': '{n}개 다이빙 스팟',

  // modal
  'modal.info': '다이빙 정보',
  'modal.depth': '수심',
  'modal.waterTemp': '수온',
  'modal.visibility': '시야',
  'modal.difficulty': '난이도',
  'modal.activityType': '활동유형',
  'modal.bestSeason': '추천 시즌',
  'modal.marineLife': '해양 생물',
  'modal.highlights': '하이라이트',

  // weather (modal)
  'modal.weather.title': '실시간 날씨 · 해양 정보',
  'modal.weather.loading': '날씨 데이터 불러오는 중...',
  'weather.temperature': '기온',
  'weather.weather': '날씨',
  'weather.windSpeed': '풍속',
  'weather.windDir': '풍향',
  'weather.waterTemp': '수온(실시간)',
  'weather.waveHeight': '파고',
  'weather.waveDir': '파향',
  'weather.wavePeriod': '파주기',
  'weather.error': '날씨 데이터를 불러오지 못했습니다.',
  'weather.retry': '다시 시도',
  'weather.noData': '이 지역의 날씨 데이터를 사용할 수 없습니다.',
  'weather.fetchError': '날씨 데이터 로딩 실패',

  // empty
  'empty.noSpots': '조건에 맞는 다이빙 스팟이 없습니다.',
  'empty.reset': '필터 초기화',
  'empty.noFavorites': '아직 즐겨찾기한 스팟이 없습니다.',
  'empty.noFavoritesSub': '하트를 눌러 관심 있는 스팟을 저장해보세요!',

  // regions
  'region.korea': '한국',
  'region.southeast-asia': '동남아시아',
  'region.oceania': '오세아니아',
  'region.indian-ocean': '인도양',
  'region.red-sea': '홍해',
  'region.caribbean': '카리브해',
  'region.europe': '유럽',
  'region.east-asia': '동아시아',
  'region.pacific': '태평양',
  'region.americas': '아메리카',

  // difficulty
  'difficulty.beginner': '초급',
  'difficulty.intermediate': '중급',
  'difficulty.advanced': '상급',

  // activity
  'activity.skin': '스킨',
  'activity.scuba': '스쿠버',

  // wind directions
  'wind.N': '북', 'wind.NE': '북동', 'wind.E': '동', 'wind.SE': '남동',
  'wind.S': '남', 'wind.SW': '남서', 'wind.W': '서', 'wind.NW': '북서',

  // weather codes
  'weather.code.0': '맑음',
  'weather.code.1': '대체로 맑음',
  'weather.code.2': '구름 약간',
  'weather.code.3': '흐림',
  'weather.code.45': '안개',
  'weather.code.48': '짙은 안개',
  'weather.code.51': '이슬비',
  'weather.code.53': '이슬비',
  'weather.code.55': '강한 이슬비',
  'weather.code.61': '약한 비',
  'weather.code.63': '비',
  'weather.code.65': '강한 비',
  'weather.code.71': '약한 눈',
  'weather.code.73': '눈',
  'weather.code.75': '강한 눈',
  'weather.code.80': '소나기',
  'weather.code.81': '소나기',
  'weather.code.82': '강한 소나기',
  'weather.code.95': '뇌우',
  'weather.code.96': '우박 뇌우',
  'weather.code.99': '강한 우박 뇌우',
  'weather.code.unknown': '정보 없음',

  // landing
  'landing.tagline': '전 세계 다이빙 스팟을 찾아보세요',
  'landing.email': '이메일',
  'landing.password': '비밀번호',
  'landing.login': '로그인',
  'landing.signup': '회원가입',
  'landing.or': '또는',
  'landing.google': 'Google로 계속하기',
  'landing.demo': '데모: demo@where2dive.com / 1234',
  'landing.error': '이메일 또는 비밀번호가 올바르지 않습니다.',

  // auth errors
  'auth.error.generic': '인증에 실패했습니다. 다시 시도해주세요.',
  'auth.error.user-not-found': '등록되지 않은 이메일입니다.',
  'auth.error.wrong-password': '비밀번호가 올바르지 않습니다.',
  'auth.error.invalid-email': '유효하지 않은 이메일 주소입니다.',
  'auth.error.email-already-in-use': '이미 사용 중인 이메일입니다.',
  'auth.error.weak-password': '비밀번호는 6자 이상이어야 합니다.',
  'auth.error.too-many-requests': '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.',
  'auth.error.invalid-credential': '이메일 또는 비밀번호가 올바르지 않습니다.',
  'auth.error.network-request-failed': '네트워크 오류가 발생했습니다. 인터넷 연결을 확인해주세요.',

  // nav (addition)
  'nav.logout': '로그아웃',
  'nav.logbook': '로그북',

  // logbook
  'logbook.stats.totalDives': '총 다이브',
  'logbook.stats.maxDepth': '최대 수심',
  'logbook.stats.totalTime': '총 시간',
  'logbook.addNew': '+ 새 로그',
  'logbook.empty': '아직 다이빙 로그가 없습니다.',
  'logbook.emptySub': '첫 다이빙 기록을 추가해보세요!',
  'logbook.depth': '수심',
  'logbook.time': '시간',
  'logbook.temp': '수온',
  'logbook.form.title': '새 다이빙 로그',
  'logbook.form.titleEdit': '다이빙 로그 수정',
  'logbook.form.date': '날짜',
  'logbook.form.spotName': '스팟 이름',
  'logbook.form.activityType': '활동 유형',
  'logbook.form.maxDepth': '최대 수심 (m)',
  'logbook.form.diveTime': '다이빙 시간 (분)',
  'logbook.form.waterTemp': '수온 (°C)',
  'logbook.form.visibility': '시야 (m)',
  'logbook.form.equipment': '장비',
  'logbook.form.weight': '웨이트 (kg)',
  'logbook.form.tankStart': '시작 잔압 (bar)',
  'logbook.form.tankEnd': '종료 잔압 (bar)',
  'logbook.form.buddy': '버디',
  'logbook.form.weather': '날씨',
  'logbook.form.location': '위치',
  'logbook.form.pickOnMap': '지도에서 선택',
  'logbook.form.pickBanner': '지도를 클릭하여 위치를 선택하세요',
  'logbook.form.pickCancel': '취소',
  'logbook.form.memo': '메모',
  'logbook.form.save': '저장',
  'logbook.form.cancel': '취소',
  'logbook.delete.confirm': '이 로그를 삭제하시겠습니까?',
  'logbook.card.edit': '수정',
  'logbook.card.delete': '삭제',

  // my spots
  'myspot.badge': '내 스팟',
  'myspot.toggle': '내 스팟',
  'myspot.add': '스팟 추가',
  'myspot.form.title': '새 다이빙 스팟',
  'myspot.form.titleEdit': '스팟 수정',
  'myspot.form.name': '스팟 이름',
  'myspot.form.location': '위치',
  'myspot.form.pickOnMap': '지도에서 선택',
  'myspot.form.depth': '수심',
  'myspot.form.tempMin': '최저 수온 (°C)',
  'myspot.form.tempMax': '최고 수온 (°C)',
  'myspot.form.difficulty': '난이도',
  'myspot.form.activityTypes': '활동 유형',
  'myspot.form.memo': '메모',
  'myspot.form.save': '저장',
  'myspot.form.cancel': '취소',
  'myspot.delete.confirm': '이 스팟을 삭제하시겠습니까?',
  'myspot.card.edit': '수정',
  'myspot.card.delete': '삭제',

  // page
  'title': 'Where2Dive — 다이빙 스팟 찾기',

  // footer
  'footer.about': 'Where2Dive 소개',
  'footer.guide': '다이빙 가이드',
  'footer.privacy': '개인정보 처리방침',
  'footer.terms': '이용약관',
  'footer.contact': '문의하기',
  'footer.section.service': '서비스',
  'footer.section.legal': '법적 고지',
  'footer.section.info': '정보',
  'footer.section.data': '데이터',
  'footer.desc': '전 세계 다이빙 스팟을 찾고, 날씨와 해양 정보를 확인하세요.',
  'footer.copyright': '© 2025 Where2Dive. All rights reserved.',
  'footer.openMeteo': 'Open-Meteo',
  'footer.osm': 'OpenStreetMap',

  // cookie
  'cookie.text': '이 웹사이트는 사용자 경험 개선을 위해 쿠키를 사용합니다. 계속 사용하면 쿠키 사용에 동의하는 것으로 간주합니다.',
  'cookie.accept': '동의',
  'cookie.learnMore': '자세히 보기',
};

// ── English strings ──
const en = {
  // nav
  'nav.map': 'Map',
  'nav.list': 'List',
  'nav.favorites': 'Favorites',
  'nav.listToggle': 'List',

  // filter
  'filter.search.placeholder': 'Search spots, countries, marine life...',
  'filter.country.placeholder': 'Search country...',
  'filter.region.all': 'All Regions',
  'filter.reset': 'Reset',
  'filter.activity.all': 'All',
  'filter.activity.skin': 'Skin',
  'filter.activity.scuba': 'Scuba',
  'filter.button': 'Filter',
  'filter.temp.label': 'Temp',

  // card
  'card.depth': 'Depth',
  'card.waterTemp': 'Temp',
  'card.visibility': 'Visibility',
  'card.detail': 'Details',
  'card.count': '{n} diving spots',

  // modal
  'modal.info': 'Dive Info',
  'modal.depth': 'Depth',
  'modal.waterTemp': 'Temp',
  'modal.visibility': 'Visibility',
  'modal.difficulty': 'Difficulty',
  'modal.activityType': 'Activity',
  'modal.bestSeason': 'Best Season',
  'modal.marineLife': 'Marine Life',
  'modal.highlights': 'Highlights',

  // weather (modal)
  'modal.weather.title': 'Live Weather & Marine Info',
  'modal.weather.loading': 'Loading weather data...',
  'weather.temperature': 'Temp',
  'weather.weather': 'Weather',
  'weather.windSpeed': 'Wind',
  'weather.windDir': 'Wind Dir',
  'weather.waterTemp': 'Sea Temp',
  'weather.waveHeight': 'Waves',
  'weather.waveDir': 'Wave Dir',
  'weather.wavePeriod': 'Period',
  'weather.error': 'Failed to load weather data.',
  'weather.retry': 'Retry',
  'weather.noData': 'Weather data unavailable for this area.',
  'weather.fetchError': 'Weather data loading failed',

  // empty
  'empty.noSpots': 'No diving spots match your criteria.',
  'empty.reset': 'Reset Filters',
  'empty.noFavorites': 'No favorite spots yet.',
  'empty.noFavoritesSub': 'Tap the heart icon to save spots you like!',

  // regions
  'region.korea': 'Korea',
  'region.southeast-asia': 'Southeast Asia',
  'region.oceania': 'Oceania',
  'region.indian-ocean': 'Indian Ocean',
  'region.red-sea': 'Red Sea',
  'region.caribbean': 'Caribbean',
  'region.europe': 'Europe',
  'region.east-asia': 'East Asia',
  'region.pacific': 'Pacific',
  'region.americas': 'Americas',

  // difficulty
  'difficulty.beginner': 'Beginner',
  'difficulty.intermediate': 'Intermediate',
  'difficulty.advanced': 'Advanced',

  // activity
  'activity.skin': 'Skin',
  'activity.scuba': 'Scuba',

  // wind directions
  'wind.N': 'N', 'wind.NE': 'NE', 'wind.E': 'E', 'wind.SE': 'SE',
  'wind.S': 'S', 'wind.SW': 'SW', 'wind.W': 'W', 'wind.NW': 'NW',

  // weather codes
  'weather.code.0': 'Clear',
  'weather.code.1': 'Mostly Clear',
  'weather.code.2': 'Partly Cloudy',
  'weather.code.3': 'Overcast',
  'weather.code.45': 'Fog',
  'weather.code.48': 'Dense Fog',
  'weather.code.51': 'Light Drizzle',
  'weather.code.53': 'Drizzle',
  'weather.code.55': 'Heavy Drizzle',
  'weather.code.61': 'Light Rain',
  'weather.code.63': 'Rain',
  'weather.code.65': 'Heavy Rain',
  'weather.code.71': 'Light Snow',
  'weather.code.73': 'Snow',
  'weather.code.75': 'Heavy Snow',
  'weather.code.80': 'Showers',
  'weather.code.81': 'Showers',
  'weather.code.82': 'Heavy Showers',
  'weather.code.95': 'Thunderstorm',
  'weather.code.96': 'Hail Storm',
  'weather.code.99': 'Severe Hail Storm',
  'weather.code.unknown': 'Unknown',

  // landing
  'landing.tagline': 'Discover diving spots worldwide',
  'landing.email': 'Email',
  'landing.password': 'Password',
  'landing.login': 'Log in',
  'landing.signup': 'Sign up',
  'landing.or': 'or',
  'landing.google': 'Continue with Google',
  'landing.demo': 'Demo: demo@where2dive.com / 1234',
  'landing.error': 'Invalid email or password.',

  // auth errors
  'auth.error.generic': 'Authentication failed. Please try again.',
  'auth.error.user-not-found': 'No account found with this email.',
  'auth.error.wrong-password': 'Incorrect password.',
  'auth.error.invalid-email': 'Invalid email address.',
  'auth.error.email-already-in-use': 'This email is already registered.',
  'auth.error.weak-password': 'Password must be at least 6 characters.',
  'auth.error.too-many-requests': 'Too many attempts. Please try again later.',
  'auth.error.invalid-credential': 'Invalid email or password.',
  'auth.error.network-request-failed': 'Network error. Please check your connection.',

  // nav (addition)
  'nav.logout': 'Logout',
  'nav.logbook': 'Logbook',

  // logbook
  'logbook.stats.totalDives': 'Total Dives',
  'logbook.stats.maxDepth': 'Max Depth',
  'logbook.stats.totalTime': 'Total Time',
  'logbook.addNew': '+ New Log',
  'logbook.empty': 'No diving logs yet.',
  'logbook.emptySub': 'Add your first dive log!',
  'logbook.depth': 'Depth',
  'logbook.time': 'Time',
  'logbook.temp': 'Temp',
  'logbook.form.title': 'New Dive Log',
  'logbook.form.titleEdit': 'Edit Dive Log',
  'logbook.form.date': 'Date',
  'logbook.form.spotName': 'Spot Name',
  'logbook.form.activityType': 'Activity Type',
  'logbook.form.maxDepth': 'Max Depth (m)',
  'logbook.form.diveTime': 'Dive Time (min)',
  'logbook.form.waterTemp': 'Water Temp (°C)',
  'logbook.form.visibility': 'Visibility (m)',
  'logbook.form.equipment': 'Equipment',
  'logbook.form.weight': 'Weight (kg)',
  'logbook.form.tankStart': 'Tank Start (bar)',
  'logbook.form.tankEnd': 'Tank End (bar)',
  'logbook.form.buddy': 'Buddy',
  'logbook.form.weather': 'Weather',
  'logbook.form.location': 'Location',
  'logbook.form.pickOnMap': 'Pick on Map',
  'logbook.form.pickBanner': 'Click the map to select a location',
  'logbook.form.pickCancel': 'Cancel',
  'logbook.form.memo': 'Memo',
  'logbook.form.save': 'Save',
  'logbook.form.cancel': 'Cancel',
  'logbook.delete.confirm': 'Delete this log?',
  'logbook.card.edit': 'Edit',
  'logbook.card.delete': 'Delete',

  // my spots
  'myspot.badge': 'My Spot',
  'myspot.toggle': 'My Spots',
  'myspot.add': 'Add Spot',
  'myspot.form.title': 'New Diving Spot',
  'myspot.form.titleEdit': 'Edit Spot',
  'myspot.form.name': 'Spot Name',
  'myspot.form.location': 'Location',
  'myspot.form.pickOnMap': 'Pick on Map',
  'myspot.form.depth': 'Depth',
  'myspot.form.tempMin': 'Min Temp (°C)',
  'myspot.form.tempMax': 'Max Temp (°C)',
  'myspot.form.difficulty': 'Difficulty',
  'myspot.form.activityTypes': 'Activity Types',
  'myspot.form.memo': 'Memo',
  'myspot.form.save': 'Save',
  'myspot.form.cancel': 'Cancel',
  'myspot.delete.confirm': 'Delete this spot?',
  'myspot.card.edit': 'Edit',
  'myspot.card.delete': 'Delete',

  // page
  'title': 'Where2Dive — Find Diving Spots',

  // footer
  'footer.about': 'About Where2Dive',
  'footer.guide': 'Diving Guide',
  'footer.privacy': 'Privacy Policy',
  'footer.terms': 'Terms of Service',
  'footer.contact': 'Contact Us',
  'footer.section.service': 'Service',
  'footer.section.legal': 'Legal',
  'footer.section.info': 'Info',
  'footer.section.data': 'Data',
  'footer.desc': 'Discover diving spots worldwide with live weather and marine info.',
  'footer.copyright': '© 2025 Where2Dive. All rights reserved.',
  'footer.openMeteo': 'Open-Meteo',
  'footer.osm': 'OpenStreetMap',

  // cookie
  'cookie.text': 'This website uses cookies to improve your experience. By continuing to use this site, you consent to the use of cookies.',
  'cookie.accept': 'Accept',
  'cookie.learnMore': 'Learn More',
};
