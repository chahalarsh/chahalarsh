

const workBoxes = document.querySelectorAll('.work-box');





workBoxes.forEach(workBox => {
    workBox.addEventListener('mouseover', () => {
        workBoxes.forEach(p => p.classList.remove('is-open'));
        workBox.classList.add('is-open');
    });

});



(function () {
  const API_BASE = "/api/leetcode-solved";

  async function loadStats(username, container) {
    container.innerHTML = `<div class="state">Loading stats…</div>`;
    try {
      const res = await fetch(`${API_BASE}?username=${encodeURIComponent(username)}`);
      if (!res.ok) throw new Error(`API responded ${res.status}`);
      const data = await res.json();
      render(data, username, container);
    } catch (err) {
      container.innerHTML = `<div class="state error">Couldn't load stats for "${username}". ${err.message}</div>`;
    }
  }


  function render(data, username, container) {
    const { solvedProblem } = data;

    container.innerHTML = `
      <div class="total">${solvedProblem}</div>
      <div class="total-label">problems solved on leetcode</div>
      
    `;
  }

  document.querySelectorAll("#lc-card, .lc-card").forEach(el => {
    const username = el.dataset.username;
    if (username) loadStats(username, el);
  });

  window.LeetCodeWidget = { load: loadStats };


})();



const triggerDiv = document.querySelector('#office3');
const macImmersionEle = document.querySelector('#macImmersion');
const header = document.querySelector('header');

window.addEventListener('scroll', () => {
  const triggerPosition = triggerDiv.offsetTop + 100;

  if (window.scrollY > triggerPosition) {
    macImmersionEle.classList.add('visible');
    header.classList.add('visible');
  } else {
    macImmersionEle.classList.remove('visible');
    header.classList.remove('visible');
  }
});

