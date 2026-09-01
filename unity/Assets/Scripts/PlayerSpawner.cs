using UnityEngine;

namespace TrustCamp.World
{
    /// <summary>
    /// Opt-in: drops a walkable player + chase camera onto the planet and parks
    /// the idle OrbitCamera while the player is active. OFF by default, so `/`
    /// and `/screensaver` are unchanged. Enable by loading the Unity build with
    /// "player" in the URL (e.g. `…/index.html?player`) or by setting
    /// <see cref="autoSpawn"/> in the scene. Task 0101.
    /// </summary>
    public class PlayerSpawner : MonoBehaviour
    {
        [SerializeField] private bool autoSpawn = false;

        private bool _spawned;

        [RuntimeInitializeOnLoadMethod(RuntimeInitializeLoadType.AfterSceneLoad)]
        private static void Boot()
        {
            string url = Application.absoluteURL ?? string.Empty;
            if (url.IndexOf("player", System.StringComparison.OrdinalIgnoreCase) < 0) return;
            var go = new GameObject("PlayerSpawner").AddComponent<PlayerSpawner>();
            var player = go.Spawn();
            // URL-triggered spawn: run the short demo walk for the visual checkpoint.
            if (player != null) player.AddComponent<PlayerDemoWalk>();
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
            Vector3 startDir = planet != null
                ? planet.BiomeDirection(PlanetGenerator.BiomeCamp)
                : Vector3.forward;

            var body = GameObject.CreatePrimitive(PrimitiveType.Capsule);
            body.name = "Player";
            body.transform.localScale = new Vector3(0.6f, 0.9f, 0.6f);
            var col = body.GetComponent<Collider>();
            if (col != null) col.enabled = false;
            var mr = body.GetComponent<MeshRenderer>();
            if (mr != null)
            {
                mr.sharedMaterial = new Material(Shader.Find("Unlit/Color"))
                {
                    color = new Color(0.95f, 0.85f, 0.35f),
                };
            }

            var pc = body.AddComponent<PlayerController>();
            // Body half-height (0.9 scale on a 2-unit capsule → ~0.9) sits above the surface.
            pc.Configure(center, radius + 0.9f);
            pc.PlaceOnSurface(startDir);

            // The scene's camera GameObject may not carry the MainCamera tag, so
            // find it by its OrbitCamera component rather than Camera.main.
            var orbit = Object.FindFirstObjectByType<OrbitCamera>();
            var cam = orbit != null ? orbit.GetComponent<Camera>() : Object.FindFirstObjectByType<Camera>();
            if (cam != null)
            {
                if (orbit != null) orbit.enabled = false;
                var follow = cam.GetComponent<PlayerCamera>();
                if (follow == null) follow = cam.gameObject.AddComponent<PlayerCamera>();
                follow.SetTarget(body.transform);
            }

            Debug.Log($"[PlayerSpawner] player spawned at {body.transform.position}");
            return body;
        }
    }
}
