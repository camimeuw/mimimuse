const $ = (s) => document.querySelector(s);
const audio = $('#audio'), caja = $('#caja'), seek = $('#seek'), vol = $('#vol');
const play = $('#play'), prev = $('#prev'), next = $('#next'), mute = $('#mute');
const KEY = 'mimi-player'; // recuerda canción, minuto y volumen al cambiar de página
let i = 0;

const fmt = (s) => (isFinite(s) ? `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}` : '0:00');
const fill = (el) => el.style.setProperty('--p', `${(el.value / el.max) * 100}%`);
const save = () => { try { sessionStorage.setItem(KEY, JSON.stringify({ i, t: audio.currentTime, v: audio.volume, m: audio.muted, on: !audio.paused })); } catch {} };

function load(n, autoplay, at = 0) {
  i = (n + SONGS.length) % SONGS.length;
  audio.src = SONGS[i].src;
  $('#cancion').textContent = SONGS[i].titulo;
  $('#artista').textContent = SONGS[i].artista || 'Mimi Muse';
  if (at) audio.addEventListener('loadedmetadata', () => { audio.currentTime = at; }, { once: true });
  if (autoplay) audio.play().catch(() => {}); // el navegador puede bloquear el autoplay: queda en pausa
}

function tick() {
  $('#tiempo').textContent = `${fmt(audio.currentTime)} / ${fmt(audio.duration)}`;
  seek.value = audio.duration ? (audio.currentTime / audio.duration) * 1000 : 0;
  fill(seek);
}

if (!SONGS.length) {
  [play, prev, next, mute, seek, vol].forEach((el) => { el.disabled = true; });
} else {
  let saved = {};
  try { saved = JSON.parse(sessionStorage.getItem(KEY)) || {}; } catch {}
  audio.volume = saved.v ?? 1; audio.muted = !!saved.m;
  vol.value = audio.volume; fill(vol); mute.setAttribute('aria-pressed', audio.muted);
  load(saved.i < SONGS.length ? saved.i || 0 : 0, saved.on, saved.t);

  play.addEventListener('click', () => (audio.paused ? audio.play().catch(() => {}) : audio.pause()));
  next.addEventListener('click', () => load(i + 1, !audio.paused));
  prev.addEventListener('click', () => (audio.currentTime > 3 ? (audio.currentTime = 0) : load(i - 1, !audio.paused)));
  seek.addEventListener('input', () => { if (audio.duration) audio.currentTime = (seek.value / 1000) * audio.duration; fill(seek); });
  vol.addEventListener('input', () => { audio.volume = vol.value; audio.muted = false; mute.setAttribute('aria-pressed', 'false'); fill(vol); save(); });
  mute.addEventListener('click', () => { audio.muted = !audio.muted; mute.setAttribute('aria-pressed', audio.muted); save(); });

  audio.addEventListener('play', () => { play.setAttribute('aria-pressed', 'true'); caja.classList.add('activo'); });
  audio.addEventListener('pause', () => { play.setAttribute('aria-pressed', 'false'); caja.classList.remove('activo'); });
  audio.addEventListener('ended', () => load(i + 1, true));
  audio.addEventListener('loadedmetadata', tick);
  audio.addEventListener('timeupdate', () => { tick(); save(); });
  audio.addEventListener('error', () => { $('#cancion').textContent = 'No se pudo cargar la canción'; });
}
