export function renderPlaceholder(root, title, desc, note) {
  root.innerHTML = `
    <p class="brand">Tomorrow starts tonight.</p>
    <div class="card placeholder">
      <h2></h2>
      <p class="muted desc"></p>
      <p class="muted note" style="margin-top:12px"></p>
    </div>`;
  root.querySelector("h2").textContent = title;
  root.querySelector(".desc").textContent = desc;
  root.querySelector(".note").textContent = note;
}
