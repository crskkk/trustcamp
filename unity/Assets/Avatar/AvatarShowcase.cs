using UnityEngine;

namespace TrustCamp.Avatar
{
    /// <summary>
    /// Visual checkpoint: renders 4 fixed-seed avatars side-by-side.
    /// Demonstrates avatar variety and visual appeal.
    /// Fixture seeds: 1, 42, 12345, 999999 (matching TS tests).
    /// </summary>
    public class AvatarShowcase : MonoBehaviour
    {
        [SerializeField]
        private float spacing = 2f;

        private AvatarProceduralBuilder[] builders = new AvatarProceduralBuilder[4];
        private readonly int[] fixtureSeeds = { 1, 42, 12345, 999999 };

        private void Start()
        {
            CreateShowcase();
        }

        private void CreateShowcase()
        {
            // Create 4 avatar displays
            for (int i = 0; i < 4; i++)
            {
                GameObject avatarDisplay = new GameObject($"Avatar_Seed{fixtureSeeds[i]}");
                avatarDisplay.transform.SetParent(transform);

                // Position side-by-side
                float xPos = (i - 1.5f) * spacing;
                avatarDisplay.transform.localPosition = new Vector3(xPos, 0, 0);

                // Add procedural builder
                AvatarProceduralBuilder builder =
                    avatarDisplay.AddComponent<AvatarProceduralBuilder>();
                builders[i] = builder;

                // Generate avatar from seed
                AvatarSpec spec = GenerateAvatarFromSeed(fixtureSeeds[i]);
                builder.BuildAvatar(spec);

                // Add label (Canvas + Text for UI)
                AddLabel(avatarDisplay, $"Seed: {fixtureSeeds[i]}");
            }
        }

        private AvatarSpec GenerateAvatarFromSeed(int seed)
        {
            // Replicate the TS seeded PRNG deterministic generation
            return new AvatarSpec
            {
                skinTone = (int)(SimpleSeededRNG(seed, 0) * 5) % 5,
                hairStyle = (int)(SimpleSeededRNG(seed, 1) * 5) % 5,
                hairColor = (int)(SimpleSeededRNG(seed, 2) * 5) % 5,
                eyeColor = (int)(SimpleSeededRNG(seed, 3) * 5) % 5,
                expression = (int)(SimpleSeededRNG(seed, 4) * 4) % 4,
                bodyAccent = (int)(SimpleSeededRNG(seed, 5) * 4) % 4,
                version = 1,
            };
        }

        private float SimpleSeededRNG(int seed, int step)
        {
            // LCG (Linear Congruential Generator) matching TS implementation exactly
            const uint a = 1103515245;
            const uint c = 12345;
            const uint m = 2147483648; // 2^31

            uint current = (uint)Mathf.Abs(seed) % m;

            // Advance RNG state `step` times to get the nth random value
            for (int i = 0; i <= step; i++)
            {
                current = (a * current + c) % m;
            }

            // Return normalized value [0, 1)
            return current / (float)m;
        }

        private void AddLabel(GameObject avatarDisplay, string text)
        {
            // Create a simple text mesh above each avatar
            GameObject textObj = new GameObject("Label");
            textObj.transform.SetParent(avatarDisplay.transform);
            textObj.transform.localPosition = new Vector3(0, 1.2f, 0);

            TextMesh textMesh = textObj.AddComponent<TextMesh>();
            textMesh.text = text;
            textMesh.fontSize = 20;
            textMesh.alignment = TextAlignment.Center;
            textMesh.anchor = TextAnchor.MiddleCenter;
            textMesh.color = Color.white;

            // Optional: add a renderer for the text
            MeshRenderer renderer = textObj.GetComponent<MeshRenderer>();
            if (renderer != null)
            {
                Material textMat = new Material(Shader.Find("GUI/Text Shader"));
                renderer.material = textMat;
            }
        }
    }
}
