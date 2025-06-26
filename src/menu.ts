const sideMenu = document.getElementById('sideMenu');
const menuToggleBtn = document.getElementById('menuToggleBtn');

if (sideMenu && menuToggleBtn) {
  menuToggleBtn.addEventListener('click', () => {
    sideMenu.classList.toggle('collapsed');
  });
}