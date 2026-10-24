package com.chamasmart.backend.security;

import java.util.ArrayDeque;
import java.util.Deque;
import java.util.concurrent.ConcurrentHashMap;
import java.util.function.LongSupplier;

/**
 * Small in-memory sliding-window counter. Good for a single server instance; if the API is ever scaled to
 * several instances, back it with Redis so the limits are shared.
 */
public class RateLimiter {
    private static final int CLEANUP_THRESHOLD = 20_000;

    private final ConcurrentHashMap<String, Deque<Long>> hits = new ConcurrentHashMap<>();
    private final LongSupplier clock;

    public RateLimiter() { this(System::currentTimeMillis); }

    public RateLimiter(LongSupplier clock) { this.clock = clock; }

    /** Counts this call and returns true if it is within {@code limit} calls per {@code windowMs}. */
    public boolean allow(String key, int limit, long windowMs) {
        long now = clock.getAsLong();
        maybeCleanup(now, windowMs);
        Deque<Long> q = hits.computeIfAbsent(key, k -> new ArrayDeque<>());
        synchronized (q) {
            trim(q, now, windowMs);
            if (q.size() >= limit) return false;
            q.addLast(now);
            return true;
        }
    }

    /** Records one event (for example a failed login) without checking a limit. */
    public void hit(String key, long windowMs) {
        long now = clock.getAsLong();
        Deque<Long> q = hits.computeIfAbsent(key, k -> new ArrayDeque<>());
        synchronized (q) {
            trim(q, now, windowMs);
            q.addLast(now);
        }
    }

    public int count(String key, long windowMs) {
        Deque<Long> q = hits.get(key);
        if (q == null) return 0;
        synchronized (q) {
            trim(q, clock.getAsLong(), windowMs);
            return q.size();
        }
    }

    /** Seconds until the oldest event in the window expires. */
    public long retryAfterSeconds(String key, long windowMs) {
        Deque<Long> q = hits.get(key);
        if (q == null) return 0;
        synchronized (q) {
            Long oldest = q.peekFirst();
            if (oldest == null) return 0;
            long wait = oldest + windowMs - clock.getAsLong();
            return Math.max(1, (wait + 999) / 1000);
        }
    }

    public void clear(String key) { hits.remove(key); }

    private static void trim(Deque<Long> q, long now, long windowMs) {
        while (!q.isEmpty() && now - q.peekFirst() >= windowMs) q.pollFirst();
    }

    private void maybeCleanup(long now, long windowMs) {
        if (hits.size() < CLEANUP_THRESHOLD) return;
        hits.entrySet().removeIf(e -> {
            synchronized (e.getValue()) {
                trim(e.getValue(), now, Math.max(windowMs, 3_600_000L));
                return e.getValue().isEmpty();
            }
        });
    }
}
