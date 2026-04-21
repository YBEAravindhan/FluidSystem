import { useEffect, useRef } from "react";
import * as THREE from "three";
import { FluidSimulation } from "../FluidSimulation";
import "../index.css";

const CursorTrail = () => {
  const canvasRef = useRef(null);

  useEffect(() => {
    if (!canvasRef.current) return;

    const sim = new FluidSimulation(canvasRef.current, {
      simResolution: 128,
      dyeResolution: 512,
      curl: 0,
      pressureIterations: 0,
      velocityDissipation: 0.98,
      dyeDissipation: 0.99,
      forceStrength: 5,
      threshold: 0,
      edgeSoftness: 0,
      inkColor: new THREE.Color(1, 1, 1),
    });

    return () => sim.renderer.dispose();
  }, []);

  return (
    <>
      <nav>
        <div className="nav-logo">
          <a href="/">Vortex</a>
          <div className="nav-links">
            <a href="/works">works</a>
            <a href="/about">about</a>
            <a href="/works">updates</a>
            <a href="/works">start a project</a>
          </div>
        </div>
      </nav>

      <section className="hero">
        <div className="header">
          <h1>Fluid System In</h1>
          <h1>Constant Field</h1>
          <h1>Of Interaction</h1>
        </div>
      </section>

      {/* ✅ IMPORTANT: use ref */}
      <canvas ref={canvasRef} id="fluid" />
    </>
  );
};

export default CursorTrail;