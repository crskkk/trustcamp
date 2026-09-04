using NUnit.Framework;
using UnityEngine;
using TrustCamp.World;

namespace TrustCamp.Tests.EditMode
{
    /// <summary>Task 0104 red test: an <see cref="NpcController"/> drives a
    /// <see cref="PlayerController"/> the same way a human does — straight
    /// walk advances along a great circle, never leaving the surface.</summary>
    public class NpcLocomotionEditTests
    {
        private const float R = 8f;
        private static readonly Vector3 Center = Vector3.zero;

        private static NpcController NewNpc(int seed, Vector3 startDir)
        {
            var go = new GameObject($"NPC_Seed{seed}");
            var pc = go.AddComponent<PlayerController>();
            pc.MoveSpeed = 6f;
            pc.Configure(Center, R);
            pc.PlaceOnSurface(startDir);
            var npc = go.AddComponent<NpcController>();
            npc.Seed = seed;
            return npc;
        }

        [Test]
        public void Step_Forward_AdvancesAlongGreatCircle_StaysOnSurface()
        {
            var npc = NewNpc(42, Vector3.forward);
            Vector3 start = (npc.transform.position - Center).normalized;
            float[] checkpoints = { 30f, 60f, 90f };
            var hit = new bool[checkpoints.Length];
            for (int i = 0; i < 1200; i++)
            {
                npc.Step(new Vector2(0f, 1f), 1f / 60f);
                float r = (npc.transform.position - Center).magnitude;
                Assert.That(r, Is.EqualTo(R).Within(0.05f), $"left the surface at frame {i}: r={r}");
                float ang = Vector3.Angle(start, (npc.transform.position - Center).normalized);
                for (int k = 0; k < checkpoints.Length; k++)
                    if (ang >= checkpoints[k]) hit[k] = true;
            }
            for (int k = 0; k < checkpoints.Length; k++)
                Assert.IsTrue(hit[k], $"NPC never reached {checkpoints[k]}° from start");
        }

        [Test]
        public void Step_ZeroInput_DoesNotMove()
        {
            var npc = NewNpc(7, Vector3.forward);
            Vector3 p0 = npc.transform.position;
            for (int i = 0; i < 60; i++) npc.Step(Vector2.zero, 1f / 60f);
            Assert.Less((npc.transform.position - p0).magnitude, 1e-3f);
        }

        [Test]
        public void Step_Strafe_TurnsTheWalk()
        {
            var straight = NewNpc(1, Vector3.forward);
            var turned = NewNpc(2, Vector3.forward);
            for (int i = 0; i < 300; i++)
            {
                straight.Step(new Vector2(0f, 1f), 1f / 60f);
                turned.Step(new Vector2(1f, 1f), 1f / 60f);
            }
            float sep = Vector3.Angle(
                (straight.transform.position - Center).normalized,
                (turned.transform.position - Center).normalized);
            Assert.Greater(sep, 5f, "strafe input did not change the path");
        }
    }
}
