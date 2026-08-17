const btn = document.getElementById('fullscreen-btn');

btn.addEventListener('click', () => {
    // Check if the document is already in full screen mode
    if (!document.fullscreenElement) {
        // Request full screen for the entire page
        document.documentElement.requestFullscreen()
            .catch((err) => {
                console.error(`Error enabling fullscreen: ${err.message}`);
            });
    } else {
        // Exit full screen mode
        document.exitFullscreen();
    }
});


const workBoxes = document.querySelectorAll('.work-box');

workBoxes.forEach(workBox => {
    workBox.addEventListener('mouseover', () => {
        workBoxes.forEach(p => p.classList.remove('is-open'));
        workBox.classList.add('is-open');
    });

});

