using System.Collections.Generic;
using UnityEngine;

namespace TrustCamp.World
{
    /// <summary>
    /// Procedurally builds a spherical mini-planet: an icosphere displaced by
    /// value-noise (mountains/valleys) with vertex colors assigned by biome
    /// region. Creates four named biome child GameObjects (Forest, Lake, Camp,
    /// Mountains) as roots for biome-specific visuals.
    /// Task 0003 — spherical planet scaffold with biomes.
    /// </summary>
    public class PlanetGenerator : MonoBehaviour
    {
        [SerializeField] private int subdivisions = 3;
        [SerializeField] private float radius = 8f;
        [SerializeField] private float mountainHeight = 2.5f;

        // Biome palette (low-poly "business kawaii").
        private static readonly Color ForestColor = new Color(0.20f, 0.55f, 0.28f);
        private static readonly Color LakeColor = new Color(0.18f, 0.42f, 0.78f);
        private static readonly Color CampColor = new Color(0.82f, 0.72f, 0.45f);
        private static readonly Color MountainColor = new Color(0.55f, 0.52f, 0.50f);
        private static readonly Color SnowColor = new Color(0.92f, 0.94f, 0.98f);

        public const string BiomeForest = "Forest";
        public const string BiomeLake = "Lake";
        public const string BiomeCamp = "Camp";
        public const string BiomeMountains = "Mountains";

        private GameObject _forest;
        private GameObject _lake;
        private GameObject _camp;
        private GameObject _mountains;

        /// <summary>Build the planet mesh and biome roots. Safe in Awake (play) or tests.</summary>
        public void Generate()
        {
            EnsureBiomeRoots();
            BuildMesh();
            PopulateForest();
            PopulateLake();
            PopulateCamp();
            PopulateMountains();
        }

        private void Awake()
        {
            // Only self-generate at runtime (builds). Edit-mode tests call Generate() explicitly.
            if (Application.isPlaying) Generate();
        }

        private void EnsureBiomeRoots()
        {
            _forest = FindOrCreate(BiomeForest);
            _lake = FindOrCreate(BiomeLake);
            _camp = FindOrCreate(BiomeCamp);
            _mountains = FindOrCreate(BiomeMountains);
        }

        private GameObject FindOrCreate(string name)
        {
            var t = transform.Find(name);
            if (t != null) return t.gameObject;
            var go = new GameObject(name);
            go.transform.SetParent(transform, false);
            return go;
        }

        // --- Mesh: icosphere -> displaced -> vertex-colored by biome ---
        private void BuildMesh()
        {
            var (verts, tris) = Icosphere.Create(subdivisions, radius);
            Color[] colors = new Color[verts.Count];

            for (int i = 0; i < verts.Count; i++)
            {
                Vector3 dir = verts[i].normalized;
                float h = ValueNoise3D(dir * 1.3f); // 0..1 terrain height field
                float height = Mathf.Pow(h, 1.6f) * mountainHeight;
                verts[i] = dir * (radius + height);

                // Biome by region. Define four regions on the sphere using a simple
                // sector split so all four are visible from most vantages.
                string biome = BiomeAt(dir, height);
                colors[i] = BiomeColor(biome, height);
            }

            var mesh = new Mesh { name = "Planet", indexFormat = UnityEngine.Rendering.IndexFormat.UInt32 };
            mesh.SetVertices(verts);
            mesh.SetTriangles(tris, 0);
            mesh.SetColors(colors);
            mesh.RecalculateNormals();
            // Flat shading: recompute normals per face for a low-poly look.
            mesh.RecalculateBounds();

            // NOTE: use explicit `if (x == null)`, not `??` — Unity's GetComponent
            // returns a fake-null that `??` (C# null check) does not catch.
            var mf = gameObject.GetComponent<MeshFilter>();
            if (mf == null) mf = gameObject.AddComponent<MeshFilter>();
            var mr = gameObject.GetComponent<MeshRenderer>();
            if (mr == null) mr = gameObject.AddComponent<MeshRenderer>();
            mf.sharedMesh = mesh;
            mr.sharedMaterial = VertexColorMaterial;
        }

        /// <summary>Assign a biome to a direction+height. Four regions around the sphere.</summary>
        private string BiomeAt(Vector3 dir, float height)
        {
            // Use the direction's "longitude" (atan2 of x,z) to pick one of 4 sectors.
            float lon = Mathf.Atan2(dir.z, dir.x); // -PI..PI
            float lat = dir.y;                     // -1..1 (north/south)

            // High points anywhere become mountains (so mountains read from any vantage).
            if (height > mountainHeight * 0.55f) return BiomeMountains;

            // Four longitudinal sectors for forest/lake/camp + mountains band.
            // Map lon (-PI..PI) into 0..3.
            float s = (lon + Mathf.PI) / (2f * Mathf.PI) * 4f;
            int sector = Mathf.Clamp(Mathf.FloorToInt(s), 0, 3);

            // Polar caps lean mountainous.
            if (Mathf.Abs(lat) > 0.78f) return BiomeMountains;

            return sector switch
            {
                0 => BiomeForest,
                1 => BiomeCamp,
                2 => BiomeLake,
                _ => BiomeForest,
            };
        }

        private Color BiomeColor(string biome, float height)
        {
            return biome switch
            {
                BiomeForest => ForestColor,
                BiomeLake => LakeColor,
                BiomeCamp => CampColor,
                BiomeMountains => height > mountainHeight * 0.8f ? SnowColor : MountainColor,
                _ => Color.white,
            };
        }

        // --- Biome visuals (minimal primitives; no external assets) ---
        private void PopulateForest()
        {
            ScatterTrees(_forest, BiomeForest, 60, 0.5f, 1.1f);
        }

        private void PopulateLake()
        {
            // A flat translucent blue patch at the lake region's surface.
            var patch = GameObject.CreatePrimitive(PrimitiveType.Quad);
            patch.name = "LakeSurface";
            patch.transform.SetParent(_lake.transform, false);
            patch.transform.localScale = new Vector3(radius * 0.9f, 1f, radius * 0.9f);
            // Position roughly in the lake sector, at the sphere surface.
            patch.transform.position = BiomeCenter(BiomeLake) * (radius * 0.99f);
            patch.transform.up = BiomeCenter(BiomeLake);
            var mat = new Material(Shader.Find("Unlit/Color")) { color = new Color(0.18f, 0.42f, 0.78f, 0.7f) };
            patch.GetComponent<MeshRenderer>().sharedMaterial = mat;
        }

        private void PopulateCamp()
        {
            // A flat tan area + a simple gate + a campfire glow.
            var ground = GameObject.CreatePrimitive(PrimitiveType.Quad);
            ground.name = "CampGround";
            ground.transform.SetParent(_camp.transform, false);
            ground.transform.localScale = new Vector3(radius * 0.6f, 1f, radius * 0.6f);
            ground.transform.position = BiomeCenter(BiomeCamp) * (radius * 1.01f);
            ground.transform.up = BiomeCenter(BiomeCamp);
            ground.GetComponent<MeshRenderer>().sharedMaterial =
                new Material(Shader.Find("Unlit/Color")) { color = CampColor };

            // Gate: two posts + crossbar.
            var gate = new GameObject("CampGate");
            gate.transform.SetParent(_camp.transform, false);
            MakePost(gate, new Vector3(-0.6f, 0, 0));
            MakePost(gate, new Vector3(0.6f, 0, 0));
            var bar = GameObject.CreatePrimitive(PrimitiveType.Cube);
            bar.transform.SetParent(gate.transform, false);
            bar.transform.localScale = new Vector3(1.5f, 0.12f, 0.12f);
            bar.transform.localPosition = new Vector3(0, 1.2f, 0);
            bar.GetComponent<MeshRenderer>().sharedMaterial =
                new Material(Shader.Find("Unlit/Color")) { color = new Color(0.5f, 0.35f, 0.2f) };
            OrientToSurface(gate, BiomeCenter(BiomeCamp), radius + 0.2f);

            // Campfire: a small emissive capsule + point light.
            var fire = GameObject.CreatePrimitive(PrimitiveType.Capsule);
            fire.name = "Campfire";
            fire.transform.SetParent(_camp.transform, false);
            fire.transform.localScale = Vector3.one * 0.3f;
            fire.GetComponent<MeshRenderer>().sharedMaterial =
                new Material(Shader.Find("Unlit/Color")) { color = new Color(1f, 0.55f, 0.1f) };
            OrientToSurface(fire, BiomeCenter(BiomeCamp) + new Vector3(0.15f, 0, 0), radius + 0.25f);
            var light = new GameObject("FireLight");
            light.transform.SetParent(_camp.transform, false);
            light.transform.position = fire.transform.position + fire.transform.up * 0.4f;
            light.AddComponent<Light>().color = new Color(1f, 0.6f, 0.2f);
        }

        private void PopulateMountains()
        {
            // No extra geometry — terrain displacement already reads as mountains.
            // A small marker so the biome root isn't empty.
            var marker = new GameObject("MountainPeakMarker");
            marker.transform.SetParent(_mountains.transform, false);
            marker.transform.position = BiomeCenter(BiomeMountains) * (radius + mountainHeight);
        }

        private void ScatterTrees(GameObject root, string biome, int count, float minScale, float maxScale)
        {
            Vector3 center = BiomeCenter(biome);
            for (int i = 0; i < count; i++)
            {
                Vector3 dir = RandomOnCone(center, 35f);
                var tree = new GameObject("Tree_" + i);
                tree.transform.SetParent(root.transform, false);

                var trunk = GameObject.CreatePrimitive(PrimitiveType.Cube);
                trunk.transform.SetParent(tree.transform, false);
                trunk.transform.localScale = new Vector3(0.1f, 0.5f, 0.1f);
                trunk.transform.localPosition = new Vector3(0, 0.25f, 0);
                trunk.GetComponent<MeshRenderer>().sharedMaterial =
                    new Material(Shader.Find("Unlit/Color")) { color = new Color(0.4f, 0.27f, 0.15f) };

                var leaves = GameObject.CreatePrimitive(PrimitiveType.Capsule);
                leaves.transform.SetParent(tree.transform, false);
                leaves.transform.localScale = new Vector3(0.5f, 0.6f, 0.5f);
                leaves.transform.localPosition = new Vector3(0, 0.7f, 0);
                leaves.GetComponent<MeshRenderer>().sharedMaterial =
                    new Material(Shader.Find("Unlit/Color")) { color = ForestColor * 1.1f };

                float s = Random.Range(minScale, maxScale);
                tree.transform.localScale = Vector3.one * s;
                OrientToSurface(tree, dir, radius + 0.1f);
            }
        }

        private void OrientToSurface(GameObject go, Vector3 dir, float dist)
        {
            go.transform.position = dir * dist;
            go.transform.up = dir;
        }

        private void MakePost(GameObject parent, Vector3 localOffset)
        {
            var post = GameObject.CreatePrimitive(PrimitiveType.Cube);
            post.name = "GatePost";
            post.transform.SetParent(parent.transform, false);
            post.transform.localScale = new Vector3(0.12f, 1.2f, 0.12f);
            post.transform.localPosition = localOffset + new Vector3(0, 0.6f, 0);
            post.GetComponent<MeshRenderer>().sharedMaterial =
                new Material(Shader.Find("Unlit/Color")) { color = new Color(0.5f, 0.35f, 0.2f) };
        }

        private Vector3 BiomeCenter(string biome)
        {
            // Representative surface direction for each biome sector.
            return biome switch
            {
                BiomeForest => SphDir(0f, 0f),
                BiomeCamp => SphDir(Mathf.PI * 0.5f, 0f),
                BiomeLake => SphDir(Mathf.PI, 0f),
                BiomeMountains => SphDir(0f, 0.85f), // near north pole
                _ => Vector3.up,
            };
        }

        private static Vector3 SphDir(float lon, float lat)
        {
            float y = Mathf.Sin(lat);
            float r = Mathf.Cos(lat);
            return new Vector3(r * Mathf.Cos(lon), y, r * Mathf.Sin(lon)).normalized;
        }

        private static Vector3 RandomOnCone(Vector3 axis, float halfAngleDeg)
        {
            float a = Random.Range(0f, halfAngleDeg * Mathf.Deg2Rad);
            float phi = Random.Range(0f, Mathf.PI * 2f);
            // Build a basis around axis.
            Vector3 refv = Mathf.Abs(axis.y) < 0.9f ? Vector3.up : Vector3.right;
            Vector3 t = Vector3.Cross(axis, refv).normalized;
            Vector3 b = Vector3.Cross(axis, t).normalized;
            Vector3 off = (Mathf.Cos(phi) * t + Mathf.Sin(phi) * b) * Mathf.Sin(a);
            return (axis * Mathf.Cos(a) + off).normalized;
        }

        private static Material _vcolorMat;
        private static Material VertexColorMaterial
        {
            get
            {
                if (_vcolorMat != null) return _vcolorMat;
                var sh = Shader.Find("Unlit/VertexColor");
                if (sh == null) sh = Shader.Find("Unlit/Color"); // fallback (no vertex colors)
                _vcolorMat = new Material(sh);
                return _vcolorMat;
            }
        }

        // Cheap deterministic-ish 3D value noise in 0..1.
        private static float ValueNoise3D(Vector3 p)
        {
            float v = Mathf.Sin(Vector3.Dot(p, new Vector3(12.9898f, 78.233f, 37.719f))) * 43758.5453f;
            return (v - Mathf.Floor(v));
        }
    }
}
