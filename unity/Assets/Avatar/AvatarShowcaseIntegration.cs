using UnityEngine;

namespace TrustCamp.Avatar
{
    /// <summary>
    /// Automatically integrates the AvatarShowcase into the active scene.
    /// Spawns a showcase panel with 4 avatar displays when the scene loads.
    /// Can be toggled with UI button or keyboard shortcut.
    /// </summary>
    public class AvatarShowcaseIntegration : MonoBehaviour
    {
        [SerializeField]
        private float showcaseDistance = 10f;

        [SerializeField]
        private bool autoSpawnOnStart = true;

        [SerializeField]
        private KeyCode toggleKey = KeyCode.H; // H for "show avatars"

        private GameObject showcasePanel;
        private bool showcaseActive = false;

        private void Start()
        {
            if (autoSpawnOnStart)
            {
                SpawnShowcase();
                showcaseActive = true;
            }
        }

        private void Update()
        {
            // Toggle showcase with keyboard shortcut
            if (Input.GetKeyDown(toggleKey))
            {
                if (showcaseActive)
                {
                    HideShowcase();
                }
                else
                {
                    ShowShowcase();
                }
            }
        }

        public void SpawnShowcase()
        {
            if (showcasePanel != null)
            {
                return; // Already spawned
            }

            // Create showcase panel
            showcasePanel = new GameObject("AvatarShowcasePanel");

            // Position in front of camera
            Camera mainCamera = Camera.main;
            if (mainCamera != null)
            {
                Vector3 cameraForward = mainCamera.transform.forward;
                showcasePanel.transform.position = mainCamera.transform.position +
                                                    cameraForward * showcaseDistance;
                showcasePanel.transform.LookAt(mainCamera.transform.position);
            }
            else
            {
                showcasePanel.transform.position = Vector3.forward * showcaseDistance;
            }

            // Add showcase component
            AvatarShowcase showcase = showcasePanel.AddComponent<AvatarShowcase>();

            showcaseActive = true;
        }

        public void HideShowcase()
        {
            if (showcasePanel != null)
            {
                showcasePanel.SetActive(false);
                showcaseActive = false;
            }
        }

        public void ShowShowcase()
        {
            if (showcasePanel != null)
            {
                showcasePanel.SetActive(true);
                showcaseActive = true;
            }
            else
            {
                SpawnShowcase();
            }
        }

        public void DestroyShowcase()
        {
            if (showcasePanel != null)
            {
                Destroy(showcasePanel);
                showcasePanel = null;
                showcaseActive = false;
            }
        }

        public bool IsShowcaseActive => showcaseActive;

        private void OnDestroy()
        {
            if (showcasePanel != null)
            {
                Destroy(showcasePanel);
            }
        }
    }
}
