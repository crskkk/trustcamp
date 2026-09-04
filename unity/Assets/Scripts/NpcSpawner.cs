using System.Collections.Generic;
using UnityEngine;
using TrustCamp.Avatar;
using TrustCamp.World;

namespace TrustCamp.World
{
    /// <summary>
    /// Opt-in NPC spawner (task 0104). URL param <c>?npcs</c> enables it,
    /// matching the convention <see cref="PlayerSpawner"/> uses for
    /// <c>?player</c>. Spawns one body per <see cref="PendingSeed"/>
    /// configured at build time and runs an idle motion policy until the
    /// shell drives a target via <see cref="NpcController.Step"/>.
    ///
    /// Shell → Unity glue for the live broadcast path (real Supabase channel
    /// → parent window → Unity) lands in task 0105. Today, this spawner
    /// just stands the bodies up; the shell publishes their positions
    /// through <c>bridge.sendState</c> from <c>npc/bridge.ts</c>.
    /// </summary>
    public class NpcSpawner : MonoBehaviour
    {
        [System.Serializable]
        public struct PendingSeed
        {
            public int seed;
            public string role;
        }

        [SerializeField] private List<PendingSeed> pending = new List<PendingSeed>();
        [SerializeField] private bool autoSpawn = false;

        // Static list so the shell (or a build-time script) can push
        // configuration before the scene loads. Read by Boot() on the
        // RuntimeInitializeOnLoadMethod hook.
        public static List<PendingSeed> StaticConfig = new List<PendingSeed>();

        private bool _spawned;

        [RuntimeInitializeOnLoadMethod(RuntimeInitializeLoadType.AfterSceneLoad)]
        private static void Boot()
        {
            string url = Application.absoluteURL ?? string.Empty;
            if (url.IndexOf("npcs", System.StringComparison.OrdinalIgnoreCase) < 0) return;
            var go = new GameObject("NpcSpawner").AddComponent<NpcSpawner>();
            go.pending = new List<PendingSeed>(StaticConfig);
            go.Spawn();
        }

        private void Start()
        {
            if (autoSpawn) Spawn();
        }

        public GameObject Spawn()
        {
            if (_spawned) return null;
            _spawned = true;

            var planet = Object.FindFirstObjectByType<PlanetGenerator>();
            Vector3 center = planet != null ? planet.transform.position : Vector3.zero;
            float radius = planet != null ? planet.Radius : 8f;
            float bodyHeight = 0.9f;

            // Find a "spawn hub" direction — camp biome if available, else +z.
            Vector3 hubDir = planet != null
                ? planet.BiomeDirection(PlanetGenerator.BiomeCamp)
                : Vector3.forward;
            Quaternion hubRot = Quaternion.LookRotation(
                Vector3.ProjectOnPlane(Vector3.forward, hubDir).normalized,
                hubDir);

            GameObject first = null;
            for (int i = 0; i < pending.Count; i++)
            {
                var s = pending[i];
                // Spread the NPCs a few meters apart on the surface so they
                // don't overlap visually. Same locomotion path as players.
                float azimuth = i * 25f;
                Quaternion q = Quaternion.AngleAxis(azimuth, hubDir) * hubRot;
                Vector3 dir = (q * Vector3.forward).normalized;

                var body = GameObject.CreatePrimitive(PrimitiveType.Capsule);
                body.name = $"NPC_Seed{s.seed}";
                body.transform.localScale = new Vector3(0.6f, 0.9f, 0.6f);
                var col = body.GetComponent<Collider>();
                if (col != null) col.enabled = false;

                var pc = body.AddComponent<PlayerController>();
                pc.Configure(center, radius + bodyHeight);
                pc.PlaceOnSurface(dir);

                var npc = body.AddComponent<NpcController>();
                npc.Seed = s.seed;
                npc.Role = string.IsNullOrEmpty(s.role) ? "prospect" : s.role;
                npc.BuildAvatar();

                Debug.Log($"[NpcSpawner] npc seed={s.seed} role={npc.Role} at {body.transform.position}");
                if (first == null) first = body;
            }
            return first;
        }
    }
}
