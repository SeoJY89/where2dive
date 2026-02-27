// 즐겨찾기 관리 (localStorage)
const STORAGE_KEY = 'where2dive_favorites';

let favSet = new Set(JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'));

function persist() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify([...favSet]));
}

export function getFavorites() {
  return favSet;
}

export function isFavorite(id) {
  return favSet.has(id);
}

export function toggleFavorite(id) {
  if (favSet.has(id)) {
    favSet.delete(id);
  } else {
    favSet.add(id);
  }
  persist();
  return favSet.has(id);
}

export function getFavCount() {
  return favSet.size;
}
