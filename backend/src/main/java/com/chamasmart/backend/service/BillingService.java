package com.chamasmart.backend.service;

import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Year;

/** Invoices for ChamaSmart's own plan revenue. One invoice per verified plan payment; invoices are never edited or deleted. */
@Service
@RequiredArgsConstructor
public class BillingService {
    private final JdbcTemplate jdbc;

    @Value("${app.billing.vat-registered:false}") boolean vatRegistered = false;
    @Value("${app.billing.vat-rate:0.16}") BigDecimal vatRate = new BigDecimal("0.16");
    @Value("${app.billing.vat-inclusive:true}") boolean vatInclusive = true;

    /** Splits an amount into net, VAT and gross. Without a VAT registration, no VAT is charged. */
    public BigDecimal[] split(BigDecimal paid) {
        if (!vatRegistered) return new BigDecimal[]{paid, BigDecimal.ZERO.setScale(2), paid};
        if (vatInclusive) {
            BigDecimal net = paid.divide(BigDecimal.ONE.add(vatRate), 2, RoundingMode.HALF_UP);
            return new BigDecimal[]{net, paid.subtract(net), paid};
        }
        BigDecimal vat = paid.multiply(vatRate).setScale(2, RoundingMode.HALF_UP);
        return new BigDecimal[]{paid, vat, paid.add(vat)};
    }

    @Transactional
    public void recordInvoice(Long chamaId, String planCode, BigDecimal paid, String currency, String reference) {
        Integer months = jdbc.queryForObject("SELECT coalesce(max(interval_months),1) FROM subscription_plans WHERE plan_code = ?", Integer.class, planCode);
        BigDecimal[] s = split(paid.setScale(2, RoundingMode.HALF_UP));
        Long seq = jdbc.queryForObject("SELECT nextval('platform_invoice_seq')", Long.class);
        String number = String.format("CS-%d-%06d", Year.now().getValue(), seq);
        jdbc.update("""
                INSERT INTO platform_invoices (invoice_number, chama_id, plan_code, period_start, period_end, gross, net, vat, vat_rate, currency, reference)
                VALUES (?, ?, ?, now(), now() + (? * interval '1 month'), ?, ?, ?, ?, ?, ?) ON CONFLICT (reference) DO NOTHING""",
                number, chamaId, planCode, months == null ? 1 : months, s[2], s[0], s[1], vatRegistered ? vatRate : BigDecimal.ZERO, currency, reference);
    }
}
