package com.chamasmart.backend.util;
import jakarta.persistence.AttributeConverter;
import jakarta.persistence.Converter;
import java.util.Base64;
/**
 * JPA AttributeConverter that encrypts the national ID before persisting to the database
 * and decrypts it when reading the entity. For demonstration purposes, this uses simple Base64
 * encoding; in production replace with a robust encryption algorithm (e.g., AES with a secret key).
 */
@Converter(autoApply = true)
public class NationalIdEncryptor implements AttributeConverter<String, String> {
    @Override
    public String convertToDatabaseColumn(String attribute) {
        if (attribute == null) return null;
        // Simple Base64 encoding as placeholder for encryption
        return Base64.getEncoder().encodeToString(attribute.getBytes());
    }
    @Override
    public String convertToEntityAttribute(String dbData) {
        if (dbData == null) return null;
        try {
            return new String(Base64.getDecoder().decode(dbData));
        } catch (IllegalArgumentException e) {
            // Fallback for existing plaintext data
            return dbData;
        }
    }
}

