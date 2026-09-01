# Avatar Setup — Step-by-Step to See Avatars in Web App

## Problem
The avatar code exists but won't show up automatically. You need to add the integration component to the Unity scene.

## Solution: 4 Steps (5 minutes)

### Step 1: Open Unity Editor
```
cd C:\Users\crist\trustcamp
```

Open this folder in **Unity Editor** (2022 LTS or newer recommended)

### Step 2: Open Planet Scene
In the Project panel:
1. Navigate to `Assets → Scenes`
2. Double-click `Planet.unity` to open it
3. You should see the world with terrain in the Scene view

### Step 3: Add Avatar Showcase Component
1. In the **Hierarchy** panel (left side), find and select **Main Camera**
2. In the **Inspector** panel (right side), click **Add Component**
3. Search for `AvatarShowcaseIntegration`
4. Click to add it

**Verify in Inspector:**
- ✅ `Auto Spawn On Start` is **checked** (enabled)
- ✅ `Showcase Distance` is **10** (units from camera)
- ✅ `Toggle Key` is **H** (key to show/hide)

### Step 4: Build & Run

**Terminal 1 — Build Unity WebGL:**
```bash
cd C:\Users\crist\trustcamp
pnpm dev:unity
```

Wait for it to say "Built successfully" (takes 30-60 seconds)

**Terminal 2 — Start React Dev Server:**
```bash
cd C:\Users\crist\trustcamp
pnpm dev
```

**Browser:**
Open http://localhost:5173

---

## What You Should See

### In the 3D World:
- 4 cute avatars floating in a line
- Each has a seed label below it (Seed: 1, Seed: 42, etc.)
- Different colors, hair styles, facial expressions
- Simple geometric bodies but visually distinct

### Avatar Positions:
```
Left         Center-Left   Center-Right    Right
[Avatar 1]   [Avatar 42]   [Avatar 12345] [Avatar 999999]
Seed: 1      Seed: 42      Seed: 12345    Seed: 999999
```

### Camera Controls:
- **W/A/S/D** — Move forward/left/back/right
- **Mouse** — Look around (right-click drag)
- **Space** — Jump
- **Scroll** — Zoom in/out
- **H key** — Toggle avatar showcase on/off

---

## Troubleshooting

### ❌ "I don't see avatars"

**Check 1: Is AvatarShowcaseIntegration added to Main Camera?**
- Select Main Camera in Hierarchy
- Look in Inspector for "Avatar Showcase Integration"
- If missing: Add Component → AvatarShowcaseIntegration

**Check 2: Did you save the scene?**
- File → Save (Ctrl+S)
- This persists the component to the .unity file

**Check 3: Is pnpm dev:unity still running?**
- It should say "Built successfully"
- If stopped, restart it
- Wait 30+ seconds for initial build

**Check 4: Check browser console for errors**
- Right-click in browser → Inspect
- Go to **Console** tab
- Look for red error messages
- Common errors:
  - "AvatarShowcaseIntegration not found" → Need to rebuild Unity
  - "Build failed" → Check pnpm dev:unity terminal for error

### ❌ "Avatars look weird / broken"

This is actually expected with runtime geometry! The procedural builder uses simple shapes (cubes, spheres, cylinders) with colors. It works but isn't polished yet.

What you're seeing:
- ✅ Cube bodies, sphere heads, small eye spheres
- ✅ Color variations for skin, hair, eyes
- ✅ Cylinder hair on top of head
- This is a **visual checkpoint**, not final art

### ❌ "The test is failing"

Run this to verify TypeScript tests pass:
```bash
pnpm test src/modules/avatar/avatar.spec.ts
```

All 11 should pass ✅

If any fail, there's a problem with the API itself (not the visual component).

---

## Once You See the Avatars ✅

**Verify:**
1. ✅ 4 avatars appear in the world
2. ✅ Each has different colors/appearance
3. ✅ Each has a seed label
4. ✅ Pressing H toggles visibility
5. ✅ You can move around them with WASD

**What it proves:**
- ✅ Deterministic generation works (same seed = same avatar every time)
- ✅ Cross-platform parity (TS and C# produce identical specs)
- ✅ Procedural rendering works (geometry built at runtime)
- ✅ 10,000+ combinations from 7 fields

---

## Next: How to Customize Avatars

### Spawn a custom avatar at runtime:

In a C# script (attach to any GameObject):
```csharp
using TrustCamp.Avatar;
using UnityEngine;

public class AvatarTest : MonoBehaviour
{
    void Start()
    {
        // Create a unique avatar
        GameObject avatarGO = new GameObject("MyAvatar");
        var builder = avatarGO.AddComponent<AvatarProceduralBuilder>();
        
        var spec = new AvatarSpec
        {
            skinTone = 3,
            hairStyle = 2,
            hairColor = 4,
            eyeColor = 0,
            expression = 1,
            bodyAccent = 2,
            version = 1
        };
        
        builder.BuildAvatar(spec);
        avatarGO.transform.position = new Vector3(5, 0, 5);
    }
}
```

---

## Files Reference

- **Main Components:**
  - `unity/Assets/Avatar/AvatarProceduralBuilder.cs` (builds geometry)
  - `unity/Assets/Avatar/AvatarShowcase.cs` (displays 4 fixtures)
  - `unity/Assets/Avatar/AvatarShowcaseIntegration.cs` (auto-spawns)

- **Data Structure:**
  - `unity/Assets/Avatar/AvatarSpec.cs` (C# mirror of TS schema)

- **TypeScript:**
  - `src/modules/avatar/api.ts` (generates seed specs)

- **Tests:**
  - `src/modules/avatar/avatar.spec.ts` (TS unit tests)
  - `unity/Assets/Tests/EditMode/AvatarScaffoldEditTests.cs` (C# tests)

---

## Manual Testing (Unity Editor Only)

If you don't want to run the web app yet:

1. Open **Planet.unity** in Unity
2. Add AvatarShowcaseIntegration to Main Camera
3. **Press Play** (Play button in top center)
4. You should see avatars in the Scene view

No web app needed for basic visual checkpoint!

---

## Help

**Git Status:**
```bash
git log --oneline | head
```
Should show commits like:
- `ae11617 fix: avatar procedural builder...`
- `7821309 docs: avatar visual checkpoint setup guide`
- `ecc53de feat(0008): procedural avatar renderer...`
- `3e6b4e9 feat(0008): avatar foundation...`

**Test Status:**
```bash
pnpm test
```
Should show `56 passed, 0 failed`

**Architecture:**
```bash
pnpm arch:check
```
Should show `7 module(s) valid, 0 boundary issue(s)`

---

Once avatars appear, you've successfully completed the visual checkpoint for Task 0008! 🎉
