#if UNITY_EDITOR
using System.IO;
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;
using TrustCamp.World;

namespace TrustCamp.EditorTools
{
    /// <summary>Creates Assets/Scenes/Planet.unity with the planet + camera + light. Run via -executeMethod.</summary>
    public static class SetupScene
    {
        public static void Setup()
        {
            const float radius = 8f;

            var scene = EditorSceneManager.NewScene(NewSceneSetup.EmptyScene, NewSceneMode.Single);

            var planetGo = new GameObject("Planet");
            var gen = planetGo.AddComponent<PlanetGenerator>();
            gen.Generate();

            var camGo = new GameObject("Main Camera");
            var cam = camGo.AddComponent<Camera>();
            cam.clearFlags = CameraClearFlags.SolidColor;
            cam.backgroundColor = new Color(0.03f, 0.04f, 0.09f);
            var orbit = camGo.AddComponent<OrbitCamera>();
            orbit.SetTarget(planetGo.transform);

            var lightGo = new GameObject("Sun");
            var l = lightGo.AddComponent<Light>();
            l.type = LightType.Directional;
            l.color = new Color(1f, 0.96f, 0.88f);
            lightGo.transform.rotation = Quaternion.Euler(40f, 30f, 0f);
            RenderSettings.ambientLight = new Color(0.35f, 0.4f, 0.5f);

            // SaveScene requires the parent directory to exist.
            Directory.CreateDirectory(Path.Combine(Application.dataPath, "Scenes"));
            AssetDatabase.Refresh();
            bool ok = EditorSceneManager.SaveScene(scene, "Assets/Scenes/Planet.unity");
            AssetDatabase.SaveAssets();
            Debug.Log($"[SetupScene] save ok={ok} -> Assets/Scenes/Planet.unity");
        }
    }
}
#endif
