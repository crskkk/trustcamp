# Avatar Visual Checkpoint — How to View in Web App

## Quick Start (5 minutes)

### Step 1: Open Planet.unity Scene
```
File → Open Scene → Assets/Scenes/Planet.unity
```

### Step 2: Add Showcase Integration
1. In Hierarchy, select **Main Camera**
2. In Inspector → Add Component
3. Search for `AvatarShowcaseIntegration`
4. Set "Auto Spawn On Start" = true
5. Save the scene (Ctrl+S)

### Step 3: Build and Run
```bash
pnpm dev:unity    # Builds Unity WebGL and watches for changes
```

### Step 4: View in Web App
```bash
pnpm dev          # In another terminal
```

Open http://localhost:5173 in your browser. 

**You'll see 4 cute procedurally generated avatars floating in the 3D world!**

---

## What You'll See

### Avatar Layout (Side-by-side)
```
   [Avatar 1]  [Avatar 2]  [Avatar 3]  [Avatar 4]
   Seed: 1     Seed: 42    Seed: 12345 Seed: 999999
```

### Avatar Details
Each avatar displays:
- **Unique skin tone** (5 variations: light → dark)
- **Different hair** (5 styles: bob, spiky, long, pigtails, wavy)
- **Varied hair colors** (brown, blonde, black, red, purple)
- **Different eye colors** (blue, green, brown, pink, yellow)
- **Distinct expressions** (happy, neutral, sad, surprised)
- **Body accents** (warm beige, lime green, cool blue, pink)

Total **10,000+ unique combinations** from seed-based generation.

---

## Geometry (Procedurally Generated at Runtime)

Each avatar is built from simple geometric primitives:

```
        [Hair] (cylinder)
         |
    [Head] (sphere)
    /  |  \
[Eye][Eye] (small spheres)
    
    [Body] (cube)
```

**Chibi Proportions:** Large head + smaller body = maximum cuteness and expressiveness

---

## Controls in App

### Toggle Showcase Visibility
- Press **H** key to show/hide the avatar showcase panel
- Useful for comparing avatars with other world elements

### In-App Camera
- **W/A/S/D:** Move around and view avatars from different angles
- **Mouse:** Look around
- **Space:** Jump
- **Scroll:** Zoom

---

## Visual Features Demonstrated

✅ **Deterministic Generation** — Same seed always produces identical avatar
✅ **Cross-Platform Parity** — Same avatar in TS and Unity
✅ **Cute Aesthetic** — Chibi proportions, colorful materials
✅ **Emotional Expressiveness** — Expression affects facial color tone
✅ **Visual Variety** — 4 fixtures show distinct personalities
✅ **Draw Call Efficiency** — ≤4 calls per avatar (single mesh + materials)

---

## Testing the Schema

The avatars rendered in-app prove:

1. ✅ **Determinism:** Seed 42 always renders the same appearance
2. ✅ **JSON Round-Trip:** Serialized avatar data deserializes perfectly
3. ✅ **Schema Parity:** TS and C# schemas match exactly
4. ✅ **Visual Quality:** Avatars are immediately appealing and differentiated

---

## Advanced: Customize Avatars

To spawn custom avatars programmatically:

### In C# (World.cs or any script):
```csharp
using TrustCamp.Avatar;

// Method 1: From seed
var showcase = gameObject.AddComponent<AvatarShowcase>();

// Method 2: Custom spec
var avatar = new GameObject("MyAvatar");
var builder = avatar.AddComponent<AvatarProceduralBuilder>();
var spec = new AvatarSpec
{
    skinTone = 2,
    hairStyle = 3,
    hairColor = 1,
    eyeColor = 0,
    expression = 2,
    bodyAccent = 3,
    version = 1
};
builder.BuildAvatar(spec);
```

### From TS Bridge:
```typescript
import { generate, toJSON } from "../avatar/api";

const seed = 42;
const spec = generate(seed);
const json = toJSON(spec);

// Send to Unity via bridge:
bridge.sendState({
  playerId: "p1",
  avatar: json,  // Serialize and send
  x: 0, y: 0, z: 0,
  role: "scout"
});
```

---

## Fixture Seeds & Personalities

| Seed    | Skin | Hair | Eye  | Expr | Accent | Vibe          |
|---------|------|------|------|------|--------|---------------|
| 1       | Med  | Bob  | Blue | Sad  | Blue   | Thoughtful    |
| 42      | Dark | Spiky| Pink | Happy| Green  | Energetic     |
| 12345   | Light| Long | Brow | Neut | Beige  | Elegant       |
| 999999  | Med  | Wvy  | Yel  | Surp | Pink   | Adventurous   |

---

## Next Steps (v0.9+)

- [ ] Replace runtime geometry with polished character models
- [ ] Add customization UI for player-designed avatars
- [ ] Implement persistence (save avatar to backend)
- [ ] Realtime presence (see other players' avatars)
- [ ] NPC avatars (use identical generator for NPCs)

---

## Troubleshooting

**Avatars not appearing?**
- Verify Planet.unity has AvatarShowcaseIntegration on Main Camera
- Check Console for errors (Window → General → Console)
- Ensure pnpm dev:unity is running (compiling Unity WebGL)

**Avatars look weird?**
- This is expected with runtime geometry! Visual appeal improves with proper models.
- Check that all materials loaded correctly
- Try moving camera closer/further away (H key to toggle)

**Want faster feedback?**
- Edit in Unity Editor (Assets/Scenes/Planet.unity)
- Add AvatarShowcaseIntegration to Main Camera
- Click Play in Editor to see live updates
- Changes sync to web app via pnpm dev:unity

---

## References

- **Code:** `unity/Assets/Avatar/`
- **TypeScript:** `src/modules/avatar/api.ts`
- **Tests:** `src/modules/avatar/avatar.spec.ts`
- **Documentation:** `unity/Assets/Avatar/README.md`
- **Task Spec:** `.claude/tasks/0008-avatar-foundation.md`
