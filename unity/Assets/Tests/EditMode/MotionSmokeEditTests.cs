using NUnit.Framework;
using UnityEngine;
using TrustCamp.World;

namespace TrustCamp.Tests.EditMode
{
    /// <summary>Task 0101 red test: the player walks the sphere surface via the
    /// pure Step() method — visiting a configured set of angular checkpoints
    /// along a great circle, and never leaving the surface.</summary>
    public class MotionSmokeEditTests
    {
        private const float R = 8f;
        private static readonly Vector3 Center = Vector3.zero;

        private static PlayerController NewPlayer(Vector3 startDir)
        {
            var go = new GameObject("Player");
            var pc = go.AddComponent<PlayerController>();
            pc.MoveSpeed = 6f;
            pc.Configure(Center, R);
            pc.PlaceOnSurface(startDir);
            return pc;
        }

        [Test]
        public void ZeroInput_DoesNotMove()
        {
            var pc = NewPlayer(Vector3.forward);
            Vector3 p0 = pc.transform.position;
            for (int i = 0; i < 120; i++) pc.Step(Vector2.zero, 1f / 60f);
            Assert.Less((pc.transform.position - p0).magnitude, 1e-3f);
        }

        [Test]
        public void PlaceOnSurface_SeatsAtSurfaceRadius()
        {
            var pc = NewPlayer(Vector3.forward);
            Assert.That((pc.transform.position - Center).magnitude, Is.EqualTo(R).Within(1e-3f));
        }

        [Test]
        public void ForwardWalk_VisitsAngularCheckpoints_StayingOnSurface()
        {
            var pc = NewPlayer(Vector3.forward);
            Vector3 start = (pc.transform.position - Center).normalized;

            float[] checkpoints = { 45f, 90f, 135f, 180f };
            var hit = new bool[checkpoints.Length];

            for (int i = 0; i < 1200; i++)
            {
                pc.Step(new Vector2(0f, 1f), 1f / 60f);

                float r = (pc.transform.position - Center).magnitude;
                Assert.That(r, Is.EqualTo(R).Within(0.05f), $"left the surface at frame {i}: r={r}");

                float ang = Vector3.Angle(start, (pc.transform.position - Center).normalized);
                for (int k = 0; k < checkpoints.Length; k++)
                    if (ang >= checkpoints[k]) hit[k] = true;
            }

            for (int k = 0; k < checkpoints.Length; k++)
                Assert.IsTrue(hit[k], $"forward walk never reached {checkpoints[k]}° from start");
        }

        [Test]
        public void Strafe_TurnsTheWalkOntoADifferentGreatCircle()
        {
            var straight = NewPlayer(Vector3.forward);
            var turned = NewPlayer(Vector3.forward);

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
