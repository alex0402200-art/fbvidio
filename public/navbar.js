// navbar.js — dipakai di semua halaman

function initNavbar() {
  const toggle = document.getElementById('menuToggle');
  const menu = document.getElementById('dropdownMenu');
  if (toggle && menu) {
    toggle.addEventListener('click', () => {
      menu.classList.toggle('show');
    });
  }

  const authArea = document.getElementById('authArea');
  if (authArea) {
    fetch('/api/me')
      .then((r) => r.json())
      .then((data) => {
        if (data.loggedIn) {
          authArea.innerHTML =
            '<span class="user-chip">👤 ' + data.username + '</span> ' +
            '<button id="logoutBtn" class="link-btn">Logout</button>';
          document.getElementById('logoutBtn').addEventListener('click', async () => {
            await fetch('/api/logout', { method: 'POST' });
            location.href = '/';
          });
        } else {
          authArea.innerHTML = '<a href="/login.html" class="create-akun-btn">👤 Create Akun</a>';
        }
      })
      .catch(() => {});
  }
}

// Proteksi halaman yang butuh login
function requireLogin() {
  fetch('/api/me')
    .then((r) => r.json())
    .then((data) => {
      if (!data.loggedIn) {
        location.href = '/login.html';
      }
    })
    .catch(() => {
      location.href = '/login.html';
    });
}

document.addEventListener('DOMContentLoaded', initNavbar);
