using System.Collections.Generic;
using UnityEngine;

namespace TrustCamp.World
{
    /// <summary>Builds an icosphere (subdivided icosahedron) as vertex + triangle lists.</summary>
    public static class Icosphere
    {
        public static (List<Vector3> verts, List<int> tris) Create(int subdivisions, float radius)
        {
            var verts = new List<Vector3>();
            var tris = new List<int>();
            var midCache = new Dictionary<ulong, int>();

            // 12 base icosahedron vertices.
            float t = (1f + Mathf.Sqrt(5f)) / 2f;
            foreach (var v in new[] {
                new Vector3(-1, t, 0), new Vector3(1, t, 0), new Vector3(-1, -t, 0), new Vector3(1, -t, 0),
                new Vector3(0, -1, t), new Vector3(0, 1, t), new Vector3(0, -1, -t), new Vector3(0, 1, -t),
                new Vector3(t, 0, -1), new Vector3(t, 0, 1), new Vector3(-t, 0, -1), new Vector3(-t, 0, 1),
            })
            {
                verts.Add(v.normalized * radius);
            }

            int[] baseFaces = {
                0,11,5, 0,5,1, 0,1,7, 0,7,10, 0,10,11,
                1,5,9, 5,11,4, 11,10,2, 10,7,6, 7,1,8,
                3,9,4, 3,4,2, 3,2,6, 3,6,8, 3,8,9,
                4,9,5, 2,4,11, 6,2,10, 8,6,7, 9,8,1,
            };

            for (int i = 0; i < baseFaces.Length; i += 3)
                Subdivide(verts, tris, midCache, baseFaces[i], baseFaces[i + 1], baseFaces[i + 2], subdivisions, radius);

            return (verts, tris);
        }

        private static void Subdivide(List<Vector3> verts, List<int> tris, Dictionary<ulong, int> mid,
            int a, int b, int c, int depth, float radius)
        {
            if (depth == 0) { tris.Add(a); tris.Add(b); tris.Add(c); return; }
            int ab = Midpoint(verts, mid, a, b, radius);
            int bc = Midpoint(verts, mid, b, c, radius);
            int ca = Midpoint(verts, mid, c, a, radius);
            Subdivide(verts, tris, mid, a, ab, ca, depth - 1, radius);
            Subdivide(verts, tris, mid, b, bc, ab, depth - 1, radius);
            Subdivide(verts, tris, mid, c, ca, bc, depth - 1, radius);
            Subdivide(verts, tris, mid, ab, bc, ca, depth - 1, radius);
        }

        private static int Midpoint(List<Vector3> verts, Dictionary<ulong, int> mid, int a, int b, float radius)
        {
            ulong key = (ulong)Mathf.Min(a, b) | ((ulong)Mathf.Max(a, b) << 32);
            if (mid.TryGetValue(key, out int idx)) return idx;
            Vector3 p = ((verts[a] + verts[b]) * 0.5f).normalized * radius;
            idx = verts.Count;
            verts.Add(p);
            mid[key] = idx;
            return idx;
        }
    }
}
