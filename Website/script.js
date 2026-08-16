
const workBoxes = document.querySelectorAll('.work-box');

workBoxes.forEach(workBox => {
  workBox.addEventListener('mouseover', () => {
    workBoxes.forEach(p => p.classList.remove('is-open'));
    workBox.classList.add('is-open');
  });

});

