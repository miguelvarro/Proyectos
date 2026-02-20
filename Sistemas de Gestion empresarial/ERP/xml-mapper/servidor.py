from flask import Flask, request
from mifuncion import miInterfaz

app = Flask(__name__)

def page(content, extra=""):
    return f"""
    <!doctype html>
    <html lang="es">
    <head>
      <meta charset="utf-8">
      <title>XML → HTML</title>
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <style>
        :root {{
          --bg: #0b0f19;
          --panel: #121826;
          --card: #0f172a;
          --text: #e6edf7;
          --muted: rgba(230,237,247,.75);
          --border: rgba(255,255,255,.12);
          --accent: #ff8a00;
          --accent2: #ffb000;
        }}
        *{{ box-sizing:border-box; }}
        body {{
          margin:0;
          font-family: ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial;
          background: radial-gradient(1100px 600px at 12% 10%, rgba(255,138,0,.18), transparent 55%),
                      radial-gradient(900px 450px at 90% 0%, rgba(255,176,0,.14), transparent 55%),
                      var(--bg);
          color: var(--text);
        }}
        .wrap {{ max-width: 920px; margin: 26px auto; padding: 16px; }}
        .top {{
          display:flex; justify-content:space-between; align-items:center; gap:12px;
          margin-bottom: 14px;
        }}
        .brand {{
          font-weight: 900; letter-spacing:.4px; font-size: 20px;
        }}
        .badge {{
          font-size: 12px; padding: 6px 10px; border-radius: 999px;
          border: 1px solid var(--border); color: var(--muted);
          background: rgba(255,255,255,.04);
        }}
        .card {{
          background: rgba(255,255,255,.05);
          border: 1px solid var(--border);
          border-radius: 16px;
          padding: 16px;
          box-shadow: 0 18px 45px rgba(0,0,0,.35);
        }}
        form {{ display:grid; gap:10px; margin-top: 10px; }}
        label {{ font-size: 13px; color: var(--muted); }}
        input, textarea {{
          width:100%;
          padding: 12px 12px;
          border-radius: 12px;
          border: 1px solid var(--border);
          background: rgba(0,0,0,.18);
          color: var(--text);
          outline:none;
        }}
        textarea {{ min-height: 110px; resize: vertical; }}
        input:focus, textarea:focus {{
          border-color: rgba(255,138,0,.6);
          box-shadow: 0 0 0 4px rgba(255,138,0,.14);
        }}
        .row {{ display:flex; gap:10px; flex-wrap: wrap; }}
        .btn {{
          border:0;
          background: linear-gradient(135deg, var(--accent), var(--accent2));
          color: #111;
          font-weight: 800;
          padding: 12px 14px;
          border-radius: 12px;
          cursor: pointer;
        }}
        .btn:hover {{ filter: brightness(1.03); }}
        .result {{
          margin-top: 14px;
          padding: 12px;
          border-radius: 14px;
          border: 1px solid var(--border);
          background: rgba(0,0,0,.22);
          color: var(--text);
          white-space: pre-wrap;
          font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
          font-size: 13px;
        }}
      </style>
    </head>
    <body>
      <div class="wrap">
        <div class="top">
          <div class="brand">XML Mapper</div>
          <div class="badge">Flask · XML → Formulario</div>
        </div>

        <div class="card">
          <h2 style="margin:0 0 6px">Formulario generado desde XML</h2>
          <div style="color:var(--muted); font-size:13px">
            Rellena y pulsa “Enviar” para ver los datos recibidos.
          </div>

          {content}
          {extra}
        </div>
      </div>
    </body>
    </html>
    """

@app.route("/", methods=["GET", "POST"])
def home():
    if request.method == "POST":
        # recoge y muestra datos
        data = dict(request.form)
        extra = f"<div class='result'>{data}</div>"
    else:
        extra = ""

    form_fields = miInterfaz("interfaz.xml")
    form = f"""
      <form method="POST">
        {form_fields}
        <div class="row">
          <button class="btn" type="submit">Enviar</button>
          <button class="btn" type="reset" style="background:rgba(255,255,255,.08); color:var(--text); border:1px solid var(--border);">
            Limpiar
          </button>
        </div>
      </form>
    """
    return page(form, extra)

@app.get("/favicon.ico")
def favicon():
    return ("", 204)

if __name__ == "__main__":
    app.run(debug=True)

