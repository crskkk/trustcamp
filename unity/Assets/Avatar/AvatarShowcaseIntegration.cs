using UnityEngine;
using TrustCamp.World;

namespace TrustCamp.Avatar
{
    /// <summary>
    /// Spawns the fixed-seed avatar showcase into the running scene. The avatars
    /// stand on the planet surface near the Camp biome, oriented to the surface
    /// normal (like the trees), so the auto-orbiting camera pans past them.
    /// Toggle with <see cref="toggleKey"/> (H).
    /// </summary>
    public class AvatarShowcaseIntegration : MonoBehaviour
    {
        [Header("Placement (tunable in the Editor — no rebuild needed)")]
        [SerializeField, Tooltip("Uniform scale applied to each avatar.")]
        private float surfaceScale = 2f;

        [SerializeField, Tooltip("Longitude step between adjacent avatars, in degrees.")]
        private float arcDegrees = 14f;

        [SerializeField, Tooltip("Height above the surface for the avatar pivot, so the body sits on the ground.")]
        private float feetOffset = 0.8f;

        [Header("Behaviour")]
        [SerializeField]
        private bool autoSpawnOnStart = true;

        [SerializeField]
        private KeyCode toggleKey = KeyCode.H;

        private GameObject showcasePanel;
        private bool showcaseActive = false;

        private void Start()
        {
            if (autoSpawnOnStart)
            {
                SpawnShowcase();
                showcaseActive = true;
            }
        }

        private void Update()
        {
            if (Input.GetKeyDown(toggleKey))
            {
                if (showcaseActive)
                {
                    HideShowcase();
                }
                else
                {
                    ShowShowcase();
                }
            }
        }

        public void SpawnShowcase()
        {
            if (showcasePanel != null)
            {
                return; // Already spawned
            }

            var planet = Object.FindFirstObjectByType<PlanetGenerator>();

            showcasePanel = new GameObject("AvatarShowcasePanel");
            showcasePanel.transform.SetParent(planet != null ? planet.transform : null, false);

            Vector3 campDir = planet != null
                ? planet.BiomeDirection(PlanetGenerator.BiomeCamp)
                : new Vector3(0f, 0f, 1f);

            int[] seeds = AvatarShowcase.FixtureSeeds;
            for (int i = 0; i < seeds.Length; i++)
            {
                // Fan the group out east–west along the surface, centred on the camp.
                float lon = (i - (seeds.Length - 1) * 0.5f) * arcDegrees;
                Vector3 dir = (Quaternion.AngleAxis(lon, Vector3.up) * campDir).normalized;

                var go = new GameObject($"Avatar_Seed{seeds[i]}");
                go.transform.SetParent(showcasePanel.transform, false);
                go.transform.localScale = Vector3.one * surfaceScale;

                go.AddComponent<AvatarProceduralBuilder>().BuildAvatar(AvatarShowcase.SpecForSeed(seeds[i]));

                if (planet != null)
                {
                    planet.PlaceOnSurface(go, dir, feetOffset);
                }
                else
                {
                    go.transform.position = dir * (8f + feetOffset);
                    go.transform.up = dir;
                }

                // Keep "up" along the surface normal, face tangent to the sphere.
                Vector3 tangent = Vector3.Cross(dir, Vector3.up);
                if (tangent.sqrMagnitude > 0.0001f)
                {
                    go.transform.rotation = Quaternion.LookRotation(tangent.normalized, dir);
                }

                Debug.Log($"Avatar {seeds[i]} spawned at {go.transform.position}");
            }

            showcaseActive = true;
            Debug.Log($"Avatar Showcase spawned near camp ({seeds.Length} avatars)");
        }

        public void HideShowcase()
        {
            if (showcasePanel != null)
            {
                showcasePanel.SetActive(false);
                showcaseActive = false;
            }
        }

        public void ShowShowcase()
        {
            if (showcasePanel != null)
            {
                showcasePanel.SetActive(true);
                showcaseActive = true;
            }
            else
            {
                SpawnShowcase();
            }
        }

        public void DestroyShowcase()
        {
            if (showcasePanel != null)
            {
                Destroy(showcasePanel);
                showcasePanel = null;
                showcaseActive = false;
            }
        }

        public bool IsShowcaseActive => showcaseActive;

        private void OnDestroy()
        {
            if (showcasePanel != null)
            {
                Destroy(showcasePanel);
            }
        }
    }
}
