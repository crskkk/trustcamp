using UnityEngine;

namespace TrustCamp.Avatar
{
    /// <summary>
    /// Renders cute, emotionally expressive low-poly characters from an AvatarSpec.
    /// Supports material swaps for appearance variation (skin tone, hair color, eyes, expression).
    /// Target visual style: chibi proportions, emotionally readable faces.
    /// Draw call budget: ≤4 per avatar (one skinned mesh + materials, optional hair overlay).
    /// </summary>
    public class AvatarRenderer : MonoBehaviour
    {
        [SerializeField]
        private SkinnedMeshRenderer bodyRenderer;

        [SerializeField]
        private SkinnedMeshRenderer hairRenderer;

        [SerializeField]
        private Material[] skinMaterials = new Material[5];

        [SerializeField]
        private Material[] hairColorMaterials = new Material[5];

        [SerializeField]
        private Material[] eyeMaterials = new Material[5];

        [SerializeField]
        private Material[] expressionMaterials = new Material[4];

        private AvatarSpec currentSpec;

        private void OnValidate()
        {
            // Ensure we have body renderer
            if (bodyRenderer == null)
            {
                bodyRenderer = GetComponent<SkinnedMeshRenderer>();
            }
        }

        /// <summary>Apply an AvatarSpec to this renderer, updating all visual properties.</summary>
        public void ApplySpec(AvatarSpec spec)
        {
            if (spec == null)
            {
                Debug.LogError("AvatarRenderer.ApplySpec: spec is null");
                return;
            }

            currentSpec = spec;

            // Apply skin tone (affects body material)
            if (bodyRenderer != null && spec.skinTone >= 0 && spec.skinTone < skinMaterials.Length)
            {
                Material skinMaterial = skinMaterials[spec.skinTone];
                if (skinMaterial != null)
                {
                    bodyRenderer.material = skinMaterial;
                }
            }

            // Apply hair color (affects hair renderer if present)
            if (hairRenderer != null && spec.hairColor >= 0 && spec.hairColor < hairColorMaterials.Length)
            {
                Material hairColorMaterial = hairColorMaterials[spec.hairColor];
                if (hairColorMaterial != null)
                {
                    hairRenderer.material = hairColorMaterial;
                }
            }

            // Apply expression (material swap on face)
            if (spec.expression >= 0 && spec.expression < expressionMaterials.Length)
            {
                Material expressionMaterial = expressionMaterials[spec.expression];
                if (expressionMaterial != null && bodyRenderer != null)
                {
                    // Swap the face material on the body renderer
                    Material[] materials = bodyRenderer.materials;
                    if (materials.Length > 0)
                    {
                        materials[0] = expressionMaterial;
                        bodyRenderer.materials = materials;
                    }
                }
            }

            // Hair style variation: use mesh swap or scale variation
            ApplyHairStyle(spec.hairStyle);

            // Body accent: tint or secondary material swap
            ApplyBodyAccent(spec.bodyAccent);
        }

        private void ApplyHairStyle(int hairStyle)
        {
            if (hairRenderer == null)
            {
                return;
            }

            // For now, use simple LOD or enabled/disabled based on hair style
            // In production: swap between different hair mesh prefabs
            // Placeholder: just ensure hair is visible
            hairRenderer.enabled = true;

            // Future: swap between different hair mesh variants
            // GameObject[] hairVariants = ...
            // hairRenderer.mesh = hairVariants[hairStyle % hairVariants.Length].GetComponent<MeshFilter>().mesh;
        }

        private void ApplyBodyAccent(int bodyAccent)
        {
            if (bodyRenderer == null)
            {
                return;
            }

            // Body accent: tint the body material based on accent color
            // Simple implementation: multiply body material color by accent tint
            Material bodyMat = bodyRenderer.material;
            if (bodyMat != null)
            {
                Color accentTint = GetAccentColor(bodyAccent);
                bodyMat.color = Color.Lerp(bodyMat.color, accentTint, 0.3f);
            }
        }

        private Color GetAccentColor(int accent)
        {
            return accent switch
            {
                0 => new Color(1f, 0.8f, 0.6f),   // Warm beige
                1 => new Color(0.8f, 1f, 0.6f),   // Lime green
                2 => new Color(0.6f, 0.8f, 1f),   // Cool blue
                3 => new Color(1f, 0.6f, 0.8f),   // Pink
                _ => Color.white,
            };
        }

        /// <summary>Get the currently applied spec (if any).</summary>
        public AvatarSpec GetCurrentSpec() => currentSpec;
    }
}
