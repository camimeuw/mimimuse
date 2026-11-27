const audio = document.querySelector('#audio');
const play = document.querySelector('.play');
const seek = document.querySelector('.seek');
const song = document.querySelector('.song');

play.addEventListener('click', () => {
  if (audio.paused) audio.play().catch(() => { song.textContent = 'falta cargar la canción'; });
  else audio.pause();
});
audio.addEventListener('play', () => play.setAttribute('aria-pressed', 'true'));
audio.addEventListener('pause', () => play.setAttribute('aria-pressed', 'false'));
audio.addEventListener('timeupdate', () => { if (audio.duration) seek.value = (audio.currentTime / audio.duration) * 100; });
seek.addEventListener('input', () => { if (audio.duration) audio.currentTime = (seek.value / 100) * audio.duration; });
audio.addEventListener('error', () => { song.textContent = 'falta cargar la canción'; });
