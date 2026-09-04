using UnityEngine;
using TrustCamp.Avatar;

namespace TrustCamp.World
{
    /// <summary>
    /// NPC locomotion wrapper. Drives an attached <see cref="PlayerController"/>
    /// with a per-tick input supplied by the shell (the
    /// <c>npc/motion.ts</c> policy). The body itself is a plain
    /// <see cref="PlayerController"/> — there is no <c>isNpc</c> branch
    /// in the locomotion code (AGENTS §9, STANDARDS §5.1). Task 0104.
    ///
    /// The avatar body (head, body, hair) is built once from
    /// <see cref="AvatarShowcase.SpecForSeed"/> and the shared
    /// <see cref="AvatarProceduralBuilder"/> — same pipeline as the player
    /// showcase (STANDARDS §3.3).
    /// </summary>
    [RequireComponent(typeof(PlayerController))]
    public class NpcController : MonoBehaviour
    {
        [SerializeField] private int seed = 1;
        [SerializeField] private string role = "prospect";

        private PlayerController _pc;

        public int Seed { get => seed; set => seed = value; }
        public string Role { get => role; set => role = value; }

        public void Awake()
        {
            _pc = GetComponent<PlayerController>();
        }

        /// <summary>Build the avatar mesh from the configured seed.</summary>
        public void BuildAvatar()
        {
            var spec = AvatarShowcase.SpecForSeed(seed);
            var builder = gameObject.GetComponent<AvatarProceduralBuilder>();
            if (builder == null) builder = gameObject.AddComponent<AvatarProceduralBuilder>();
            builder.BuildAvatar(spec);
        }

        /// <summary>Per-frame step. <paramref name="input"/> is the policy's
        /// output (a Vector2 with x = strafe, y = forward, magnitude ≤ 1).</summary>
        public void Step(Vector2 input, float dt)
        {
            if (_pc == null) _pc = GetComponent<PlayerController>();
            if (_pc == null) return;
            _pc.Step(input, dt);
        }
    }
}
