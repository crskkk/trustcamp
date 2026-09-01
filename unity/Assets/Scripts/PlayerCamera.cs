using UnityEngine;

namespace TrustCamp.World
{
    /// <summary>
    /// Chase camera: rides behind and above the player along the surface, looks
    /// at the player, and keeps the planet "down". Task 0101.
    /// </summary>
    public class PlayerCamera : MonoBehaviour
    {
        [SerializeField] private Transform target;
        [SerializeField] private float distanceBack = 5f;
        [SerializeField] private float heightUp = 2.5f;
        [SerializeField] private float followLerp = 10f;

        public void SetTarget(Transform t) => target = t;

        private void LateUpdate()
        {
            if (target == null) return;

            Vector3 up = target.up;
            Vector3 want = target.position - target.forward * distanceBack + up * heightUp;

            float k = 1f - Mathf.Exp(-followLerp * Mathf.Max(Time.deltaTime, 1e-4f));
            transform.position = Vector3.Lerp(transform.position, want, k);
            transform.rotation = Quaternion.LookRotation((target.position + up) - transform.position, up);
        }
    }
}
