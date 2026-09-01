using System.Globalization;
using UnityEngine;

namespace TrustCamp.World
{
    /// <summary>
    /// Orbit camera for the planet scaffold. Auto-rotates slowly around the planet
    /// so all four biomes pass into view within ~60 s (visual checkpoint), and lets
    /// the user drag (mouse/touch) to rotate manually. Task 0003.
    ///
    /// Task 0009: the shell can detach the idle auto-rotate (SetAutoOrbit "0")
    /// and drive the yaw itself (SetYaw), so screensaver / host steering owns the
    /// orbit angle without touching this script again.
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
        private bool _autoOrbit = true;

        private void Awake()
        {
            if (target == null) target = transform.parent;
        }

        private void Update()
        {
            HandleDrag();
            if (_autoOrbit && !_dragging) _yaw += autoRotateSpeed * Time.deltaTime;
            Apply();
        }

        /// <summary>Shell hook: "1"/"true" keeps the idle auto-rotate; "0" hands
        /// the yaw to the shell (screensaver / host steering).</summary>
        public void SetAutoOrbit(string on)
        {
            _autoOrbit = on == "1" || on == "true" || on == "True";
        }

        /// <summary>Shell hook: set the absolute orbit yaw, in degrees.</summary>
        public void SetYaw(string deg)
        {
            if (float.TryParse(deg, NumberStyles.Float, CultureInfo.InvariantCulture, out float y))
            {
                _yaw = y;
            }
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
