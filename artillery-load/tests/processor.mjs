const MOTO_IDS = ["bmw", "ducati", "honda", "kawa", "yamaha", "suzuki"];

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function pickMoto(seed) {
  return MOTO_IDS[seed % MOTO_IDS.length];
}

export async function setIdentity(context, events) {
  const vuId = Number(context.vars.$uuid?.slice(-6).replace(/[^0-9a-f]/gi, ""), 16) || 1;
  const seed = vuId % 100000;

  context.vars.playerSeed = seed;
  context.vars.playerName = `artillery-${seed}`;
  context.vars.motoId = pickMoto(seed);
  context.vars.step = 0;
  context.vars.baseX = 600 + (seed % 6) * 18;
  context.vars.baseY = 5200 - (seed % 5) * 30;
  context.vars.speedFactor = 10 + (seed % 6);

  events.emit("counter", "deliver.identity.created", 1);
}

export async function markLobbyReady(context, events) {
  events.emit("counter", "deliver.lobby.ready.sent", 1);
}

export async function markGameplayStart(context, events) {
  context.vars.step = 0;
  events.emit("counter", "deliver.gameplay.started", 1);
}

export async function setMovementTick(context, events) {
  const seed = Number(context.vars.playerSeed || 1);
  const step = Number(context.vars.step || 0) + 1;
  const baseX = Number(context.vars.baseX || 600);
  const baseY = Number(context.vars.baseY || 5200);
  const speedFactor = Number(context.vars.speedFactor || 10);

  const x = baseX + ((step * (6 + speedFactor)) % 780);
  const y = baseY - ((step * (18 + speedFactor)) % 2100);
  const angle = ((step % 36) / 36) * 6.2832;
  const objectiveIndex = Math.min(3, Math.floor(step / 50));
  const deliveredCount = Math.min(4, Math.floor(step / 45));
  const qualityPercent = clamp(100 - Math.floor(step / 14) - (seed % 5), 72, 100);
  const motoHealthPercent = clamp(100 - Math.floor(step / 18) - (seed % 7), 68, 100);
  const packageHealthPercent = clamp(100 - Math.floor(step / 20) - (seed % 4), 70, 100);
  const serviceProgress = clamp((step % 45) / 45, 0, 1);
  const speedPxPerSec = 140 + ((step * 9 + seed) % 110);
  const heatPercent = clamp(((step * 3) % 100) / 100, 0, 1);

  context.vars.step = step;
  context.vars.posX = x.toFixed(2);
  context.vars.posY = y.toFixed(2);
  context.vars.angle = angle.toFixed(4);
  context.vars.objectiveIndex = objectiveIndex;
  context.vars.totalObjectives = 4;
  context.vars.serviceProgress = serviceProgress.toFixed(3);
  context.vars.distanceToObjectivePx = Math.max(40, 1200 - step * 8);
  context.vars.progressValue = step * 50000;
  context.vars.liveQualityPercent = qualityPercent;
  context.vars.speedPxPerSec = speedPxPerSec;
  context.vars.maxSpeedPxPerSec = 260;
  context.vars.currentOrder = Math.min(4, objectiveIndex + 1);
  context.vars.totalOrders = 4;
  context.vars.packageHealthPercent = packageHealthPercent;
  context.vars.qualityPercent = qualityPercent;
  context.vars.deliveredCount = deliveredCount;
  context.vars.elapsedMs = step * 50;
  context.vars.countdownLabel = "";
  context.vars.motoHealthPercent = motoHealthPercent;
  context.vars.repairRemainingMs = 0;
  context.vars.heatPercent = heatPercent.toFixed(2);
  context.vars.turboCharges = Math.max(0, 3 - Math.floor(step / 70));
  context.vars.turboMaxCharges = 3;

  if (step % 40 === 0) {
    events.emit("counter", "deliver.position.tick.40", 1);
  }
}

export async function setFinishPayload(context, events) {
  const step = Number(context.vars.step || 0);
  const seed = Number(context.vars.playerSeed || 1);

  context.vars.finishElapsedMs = 18000 + step * 50 + (seed % 1200);
  context.vars.finishQualityPercent = clamp(
    Number(context.vars.qualityPercent || 90) - (seed % 4),
    70,
    100
  );

  events.emit("counter", "deliver.finish.sent", 1);
}

export async function markScenarioComplete(context, events) {
  events.emit("counter", "deliver.scenario.completed", 1);
}
