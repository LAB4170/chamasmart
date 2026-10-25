package com.chamasmart.backend.ledger;

/** Payment account numbers: chama code (5 digits + check digit), a 4-digit member number, and a check digit over the lot. A mistyped digit is caught before money moves. */
public final class AccountNumbers {
    private AccountNumbers() {}

    /** Luhn check digit for a string of digits. */
    public static int checkDigit(String digits) {
        int sum = 0; boolean dbl = true;
        for (int i = digits.length() - 1; i >= 0; i--) {
            int d = digits.charAt(i) - '0';
            if (dbl) { d *= 2; if (d > 9) d -= 9; }
            sum += d; dbl = !dbl;
        }
        return (10 - (sum % 10)) % 10;
    }

    public static boolean valid(String number) {
        if (number == null || !number.matches("\\d{6,16}")) return false;
        return checkDigit(number.substring(0, number.length() - 1)) == number.charAt(number.length() - 1) - '0';
    }

    public static String chamaCode(int fiveDigits) {
        String base = String.format("%05d", fiveDigits);
        return base + checkDigit(base);
    }

    public static String memberAccount(String chamaCode, int seq) {
        String base = chamaCode + String.format("%04d", seq);
        return base + checkDigit(base);
    }

    /** What a payer may type: digits only, spaces and dashes ignored. */
    public static String normalise(String typed) { return typed == null ? "" : typed.replaceAll("[\\s-]", ""); }
}
