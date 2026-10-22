package com.ticketing.web;

import java.util.Map;

/**
 * Mensagens de erro da API (em inglês, ver exceções de domínio) traduzidas para exibição nas páginas.
 * Comparação exata de texto: simples e suficiente para o conjunto fechado de erros do sistema.
 */
public final class ErrorMessages {

    private static final Map<String, String> KNOWN = Map.ofEntries(
            Map.entry("Event not found", "Evento não encontrado."),
            Map.entry("Seat not found", "Assento não encontrado."),
            Map.entry("Reservation not found", "Reserva não encontrada."),
            Map.entry("Payment not found", "Pagamento não encontrado."),
            Map.entry("No tickets available for this event", "Não há mais ingressos disponíveis para este evento."),
            Map.entry("Seat is not available", "Este assento não está mais disponível."),
            Map.entry("Seat already has an active reservation", "Este assento já tem uma reserva ativa."),
            Map.entry("Could not acquire lock for seat reservation",
                    "Muita gente tentando reservar esse assento agora. Tente de novo."),
            Map.entry("Reservation is not active", "Esta reserva não está mais ativa."),
            Map.entry("Reservation has expired", "Esta reserva expirou."),
            Map.entry("Invalid or expired reservation", "Reserva inválida ou expirada."),
            Map.entry("Could not acquire lock for reservation",
                    "Não foi possível processar agora. Tente novamente em instantes."),
            Map.entry("Could not acquire lock for payment processing",
                    "Não foi possível processar o pagamento agora. Tente novamente."),
            Map.entry("Payment already processed", "Este pagamento já foi processado."),
            Map.entry("Reservation is no longer active", "A reserva não está mais ativa."));

    private ErrorMessages() {
    }

    public static String translate(String message) {
        if (message == null) {
            return "Tente novamente.";
        }
        String known = KNOWN.get(message);
        if (known != null) {
            return known;
        }
        if (message.startsWith("Payment processing failed:")) {
            return "O pagamento foi recusado pela operadora. Tente novamente ou use outro método.";
        }
        return message;
    }
}
