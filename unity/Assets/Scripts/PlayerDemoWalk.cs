using UnityEngine;

namespace TrustCamp.World
{
    /// <summary>
    /// Feeds a short forward walk into a <see cref="PlayerController"/> so the
    /// visual checkpoint shows locomotion + chase-camera follow without a
    /// keyboard. Attached by <see cref="PlayerSpawner"/> only on URL-triggered
    /// spawns; a real "enter the world" flow replaces this. Task 0101.
    /// </summary>
    [RequireComponent(typeof(PlayerController))]
    public class PlayerDemoWalk : MonoBehaviour
    {
        [SerializeField] private float seconds = 8f;

        private PlayerController _pc;
        private float _elapsed;

        private void Awake() => _pc = GetComponent<PlayerController>();

        private void Update()
        {
            if (_elapsed >= seconds)
            {
                enabled = false;
                return;
            }
            _elapsed += Time.deltaTime;
            _pc.Step(new Vector2(0f, 1f), Time.deltaTime);
        }
    }
}
