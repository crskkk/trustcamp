namespace TrustCamp.Scorebus
{
    /// <summary>
    /// The one public door to the Scorebus module on the Unity side (AGENTS §2).
    /// Mirrors validateEnvelope() from src/modules/scorebus/api.ts so a round
    /// built in the player and one built in the shell agree on what is valid.
    /// Task 0010 — skeleton.
    /// </summary>
    public static class ScorebusApi
    {
        public static RoundEnvelope FromJSON(string json) => RoundEnvelope.FromJSON(json);

        public static string ToJSON(RoundEnvelope envelope) => envelope.ToJSON();

        /// <summary>True when <paramref name="e"/> is a well-formed envelope.
        /// On failure, <paramref name="error"/> holds the first reason.</summary>
        public static bool IsValid(RoundEnvelope e, out string error)
        {
            error = null;
            if (e == null) { error = "envelope is null"; return false; }
            if (e.version != RoundEnvelope.Version) { error = "wrong version"; return false; }
            if (IsBlank(e.roundId)) { error = "roundId is blank"; return false; }
            if (IsBlank(e.sessionId)) { error = "sessionId is blank"; return false; }
            if (IsBlank(e.minigame)) { error = "minigame is blank"; return false; }
            if (IsBlank(e.playerId)) { error = "playerId is blank"; return false; }
            if (IsBlank(e.role)) { error = "role is blank"; return false; }
            if (e.maxPoints <= 0) { error = "maxPoints must be > 0"; return false; }
            if (e.points < 0) { error = "points must be >= 0"; return false; }
            if (e.points > e.maxPoints) { error = "points exceed maxPoints"; return false; }
            if (e.startedAt <= 0) { error = "startedAt must be > 0"; return false; }
            if (e.endedAt <= 0) { error = "endedAt must be > 0"; return false; }
            if (e.endedAt < e.startedAt) { error = "endedAt is before startedAt"; return false; }
            return true;
        }

        private static bool IsBlank(string s) => string.IsNullOrWhiteSpace(s);
    }
}
