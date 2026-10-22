package com.ticketing.service;

import java.security.SecureRandom;
import java.util.Base64;
import org.springframework.stereotype.Component;

/** 32 bytes aleatórios criptograficamente seguros em Base64 URL-safe sem padding (43 caracteres). */
@Component
public class ReservationTokenGenerator {

    private final SecureRandom random = new SecureRandom();

    public String generate() {
        byte[] bytes = new byte[32];
        random.nextBytes(bytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }
}
