import asyncio
import json
import websockets

from backend.config import HOST, PORT, RENDERS_DIR, ZIPS_DIR, DEFAULT_WORKERS
from backend.jobs.job_manager import JobManager
from backend.utils.files import ensure_dir
from backend.utils.log import log
from backend.engines.pathtracer.tracer import render_pathtracer_ppm, b64 as b64_render
from backend.engines.zip_multicore.zipper import zip_outputs, b64 as b64_zip


jm = JobManager()

async def send(ws, obj):
    await ws.send(json.dumps(obj))

def make_progress_sender(loop, ws, job_id: str):
    """
    Devuelve un callback seguro para llamar desde threads:
    on_progress(pct, msg) -> envía por WS usando el loop principal.
    """
    def on_progress(pct, msg):
        fut = asyncio.run_coroutine_threadsafe(
            send(ws, {"type": "progress", "job_id": job_id, "pct": pct, "msg": msg}),
            loop
        )
        try:
            fut.result(timeout=0)
        except Exception:
            pass
    return on_progress

async def handle_render(ws, payload):
    scene = payload.get("scene")
    if not isinstance(scene, dict):
        raise ValueError("scene must be an object")

    job = jm.create("render", meta={"scene": {"width": scene.get("width"), "height": scene.get("height")}})
    await send(ws, {"type": "job", "job_id": job.job_id, "status": "queued"})

    jm.set_status(job.job_id, "running")
    await send(ws, {"type": "job", "job_id": job.job_id, "status": "running"})

    loop = asyncio.get_running_loop()
    on_progress = make_progress_sender(loop, ws, job.job_id)

    try:
        filename, data = await asyncio.to_thread(
            render_pathtracer_ppm,
            scene,
            RENDERS_DIR,
            DEFAULT_WORKERS,
            on_progress
        )
        jm.set_status(job.job_id, "done")
        await send(ws, {"type": "job", "job_id": job.job_id, "status": "done"})
        await send(ws, {
            "type": "result",
            "job_id": job.job_id,
            "kind": "render",
            "filename": filename,
            "data_b64": b64_render(data)
        })
    except Exception as e:
        jm.set_status(job.job_id, "error", str(e))
        await send(ws, {"type": "job", "job_id": job.job_id, "status": "error"})
        await send(ws, {"type": "error", "job_id": job.job_id, "error": str(e)})

async def handle_zip(ws):
    job = jm.create("zip_outputs")
    await send(ws, {"type": "job", "job_id": job.job_id, "status": "queued"})

    jm.set_status(job.job_id, "running")
    await send(ws, {"type": "job", "job_id": job.job_id, "status": "running"})

    loop = asyncio.get_running_loop()
    on_progress = make_progress_sender(loop, ws, job.job_id)

    try:
        filename, data = await asyncio.to_thread(
            zip_outputs,
            RENDERS_DIR,
            ZIPS_DIR,
            DEFAULT_WORKERS,
            on_progress
        )
        jm.set_status(job.job_id, "done")
        await send(ws, {"type": "job", "job_id": job.job_id, "status": "done"})
        await send(ws, {
            "type": "result",
            "job_id": job.job_id,
            "kind": "zip",
            "filename": filename,
            "data_b64": b64_zip(data)
        })
    except Exception as e:
        jm.set_status(job.job_id, "error", str(e))
        await send(ws, {"type": "job", "job_id": job.job_id, "status": "error"})
        await send(ws, {"type": "error", "job_id": job.job_id, "error": str(e)})

async def handler(ws):
    await send(ws, {"type": "hello", "server": "multinucleo", "ws": f"ws://{HOST}:{PORT}"})
    async for msg in ws:
        try:
            data = json.loads(msg)
        except json.JSONDecodeError:
            await send(ws, {"type": "error", "error": "invalid_json"})
            continue

        action = data.get("action")
        if action == "render":
            await handle_render(ws, data)
        elif action == "zip_outputs":
            await handle_zip(ws)
        elif action == "ping":
            await send(ws, {"type": "pong"})
        else:
            await send(ws, {"type": "error", "error": f"unknown_action: {action}"})

async def main():
    ensure_dir(RENDERS_DIR)
    ensure_dir(ZIPS_DIR)
    log(f"WebSocket server on ws://{HOST}:{PORT}")
    async with websockets.serve(handler, HOST, PORT):
        await asyncio.Future()

if __name__ == "__main__":
    asyncio.run(main())

