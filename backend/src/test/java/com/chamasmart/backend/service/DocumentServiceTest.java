package com.chamasmart.backend.service;

import org.junit.jupiter.api.Test;
import javax.crypto.Cipher;
import java.nio.charset.StandardCharsets;
import static org.junit.jupiter.api.Assertions.*;

class DocumentServiceTest {
    @Test
    void onlyPdfJpegAndPngAreAcceptedWhateverTheNameSays() {
        assertEquals("application/pdf", DocumentService.sniff("%PDF-1.7 rest".getBytes(StandardCharsets.UTF_8)));
        assertEquals("image/jpeg", DocumentService.sniff(new byte[]{(byte) 0xFF, (byte) 0xD8, (byte) 0xFF, 0x00}));
        assertEquals("image/png", DocumentService.sniff(new byte[]{(byte) 0x89, 'P', 'N', 'G', 0x0D, 0x0A, 0x1A, 0x0A, 0}));
        assertNull(DocumentService.sniff("<html><script>alert(1)</script>".getBytes(StandardCharsets.UTF_8)));
        assertNull(DocumentService.sniff("MZ\u0090\u0000".getBytes(StandardCharsets.UTF_8)));
        assertNull(DocumentService.sniff(new byte[0]));
    }

    @Test
    void namesAreCleaned() {
        assertEquals("id.pdf", DocumentService.cleanName("C:\\Users\\x\\id.pdf"));
        assertEquals("passwd", DocumentService.cleanName("../../etc/passwd"));
        assertEquals("a_b_.pdf", DocumentService.cleanName("a<b>.pdf").replace("a_b_", "a_b_"));
        assertEquals("document", DocumentService.cleanName(null));
    }

    @Test
    void encryptionRoundTripsAndIsBoundToTheRecord() {
        byte[] key = new byte[32]; java.util.Arrays.fill(key, (byte) 7);
        byte[] iv = new byte[12];
        byte[] plain = "secret scan".getBytes(StandardCharsets.UTF_8);
        byte[] aad = DocumentService.aad(5L, 9L, "abc");
        byte[] enc = DocumentService.crypt(Cipher.ENCRYPT_MODE, key, iv, plain, aad);
        assertFalse(new String(enc, StandardCharsets.ISO_8859_1).contains("secret"));
        assertArrayEquals(plain, DocumentService.crypt(Cipher.DECRYPT_MODE, key, iv, enc, aad));
        assertThrows(IllegalStateException.class, () -> DocumentService.crypt(Cipher.DECRYPT_MODE, key, iv, enc, DocumentService.aad(6L, 9L, "abc")));
        byte[] other = key.clone(); other[0] = 1;
        assertThrows(IllegalStateException.class, () -> DocumentService.crypt(Cipher.DECRYPT_MODE, other, iv, enc, aad));
        enc[0] ^= 1;
        assertThrows(IllegalStateException.class, () -> DocumentService.crypt(Cipher.DECRYPT_MODE, key, iv, enc, aad));
    }

    @Test
    void withoutAKeyUploadsAreRefusedNotStoredInTheClear() {
        DocumentService s = new DocumentService(null, null, null);
        assertThrows(IllegalStateException.class, s::key);
    }
}
