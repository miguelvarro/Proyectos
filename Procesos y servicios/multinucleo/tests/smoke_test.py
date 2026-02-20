"""
Smoke test rápido (sin WS):
- Renderiza una escena
- Hace ZIP de outputs
"""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from pathlib import Path
from backend.engines.pathtracer.tracer import render_pathtracer_ppm
from backend.engines.zip_multicore.zipper import zip_outputs

scene = {
  "width": 80, "height": 50, "samples_per_pixel": 5, "max_depth": 3,
  "camera": { "origin":[0,1,3], "look_at":[0,0.6,0], "fov_degrees":45 },
  "world": {
    "spheres":[ { "center":[0,0.6,0], "radius":0.6, "albedo":[0.7,0.3,0.2] } ],
    "ground": { "y":0.0, "albedo":[0.8,0.8,0.8] }
  }
}

if __name__ == "__main__":
    out_r = Path("backend/output/renders")
    out_z = Path("backend/output/zips")

    render_pathtracer_ppm(scene, out_r, workers=0, on_progress=lambda p,m: print(p,m))
    zip_outputs(out_r, out_z, workers=0, on_progress=lambda p,m: print(p,m))
    print("OK")

