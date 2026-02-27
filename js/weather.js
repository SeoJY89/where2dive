// Open-Meteo API 호출 + 30분 인메모리 캐싱
import { t } from './i18n.js';

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
const DIR_KEYS = ['wind.N', 'wind.NE', 'wind.E', 'wind.SE', 'wind.S', 'wind.SW', 'wind.W', 'wind.NW'];

function windDir(deg) {
  return t(DIR_KEYS[Math.round(deg / 45) % 8]);
}

// 날씨 코드 → 설명
function weatherDesc(code) {
  const key = `weather.code.${code}`;
  const val = t(key);
  return val !== key ? val : t('weather.code.unknown');
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

  if (!forecastRes.ok) throw new Error(t('weather.fetchError'));

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
