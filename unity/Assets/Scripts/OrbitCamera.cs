using UnityEngine;

namespace TrustCamp.World
{
    /// <summary>
    /// Orbit camera for the planet scaffold. Auto-rotates slowly around the planet
    /// so all four biomes pass into view within ~60 s (visual checkpoint), and lets
    /// the user drag (mouse/touch) to rotate manually. Task 0003.
    /// </summary>
    public class OrbitCamera : MonoBehaviour
    {
        [SerializeField] private Transform target;
        [SerializeField] private float distance = 22f;
        [SerializeField] private float autoRotateSpeed = 6f;   // deg/sec
        [SerializeField] private float dragSpeed = 0.25f;

        private float _yaw;
        private float _pitch = 25f;
        private Vector3 _lastInput;
        private bool _dragging;

        private void Awake()
        {
            if (target == null) target = transform.parent;
        }

        private void Update()
        {
            HandleDrag();
            if (!_dragging) _yaw += autoRotateSpeed * Time.deltaTime;
            Apply();
        }

        private void HandleDrag()
        {
            if (Input.GetMouseButtonDown(0)) { _dragging = true; _lastInput = Input.mousePosition; }
            if (Input.GetMouseButtonUp(0)) _dragging = false;
            if (_dragging && Input.GetMouseButton(0))
            {
                Vector3 d = (Vector3)Input.mousePosition - _lastInput;
                _yaw += d.x * dragSpeed;
                _pitch = Mathf.Clamp(_pitch - d.y * dragSpeed, -80f, 80f);
                _lastInput = Input.mousePosition;
            }
        }

        private void Apply()
        {
            if (target == null) return;
            Quaternion q = Quaternion.Euler(_pitch, _yaw, 0f);
            transform.position = target.position + q * Vector3.back * distance;
            transform.LookAt(target);
        }

        public void SetTarget(Transform t) => target = t;
    }
}
