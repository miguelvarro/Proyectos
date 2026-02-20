(function(){
  document.addEventListener("DOMContentLoaded", () => {
    const favTitle = document.getElementById("favTitle");
    if (favTitle && !favTitle.textContent.trim()) favTitle.textContent = "Favoritos";
  });
})();
const btnTheme = document.getElementById("btnTheme");

btnTheme?.addEventListener("click", () => {
  document.body.classList.toggle("energy");
});

