package com.chamasmart.backend.util;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

class UploadCheckTest {
    private static byte[] pad(int... head) {
        byte[] b = new byte[64];
        for (int i = 0; i < head.length; i++) b[i] = (byte) head[i];
        return b;
    }

    @Test
    void recognisesPdfJpegAndPngByContent() {
        assertEquals("application/pdf", UploadCheck.detect(pad('%', 'P', 'D', 'F', '-')));
        assertEquals("image/jpeg", UploadCheck.detect(pad(0xFF, 0xD8, 0xFF, 0xE0)));
        assertEquals("image/png", UploadCheck.detect(pad(0x89, 'P', 'N', 'G', 0x0D, 0x0A, 0x1A, 0x0A)));
    }

    @Test
    void rejectsHtmlScriptsExecutablesEmptyAndOversizeFiles() {
        assertThrows(IllegalArgumentException.class, () -> UploadCheck.detect("<html><script>alert(1)</script>".getBytes()));
        assertThrows(IllegalArgumentException.class, () -> UploadCheck.detect(pad('M', 'Z')));
        assertThrows(IllegalArgumentException.class, () -> UploadCheck.detect(new byte[0]));
        byte[] big = new byte[UploadCheck.MAX_BYTES + 1];
        big[0] = '%'; big[1] = 'P'; big[2] = 'D'; big[3] = 'F'; big[4] = '-';
        assertThrows(IllegalArgumentException.class, () -> UploadCheck.detect(big));
    }

    @Test
    void safeNameDropsPathsOddCharactersAndFakeExtensions() {
        assertEquals("death certificate.pdf", UploadCheck.safeName("C:\\Users\\me\\death certificate.exe", "application/pdf"));
        assertEquals("passwd.png", UploadCheck.safeName("../../etc/passwd", "image/png"));
        assertEquals("proof.jpg", UploadCheck.safeName(null, "image/jpeg"));
        assertTrue(UploadCheck.safeName("a".repeat(200) + ".pdf", "application/pdf").length() <= 74);
    }
}
