package com.ticketing.domain;

/** Categorias exibidas nos chips de filtro da listagem. */
public enum EventCategory {
    MUSICA("Música"),
    TECH("Tecnologia"),
    TEATRO("Teatro & Arte"),
    OUTROS("Outros");

    private final String label;

    EventCategory(String label) {
        this.label = label;
    }

    public String getLabel() {
        return label;
    }
}