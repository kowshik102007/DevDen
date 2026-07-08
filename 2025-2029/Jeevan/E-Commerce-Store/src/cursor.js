document.addEventListener('DOMContentLoaded', () => {
  // Only initialize on non-touch devices to prevent mobile bugs
  if (window.innerWidth <= 768 || 'ontouchstart' in window) return;

  document.body.classList.add('has-custom-cursor');

  const dot = document.createElement('div');
  dot.classList.add('tf-cursor-dot');
  document.body.appendChild(dot);

  const ring = document.createElement('div');
  ring.classList.add('tf-cursor-ring');
  document.body.appendChild(ring);

  let mouseX = window.innerWidth / 2;
  let mouseY = window.innerHeight / 2;
  let ringX = mouseX;
  let ringY = mouseY;

  document.addEventListener('mousemove', (e) => {
    mouseX = e.clientX;
    mouseY = e.clientY;
    
    // Dot follows exactly
    dot.style.transform = `translate3d(${mouseX}px, ${mouseY}px, 0)`;
  });

  // Animation loop for the smooth trailing ring
  function renderCursor() {
    // Lerp for smooth trailing effect
    ringX += (mouseX - ringX) * 0.15;
    ringY += (mouseY - ringY) * 0.15;
    
    ring.style.transform = `translate3d(${ringX}px, ${ringY}px, 0)`;
    requestAnimationFrame(renderCursor);
  }
  requestAnimationFrame(renderCursor);

  // Add hover effect states
  const addHover = () => {
    ring.classList.add('hover');
    dot.classList.add('hover');
  };
  const removeHover = () => {
    ring.classList.remove('hover');
    dot.classList.remove('hover');
  };

  document.body.addEventListener('mouseover', (e) => {
    if (e.target.closest('a, button, input, select, textarea, .dish-card, .gallery-item, .cart-fab')) {
      addHover();
    }
  });
  
  document.body.addEventListener('mouseout', (e) => {
    if (e.target.closest('a, button, input, select, textarea, .dish-card, .gallery-item, .cart-fab')) {
      removeHover();
    }
  });
});
