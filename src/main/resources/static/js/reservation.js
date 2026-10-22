(function () {
  'use strict';

  // Contagem regressiva calculada no navegador a partir de expiresAt (sem repetir chamadas ao servidor).
  var countdown = document.getElementById('countdown');
  var value = document.getElementById('countdown-value');

  if (countdown && value) {
    var expiresAt = new Date(countdown.getAttribute('data-expires-at')).getTime();

    var tick = function () {
      var remaining = Math.max(0, Math.floor((expiresAt - Date.now()) / 1000));
      var minutes = Math.floor(remaining / 60);
      var seconds = remaining % 60;
      value.textContent = minutes + ':' + (seconds < 10 ? '0' : '') + seconds;
      if (remaining <= 60) countdown.classList.add('urgent');
      if (remaining <= 0) {
        clearInterval(timer);
        window.location.reload();
      }
    };

    var timer = setInterval(tick, 1000);
    tick();
  }

  // Evita envio duplo do pagamento; a chave de idempotência do formulário protege o servidor de qualquer forma.
  var form = document.getElementById('payment-form');
  var button = document.getElementById('pay-button');
  if (form && button) {
    form.addEventListener('submit', function () {
      button.disabled = true;
      button.textContent = 'Processando pagamento...';
    });
  }
})();
