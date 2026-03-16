// Estado inicial del GameScene.
// Declara y reinicia todas las propiedades runtime que la escena y sus modulos comparten.
import { createEmptyWeatherEventState } from "../../events/weather/catalog.js";
import { createInventoryState } from "../../items/catalog.js";
import { STARTUP_STABILIZE_FRAMES } from "./constants.js";

export function initializeGameSceneState(scene) {
  scene.inputSystem = null;
  scene.restartLevelKey = null;

  scene.map = null;
  scene.moto = null;
  scene.hud = null;
  scene.effectCamera = null;
  scene.hudCamera = null;
  scene.playersGroup = null;
  scene.multiplayer = null;

  scene.matchRunning = false;
  scene.matchEnded = false;
  scene.finishSent = false;
  scene.currentLobbyState = null;
  scene.isRegistered = false;
  scene.pendingRoomMode = "public";
  scene.roomCodeValue = "";

  scene.cameraOffsetX = 0;
  scene.cameraOffsetY = 0;
  scene.hudFilterAccumulatorMs = 0;
  scene.simulationAccumulatorMs = 0;
  scene.noCatchUpFrames = STARTUP_STABILIZE_FRAMES;
  scene.weatherEvent = createEmptyWeatherEventState();
  scene.weatherOverlayAlpha = 0;

  scene.lobbyBackdrop = null;
  scene.lobbyCard = null;
  scene.lobbyPlayersPanel = null;
  scene.lobbyTitle = null;
  scene.lobbySubtitle = null;
  scene.playersListText = null;
  scene.lobbyMessage = null;
  scene.startButtonRect = null;
  scene.startButtonLabel = null;
  scene.statusBanner = null;

  scene.nameEntryRoot = null;
  scene.nameInput = null;
  scene.roomCodeInput = null;
  scene.nameSubmitButton = null;
  scene.publicMatchButton = null;
  scene.privateCreateButton = null;
  scene.privateJoinButton = null;
  scene.debugFinishRoot = null;
  scene.debugFinishPlayerSelect = null;
  scene.debugFinishQualityInput = null;
  scene.debugFinishTimeInput = null;
  scene.debugFinishSubmitButton = null;
  scene.debugFinishSubmitAndFinalizeButton = null;
  scene.debugFinishFinalizeButton = null;
  scene.debugFinishStatusText = null;
  scene.weatherOverlay = null;
  scene.weatherEventText = null;
  scene.weatherHintText = null;
  scene.weatherButtons = [];
  scene.nightVisionOverlay = null;
  scene.itemPanel = null;
  scene.stockPanel = null;
  scene.empPulseVisual = null;
  scene.itemInventoryState = createInventoryState([]);
  scene.positiveStockSystem = null;
  scene.shieldEffectSystem = null;
  scene.routeRewardSystem = null;
  scene.empHudSuppressedUntilMs = 0;
  scene.statusBannerVisibleBeforeEmp = false;

  scene.rainEventKey = null;
  scene.sunnyEventKey = null;
  scene.nightEventKey = null;
  scene.clearWeatherEventKey = null;
  scene.trainEventKey = null;
  scene.dropItemKey = null;
  scene.grantOilKey = null;
  scene.grantWallKey = null;
  scene.grantOilNumpadKey = null;
  scene.grantWallNumpadKey = null;
  scene.grantEmpKey = null;
  scene.grantEmpNumpadKey = null;
  scene.grantShieldKey = null;
  scene.grantShieldNumpadKey = null;
  scene.turboKey = null;
  scene.lobbyReturnAtMs = 0;
  scene.lobbyReturnRoot = null;
  scene.lobbyReturnText = null;
  scene.lobbyReturnButton = null;
  scene.leaveRoomRoot = null;
  scene.leaveRoomButton = null;
  scene.roomShareRoot = null;
  scene.roomShareLabel = null;
  scene.roomShareCodeValue = null;
  scene.roomShareHint = null;
  scene.roomShareButton = null;
  scene.autoReconnectLobby = false;

  scene.onVisibilityChange = scene.onVisibilityChange.bind(scene);
  scene.matchResultText = "";
  scene.finishWindowEndsAtMs = 0;
}
