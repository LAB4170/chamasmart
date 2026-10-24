package com.chamasmart.backend.util;
import jakarta.persistence.AttributeConverter;
import jakarta.persistence.Converter;

/**
 * Encrypts the national ID at rest (AES-256-GCM, see FieldCrypto). It is NOT auto-applied: the earlier version was
 * applied to every String column in every entity and only Base64-encoded them (finding S-18). Use it with @Convert on
 * the specific fields that need it.
 */
@Converter
public class NationalIdEncryptor implements AttributeConverter<String, String> {
    @Override
    public String convertToDatabaseColumn(String attribute) {
        return FieldCrypto.encrypt(attribute);
    }
    @Override
    public String convertToEntityAttribute(String dbData) {
        return FieldCrypto.decrypt(dbData);
    }
}
