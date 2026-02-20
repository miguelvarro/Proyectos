(function(){
  const screens = document.getElementById("pantallas");

  function setActive(name){
    const all = Array.from(document.querySelectorAll(".screen"));
    all.forEach(s => {
      const sName = s.getAttribute("data-screen");
      s.classList.remove("isActive","isLeft");
      if (sName === name) s.classList.add("isActive");
    });

    const order = ["inicio","favoritos","player","mapa"];
    const idx = order.indexOf(name);
    all.forEach(s => {
      const sName = s.getAttribute("data-screen");
      const sIdx = order.indexOf(sName);
      if (sIdx !== -1 && sIdx < idx) s.classList.add("isLeft");
    });

    screens.dataset.active = name;
    window.dispatchEvent(new CustomEvent("screen:changed", { detail:{ name } }));
  }

  window.Nav = {
    go: setActive,
    current: () => screens.dataset.active || "inicio"
  };

  document.addEventListener("click", (e) => {
    const go = e.target?.closest?.("[data-go]")?.dataset?.go;
    if (go) setActive(go);

    const back = e.target?.closest?.("[data-back]")?.dataset?.back;
    if (back) setActive(back);
  });

  // init
  setActive("inicio");
})();

