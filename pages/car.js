import React, { useState, useEffect, useRef } from "react";
import { Wrapper } from "@googlemaps/react-wrapper";
import ThreejsOverlayView from "@ubilabs/threejs-overlay-view";
import { CatmullRomCurve3, Vector3 } from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader";
import { Line2 } from "three/examples/jsm/lines/Line2.js";
import { LineMaterial } from "three/examples/jsm/lines/LineMaterial.js";
import { LineGeometry } from "three/examples/jsm/lines/LineGeometry.js";
import fetchDirections from "../src/fetchDirections";
import * as THREE from "three"
import { Clock } from 'three';


const mapOptions = {
  mapId: process.env.NEXT_PUBLIC_MAP_ID,
  center: { lat: 43.66293, lng: -79.39314 },
  zoom: 18,
  disableDefaultUI: true,
  heading: 25,
  tilt: 60,
};

export default function App() {
  return (
    <Wrapper apiKey={process.env.NEXT_PUBLIC_MAP_API_KEY}>
      <MyMap />
    </Wrapper>
  );
}

function MyMap() {
  const [route, setRoute] = useState(null);
  const [map, setMap] = useState();
  const ref = useRef();

  useEffect(() => {
    setMap(new window.google.maps.Map(ref.current, mapOptions));
  }, []);

  return (
    <>
      <div ref={ref} id="map" />
      {map && <Directions setRoute={setRoute} />}
      {map && route && <Animate map={map} route={route} />}
    </>
  );
}

function Directions({ setRoute }) {
  const [origin] = useState("27 Front St E Toronto");
  const [destination] = useState("75 Yonge Street Toronto");

  useEffect(() => {
    fetchDirections(origin, destination, setRoute);
  }, [origin, destination]);

  return (
    <div className="directions">
      <h2>Directions</h2>
      <h3>Origin</h3>
      <p>{origin}</p>
      <h3>Destination</h3>
      <p>{destination}</p>
    </div>
  );
}

const ANIMATION_MS = 50000;
const FRONT_VECTOR = new Vector3(0, -1, 0);

function Animate({ route, map }) {
  const overlayRef = useRef();
  const trackRef = useRef();
  const carRef = useRef();
  const mixerRef = useRef();
  const clock = new Clock();
  useEffect(() => {
    map.setCenter(route[Math.floor(route.length / 2)], 17);

    if (!overlayRef.current) {
      overlayRef.current = new ThreejsOverlayView(mapOptions.center);
      overlayRef.current.setMap(map);
    }

    const scene = overlayRef.current.getScene();
    const points = route.map((p) => overlayRef.current.latLngAltToVector3(p));
    const curve = new CatmullRomCurve3(points);

    if (trackRef.current) {
      scene.remove(trackRef.current);
    }
    trackRef.current = createTrackFromCurve(curve);
    scene.add(trackRef.current);

    loadModel().then(({model, mixer}) => {
      if (carRef.current) {
        scene.remove(carRef.current);
      }
      carRef.current = model;
      scene.add(carRef.current);
            // Save the mixer reference to update the animation
      mixerRef.current = mixer;
      scene.add(model);
    });

    overlayRef.current.update = () => {
      trackRef.current.material.resolution.copy(
        overlayRef.current.getViewportSize()
      );

      if (carRef.current) {
        const progress = (performance.now()*3 % ANIMATION_MS) / ANIMATION_MS;
        curve.getPointAt(progress, carRef.current.position);
        carRef.current.quaternion.setFromUnitVectors(
          FRONT_VECTOR,
          curve.getTangentAt(progress)
        );
        carRef.current.rotateX(Math.PI / 2);
      }
      if (carRef.current && mixerRef.current) {
        const delta = clock.getDelta(); // Time delta
        mixerRef.current.update(delta);
      }

      overlayRef.current.requestRedraw();
    };

    return () => {
      scene.remove(trackRef.current);
      scene.remove(carRef.current);
    };
  }, [route]);
}

function createTrackFromCurve(curve) {
  const points = curve.getSpacedPoints(curve.points.length * 10);
  const positions = points.map((point) => point.toArray()).flat();

  return new Line2(
    new LineGeometry().setPositions(positions),
    new LineMaterial({
      color: "blue",
      linewidth: 8,
    })
  );
}
// --------------Start------------------
// var characterControls: CharacterControls
// new GLTFLoader().load('models/Soldier.glb' , function (gltf) {
//       const model = gltf.scene;
//       model.traverse(function (object: any) {
//         if (object.isMesh) object.castShadow = true;
//       });
//       scene.add(model);

//       const gltfAnimations: THREE.AnimationClip[] = gltf.animations;
//       const mixer = new THREE.AnimationMixer(model);
//       const animationsMap: Map<String, THREE.AnimationAction> = new Map()
//       gltfAnimations.filters(a => a.name != 'Tpose').forEach((a: THREE.AnimationClip) => {
//         animationsMap.set(a.name, mixer.clipAction(a))
//       })
//       characterControls = new CharacterControls(model,mixer,animationsMap,OrbitControls,camera, 'Idle')
// });

// ---------------End----------------- 
async function loadModel() {
  const loader = new GLTFLoader();
  // This work is based on "Low poly Car" (https://sketchfab.com/3d-models/low-poly-car-f822f0c500a24ca9ac2af183d2e630b4) by reyad.bader (https://sketchfab.com/reyad.bader) licensed under CC-BY-4.0 (http://creativecommons.org/licenses/by/4.0/)
  const object = await loader.loadAsync("/scanned_animated_walking_man/scene.gltf");
  const group = object.scene;
  group.scale.setScalar(10);
  const mixer = new THREE.AnimationMixer(group);
  const clips = object.animations;

  let walkingAnimation = null;

  if (clips && clips.length) {
    // Check for the walking animation by inspecting animation names
    walkingAnimation = clips.find((clip) => clip.name.toLowerCase().includes('walk'));

    if (walkingAnimation) {
      const action = mixer.clipAction(walkingAnimation);
      
      action.reset();
      action.play();
  
      action._clip.duration;
      
      // action.setEffectiveTimeScale(0.5)
    } else {
      // If 'walk' animation not found, play the first animation available
      const action = mixer.clipAction(clips[0]);
      action.reset();
      action.play();
      
      // action.setLoop(THREE.LoopOnce); // Stops after playing once
  // action.clampWhenFinished = true; // Stops at the last frame when the animation ends
  action.setEffectiveTimeScale(0.5); // Adjust the animation speed
      // action.setEffectiveTimeScale(0.5)
    }
  }

  return { model: group, mixer };
}
