// Three.js globe — sphere, atmosphere, story markers, connecting arcs.

import * as THREE from 'three';
import gsap from 'gsap';
import { buildMapCanvas, latLngToVec3 } from './dots.js';

const SPHERE_RADIUS = 1;
const MARKER_RADIUS = 0.018;
const PULSE_RADIUS  = 0.035;
const PIN_HEIGHT    = 0.04;

export class Globe {
  /**
   * @param {HTMLElement} container — element that will host the canvas
   * @param {Array}        storyPoints — story data
   * @param {object}       handlers — { onMarkerHover, onMarkerLeave, onMarkerClick }
   */
  constructor(container, storyPoints, handlers = {}) {
    this.container = container;
    this.storyPoints = storyPoints;
    this.handlers = handlers;

    this.markers = [];      // [{ point, mesh, pulse, group }]
    this.arcs = [];

    this._raycaster = new THREE.Raycaster();
    this._pointer = new THREE.Vector2();
    this._hovered = null;
    this._autoRotate = true;
    this._disposed = false;
    this._reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

    this._init();
  }

  _init() {
    const w = this.container.clientWidth;
    const h = this.container.clientHeight;

    // Renderer
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance'
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(w, h);
    this.container.appendChild(this.renderer.domElement);

    // Scene + camera
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(38, w / h, 0.1, 100);
    this.camera.position.set(0, 0, 2.8);

    // Lighting
    const ambient = new THREE.AmbientLight(0x6b8db5, 0.7);
    this.scene.add(ambient);
    const point = new THREE.PointLight(0xf0c878, 1.6, 0, 1);
    point.position.set(-2, 2, 3);
    this.scene.add(point);

    // World group — rotating
    this.world = new THREE.Group();
    this.scene.add(this.world);

    // Sphere with procedural map texture
    const mapCanvas = buildMapCanvas();
    const mapTex = new THREE.CanvasTexture(mapCanvas);
    mapTex.colorSpace = THREE.SRGBColorSpace;
    mapTex.anisotropy = this.renderer.capabilities.getMaxAnisotropy?.() ?? 4;

    const sphereGeo = new THREE.SphereGeometry(SPHERE_RADIUS, 64, 64);
    const sphereMat = new THREE.MeshPhongMaterial({
      map: mapTex,
      emissive: new THREE.Color(0x0a1f40),
      emissiveIntensity: 0.6,
      shininess: 18,
      specular: new THREE.Color(0x4a6f99)
    });
    this.sphere = new THREE.Mesh(sphereGeo, sphereMat);
    this.world.add(this.sphere);
    this._mapTexture = mapTex;

    // Atmosphere — slightly larger additive sphere for the glow halo
    const atmoGeo = new THREE.SphereGeometry(SPHERE_RADIUS * 1.02, 64, 64);
    const atmoMat = new THREE.MeshBasicMaterial({
      color: 0x6fa8ff,
      transparent: true,
      opacity: 0.08,
      blending: THREE.AdditiveBlending,
      side: THREE.BackSide
    });
    this.atmosphere = new THREE.Mesh(atmoGeo, atmoMat);
    this.scene.add(this.atmosphere);

    // Outer faint glow halo (much larger, very subtle)
    const haloGeo = new THREE.SphereGeometry(SPHERE_RADIUS * 1.15, 64, 64);
    const haloMat = new THREE.MeshBasicMaterial({
      color: 0x4a8fff,
      transparent: true,
      opacity: 0.04,
      blending: THREE.AdditiveBlending,
      side: THREE.BackSide
    });
    this.halo = new THREE.Mesh(haloGeo, haloMat);
    this.scene.add(this.halo);

    this._addMarkers();
    this._addArcs();
    this._bindEvents();

    this._clock = new THREE.Clock();
    this._animate = this._animate.bind(this);
    this.renderer.setAnimationLoop(this._animate);
  }

  _addMarkers() {
    const pulseMat = new THREE.MeshBasicMaterial({
      color: 0xf0c878,
      transparent: true,
      opacity: 0.0,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });

    this.storyPoints.forEach((point, idx) => {
      const pos = latLngToVec3(point.lat, point.lng, SPHERE_RADIUS + 0.005);

      const group = new THREE.Group();
      group.position.set(pos.x, pos.y, pos.z);
      // Orient marker outward from sphere center
      group.lookAt(0, 0, 0);
      group.rotateY(Math.PI);

      // Core marker
      const colorHex = new THREE.Color(point.color || '#f0c878');
      const markerGeo = new THREE.SphereGeometry(MARKER_RADIUS, 24, 24);
      const markerMat = new THREE.MeshBasicMaterial({ color: colorHex });
      const marker = new THREE.Mesh(markerGeo, markerMat);
      marker.userData.point = point;
      marker.userData.kind = 'marker';
      group.add(marker);

      // Outer glow ring (additive)
      const glowGeo = new THREE.SphereGeometry(MARKER_RADIUS * 1.6, 16, 16);
      const glowMat = new THREE.MeshBasicMaterial({
        color: colorHex,
        transparent: true,
        opacity: 0.25,
        blending: THREE.AdditiveBlending,
        depthWrite: false
      });
      const glow = new THREE.Mesh(glowGeo, glowMat);
      group.add(glow);

      // Pulse — separate sphere driven by GSAP
      const pulseGeo = new THREE.SphereGeometry(PULSE_RADIUS, 16, 16);
      const pulse = new THREE.Mesh(pulseGeo, pulseMat.clone());
      pulse.material.color = colorHex;
      group.add(pulse);

      // Vertical pin line — from surface outward
      const pinGeo = new THREE.CylinderGeometry(0.0009, 0.0009, PIN_HEIGHT, 6);
      const pinMat = new THREE.MeshBasicMaterial({ color: colorHex, transparent: true, opacity: 0.55 });
      const pin = new THREE.Mesh(pinGeo, pinMat);
      // Cylinder default axis is Y; we want it along local +Z (radial outward).
      pin.rotation.x = Math.PI / 2;
      pin.position.z = -PIN_HEIGHT / 2;
      group.add(pin);

      // Initial state — invisible, will pop in via GSAP staggered
      group.scale.setScalar(0);

      this.world.add(group);
      this.markers.push({ point, mesh: marker, pulse, glow, group, idx });

      // Pulse loop (skipped under reduced motion)
      if (!this._reduced) {
        gsap.fromTo(pulse.scale,
          { x: 1, y: 1, z: 1 },
          {
            x: 2.6, y: 2.6, z: 2.6,
            duration: 1.8,
            repeat: -1,
            ease: 'power1.out',
            delay: idx * 0.25
          }
        );
        gsap.fromTo(pulse.material,
          { opacity: 0.6 },
          {
            opacity: 0,
            duration: 1.8,
            repeat: -1,
            ease: 'power1.out',
            delay: idx * 0.25
          }
        );
      } else {
        pulse.material.opacity = 0.4;
      }
    });
  }

  /** Plays the staggered pop-in for all markers + arcs. Call once after globe mounts. */
  revealMarkers(opts = {}) {
    const { onComplete } = opts;
    const tl = gsap.timeline({ onComplete });
    this.markers.forEach((m, i) => {
      tl.to(m.group.scale, {
        x: 1, y: 1, z: 1,
        duration: 0.55,
        ease: 'back.out(2.2)'
      }, i * 0.18);
    });
    // Animate arcs in sequence after markers
    this.arcs.forEach((a, i) => {
      tl.to(a.uniforms ? a.uniforms.uProgress : a.material, {
        value: 1,
        duration: 1.1,
        ease: 'power2.inOut'
      }, this.markers.length * 0.18 + i * 0.35);
    });
  }

  _addArcs() {
    for (let i = 0; i < this.storyPoints.length - 1; i++) {
      const a = this.storyPoints[i];
      const b = this.storyPoints[i + 1];
      const arc = this._createArc(a, b);
      this.arcs.push(arc);
      this.world.add(arc.mesh);
    }
  }

  _createArc(a, b) {
    const start = latLngToVec3(a.lat, a.lng, SPHERE_RADIUS);
    const end   = latLngToVec3(b.lat, b.lng, SPHERE_RADIUS);
    const v1 = new THREE.Vector3(start.x, start.y, start.z);
    const v2 = new THREE.Vector3(end.x, end.y, end.z);
    const distance = v1.distanceTo(v2);

    // Mid-point pushed outward — height proportional to chord length
    const mid = new THREE.Vector3().addVectors(v1, v2).multiplyScalar(0.5);
    const lift = SPHERE_RADIUS + Math.min(0.55, 0.18 + distance * 0.35);
    mid.normalize().multiplyScalar(lift);

    // Two extra control points either side of midpoint for a smooth curve
    const ctrlA = new THREE.Vector3().lerpVectors(v1, mid, 0.5).normalize().multiplyScalar(SPHERE_RADIUS + (lift - SPHERE_RADIUS) * 0.7);
    const ctrlB = new THREE.Vector3().lerpVectors(mid, v2, 0.5).normalize().multiplyScalar(SPHERE_RADIUS + (lift - SPHERE_RADIUS) * 0.7);

    const curve = new THREE.CatmullRomCurve3([v1, ctrlA, mid, ctrlB, v2]);
    const tubeGeo = new THREE.TubeGeometry(curve, 80, 0.0035, 8, false);

    // Custom shader-free "draw progress" effect: shrink the visible portion via
    // a ring of vertex Y-offsets isn't trivial; instead we use a uniforms-style
    // approach with a shader material that masks based on arc parameter.
    const mat = new THREE.ShaderMaterial({
      uniforms: {
        uProgress: { value: 0 },
        uColor:    { value: new THREE.Color(0xd4a853) }
      },
      vertexShader: /* glsl */ `
        varying float vU;
        void main() {
          // CatmullRomCurve3 + TubeGeometry: u runs along length in uv.x
          vU = uv.x;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        varying float vU;
        uniform float uProgress;
        uniform vec3  uColor;
        void main() {
          if (vU > uProgress) discard;
          // Slight gradient — brighter near the leading edge
          float edge = smoothstep(uProgress - 0.06, uProgress, vU);
          vec3 c = mix(uColor, vec3(1.0, 0.92, 0.7), edge * 0.35);
          gl_FragColor = vec4(c, 0.85);
        }
      `,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide
    });

    const mesh = new THREE.Mesh(tubeGeo, mat);
    return { mesh, material: mat, uniforms: mat.uniforms };
  }

  _bindEvents() {
    this._onPointerMove = (e) => {
      const rect = this.renderer.domElement.getBoundingClientRect();
      this._pointer.x =  ((e.clientX - rect.left) / rect.width)  * 2 - 1;
      this._pointer.y = -((e.clientY - rect.top)  / rect.height) * 2 + 1;
      this._lastClient = { x: e.clientX, y: e.clientY };
    };
    this._onClick = () => {
      if (this._hovered) {
        this.handlers.onMarkerClick?.(this._hovered.point, this._hovered);
      }
    };
    this._onResize = () => {
      const w = this.container.clientWidth;
      const h = this.container.clientHeight;
      this.camera.aspect = w / h;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(w, h);
    };

    this.renderer.domElement.addEventListener('pointermove', this._onPointerMove);
    this.renderer.domElement.addEventListener('click', this._onClick);
    window.addEventListener('resize', this._onResize);
  }

  _animate() {
    if (this._disposed) return;
    const delta = this._clock.getDelta();

    if (this._autoRotate && !this._reduced) {
      this.world.rotation.y += 0.0012 * 60 * delta;
    }

    // Hover detection
    this._raycaster.setFromCamera(this._pointer, this.camera);
    const hits = this._raycaster.intersectObjects(this.markers.map(m => m.mesh));
    const hit = hits[0]?.object;

    if (hit !== this._hovered?.mesh) {
      // Leave previous
      if (this._hovered) {
        gsap.to(this._hovered.group.scale, { x: 1, y: 1, z: 1, duration: 0.35, ease: 'power2.out' });
        this.handlers.onMarkerLeave?.();
        this._hovered = null;
      }
      // Enter new
      if (hit) {
        const m = this.markers.find(mm => mm.mesh === hit);
        if (m) {
          this._hovered = m;
          gsap.to(m.group.scale, { x: 1.5, y: 1.5, z: 1.5, duration: 0.35, ease: 'back.out(2)' });
          this.renderer.domElement.style.cursor = 'pointer';
          this.handlers.onMarkerHover?.(m.point, this._lastClient);
          return;
        }
      }
      this.renderer.domElement.style.cursor = '';
    } else if (this._hovered) {
      // Update tooltip cursor coords on every frame
      this.handlers.onMarkerHover?.(this._hovered.point, this._lastClient);
    }

    this.renderer.render(this.scene, this.camera);
  }

  /**
   * Rotate the world so the given lat/lng faces the camera.
   * Camera looks down +Z; faces forward when the point is at z>0 in world space.
   * The sphere starts un-rotated; the world group's Y rotation determines spin.
   * Returns a GSAP tween for chaining.
   */
  focusOn(point, { duration = 1.5, zoomTo = 2.2 } = {}) {
    // Convert to local sphere position, then derive Y-rotation that brings
    // the target longitude to the camera (z+ direction) and X-rotation to
    // tilt the latitude up to camera height.
    const { x, y, z } = latLngToVec3(point.lat, point.lng, 1);

    // Target rotations: we want the unit vector to align with (0,0,1).
    // For Y-rotation only: angle s.t. rotating (x,_,z) by Y maps x→0, z→positive.
    const targetY = Math.atan2(x, z);                       // bring lng forward
    const targetX = -Math.asin(y);                          // tilt lat toward camera

    this._autoRotate = false;

    const tl = gsap.timeline({
      onComplete: () => { /* keep autorotate off until scene closes */ }
    });

    tl.to(this.world.rotation, {
      x: targetX,
      y: targetY,
      duration,
      ease: 'power3.inOut'
    }, 0);

    tl.to(this.camera.position, {
      z: zoomTo,
      duration: 1,
      ease: 'power2.inOut'
    }, 0);

    return tl;
  }

  resumeAutoRotate() { this._autoRotate = true; }

  flashMarker(point) {
    const m = this.markers.find(mm => mm.point === point);
    if (!m) return;
    gsap.fromTo(m.mesh.material.color,
      { r: 1, g: 1, b: 1 },
      { r: m.point.color ? new THREE.Color(m.point.color).r : 1,
        g: m.point.color ? new THREE.Color(m.point.color).g : 1,
        b: m.point.color ? new THREE.Color(m.point.color).b : 1,
        duration: 0.8, ease: 'power2.out' }
    );
  }

  dispose() {
    this._disposed = true;
    this.renderer.setAnimationLoop(null);
    this.renderer.domElement.removeEventListener('pointermove', this._onPointerMove);
    this.renderer.domElement.removeEventListener('click', this._onClick);
    window.removeEventListener('resize', this._onResize);

    // Geometry + material cleanup
    this.scene.traverse(obj => {
      if (obj.geometry) obj.geometry.dispose();
      if (obj.material) {
        if (Array.isArray(obj.material)) obj.material.forEach(m => m.dispose());
        else obj.material.dispose();
      }
    });
    this._mapTexture?.dispose();
    this.renderer.dispose();
    if (this.renderer.domElement.parentNode) {
      this.renderer.domElement.parentNode.removeChild(this.renderer.domElement);
    }
  }
}
