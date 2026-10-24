package com.chamasmart.backend.util;

/**
 * Decides what an uploaded file really is from its first bytes, never from the name or the type the browser claims.
 * Only PDF, JPEG and PNG are accepted, up to 5 MB.
 */
public final class UploadCheck {
    public static final int MAX_BYTES = 5 * 1024 * 1024;

    private UploadCheck() {}

    /** Returns the real content type, or throws if the file is empty, too large or not an accepted kind. */
    public static String detect(byte[] b) {
        if (b == null || b.length == 0) throw new IllegalArgumentException("The file is empty");
        if (b.length > MAX_BYTES) throw new IllegalArgumentException("The file is larger than 5 MB");
        if (b.length >= 5 && b[0] == '%' && b[1] == 'P' && b[2] == 'D' && b[3] == 'F' && b[4] == '-') return "application/pdf";
        if (b.length >= 3 && (b[0] & 0xFF) == 0xFF && (b[1] & 0xFF) == 0xD8 && (b[2] & 0xFF) == 0xFF) return "image/jpeg";
        if (b.length >= 8 && (b[0] & 0xFF) == 0x89 && b[1] == 'P' && b[2] == 'N' && b[3] == 'G' && b[4] == 0x0D && b[5] == 0x0A && b[6] == 0x1A && b[7] == 0x0A) return "image/png";
        throw new IllegalArgumentException("Only PDF, JPG or PNG files are accepted");
    }

    /** A safe display name: no path, no control characters, at most 80 characters, extension matching the real type. */
    public static String safeName(String original, String type) {
        String base = original == null ? "" : original.replace('\\', '/');
        base = base.substring(base.lastIndexOf('/') + 1).replaceAll("[^A-Za-z0-9._ -]", "_").trim();
        int dot = base.lastIndexOf('.');
        if (dot > 0) base = base.substring(0, dot);
        if (base.isEmpty()) base = "proof";
        if (base.length() > 70) base = base.substring(0, 70);
        String ext = switch (type) { case "application/pdf" -> ".pdf"; case "image/png" -> ".png"; default -> ".jpg"; };
        return base + ext;
    }
}
