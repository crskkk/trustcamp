// src/modules/world3d/internal/palette.ts — the "Animal Crossing" palette:
// saturated-but-soft, warm sun, no pure black or white.
export const PALETTE = {
  grass: 0x7fc65a,
  grassLight: 0x9bd671,
  grassDark: 0x62ad47,
  meadow: 0x9fd46a,
  dirt: 0xb48a5c,
  dirtLight: 0xc9a273,
  campGround: 0xbccc78,
  sand: 0xe8d59a,
  lakebed: 0x5f8f86,
  rock: 0xb0a37e,
  rockDark: 0x8a7a5c,
  snow: 0xf4f6fa,
  trunk: 0x8a5a3c,
  canopy: [0x5fb64d, 0x74c65a, 0x4ea546, 0x8ccf5e],
  pine: [0x3f8f4f, 0x4a9c58, 0x357f45],
  bush: 0x6cbf58,
  flower: [0xff8fb1, 0xffe27a, 0xfff5e6, 0xc7a5ff, 0xff9f6b],
  mushroomCap: 0xe0523f,
  mushroomStem: 0xf3e6c8,
  wood: 0xb97f4c,
  woodDark: 0x8c5a33,
  roof: 0xc75b4a,
  roofGreen: 0x5f9a63,
  tent: [0xff9b54, 0x5ec7c1, 0xffd45f, 0xb58cf5],
  lantern: 0xffd27a,
  fire: [0xfff2a8, 0xffa63d, 0xff5a2a],
  water: 0x6fd3e6,
  waterDeep: 0x3a9ccb,
  skyZenith: 0x5fb4ea,
  skyHorizon: 0xd8f0ff,
  fog: 0xcfe9ff,
  sun: 0xfff1cf,
  cloud: 0xffffff,
} as const;

export const SKIN = [0xffe0c4, 0xf3c39d, 0xd99f76, 0xb27651, 0x7d4a30];
export const HAIR = [0x6b4a2e, 0xf2c94c, 0x4a3628, 0xc94a3b, 0x8c5cd6]; // no near-black: silhouettes stay readable
export const EYES = [0x3a67c7, 0x3aa35a, 0x7a4b2a, 0xd44a8a, 0xd6a02a];
export const OUTFIT = [0xf7b267, 0x9bd66b, 0x6fb4ff, 0xff8fb1];
export const OUTFIT_BOTTOM = [0x4f6d8f, 0x6b5b95, 0x3f7f6f, 0x8f5f3f];
export const SHOE = 0x7a5a48;
