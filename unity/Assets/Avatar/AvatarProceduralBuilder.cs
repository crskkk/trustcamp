using UnityEngine;

namespace TrustCamp.Avatar
{
    /// <summary>
    /// Procedurally builds cute low-poly avatar geometry from an AvatarSpec.
    /// Creates a simple humanoid with body, head, and simple facial features.
    /// No pre-made models needed—built from primitives and materials at runtime.
    /// </summary>
    public class AvatarProceduralBuilder : MonoBehaviour
    {
        [SerializeField]
        private Material baseMaterial;

        private AvatarSpec currentSpec;
        private GameObject avatarRoot;

        /// <summary>Build and render an avatar from an AvatarSpec.</summary>
        public void BuildAvatar(AvatarSpec spec)
        {
            if (spec == null)
            {
                Debug.LogError("AvatarProceduralBuilder.BuildAvatar: spec is null");
                return;
            }

            currentSpec = spec;

            // Clean up any existing avatar
            if (avatarRoot != null)
            {
                Destroy(avatarRoot);
            }

            // Create avatar hierarchy
            avatarRoot = new GameObject("Avatar_" + spec.version);
            avatarRoot.transform.SetParent(transform);
            avatarRoot.transform.localPosition = Vector3.zero;

            Debug.Log($"Building avatar: skinTone={spec.skinTone}, hair={spec.hairStyle}/{spec.hairColor}, eyes={spec.eyeColor}");

            // Build body (cube, chibi proportions)
            GameObject body = CreateBody(spec);
            body.transform.SetParent(avatarRoot.transform);

            // Build head (larger sphere, chibi style)
            GameObject head = CreateHead(spec);
            head.transform.SetParent(avatarRoot.transform);

            // Build simple eyes
            GameObject leftEye = CreateEye(spec, isRight: false);
            leftEye.transform.SetParent(head.transform);

            GameObject rightEye = CreateEye(spec, isRight: true);
            rightEye.transform.SetParent(head.transform);

            // Build hair
            GameObject hair = CreateHair(spec);
            hair.transform.SetParent(head.transform);
        }

        private GameObject CreateBody(AvatarSpec spec)
        {
            GameObject body = new GameObject("Body");

            // Cube body with chibi proportions
            GameObject bodyMesh = GameObject.CreatePrimitive(PrimitiveType.Cube);
            Collider collider = bodyMesh.GetComponent<Collider>();
            if (collider != null)
            {
                collider.enabled = false;
            }
            bodyMesh.name = "BodyMesh";
            bodyMesh.transform.SetParent(body.transform);
            bodyMesh.transform.localPosition = Vector3.zero;
            bodyMesh.transform.localScale = new Vector3(0.6f, 0.8f, 0.4f);

            // Apply skin color to body
            Renderer bodyRenderer = bodyMesh.GetComponent<Renderer>();
            if (bodyRenderer != null)
            {
                Material mat = new Material(baseMaterial ?? Shader.Find("Standard"));
                mat.color = GetSkinColor(spec.skinTone);
                bodyRenderer.material = mat;

                // Add accent color overlay
                Color accentColor = GetAccentColor(spec.bodyAccent);
                bodyRenderer.material.color = Color.Lerp(
                    bodyRenderer.material.color,
                    accentColor,
                    0.2f
                );
            }

            return body;
        }

        private GameObject CreateHead(AvatarSpec spec)
        {
            GameObject head = new GameObject("Head");
            head.transform.localPosition = new Vector3(0, 0.6f, 0);

            // Sphere head (larger, chibi style)
            GameObject headMesh = GameObject.CreatePrimitive(PrimitiveType.Sphere);
            Collider headCollider = headMesh.GetComponent<Collider>();
            if (headCollider != null)
            {
                headCollider.enabled = false;
            }
            headMesh.name = "HeadMesh";
            headMesh.transform.SetParent(head.transform);
            headMesh.transform.localPosition = Vector3.zero;
            headMesh.transform.localScale = new Vector3(0.5f, 0.6f, 0.5f);

            // Apply skin color
            Renderer headRenderer = headMesh.GetComponent<Renderer>();
            if (headRenderer != null)
            {
                Material mat = new Material(baseMaterial ?? Shader.Find("Standard"));
                mat.color = GetSkinColor(spec.skinTone);
                headRenderer.material = mat;
            }

            return head;
        }

        private GameObject CreateEye(AvatarSpec spec, bool isRight)
        {
            GameObject eye = new GameObject(isRight ? "EyeRight" : "EyeLeft");
            float xOffset = isRight ? 0.15f : -0.15f;
            eye.transform.localPosition = new Vector3(xOffset, 0.1f, 0.2f);

            // Small sphere for eye
            GameObject eyeMesh = GameObject.CreatePrimitive(PrimitiveType.Sphere);
            Collider eyeCollider = eyeMesh.GetComponent<Collider>();
            if (eyeCollider != null)
            {
                eyeCollider.enabled = false;
            }
            eyeMesh.name = "EyeMesh";
            eyeMesh.transform.SetParent(eye.transform);
            eyeMesh.transform.localPosition = Vector3.zero;
            eyeMesh.transform.localScale = new Vector3(0.1f, 0.12f, 0.08f);

            // Eye color
            Renderer eyeRenderer = eyeMesh.GetComponent<Renderer>();
            if (eyeRenderer != null)
            {
                Material mat = new Material(baseMaterial ?? Shader.Find("Standard"));
                mat.color = GetEyeColor(spec.eyeColor);
                eyeRenderer.material = mat;

                // Expression affects eye appearance (tint or pupil size simulation)
                Color emotionTint = GetExpressionTint(spec.expression);
                eyeRenderer.material.color = Color.Lerp(
                    eyeRenderer.material.color,
                    emotionTint,
                    0.1f
                );
            }

            return eye;
        }

        private GameObject CreateHair(AvatarSpec spec)
        {
            GameObject hair = new GameObject("Hair");
            hair.transform.localPosition = new Vector3(0, 0.3f, 0);

            // Simple hair crown (cylinder on top of head)
            GameObject hairMesh = GameObject.CreatePrimitive(PrimitiveType.Cylinder);
            Collider hairCollider = hairMesh.GetComponent<Collider>();
            if (hairCollider != null)
            {
                hairCollider.enabled = false;
            }
            hairMesh.name = "HairMesh";
            hairMesh.transform.SetParent(hair.transform);
            hairMesh.transform.localPosition = new Vector3(0, 0.05f, 0);
            hairMesh.transform.localScale = new Vector3(0.35f, 0.15f, 0.35f);

            // Hair color
            Renderer hairRenderer = hairMesh.GetComponent<Renderer>();
            if (hairRenderer != null)
            {
                Material mat = new Material(baseMaterial ?? Shader.Find("Standard"));
                mat.color = GetHairColor(spec.hairColor);
                hairRenderer.material = mat;
            }

            // Hair style variation: modify cylinder based on style
            ApplyHairStyle(hairMesh.transform, spec.hairStyle);

            return hair;
        }

        private void ApplyHairStyle(Transform hairTransform, int hairStyle)
        {
            // Simple hair style variation via scale/rotation adjustments
            switch (hairStyle % 5)
            {
                case 0: // Bob
                    hairTransform.localScale = new Vector3(0.35f, 0.1f, 0.35f);
                    break;
                case 1: // Spiky
                    hairTransform.localScale = new Vector3(0.3f, 0.25f, 0.3f);
                    break;
                case 2: // Long
                    hairTransform.localScale = new Vector3(0.35f, 0.2f, 0.35f);
                    hairTransform.localPosition += new Vector3(0, -0.1f, 0);
                    break;
                case 3: // Pigtails
                    hairTransform.localScale = new Vector3(0.25f, 0.15f, 0.4f);
                    break;
                case 4: // Wavy
                    hairTransform.localScale = new Vector3(0.4f, 0.12f, 0.3f);
                    break;
            }
        }

        private Color GetSkinColor(int skinTone)
        {
            return skinTone switch
            {
                0 => new Color(1f, 0.85f, 0.73f),      // Light
                1 => new Color(0.95f, 0.75f, 0.6f),    // Medium light
                2 => new Color(0.85f, 0.65f, 0.5f),    // Medium
                3 => new Color(0.7f, 0.5f, 0.4f),      // Medium dark
                4 => new Color(0.5f, 0.3f, 0.25f),     // Dark
                _ => Color.white,
            };
        }

        private Color GetHairColor(int hairColor)
        {
            return hairColor switch
            {
                0 => new Color(0.2f, 0.15f, 0.1f),     // Brown
                1 => new Color(1f, 0.8f, 0.2f),        // Blonde
                2 => new Color(0.1f, 0.1f, 0.2f),      // Black
                3 => new Color(0.8f, 0.2f, 0.2f),      // Red
                4 => new Color(0.5f, 0.2f, 0.8f),      // Purple
                _ => Color.gray,
            };
        }

        private Color GetEyeColor(int eyeColor)
        {
            return eyeColor switch
            {
                0 => new Color(0.4f, 0.6f, 1f),        // Blue
                1 => new Color(0.2f, 1f, 0.4f),        // Green
                2 => new Color(0.8f, 0.6f, 0.2f),      // Brown
                3 => new Color(1f, 0.2f, 0.6f),        // Pink
                4 => new Color(1f, 1f, 0.2f),          // Yellow
                _ => Color.white,
            };
        }

        private Color GetAccentColor(int bodyAccent)
        {
            return bodyAccent switch
            {
                0 => new Color(1f, 0.8f, 0.6f),        // Warm beige
                1 => new Color(0.8f, 1f, 0.6f),        // Lime green
                2 => new Color(0.6f, 0.8f, 1f),        // Cool blue
                3 => new Color(1f, 0.6f, 0.8f),        // Pink
                _ => Color.white,
            };
        }

        private Color GetExpressionTint(int expression)
        {
            return expression switch
            {
                0 => new Color(1f, 1f, 0.8f),          // Happy (warm)
                1 => new Color(1f, 1f, 1f),            // Neutral (normal)
                2 => new Color(0.8f, 0.8f, 1f),        // Sad (cool)
                3 => new Color(1f, 0.9f, 0.7f),        // Surprised (bright)
                _ => Color.white,
            };
        }

        public AvatarSpec GetCurrentSpec() => currentSpec;

        private void OnDestroy()
        {
            if (avatarRoot != null)
            {
                Destroy(avatarRoot);
            }
        }
    }
}
