(function () {
  const BUG_SIZE = 40;
  const EDGE_PADDING = 20;
  const APPEAR_DELAY = 10000;

  const STEP_MIN_DIST = 90;
  const STEP_MAX_DIST = 180;
  const SPEED_MIN = 18;
  const SPEED_MAX = 26;
  const PAUSE_MIN = 0;
  const PAUSE_MAX = 120;
  const TURN_MAX = 50;
  const FIRST_TURN_MAX = 10;
  // The artwork's front faces "up" (toward the top of the image), so a
  // heading of 0 (pointing right, screen coords) needs a +90deg rotation
  // to bring that front edge in line with the direction of travel.
  const FRONT_OFFSET = 90;

  function randomBetween(min, max) {
    return Math.random() * (max - min) + min;
  }

  function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
  }

  function createBug(startX, startY) {
    const bug = document.createElement('img');
    bug.src = 'images/insect.png';
    bug.alt = 'A small insect';
    bug.className = 'wandering-insect';
    // Position off-screen before the element ever enters the DOM, so
    // there is no frame where it could paint at a default on-screen spot.
    bug.style.left = startX + 'px';
    bug.style.top = startY + 'px';
    bug.style.transform = 'rotate(' + FRONT_OFFSET + 'deg)';
    document.body.appendChild(bug);
    // Force the browser to commit this starting position before any later
    // style change, otherwise the first transition has no "from" value to
    // animate from and just jumps straight to its destination.
    void bug.offsetWidth;
    return bug;
  }

  function showPopup() {
    if (document.querySelector('.insect-popup-overlay')) return;

    const overlay = document.createElement('div');
    overlay.className = 'insect-popup-overlay';

    const box = document.createElement('div');
    box.className = 'insect-popup';
    box.innerHTML =
      '<div class="insect-popup-close">✕</div>' +
      '<p>One of my interests is entomology.</p>' +
      '<p>I love insects and have been collecting and studying specimens for years.</p>';

    overlay.appendChild(box);
    document.body.appendChild(overlay);

    function close() {
      overlay.remove();
    }
    overlay.addEventListener('click', close);
    box.addEventListener('click', function (e) { e.stopPropagation(); });
    box.querySelector('.insect-popup-close').addEventListener('click', close);
  }

  function startWandering(bug, startX, startY) {
    let x = startX;
    let y = startY;
    let heading = 0; // degrees; 0 = facing right, the bug's natural forward direction
    let first = true;

    function step() {
      const minX = EDGE_PADDING;
      const maxX = window.innerWidth - BUG_SIZE - EDGE_PADDING;
      const minY = EDGE_PADDING;
      const maxY = window.innerHeight - BUG_SIZE - EDGE_PADDING;

      // Gentle turn only - never a sharp snap to a new heading.
      const turnLimit = first ? FIRST_TURN_MAX : TURN_MAX;
      heading += randomBetween(-turnLimit, turnLimit);

      const dist = randomBetween(STEP_MIN_DIST, STEP_MAX_DIST);
      let rad = (heading * Math.PI) / 180;
      let nextX = x + Math.cos(rad) * dist;
      let nextY = y + Math.sin(rad) * dist;

      // Steer gently away from walls instead of snapping to a reflection.
      if (nextX < minX || nextX > maxX) {
        heading = 180 - heading;
      }
      if (nextY < minY || nextY > maxY) {
        heading = -heading;
      }
      rad = (heading * Math.PI) / 180;
      nextX = clamp(x + Math.cos(rad) * dist, minX, maxX);
      nextY = clamp(y + Math.sin(rad) * dist, minY, maxY);

      const legDistance = Math.hypot(nextX - x, nextY - y);
      const speed = randomBetween(SPEED_MIN, SPEED_MAX);
      const duration = Math.max(1.5, legDistance / speed);

      bug.style.transition =
        'left ' + duration + 's ease-in-out, top ' + duration + 's ease-in-out, transform ' + duration + 's ease-in-out';
      bug.style.transform = 'rotate(' + (heading + FRONT_OFFSET) + 'deg)';
      bug.style.left = nextX + 'px';
      bug.style.top = nextY + 'px';

      x = nextX;
      y = nextY;
      first = false;

      const pause = randomBetween(PAUSE_MIN, PAUSE_MAX);
      setTimeout(step, duration * 1000 + pause);
    }

    requestAnimationFrame(function () {
      step();
    });
  }

  window.addEventListener('load', function () {
    setTimeout(function () {
      const startX = -BUG_SIZE;
      const startY = randomBetween(EDGE_PADDING, window.innerHeight - EDGE_PADDING - BUG_SIZE);
      const bug = createBug(startX, startY);
      bug.addEventListener('click', showPopup);
      if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        // No wandering for visitors who ask for less motion: park the bug in a corner instead.
        bug.style.left = (window.innerWidth - BUG_SIZE - EDGE_PADDING) + 'px';
        bug.style.top = (window.innerHeight - BUG_SIZE - EDGE_PADDING) + 'px';
        return;
      }
      startWandering(bug, startX, startY);
    }, APPEAR_DELAY);
  });
})();
