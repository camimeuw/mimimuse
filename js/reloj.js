// Contador de visitas: un dígito por casillero (el número sale de data/config.js)
document.querySelector('#visitas').innerHTML = String(VISITAS).padStart(6, '0').split('').map((d) => `<i>${d}</i>`).join('');
