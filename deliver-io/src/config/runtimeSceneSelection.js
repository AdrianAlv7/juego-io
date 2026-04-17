const FAKE_DEPTH_SCENE_ID = "fake-depth";

export function getRequestedSceneId() {
  if (typeof window === "undefined") return "";

  const params = new URLSearchParams(window.location.search);
  return String(params.get("scene") || "").trim().toLowerCase();
}

export function isFakeDepthPreviewEnabled() {
  return getRequestedSceneId() === FAKE_DEPTH_SCENE_ID;
}

export { FAKE_DEPTH_SCENE_ID };
