using System;

namespace TrustCamp.Scorebus
{
    /// <summary>
    /// Unity mirror of the TypeScript RoundEnvelope (src/modules/scorebus/api.ts).
    /// One minigame round's scoring summary. All ids are opaque — never PII.
    /// Task 0010 — skeleton.
    /// </summary>
    [Serializable]
    public class RoundEnvelope
    {
        public const int Version = 1;

        public int version = Version;
        public string roundId;
        public string sessionId;
        public string minigame;
        public string playerId;
        public string role;
        public int points;
        public int maxPoints;
        public long startedAt;
        public long endedAt;

        public static RoundEnvelope FromJSON(string json)
        {
            return UnityEngine.JsonUtility.FromJson<RoundEnvelope>(json);
        }

        public string ToJSON()
        {
            return UnityEngine.JsonUtility.ToJson(this);
        }

        public override string ToString()
        {
            return $"RoundEnvelope(round={roundId}, game={minigame}, {points}/{maxPoints}, role={role})";
        }
    }
}
