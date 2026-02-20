import base64
import json
import math
import os
import random
from dataclasses import dataclass
from pathlib import Path
from concurrent.futures import ProcessPoolExecutor, as_completed
from typing import Callable, List, Tuple

from backend.utils.files import ensure_dir, safe_name


# Vector utils 
def v_add(a, b): return (a[0]+b[0], a[1]+b[1], a[2]+b[2])
def v_sub(a, b): return (a[0]-b[0], a[1]-b[1], a[2]-b[2])
def v_mul(a, t): return (a[0]*t, a[1]*t, a[2]*t)
def v_dot(a, b): return a[0]*b[0] + a[1]*b[1] + a[2]*b[2]
def v_len(a): return math.sqrt(v_dot(a, a))
def v_unit(a):
    L = v_len(a) or 1.0
    return (a[0]/L, a[1]/L, a[2]/L)

def clamp(x, lo=0.0, hi=0.999):
    return lo if x < lo else hi if x > hi else x

def random_in_unit_sphere(rng: random.Random):
    while True:
        p = (rng.uniform(-1,1), rng.uniform(-1,1), rng.uniform(-1,1))
        if v_dot(p, p) < 1:
            return p

# Ray/sphere
@dataclass
class Sphere:
    center: Tuple[float,float,float]
    radius: float
    albedo: Tuple[float,float,float]

@dataclass
class Hit:
    t: float
    p: Tuple[float,float,float]
    normal: Tuple[float,float,float]
    albedo: Tuple[float,float,float]

def hit_sphere(ray_o, ray_d, sphere: Sphere, t_min=0.001, t_max=1e9):
    oc = v_sub(ray_o, sphere.center)
    a = v_dot(ray_d, ray_d)
    b = v_dot(oc, ray_d)
    c = v_dot(oc, oc) - sphere.radius*sphere.radius
    disc = b*b - a*c
    if disc < 0:
        return None
    sqrtd = math.sqrt(disc)
    root = (-b - sqrtd) / a
    if root < t_min or root > t_max:
        root = (-b + sqrtd) / a
        if root < t_min or root > t_max:
            return None
    p = v_add(ray_o, v_mul(ray_d, root))
    n = v_mul(v_sub(p, sphere.center), 1.0/sphere.radius)
    return Hit(t=root, p=p, normal=n, albedo=sphere.albedo)

def hit_ground_plane(ray_o, ray_d, y0: float, albedo, t_min=0.001, t_max=1e9):
    # plano y = y0
    if abs(ray_d[1]) < 1e-8:
        return None
    t = (y0 - ray_o[1]) / ray_d[1]
    if t < t_min or t > t_max:
        return None
    p = v_add(ray_o, v_mul(ray_d, t))
    n = (0.0, 1.0 if ray_d[1] < 0 else -1.0, 0.0)
    return Hit(t=t, p=p, normal=n, albedo=tuple(albedo))

def ray_color(ray_o, ray_d, spheres: List[Sphere], ground_y: float, ground_albedo, depth: int, rng: random.Random):
    if depth <= 0:
        return (0.0, 0.0, 0.0)

    closest = None
    closest_t = 1e9

    # spheres
    for s in spheres:
        h = hit_sphere(ray_o, ray_d, s, t_max=closest_t)
        if h and h.t < closest_t:
            closest_t = h.t
            closest = h

    # ground
    hg = hit_ground_plane(ray_o, ray_d, ground_y, ground_albedo, t_max=closest_t)
    if hg and hg.t < closest_t:
        closest = hg
        closest_t = hg.t

    if closest:
        target = v_add(closest.p, v_add(closest.normal, random_in_unit_sphere(rng)))
        new_d = v_unit(v_sub(target, closest.p))
        atten = closest.albedo
        col = ray_color(closest.p, new_d, spheres, ground_y, ground_albedo, depth-1, rng)
        return (atten[0]*col[0], atten[1]*col[1], atten[2]*col[2])

    # background gradient
    u = v_unit(ray_d)
    t = 0.5*(u[1] + 1.0)
    return (
        (1.0-t)*1.0 + t*0.5,
        (1.0-t)*1.0 + t*0.7,
        (1.0-t)*1.0 + t*1.0
    )

def build_camera(scene):
    cam = scene["camera"]
    origin = tuple(cam["origin"])
    look_at = tuple(cam["look_at"])
    fov = cam.get("fov_degrees", 45)

    aspect = scene["width"]/scene["height"]
    theta = math.radians(fov)
    h = math.tan(theta/2)
    viewport_h = 2.0*h
    viewport_w = aspect*viewport_h

    w = v_unit(v_sub(origin, look_at))
    # up fijo
    up = (0.0, 1.0, 0.0)
    # u = up x w
    u = v_unit((
        up[1]*w[2] - up[2]*w[1],
        up[2]*w[0] - up[0]*w[2],
        up[0]*w[1] - up[1]*w[0],
    ))
    # v = w x u
    v = (
        w[1]*u[2] - w[2]*u[1],
        w[2]*u[0] - w[0]*u[2],
        w[0]*u[1] - w[1]*u[0],
    )

    horiz = v_mul(u, viewport_w)
    vert  = v_mul(v, viewport_h)
    llc = v_sub(v_sub(v_sub(origin, v_mul(horiz, 0.5)), v_mul(vert, 0.5)), w)

    return origin, llc, horiz, vert

def _render_row(y: int, scene: dict, seed: int) -> Tuple[int, bytes]:
    rng = random.Random(seed + y*1337)

    w = scene["width"]
    h = scene["height"]
    spp = scene.get("samples_per_pixel", 10)
    max_depth = scene.get("max_depth", 4)

    spheres = [Sphere(tuple(s["center"]), float(s["radius"]), tuple(s["albedo"])) for s in scene["world"]["spheres"]]
    ground_y = float(scene["world"]["ground"]["y"])
    ground_albedo = scene["world"]["ground"]["albedo"]

    origin, llc, horiz, vert = build_camera(scene)

    row = bytearray()
    for x in range(w):
        col = (0.0,0.0,0.0)
        for _ in range(spp):
            u = (x + rng.random())/(w-1)
            v = ((h-1-y) + rng.random())/(h-1)  # flip
            dir_ = v_unit(v_sub(v_add(v_add(llc, v_mul(horiz, u)), v_mul(vert, v)), origin))
            c = ray_color(origin, dir_, spheres, ground_y, ground_albedo, max_depth, rng)
            col = (col[0]+c[0], col[1]+c[1], col[2]+c[2])
        scale = 1.0/spp
        r = math.sqrt(col[0]*scale)
        g = math.sqrt(col[1]*scale)
        b = math.sqrt(col[2]*scale)
        ir = int(256*clamp(r))
        ig = int(256*clamp(g))
        ib = int(256*clamp(b))
        row += bytes([ir, ig, ib])
    return y, bytes(row)

def render_pathtracer_ppm(
    scene: dict,
    out_dir: Path,
    workers: int = 0,
    on_progress: Callable[[int,str], None] = lambda pct, msg: None
) -> Tuple[str, bytes]:
    """
    Renderiza a PPM binario (P6) y devuelve (filename, file_bytes).
    Paraleliza por filas con ProcessPoolExecutor => multinúcleo real.
    """
    ensure_dir(out_dir)

    w = int(scene["width"])
    h = int(scene["height"])

    workers = workers or (os.cpu_count() or 2)

    # header PPM
    header = f"P6\n{w} {h}\n255\n".encode("ascii")
    rows = [None]*h

    on_progress(0, f"Starting render {w}x{h} with {workers} processes…")

    with ProcessPoolExecutor(max_workers=workers) as ex:
        futs = []
        base_seed = int.from_bytes(os.urandom(4), "little")
        for y in range(h):
            futs.append(ex.submit(_render_row, y, scene, base_seed))

        done = 0
        for f in as_completed(futs):
            y, row = f.result()
            rows[y] = row
            done += 1
            pct = int(done*100/h)
            if done % max(1, h//20) == 0 or done == h:
                on_progress(pct, f"Rendered rows: {done}/{h}")

    body = b"".join(rows)
    file_bytes = header + body

    filename = safe_name(f"render_{w}x{h}.ppm")
    out_path = out_dir / filename
    out_path.write_bytes(file_bytes)

    on_progress(100, f"Render done: {filename}")
    return filename, file_bytes

def b64(data: bytes) -> str:
    return base64.b64encode(data).decode("ascii")

