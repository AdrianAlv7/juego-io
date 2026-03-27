export const GARAGE_STORAGE_KEY = "deliver_selected_moto";
const LEGACY_GARAGE_STORAGE_KEY = "repartidor_selected_moto";

export const GARAGE_MOTOS = Object.freeze([
  {
    id: "bmw",
    label: "BMW",
    textureKey: "moto-bmw",
    assetPath: "assets/motos/bmw.png",
    previewSrc: "/assets/motos/bmw.png",
  },
  {
    id: "ducati",
    label: "Ducati",
    textureKey: "moto-ducati",
    assetPath: "assets/motos/ducati.png",
    previewSrc: "/assets/motos/ducati.png",
  },
  {
    id: "honda",
    label: "Honda",
    textureKey: "moto-honda",
    assetPath: "assets/motos/honda.png",
    previewSrc: "/assets/motos/honda.png",
  },
  {
    id: "kawa",
    label: "Kawasaki",
    textureKey: "moto-kawa",
    assetPath: "assets/motos/kawa.png",
    previewSrc: "/assets/motos/kawa.png",
  },
  {
    id: "yamaha",
    label: "Yamaha",
    textureKey: "moto-yamaha",
    assetPath: "assets/motos/yamaha.png",
    previewSrc: "/assets/motos/yamaha.png",
  },
  {
    id: "suzuki",
    label: "Suzuki",
    textureKey: "moto-suzuki",
    assetPath: "assets/motos/suziki.png",
    previewSrc: "/assets/motos/suziki.png",
  },
]);

export const DEFAULT_GARAGE_MOTO_ID = GARAGE_MOTOS[0].id;
const GARAGE_MOTO_IDS = new Set(GARAGE_MOTOS.map((moto) => moto.id));

export function getGarageMotoById(id) {
  return (
    GARAGE_MOTOS.find((moto) => moto.id === id) ||
    GARAGE_MOTOS.find((moto) => moto.id === DEFAULT_GARAGE_MOTO_ID) ||
    GARAGE_MOTOS[0]
  );
}

export function getSavedGarageMotoId() {
  if (typeof window === "undefined") return null;
  const storedValue =
    window.localStorage.getItem(GARAGE_STORAGE_KEY) ||
    window.localStorage.getItem(LEGACY_GARAGE_STORAGE_KEY) ||
    "";
  const rawValue = String(storedValue)
    .trim()
    .toLowerCase();
  return GARAGE_MOTO_IDS.has(rawValue) ? rawValue : null;
}

export function hasSavedGarageMotoSelection() {
  return Boolean(getSavedGarageMotoId());
}

export function loadSelectedGarageMotoId() {
  return getGarageMotoById(getSavedGarageMotoId() || DEFAULT_GARAGE_MOTO_ID).id;
}

export function saveSelectedGarageMotoId(id) {
  const resolvedId = getGarageMotoById(id).id;
  if (typeof window !== "undefined") {
    window.localStorage.setItem(GARAGE_STORAGE_KEY, resolvedId);
  }
  return resolvedId;
}

export function getSelectedGarageMotoConfig(id) {
  return getGarageMotoById(id || loadSelectedGarageMotoId());
}
