# Measured reconstruction test fixture

`measured-castle.glb` was generated locally from 11 real photographs in the public OpenMVG Sceaux Castle benchmark through COLMAP and OpenMVS, then packed with Trimesh. It has 37,332 triangles and an embedded photographed texture atlas. It is used to test binary output validation, authenticated artifact transport and job controls; it is not an avatar or garment-quality fixture.

Input attribution: Sceaux Castle, France; photographer copyright 2012 Pierre Moulon. Source: https://github.com/openMVG/ImageDataset_SceauxCastle . Preserve attribution and review upstream permissions before redistributing this derived benchmark fixture. No personal biometric images are bundled.

The final end-to-end worker verification generated a separate optimized 60,000-triangle model from the same real input photos. Its outputs and hashes are recorded in docs/automated-reconstruction-verification.md.

`static-scan.glb` is the original authored, unanimated Thread sample character, retained solely to test the bounded static-scan parser independently of the now animated character asset. It is synthetic geometry, not a reconstructed face, and supplies no likeness evidence.
