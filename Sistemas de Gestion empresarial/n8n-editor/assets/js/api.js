export async function saveWorkflow(payload){
  const res = await fetch("api/save.php", {
    method: "POST",
    headers: { "Content-Type":"application/json" },
    body: JSON.stringify(payload)
  });
  return await res.json();
}

export async function loadWorkflow(){
  const res = await fetch("api/load.php");
  return await res.json();
}

