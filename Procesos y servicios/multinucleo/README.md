# Proyecto Multinúcleo: Distributed Rendering & Compression Server

Este proyecto integra:
- Programación multihilo (demo)
- Programación concurrente (job manager + WebSocket)
- Web Workers en JavaScript (UI no bloqueante)
- Comunicación en red con WebSockets (cliente/servidor)
- Compresor ZIP multinúcleo (pipeline paralelo)
- Path tracer CPU (render por filas en paralelo)
- Demo OpenMP (C) independiente

## Requisitos
- Python 3.10+
- pip
- Navegador moderno

## Instalación backend
cd backend
python -m venv .venv
# Windows: .venv\Scripts\activate
# Linux/Mac: source .venv/bin/activate
pip install -r requirements.txt

## Ejecutar backend
python server.py

## Ejecutar frontend
Abre `frontend/index.html` en el navegador.

## Uso
1) Pulsa "Conectar"
2) Pulsa "Render (Path Tracer)"
3) Verás progreso y al final podrás descargar el resultado
4) Pulsa "ZIP outputs" para generar un zip de los renders

## Demos
- OpenMP: `demos/openmp_demo`
- Multihilo Python: `demos/threading_demo`

## Estructura
- backend/: servidor websocket + motores (pathtracer, zip)
- frontend/: interfaz web + worker
- docs/: memoria técnica/capturas

