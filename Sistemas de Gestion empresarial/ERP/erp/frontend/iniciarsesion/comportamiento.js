document.querySelector("button").onclick = function(){
  let usuario = document.querySelector("#usuario").value;
  let contrasena = document.querySelector("#contrasena").value;

  let objeto = { usuario, contrasena };

  fetch("../../backend/iniciarsesion.php", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(objeto)
  })
  .then(res => res.json())
  .then(result => {
    if (result.success) {
      window.location = "../escritorio/index.html";
    } else {
      document.querySelector("#estado").textContent = "Error de inicio de sesión";
    }
  })
  .catch(error => console.error(error));
}

