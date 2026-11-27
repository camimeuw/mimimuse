// Intro siempre; con "reducir animaciones" va en versión calma (quieta, solo el guiño y un fundido).
// Va en la cabecera y sin demora (sin "defer") para que la intro se prepare antes de que se dibuje la página.
document.documentElement.classList.add('splash-on');
if (matchMedia('(prefers-reduced-motion: reduce)').matches) document.documentElement.classList.add('calma');
