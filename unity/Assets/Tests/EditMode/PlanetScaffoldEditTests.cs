using NUnit.Framework;
using UnityEngine;
using TrustCamp.World;

namespace TrustCamp.Tests.EditMode
{
    /// <summary>Red-then-green test for task 0003: the planet scaffold must expose
    /// four named biome regions in the scene graph.</summary>
    public class PlanetScaffoldEditTests
    {
        [Test]
        public void PlanetHasFourBiomes()
        {
            var go = new GameObject("Planet");
            var gen = go.AddComponent<PlanetGenerator>();
            gen.Generate();

            Assert.IsNotNull(go.transform.Find(PlanetGenerator.BiomeForest), "Forest biome missing");
            Assert.IsNotNull(go.transform.Find(PlanetGenerator.BiomeLake), "Lake biome missing");
            Assert.IsNotNull(go.transform.Find(PlanetGenerator.BiomeCamp), "Camp biome missing");
            Assert.IsNotNull(go.transform.Find(PlanetGenerator.BiomeMountains), "Mountains biome missing");
        }

        [Test]
        public void PlanetHasGeneratedMesh()
        {
            var go = new GameObject("Planet");
            var gen = go.AddComponent<PlanetGenerator>();
            gen.Generate();
            var mf = go.GetComponent<MeshFilter>();
            Assert.IsNotNull(mf, "MeshFilter missing");
            Assert.IsNotNull(mf.sharedMesh, "Mesh not generated");
            Assert.Greater(mf.sharedMesh.vertexCount, 0, "Mesh has no vertices");
        }
    }
}
