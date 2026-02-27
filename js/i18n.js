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

  // page
  'title': 'Where2Dive — 다이빙 스팟 찾기',
};

// ── English strings ──
const en = {
  // nav
  'nav.map': 'Map',
  'nav.list': 'List',
  'nav.favorites': 'Favorites',

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

  // page
  'title': 'Where2Dive — Find Diving Spots',
};
