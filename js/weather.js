// Open-Meteo API 호출 + 캐싱 + 다이빙 적합도
import { t, getLang } from './i18n.js';

const cache = new Map();
const CACHE_TTL = 60 * 60 * 1000; // 1시간

function cacheKey(lat, lng) {
  return `${lat.toFixed(2)},${lng.toFixed(2)}`;
}

function getCached(key) {
  const entry = cache.get(key);
  if (entry && Date.now() - entry.ts < CACHE_TTL) return entry.data;
  cache.delete(key);
  return null;
}

// Also try localStorage
function getLSCached(key) {
  try {
    const raw = localStorage.getItem('w2d_wx_' + key);
    if (!raw) return null;
    const { data, ts } = JSON.parse(raw);
    if (Date.now() - ts < CACHE_TTL) return data;
    localStorage.removeItem('w2d_wx_' + key);
  } catch { /* ignore */ }
  return null;
}

function setLSCache(key, data) {
  try {
    localStorage.setItem('w2d_wx_' + key, JSON.stringify({ data, ts: Date.now() }));
  } catch { /* quota exceeded */ }
}

// ── 풍향 각도 → 방위 텍스트 ──
const DIR_KEYS = ['wind.N', 'wind.NE', 'wind.E', 'wind.SE', 'wind.S', 'wind.SW', 'wind.W', 'wind.NW'];

export function windDir(deg) {
  if (deg == null) return '';
  return t(DIR_KEYS[Math.round(deg / 45) % 8]);
}

// ── 날씨 코드 → 설명 ──
function weatherDesc(code) {
  const key = `weather.code.${code}`;
  const val = t(key);
  return val !== key ? val : t('weather.code.unknown');
}

// ── 날씨 코드 → 아이콘 ──
const WEATHER_ICONS = {
  0: '\u2600\uFE0F',    // Clear
  1: '\uD83C\uDF24\uFE0F', // Mainly clear
  2: '\u26C5',           // Partly cloudy
  3: '\u2601\uFE0F',    // Overcast
  45: '\uD83C\uDF2B\uFE0F', // Fog
  48: '\uD83C\uDF2B\uFE0F', // Dense fog
  51: '\uD83C\uDF26\uFE0F', // Light drizzle
  53: '\uD83C\uDF26\uFE0F', // Drizzle
  55: '\uD83C\uDF27\uFE0F', // Heavy drizzle
  61: '\uD83C\uDF27\uFE0F', // Light rain
  63: '\uD83C\uDF27\uFE0F', // Moderate rain
  65: '\uD83C\uDF27\uFE0F', // Heavy rain
  71: '\uD83C\uDF28\uFE0F', // Light snow
  73: '\uD83C\uDF28\uFE0F', // Snow
  75: '\uD83C\uDF28\uFE0F', // Heavy snow
  80: '\uD83C\uDF26\uFE0F', // Rain showers
  81: '\uD83C\uDF27\uFE0F', // Heavy showers
  82: '\uD83C\uDF27\uFE0F', // Violent showers
  95: '\u26C8\uFE0F',    // Thunderstorm
  96: '\u26C8\uFE0F',    // Hail storm
  99: '\u26C8\uFE0F',    // Severe hail storm
};

export function getWeatherIcon(code) {
  return WEATHER_ICONS[code] ?? '\u2600\uFE0F';
}

// ── 다이빙 적합도 점수 (1~5) ──
export function calculateDiveScore(w) {
  let score = 5;

  // 파도 높이 감점
  if (w.waveHeight != null) {
    if (w.waveHeight > 2.0) score -= 2;
    else if (w.waveHeight > 1.5) score -= 1;
  }

  // 바람 속도 감점
  if (w.windSpeed != null) {
    if (w.windSpeed > 30) score -= 2;
    else if (w.windSpeed > 20) score -= 1;
  }

  // 강수량 감점
  if (w.precipitation != null && w.precipitation > 5) score -= 1;

  // 기온
  if (w.temperature != null) {
    if (w.temperature < 20 || w.temperature > 35) score -= 0.5;
  }

  return Math.max(1, Math.min(5, Math.round(score)));
}

// ── 적합도 메시지 ──
export function getDiveMessage(score) {
  return t(`weather.diveScore.msg${score}`);
}

// ── 적합도 별 렌더 ──
export function renderDiveStars(score) {
  let html = '';
  for (let i = 1; i <= 5; i++) {
    html += `<span class="dive-star ${i <= score ? 'dive-star--filled' : ''}">\u2605</span>`;
  }
  return html;
}

// ── 요일 이름 ──
function getDayLabel(dateStr, idx) {
  if (idx === 0) return t('weather.forecast.today');
  if (idx === 1) return t('weather.forecast.tomorrow');
  const d = new Date(dateStr + 'T00:00:00');
  const dayKey = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d.getDay()];
  return t('weather.forecast.day.' + dayKey);
}

// ── 현재 날씨 가져오기 (기존 호환) ──
export async function fetchWeather(lat, lng) {
  const full = await fetchWeatherFull(lat, lng);
  return full.current;
}

// ── 전체 날씨 (현재 + 7일 예보) 가져오기 ──
export async function fetchWeatherFull(lat, lng) {
  const key = cacheKey(lat, lng);

  // Memory cache
  const memCached = getCached(key);
  if (memCached) return memCached;

  // localStorage cache
  const lsCached = getLSCached(key);
  if (lsCached) {
    cache.set(key, { data: lsCached, ts: Date.now() });
    return lsCached;
  }

  const [forecastRes, marineRes] = await Promise.all([
    fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}` +
      `&current=temperature_2m,weather_code,wind_speed_10m,wind_direction_10m,precipitation` +
      `&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,wind_speed_10m_max` +
      `&forecast_days=7&timezone=auto`
    ),
    fetch(
      `https://marine-api.open-meteo.com/v1/marine?latitude=${lat}&longitude=${lng}` +
      `&current=wave_height,wave_direction,wave_period,ocean_temperature` +
      `&daily=wave_height_max,wave_period_max` +
      `&forecast_days=7&timezone=auto`
    ),
  ]);

  if (!forecastRes.ok) throw new Error(t('weather.fetchError'));

  const forecast = await forecastRes.json();
  let marine = null;
  if (marineRes.ok) {
    marine = await marineRes.json();
  }

  const fc = forecast.current;
  const mc = marine?.current;

  const current = {
    temperature: fc?.temperature_2m ?? null,
    weatherCode: fc?.weather_code ?? null,
    weatherText: weatherDesc(fc?.weather_code),
    windSpeed: fc?.wind_speed_10m ?? null,
    windDeg: fc?.wind_direction_10m ?? null,
    windDir: fc?.wind_direction_10m != null ? windDir(fc.wind_direction_10m) : null,
    precipitation: fc?.precipitation ?? null,
    waterTemp: mc?.ocean_temperature ?? null,
    waveHeight: mc?.wave_height ?? null,
    waveDir: mc?.wave_direction != null ? windDir(mc.wave_direction) : null,
    wavePeriod: mc?.wave_period ?? null,
  };

  // Build 7-day forecast
  const daily = [];
  const fd = forecast.daily;
  const md = marine?.daily;

  if (fd?.time) {
    for (let i = 0; i < fd.time.length; i++) {
      const dayWeather = {
        date: fd.time[i],
        dayLabel: getDayLabel(fd.time[i], i),
        weatherCode: fd.weather_code?.[i] ?? null,
        tempMax: fd.temperature_2m_max?.[i] ?? null,
        tempMin: fd.temperature_2m_min?.[i] ?? null,
        precipitation: fd.precipitation_sum?.[i] ?? null,
        windSpeedMax: fd.wind_speed_10m_max?.[i] ?? null,
        waveHeightMax: md?.wave_height_max?.[i] ?? null,
        wavePeriodMax: md?.wave_period_max?.[i] ?? null,
      };

      // Compute dive score for daily data
      dayWeather.diveScore = calculateDiveScore({
        waveHeight: dayWeather.waveHeightMax,
        windSpeed: dayWeather.windSpeedMax,
        precipitation: dayWeather.precipitation,
        temperature: dayWeather.tempMax,
      });

      daily.push(dayWeather);
    }
  }

  // Current dive score
  current.diveScore = calculateDiveScore(current);

  const data = { current, daily };
  cache.set(key, { data, ts: Date.now() });
  setLSCache(key, data);
  return data;
}
