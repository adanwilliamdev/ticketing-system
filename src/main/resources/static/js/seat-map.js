(function () {
  'use strict';

  var form = document.getElementById('seat-form');
  if (!form) return;

  var label = document.getElementById('selected-seat-label');
  var seatsUrl = form.getAttribute('data-seats-url');

  function selectedSeat() {
    var checked = form.querySelector('input[name="seatNumber"]:checked');
    return checked ? checked.value : '';
  }

  function updateLabel() {
    if (label) label.textContent = selectedSeat();
  }

  form.addEventListener('change', updateLabel);
  form.addEventListener('reset', function () { setTimeout(updateLabel, 0); });
  updateLabel();

  // Evita envio duplo do formulário de reserva.
  form.addEventListener('submit', function () {
    var button = form.querySelector('button[type="submit"]');
    if (button) { button.disabled = true; button.textContent = 'Reservando...'; }
  });

  // Mantém o mapa atualizado (a cada 15s), refletindo reservas e vendas de outras pessoas.
  function refresh() {
    if (!seatsUrl || document.hidden) return;
    fetch(seatsUrl, { headers: { Accept: 'application/json' } })
      .then(function (response) { return response.ok ? response.json() : null; })
      .then(function (seats) {
        if (!seats) return;
        seats.forEach(function (seat) {
          var input = form.querySelector('input[data-seat="' + seat.seatNumber.replace(/"/g, '\\"') + '"]');
          if (!input) return;
          var available = seat.status === 'AVAILABLE';
          input.disabled = !available;
          if (!available && input.checked) input.checked = false;
          input.nextElementSibling.className = 'seat-face seat-' + seat.status.toLowerCase();
        });
        updateLabel();
      })
      .catch(function () { /* mantém o estado atual até a próxima tentativa */ });
  }

  setInterval(refresh, 15000);
})();
