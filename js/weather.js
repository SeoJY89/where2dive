// Open-Meteo API 호출 + 30분 인메모리 캐싱
const cache = new Map();
const CACHE_TTL = 30 * 60 * 1000; // 30분

function cacheKey(lat, lng) {
  return `${lat.toFixed(2)},${lng.toFixed(2)}`;
}

function getCached(key) {
  const entry = cache.get(key);
  if (entry && Date.now() - entry.ts < CACHE_TTL) return entry.data;
  cache.delete(key);
  return null;
}

// 풍향 각도 → 방위 텍스트
function windDir(deg) {
  const dirs = ['북', '북동', '동', '남동', '남', '남서', '서', '북서'];
  return dirs[Math.round(deg / 45) % 8];
}

// 날씨 코드 → 설명
function weatherDesc(code) {
  const map = {
    0: '맑음', 1: '대체로 맑음', 2: '구름 약간', 3: '흐림',
    45: '안개', 48: '짙은 안개',
    51: '이슬비', 53: '이슬비', 55: '강한 이슬비',
    61: '약한 비', 63: '비', 65: '강한 비',
    71: '약한 눈', 73: '눈', 75: '강한 눈',
    80: '소나기', 81: '소나기', 82: '강한 소나기',
    95: '뇌우', 96: '우박 뇌우', 99: '강한 우박 뇌우',
  };
  return map[code] || '정보 없음';
}

export async function fetchWeather(lat, lng) {
  const key = cacheKey(lat, lng);
  const cached = getCached(key);
  if (cached) return cached;

  const [forecastRes, marineRes] = await Promise.all([
    fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}` +
      `&current=temperature_2m,weather_code,wind_speed_10m,wind_direction_10m` +
      `&timezone=auto`
    ),
    fetch(
      `https://marine-api.open-meteo.com/v1/marine?latitude=${lat}&longitude=${lng}` +
      `&current=wave_height,wave_direction,wave_period,ocean_temperature` +
      `&timezone=auto`
    ),
  ]);

  if (!forecastRes.ok) throw new Error('날씨 데이터 로딩 실패');

  const forecast = await forecastRes.json();
  let marine = null;
  if (marineRes.ok) {
    marine = await marineRes.json();
  }

  const fc = forecast.current;
  const mc = marine?.current;

  const data = {
    // 대기
    temperature: fc?.temperature_2m ?? null,
    weatherCode: fc?.weather_code ?? null,
    weatherText: weatherDesc(fc?.weather_code),
    windSpeed: fc?.wind_speed_10m ?? null,
    windDir: fc?.wind_direction_10m != null ? windDir(fc.wind_direction_10m) : null,
    // 해양
    waterTemp: mc?.ocean_temperature ?? null,
    waveHeight: mc?.wave_height ?? null,
    waveDir: mc?.wave_direction != null ? windDir(mc.wave_direction) : null,
    wavePeriod: mc?.wave_period ?? null,
  };

  cache.set(key, { data, ts: Date.now() });
  return data;
}
