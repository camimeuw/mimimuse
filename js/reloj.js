const reloj = document.querySelector('#reloj');
const hora = new Intl.DateTimeFormat('es-PE', { timeZone: 'America/Lima', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' });
const tic = () => { reloj.textContent = hora.format(new Date()); };
tic();
setInterval(tic, 1000);

// Contador de visitas: un dígito por casillero (el número sale de data/config.js)
document.querySelector('#visitas').innerHTML = String(VISITAS).padStart(6, '0').split('').map((d) => `<i>${d}</i>`).join('');
