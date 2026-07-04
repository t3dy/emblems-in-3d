import * as THREE from "three";

// ===========================================================================
// relief.js — turn any woodcut/emblem plate into a 3D *carved relief*.
// The plate image drives a displacement map on a finely-subdivided plane:
// the light paper stands proud and the dark engraved lines are recessed, so
// the picture is literally carved into geometry. Raking light makes it read.
// This is the scalable "model" generated for each of the 213 plates.
// ===========================================================================

export function buildRelief(tex, aspect, opts = {}) {
  const width = opts.width ?? 4.4;
  const height = width / aspect;
  const depth = opts.depth ?? 0.42;

  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  tex.minFilter = THREE.LinearMipmapLinearFilter;

  const g = new THREE.Group();

  // the carved face — paper raised, ink lines recessed
  const segX = opts.seg ?? 200;
  const segY = Math.max(40, Math.round(segX / aspect));
  const geo = new THREE.PlaneGeometry(width, height, segX, segY);
  const mat = new THREE.MeshStandardMaterial({
    map: tex,
    displacementMap: tex,
    displacementScale: depth,
    roughness: 0.92,
    metalness: 0.0,
  });
  const relief = new THREE.Mesh(geo, mat);
  relief.castShadow = relief.receiveShadow = true;
  g.add(relief);

  // stone backing slab
  const slab = new THREE.Mesh(
    new THREE.BoxGeometry(width + 0.35, height + 0.35, 0.3),
    new THREE.MeshStandardMaterial({ color: 0x6f6450, roughness: 1.0 })
  );
  slab.position.z = -0.24; slab.receiveShadow = true; g.add(slab);

  // gilt frame
  const frameMat = new THREE.MeshStandardMaterial({ color: 0x836329, roughness: 0.5, metalness: 0.55 });
  const fb = 0.2, t = 0.32;
  const bar = (w, h, x, y) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, t), frameMat);
    m.position.set(x, y, 0.02); m.castShadow = true; g.add(m);
  };
  bar(width + 0.35 + fb, fb, 0, (height + 0.35) / 2);   // top
  bar(width + 0.35 + fb, fb, 0, -(height + 0.35) / 2);  // bottom
  bar(fb, height + 0.35 + fb, (width + 0.35) / 2, 0);   // right
  bar(fb, height + 0.35 + fb, -(width + 0.35) / 2, 0);  // left

  g.userData = { relief, mat, width, height, setDepth: (d) => (mat.displacementScale = d) };
  return g;
}

// Load an image as a texture and resolve with {tex, aspect}.
export function loadPlate(url) {
  return new Promise((resolve, reject) => {
    new THREE.TextureLoader().load(
      url,
      (tex) => {
        const img = tex.image;
        resolve({ tex, aspect: (img.width || 1) / (img.height || 1) });
      },
      undefined,
      reject
    );
  });
}
