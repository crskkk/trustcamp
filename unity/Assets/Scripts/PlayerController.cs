using UnityEngine;

namespace TrustCamp.World
{
    /// <summary>
    /// Walks on the planet surface: "down" is toward the planet centre, the body
    /// stays pinned to the surface radius, and it faces its travel direction.
    ///
    /// All motion lives in <see cref="Step"/> — a plain method with no per-frame
    /// state — so NPCs (AGENTS §9) and the MotionSmoke edit test drive the exact
    /// same path as a human player. Task 0101.
    /// </summary>
    public class PlayerController : MonoBehaviour
    {
        [SerializeField] private float moveSpeed = 6f; // metres/sec along the surface

        private Vector3 _center = Vector3.zero;
        private float _radius = 8f;

        public float MoveSpeed { get => moveSpeed; set => moveSpeed = value; }

        /// <summary>Outward surface normal at the body's current position.</summary>
        public Vector3 SurfaceUp => (transform.position - _center).normalized;

        /// <summary>Bind the controller to a planet (centre + the radius the body walks at).</summary>
        public void Configure(Vector3 center, float surfaceRadius)
        {
            _center = center;
            _radius = Mathf.Max(0.01f, surfaceRadius);
        }

        /// <summary>Seat the body on the surface along <paramref name="dir"/>, standing up.</summary>
        public void PlaceOnSurface(Vector3 dir)
        {
            Vector3 up = dir.sqrMagnitude > 1e-6f ? dir.normalized : Vector3.up;
            transform.position = _center + up * _radius;
            transform.rotation = Quaternion.LookRotation(TangentForward(Vector3.up, up), up);
        }

        /// <summary>Advance one step. <c>input.x</c> = strafe, <c>input.y</c> = forward, each in [-1, 1].</summary>
        public void Step(Vector2 input, float dt)
        {
            if (dt <= 0f) return;

            Vector3 up = SurfaceUp;
            Vector3 fwd = TangentForward(transform.forward, up);
            Vector3 right = Vector3.Cross(up, fwd).normalized;

            Vector3 move = fwd * input.y + right * input.x;
            if (move.sqrMagnitude < 1e-8f)
            {
                // Keep pinned + upright, but do not translate.
                transform.position = _center + up * _radius;
                transform.rotation = Quaternion.LookRotation(fwd, up);
                return;
            }
            move = move.normalized;

            // Roll the position along the great circle whose axis is (up × move).
            float angleDeg = moveSpeed * dt / _radius * Mathf.Rad2Deg;
            Quaternion roll = Quaternion.AngleAxis(angleDeg, Vector3.Cross(up, move).normalized);

            Vector3 newUp = (roll * up).normalized;
            transform.position = _center + newUp * _radius;
            transform.rotation = Quaternion.LookRotation(TangentForward(roll * move, newUp), newUp);
        }

        /// <summary>A unit vector in the tangent plane at <paramref name="up"/>, closest to
        /// <paramref name="hint"/>; falls back to something sane at the poles.</summary>
        private static Vector3 TangentForward(Vector3 hint, Vector3 up)
        {
            Vector3 t = Vector3.ProjectOnPlane(hint, up);
            if (t.sqrMagnitude < 1e-6f) t = Vector3.ProjectOnPlane(Vector3.forward, up);
            if (t.sqrMagnitude < 1e-6f) t = Vector3.ProjectOnPlane(Vector3.right, up);
            return t.normalized;
        }

        private void Update()
        {
            Step(new Vector2(Input.GetAxisRaw("Horizontal"), Input.GetAxisRaw("Vertical")), Time.deltaTime);
        }
    }
}
