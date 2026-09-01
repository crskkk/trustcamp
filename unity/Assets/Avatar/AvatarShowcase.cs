using UnityEngine;

namespace TrustCamp.Avatar
{
    /// <summary>
    /// Deterministic seed → <see cref="AvatarSpec"/> factory for the in-world
    /// avatar showcase. The LCG below matches the TypeScript generator in
    /// src/modules/avatar/api.ts (and the fixtures in avatar.spec.ts) exactly,
    /// so a given seed produces the same avatar on both sides.
    /// Fixture seeds: 1, 42, 12345, 999999.
    /// </summary>
    public static class AvatarShowcase
    {
        /// <summary>Seeds rendered by the showcase — kept in sync with the TS tests.</summary>
        public static readonly int[] FixtureSeeds = { 1, 42, 12345, 999999 };

        /// <summary>Build the deterministic <see cref="AvatarSpec"/> for a seed.</summary>
        public static AvatarSpec SpecForSeed(int seed)
        {
            return new AvatarSpec
            {
                skinTone = (int)(SeededValue(seed, 0) * 5) % 5,
                hairStyle = (int)(SeededValue(seed, 1) * 5) % 5,
                hairColor = (int)(SeededValue(seed, 2) * 5) % 5,
                eyeColor = (int)(SeededValue(seed, 3) * 5) % 5,
                expression = (int)(SeededValue(seed, 4) * 4) % 4,
                bodyAccent = (int)(SeededValue(seed, 5) * 4) % 4,
                version = 1,
            };
        }

        /// <summary>
        /// LCG (a=1103515245, c=12345, m=2^31) advanced <paramref name="step"/>+1 times,
        /// normalized to [0, 1). Matches the TS implementation bit-for-bit.
        /// </summary>
        public static float SeededValue(int seed, int step)
        {
            const uint a = 1103515245;
            const uint c = 12345;
            const uint m = 2147483648; // 2^31

            uint current = (uint)Mathf.Abs(seed) % m;
            for (int i = 0; i <= step; i++)
            {
                current = (a * current + c) % m;
            }

            return current / (float)m;
        }
    }
}
