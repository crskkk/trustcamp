#if UNITY_EDITOR
using System.IO;
using UnityEditor;
using UnityEditor.Build.Reporting;
using UnityEngine;

namespace TrustCamp.EditorTools
{
    /// <summary>Builds the WebGL player to the repo's public/unity/Build/. Run via -executeMethod.</summary>
    public static class BuildScript
    {
        public static void BuildWebGL()
        {
            PlayerSettings.companyName = "TrustCamp";
            PlayerSettings.productName = "TrustCamp";
            PlayerSettings.WebGL.compressionFormat = WebGLCompressionFormat.Disabled;
            PlayerSettings.WebGL.dataCaching = true;
            PlayerSettings.WebGL.exceptionSupport = WebGLExceptionSupport.FullWithStacktrace;

            string projectRoot = FindRepoRoot();
            string outDir = Path.Combine(projectRoot, "public", "unity", "Build");
            Directory.CreateDirectory(outDir);

            var scenes = new[] { "Assets/Scenes/Planet.unity" };
            var opts = new BuildPlayerOptions
            {
                scenes = scenes,
                locationPathName = outDir,
                targetGroup = BuildTargetGroup.WebGL,
                target = BuildTarget.WebGL,
                options = BuildOptions.None,
            };

            BuildReport report = BuildPipeline.BuildPlayer(opts);
            int code = report.summary.result == BuildResult.Succeeded ? 0 : 1;
            Debug.Log($"[BuildScript] WebGL build result={report.summary.result} (code {code}) -> {outDir}");
            if (code != 0) EditorApplication.Exit(code);
        }

        private static string FindRepoRoot()
        {
            // Walk up from the project's Application.dataPath (the Assets folder) to find the repo root,
            // detected by the presence of `package.json` (the web repo) or `.git`.
            string dir = Application.dataPath;
            while (!string.IsNullOrEmpty(dir))
            {
                if (File.Exists(Path.Combine(dir, "package.json")) || Directory.Exists(Path.Combine(dir, ".git")))
                    return dir;
                var parent = Directory.GetParent(dir);
                if (parent == null) break;
                dir = parent.FullName;
            }
            // Fallback: two levels up from Assets (Assets -> <proj> -> repo).
            return Directory.GetParent(Directory.GetParent(Application.dataPath).FullName).FullName;
        }
    }
}
#endif
