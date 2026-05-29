ckage com.chamasmart.backend.dto;
import com.chamasmart.backend.domain.User;
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public class AuthResponse {
        private User user;
        private TokenResponse tokens;
        // Explicit constructor for manual creation
        public AuthResponse(User user, TokenResponse tokens) {
            this.user = user;
            this.tokens = tokens;
        }
        @Data
        @Builder
        @NoArgsConstructor
        @AllArgsConstructor
        public static class TokenResponse {
            private String accessToken;
            private String refreshToken;
            // Explicit constructor for manual creation
            public TokenResponse(String accessToken, String refreshToken) {
                this.accessToken = accessToken;
                this.refreshToken = refreshToken;
            }
        }
    }

