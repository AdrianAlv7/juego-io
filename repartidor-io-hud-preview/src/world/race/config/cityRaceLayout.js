export const CITY_RACE_LAYOUT = {
  spawnPoint: { x: 600, y: 5200 },
  orders: [
    {
      pickup: { x: 500, y: 800, label: "R1", color: 0xffbf69 },
      dropoff: { x: 5500, y: 5200, label: "E1", color: 0x8fd694 },
    },
    {
      pickup: { x: 3000, y: 3000, label: "R2", color: 0xffbf69 },
      dropoff: { x: 4500, y: 1500, label: "E2", color: 0x8fd694 },
    },
    {
      pickup: { x: 5500, y: 800, label: "R3", color: 0xffbf69 },
      dropoff: { x: 2000, y: 4000, label: "E3", color: 0x8fd694 },
    },
  ],
  routeSets: [
    [
      { x: 500, y: 5200 },
      { x: 500, y: 800 },
      { x: 3000, y: 500 },
      { x: 5500, y: 800 },
      { x: 5500, y: 3000 },
      { x: 5500, y: 5200 },
      { x: 3000, y: 5500 },
      { x: 500, y: 5200 },
    ],
    [
      { x: 2000, y: 2000 },
      { x: 4000, y: 2000 },
      { x: 4000, y: 4000 },
      { x: 2000, y: 4000 },
      { x: 2000, y: 2000 },
    ],
    [
      { x: 3000, y: 500 },
      { x: 3000, y: 2000 },
      { x: 2800, y: 3000 },
      { x: 3000, y: 4000 },
      { x: 3000, y: 5500 },
    ],
    [
      { x: 500, y: 3000 },
      { x: 2000, y: 3000 },
      { x: 4000, y: 3000 },
      { x: 5500, y: 3000 },
    ],
    [
      { x: 4000, y: 2000 },
      { x: 4500, y: 1500 },
      { x: 5000, y: 2000 },
      { x: 4500, y: 2500 },
      { x: 4000, y: 2000 },
    ],
  ],
};

export const CITY_RACE_TUNING = {
  roadHalfWidth: 190,
  collisionHalfWidth: 205,
  repositionHalfWidth: 165,
  pickupRadius: 220,
  dropoffRadius: 180,
  returnRadius: 190,
  serviceTimeMs: 1000,
  preStartMs: 3000,
  goVisibleMs: 900,
  roadGeometrySamples: 96,
  roadDrawSamples: 170,
  roadGridCellSize: 500,
  roadGridRadius: 2,
  defaultEventDurationMs: 2000,
  maxHealth: 100,
  minImpactForDamage: 0.9,
  collisionDamageFactor: 0.14,
  collisionDamageCooldownMs: 180,
  // Ajusta aqui la vida de la moto para pruebas de balance.
  motoMaxHealth: 210,
  motoMinImpactForDamage: 0.75,
  motoCollisionDamageFactor: 0.09,
  // Ajusta aqui la duracion de reparacion cuando la moto queda en 0.
  motoRepairDurationMs: 1800,
};
