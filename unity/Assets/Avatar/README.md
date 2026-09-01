# Avatar Module — Procedural Avatar System

## Overview

This module provides a complete procedurally generated avatar system for TrustCamp. Players and NPCs use the same deterministic generator, ensuring identical avatars on both TypeScript (React) and Unity sides.

## Components

### AvatarSpec.cs
- **Purpose:** Data class mirroring the TypeScript avatar specification
- **Fields:** skinTone, hairStyle, hairColor, eyeColor, expression, bodyAccent, version
- **Methods:** `FromJSON(string)`, `ToJSON()`
- **Usage:** Serialization/deserialization of avatar data

### AvatarProceduralBuilder.cs
- **Purpose:** Builds cute low-poly avatars at runtime from AvatarSpec
- **Method:** `BuildAvatar(AvatarSpec spec)`
- **Output:** Hierarchical GameObject with body, head, eyes, hair
- **Colors:** Procedurally determined from AvatarSpec fields
- **Quality:** Simple geometry (spheres, cubes, cylinders) with material color variations

### AvatarShowcase.cs
- **Purpose:** Visual checkpoint displaying 4 fixed-seed avatars
- **Fixture Seeds:** 1, 42, 12345, 999999 (matching TypeScript tests)
- **Layout:** Side-by-side display with labels
- **Usage:** Verify avatar variety and visual appeal

### AvatarShowcaseIntegration.cs
- **Purpose:** Automatically spawns the showcase in any scene
- **Auto-Spawn:** Enabled by default on Start()
- **Toggle:** Press 'H' key to show/hide showcase
- **Methods:** `SpawnShowcase()`, `ShowShowcase()`, `HideShowcase()`, `DestroyShowcase()`

## Setup Instructions

### Option 1: Auto-Spawn (Recommended for Testing)

1. Open the Planet.unity scene
2. Find the Main Camera or WorldManager GameObject
3. Add component → `AvatarShowcaseIntegration`
4. Leave "Auto Spawn On Start" checked
5. Play the scene — avatars will appear 10 units in front of the camera
6. Press 'H' to toggle showcase visibility

### Option 2: Manual Instantiation

```csharp
// In a scene setup script or initialization code:
GameObject avatarDisplay = new GameObject("Avatar_Test");
AvatarProceduralBuilder builder = avatarDisplay.AddComponent<AvatarProceduralBuilder>();

AvatarSpec spec = new AvatarSpec
{
    skinTone = 2,
    hairStyle = 1,
    hairColor = 3,
    eyeColor = 4,
    expression = 0,
    bodyAccent = 1,
    version = 1
};

builder.BuildAvatar(spec);
```

### Option 3: From Seeded Generation

```csharp
// Generate avatar from seed (matches TS deterministic generation)
int seed = 42;
AvatarSpec spec = GenerateFromSeed(seed);

GameObject avatarDisplay = new GameObject("Avatar_" + seed);
AvatarProceduralBuilder builder = avatarDisplay.AddComponent<AvatarProceduralBuilder>();
builder.BuildAvatar(spec);
```

## Visual Design

### Color Palettes

**Skin Tones (5 variants):**
- Light: #FDD9BA
- Medium Light: #F2BF99
- Medium: #D9A680
- Medium Dark: #B38066
- Dark: #804D40

**Hair Colors (5 variants):**
- Brown, Blonde, Black, Red, Purple

**Eye Colors (5 variants):**
- Blue, Green, Brown, Pink, Yellow

**Body Accents (4 variants):**
- Warm Beige, Lime Green, Cool Blue, Pink

**Expressions (4 variants):**
- Happy (warm tint), Neutral, Sad (cool tint), Surprised (bright)

### Geometry

- **Body:** Scaled cube (chibi proportions)
- **Head:** Larger scaled sphere (large head, smaller body = cute)
- **Eyes:** Small spheres with color variation
- **Hair:** Cylinder with scale/position variation by hair style
- **Total Draw Calls:** ≤4 per avatar (body mesh + materials)

## Deterministic Generation

The avatar generator uses a **seeded Linear Congruential Generator (LCG)** for deterministic randomness:

```
seed → PRNG → skinTone (0-4)
            → hairStyle (0-4)
            → hairColor (0-4)
            → eyeColor (0-4)
            → expression (0-3)
            → bodyAccent (0-3)
```

**Same seed always produces the same avatar.**

Example:
```
Seed 1   → skinTone=2, hairStyle=1, hairColor=0, eyeColor=4, expression=1, bodyAccent=2
Seed 42  → skinTone=4, hairStyle=3, hairColor=2, eyeColor=1, expression=0, bodyAccent=3
```

## Testing

Run C# tests to verify JSON round-trip:
```bash
# In Unity Editor: Window → General → Test Runner
# Run EditMode tests: Assets/Tests/EditMode/AvatarScaffoldEditTests.cs
```

Run TypeScript tests:
```bash
pnpm test src/modules/avatar/avatar.spec.ts
```

## Future Improvements

1. **Character Models:** Replace runtime primitives with pre-baked cute humanoid models
2. **Rigging & Animation:** Add skeleton for future character animations
3. **Customization UI:** Let players design their avatar appearance (v0.9)
4. **Performance:** Bake avatars to static meshes for multiplayer rendering
5. **Variety:** Add more geometry variants (ears, tails, accessories)

## References

- **TypeScript API:** `src/modules/avatar/api.ts`
- **Standards:** `STANDARDS.md` §3 (Avatar System)
- **Task Spec:** `.claude/tasks/0008-avatar-foundation.md`
- **Visual Reference:** Toony Tiny People asset pack, indie games with personality
