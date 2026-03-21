import CityRaceMap from "./race/CityRaceMap.js";
import { CITY_RACE_LAYOUT } from "./race/config/cityRaceLayout.js";
import TiledPreviewMap, {
  getTiledPreviewSpawnPoint,
  preloadTiledPreviewAssets,
} from "./tiled/TiledPreviewMap.js";

const MAPS = {
  tiledPreview: {
    id: "tiledPreview",
    label: "Mapa Tiled Preview",
    preload(scene) {
      preloadTiledPreviewAssets(scene);
    },
    create(scene, options = {}) {
      return new TiledPreviewMap(scene, options);
    },
    getSpawnPoint() {
      return getTiledPreviewSpawnPoint();
    },
  },
  cityRace: {
    id: "cityRace",
    label: "City Race",
    preload() {},
    create(scene, options = {}) {
      return new CityRaceMap(scene, options);
    },
    getSpawnPoint() {
      return { ...CITY_RACE_LAYOUT.spawnPoint };
    },
  },
};

export const ACTIVE_MAP = MAPS.tiledPreview;

export function preloadActiveMapAssets(scene) {
  ACTIVE_MAP.preload(scene);
}
