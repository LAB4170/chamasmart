ckage com.chamasmart.backend.service;
import com.chamasmart.backend.domain.ChamaMember;
import com.chamasmart.backend.repository.ChamaMemberRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import java.util.List;
import java.util.regex.Pattern;
@Service
@RequiredArgsConstructor
public class ChatGuardrailService {
    private final ChamaMemberRepository chamaMemberRepository;
    // Pattern to detect common jailbreak attempts and prompt injections
    private static final Pattern INJECTION_PATTERN = Pattern.compile(
        "(?i)\\b(ignore\\s+(all\\s+)?previous|system\\s+override|developer\\s+mode|jailbreak|you\\s+are\\s+now|override\\s+instructions|pretend\\s+to\\s+be|forget\\s+(all\\s+)?instructions|acting\\s+as|simulate|bypass\\s+rules)\\b"
    );
    // Pattern to check if the input is totally unrelated to our domain (basic local scope defense)
    private static final Pattern OFF_TOPIC_BLOCK_PATTERN = Pattern.compile(
        "(?i)\\b(recipe|chocolate|cake|pancake|minecraft|fortnite|chess|game\\s+code|python\\s+script|write\\s+code|html\\s+page|java\\s+program|movie\\s+plot|song\\s+lyrics|joke\\s+about|poem)\\b"
    );
    // Output sanitization patterns
    private static final Pattern EMAIL_PATTERN = Pattern.compile("[a-zA-Z0-9.-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}");
    private static final Pattern PHONE_PATTERN = Pattern.compile("\\+?\\d{10,15}");
    private static final Pattern SECRET_KEY_PATTERN = Pattern.compile("(?i)(gsk_[a-zA-Z0-9]{40,}|key-[a-zA-Z0-9]{20,}|AIzaSy[a-zA-Z0-9_-]{33})");
    private static final Pattern SQL_PATTERN = Pattern.compile("(?i)\\b(SELECT|INSERT|UPDATE|DELETE|DROP|ALTER|FROM|WHERE|JOIN|CREATE\\s+TABLE|pg_type|information_schema|sysdatabases)\\b");
    /**
     * Inspects input for prompt injection or severe off-topic queries.
     * Returns a non-empty refusal string if the request is blocked, or null if it passes.
     */
    public String guardInput(String message) {
        if (message == null || message.isBlank()) {
            return "I couldn't hear you. Please ask a question related to ChamaSmart or savings groups.";
        }
        // 1. Prompt Injection Detection
        if (INJECTION_PATTERN.matcher(message).find()) {
            log.warn("Jailbreak attempt or prompt injection detected in user input: '{}'", message);
            return "I cannot fulfill this request. I am here only to assist with ChamaSmart, savings groups, and financial support.";
        }
        // 2. Off-Topic Validation
        if (OFF_TOPIC_BLOCK_PATTERN.matcher(message).find()) {
            log.warn("Off-topic prompt blocked locally: '{}'", message);
            return "I'm only trained to answer questions related to ChamaSmart, savings groups, table banking, ROSCA, ASCA, and financial literacy. Please ask a topic related to Chamas.";
        }
        return null;
    }
    /**
     * Securely builds authorized context for the logged-in user.
     * Contains only the Chamas that the user belongs to.
     */
    public String getUserChamaContext(Long userId) {
        if (userId == null) {
            return "No user context: The user is currently browsing as a guest.";
        }
        try {
            List<ChamaMember> memberships = chamaMemberRepository.findActiveMembershipsByUserId(userId);
            if (memberships.isEmpty()) {
                return "The user is not currently an active member of any Chama.";
            }
            StringBuilder sb = new StringBuilder();
            sb.append("Authorized User context:\n");
            sb.append("- User ID: ").append(userId).append("\n");
            sb.append("The user is an active member of the following Chama(s):\n");
            for (ChamaMember member : memberships) {
                if (member.getChama() == null || !Boolean.TRUE.equals(member.getChama().getIsActive())) {
                    continue;
                }
                sb.append("--- Chama Details ---\n");
                sb.append("- Name: ").append(member.getChama().getChamaName()).append("\n");
                sb.append("- Type: ").append(member.getChama().getChamaType()).append("\n");
                sb.append("- Description: ").append(member.getChama().getDescription()).append("\n");
                sb.append("- Role in Chama: ").append(member.getRole()).append("\n");
                sb.append("- Monthly/Weekly Contribution: ").append(member.getChama().getContributionAmount())
                  .append(" (").append(member.getChama().getContributionFrequency()).append(")\n");
                sb.append("- Meeting Day: ").append(member.getChama().getMeetingDay()).append("\n");
                sb.append("- Total Members: ").append(member.getChama().getTotalMembers()).append("\n");
                sb.append("- User's Total Contributions: KSh ").append(member.getTotalContributions()).append("\n");
            }
            return sb.toString();
        } catch (Exception e) {
            log.error("Failed to compile secure Chama context for user ID: {}", userId, e);
            return "Error retrieving secure user context.";
        }
    }
    /**
     * Scans and sanitizes LLM response for PII, SQL injections, and system secret leaks.
     */
    public String guardOutput(String reply) {
        if (reply == null || reply.isBlank()) {
            return reply;
        }
        String sanitized = reply;
        // 1. Mask secret API keys
        sanitized = SECRET_KEY_PATTERN.matcher(sanitized).replaceAll("[REDACTED SECRET]");
        // 2. Mask email addresses
        sanitized = EMAIL_PATTERN.matcher(sanitized).replaceAll("[REDACTED EMAIL]");
        // 3. Mask phone numbers
        sanitized = PHONE_PATTERN.matcher(sanitized).replaceAll("[REDACTED PHONE]");
        // 4. Block database or system command details
        if (SQL_PATTERN.matcher(sanitized).find()) {
            log.warn("Database/SQL pattern detected in LLM response: {}", sanitized);
            sanitized = SQL_PATTERN.matcher(sanitized).replaceAll("[REDACTED DATABASE REF]");
        }
        return sanitized;
    }
}

