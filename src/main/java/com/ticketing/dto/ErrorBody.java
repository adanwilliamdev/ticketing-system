package com.ticketing.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import java.util.Map;

@JsonInclude(JsonInclude.Include.NON_NULL)
public record ErrorBody(String timestamp, int status, String error, String message, Map<String, String> details) {
}
