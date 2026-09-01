using UnityEngine;

namespace TrustCamp.Avatar
{
    /// <summary>
    /// Avatar specification: deterministic, fully procedural character definition.
    /// Mirrors the TypeScript AvatarSpec from src/modules/avatar/api.ts.
    /// Same seed produces bit-identical avatars on both TS and Unity sides.
    /// </summary>
    [System.Serializable]
    public class AvatarSpec
    {
        public int skinTone;      // 0-4: 5 skin color variants
        public int hairStyle;     // 0-4: 5 hair geometry variants
        public int hairColor;     // 0-4: 5 hair color variants
        public int eyeColor;      // 0-4: 5 eye color variants
        public int expression;    // 0-3: 4 expressions (happy, neutral, sad, surprised)
        public int bodyAccent;    // 0-3: 4 body/outfit accent colors
        public int version = 1;   // Schema version for forward compatibility

        /// <summary>Deserialize from JSON string (mirrors TS fromJSON).</summary>
        public static AvatarSpec FromJSON(string json)
        {
            return JsonUtility.FromJson<AvatarSpec>(json);
        }

        /// <summary>Serialize to JSON string (mirrors TS toJSON).</summary>
        public string ToJSON()
        {
            return JsonUtility.ToJson(this);
        }

        public override string ToString()
        {
            return $"AvatarSpec(skin={skinTone}, hair={hairStyle}/{hairColor}, eyes={eyeColor}, expr={expression}, accent={bodyAccent})";
        }
    }
}
