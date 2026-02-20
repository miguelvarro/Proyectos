import xml.etree.ElementTree as ET

def miInterfaz(destino):
    tree = ET.parse(destino)
    root = tree.getroot()

    html = ""
    for campo in root:
        nombre = campo.get("nombre", "campo")
        label = nombre.capitalize()

        if campo.tag == "campotexto":
            html += f"""
              <label>{label}</label>
              <input type="text" name="{nombre}" placeholder="{label}" required>
            """
        elif campo.tag == "areadetexto":
            html += f"""
              <label>{label}</label>
              <textarea name="{nombre}" placeholder="{label}" required></textarea>
            """
    return html

