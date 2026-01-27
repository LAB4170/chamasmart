<template>
  <div class="signup-v2-container">
    <!-- Logo & Header -->
    <div class="signup-header">
      <div class="logo">🎯 ChamaSmart</div>
      <h1>Join Your Chama</h1>
      <p class="subtitle">Create an account to start saving together</p>
    </div>

    <!-- Progress Indicator -->
    <div class="progress-bar">
      <div
        class="progress-step"
        :class="{ active: currentStep >= 1, completed: currentStep > 1 }"
      >
        <div class="step-number">1</div>
        <div class="step-label">Account Type</div>
      </div>
      <div class="progress-line" :class="{ active: currentStep > 1 }"></div>

      <div
        class="progress-step"
        :class="{ active: currentStep >= 2, completed: currentStep > 2 }"
      >
        <div class="step-number">2</div>
        <div class="step-label">Choose Auth</div>
      </div>
      <div class="progress-line" :class="{ active: currentStep > 2 }"></div>

      <div
        class="progress-step"
        :class="{ active: currentStep >= 3, completed: currentStep > 3 }"
      >
        <div class="step-number">3</div>
        <div class="step-label">Verify OTP</div>
      </div>
      <div class="progress-line" :class="{ active: currentStep > 3 }"></div>

      <div class="progress-step" :class="{ active: currentStep >= 4 }">
        <div class="step-number">4</div>
        <div class="step-label">Profile</div>
      </div>
    </div>

    <!-- Forms Container -->
    <div class="forms-container">
      <!-- STEP 1: Account Type Selection -->
      <div v-if="currentStep === 1" class="form-step">
        <h2>What brings you here?</h2>

        <div class="option-grid">
          <div
            class="option-card"
            :class="{ selected: accountType === 'existing' }"
            @click="selectAccountType('existing')"
          >
            <div class="option-icon">👥</div>
            <div class="option-title">Join Existing Group</div>
            <div class="option-description">
              Have an invite code from your group
            </div>
          </div>

          <div
            class="option-card"
            :class="{ selected: accountType === 'create' }"
            @click="selectAccountType('create')"
          >
            <div class="option-icon">✨</div>
            <div class="option-title">Create New Group</div>
            <div class="option-description">
              Start your own Chama with friends
            </div>
          </div>

          <div
            class="option-card"
            :class="{ selected: accountType === 'explore' }"
            @click="selectAccountType('explore')"
          >
            <div class="option-icon">🔍</div>
            <div class="option-title">Just Exploring</div>
            <div class="option-description">Browse and learn about Chamas</div>
          </div>
        </div>

        <button
          class="btn btn-primary btn-block"
          :disabled="!accountType"
          @click="goToStep(2)"
        >
          Continue
        </button>
      </div>

      <!-- STEP 2: Choose Authentication Method -->
      <div v-if="currentStep === 2" class="form-step">
        <h2>How would you like to sign up?</h2>

        <div class="auth-options">
          <!-- Google OAuth -->
          <button class="auth-btn google-btn" @click="handleGoogleAuth">
            <span class="auth-icon">🔵</span>
            <span>Continue with Google</span>
            <span class="auth-badge">Fastest</span>
          </button>

          <!-- Email OTP -->
          <button
            class="auth-btn email-btn"
            :class="{ active: authMethod === 'email' }"
            @click="selectAuthMethod('email')"
          >
            <span class="auth-icon">✉️</span>
            <span>Email Verification</span>
            <span class="auth-badge">Recommended</span>
          </button>

          <!-- Phone OTP -->
          <button
            class="auth-btn phone-btn"
            :class="{ active: authMethod === 'phone' }"
            @click="selectAuthMethod('phone')"
          >
            <span class="auth-icon">📱</span>
            <span>Phone Verification</span>
            <span class="auth-badge">SMS</span>
          </button>

          <!-- Passwordless Email -->
          <button
            class="auth-btn passwordless-btn"
            :class="{ active: authMethod === 'passwordless' }"
            @click="selectAuthMethod('passwordless')"
          >
            <span class="auth-icon">🔐</span>
            <span>Passwordless Email</span>
            <span class="auth-badge">Secure</span>
          </button>
        </div>

        <!-- Form for Email/Phone Input -->
        <div v-if="authMethod === 'email'" class="contact-input">
          <input
            v-model="email"
            type="email"
            placeholder="your@email.com"
            class="form-control"
          />
        </div>

        <div v-if="authMethod === 'phone'" class="contact-input">
          <div class="phone-input-group">
            <select v-model="countryCode" class="country-select">
              <option value="+254">🇰🇪 +254</option>
              <option value="+255">🇹🇿 +255</option>
              <option value="+256">🇺🇬 +256</option>
              <option value="+234">🇳🇬 +234</option>
            </select>
            <input
              v-model="phone"
              type="tel"
              placeholder="712345678"
              class="form-control"
            />
          </div>
        </div>

        <div class="button-group">
          <button class="btn btn-secondary" @click="goToStep(1)">Back</button>
          <button
            class="btn btn-primary"
            :disabled="!canProceedStep2"
            @click="proceedToOTP"
            :class="{ loading: isLoading }"
          >
            <span v-if="isLoading">Sending...</span>
            <span v-else>Get Verification Code</span>
          </button>
        </div>
      </div>

      <!-- STEP 3: OTP Verification -->
      <div v-if="currentStep === 3" class="form-step">
        <h2>Enter Verification Code</h2>
        <p class="step-description">
          We sent a 6-digit code to
          <strong>{{ contactMethodDisplay }}</strong>
        </p>

        <!-- OTP Input (6 digits) -->
        <div class="otp-input-group">
          <input
            v-for="(digit, index) in 6"
            :key="index"
            v-model="otp[index]"
            type="text"
            maxlength="1"
            class="otp-input"
            @input="handleOTPInput(index, $event)"
            @keydown.backspace="handleOTPBackspace(index, $event)"
          />
        </div>

        <!-- Resend OTP -->
        <div class="resend-section">
          <p v-if="otpResendTimer > 0">
            Resend in <strong>{{ otpResendTimer }}s</strong>
          </p>
          <button
            v-else
            class="btn-link"
            @click="resendOTP"
            :disabled="isResending"
          >
            {{ isResending ? "Sending..." : "Resend Code" }}
          </button>
        </div>

        <!-- OTP Time Remaining -->
        <div class="otp-expiry">
          Expires in: <strong>{{ otpExpiry }}</strong>
        </div>

        <!-- Password Input (for non-OAuth methods) -->
        <div v-if="authMethod !== 'google'" class="password-input-group">
          <label>Create Password (optional)</label>
          <input
            v-model="password"
            type="password"
            placeholder="Leave blank for passwordless login"
            class="form-control"
          />
          <small>Leave empty for passwordless/OTP-only login</small>
        </div>

        <div class="button-group">
          <button class="btn btn-secondary" @click="goToStep(2)">
            Change Method
          </button>
          <button
            class="btn btn-primary"
            :disabled="!otpComplete || isLoading"
            @click="verifyOTP"
            :class="{ loading: isLoading }"
          >
            <span v-if="isLoading">Verifying...</span>
            <span v-else>Verify & Create Account</span>
          </button>
        </div>
      </div>

      <!-- STEP 4: Complete Profile -->
      <div v-if="currentStep === 4" class="form-step">
        <h2>Complete Your Profile</h2>

        <div class="profile-form">
          <div class="form-group">
            <label>First Name</label>
            <input
              v-model="firstName"
              type="text"
              placeholder="John"
              class="form-control"
            />
          </div>

          <div class="form-group">
            <label>Last Name</label>
            <input
              v-model="lastName"
              type="text"
              placeholder="Doe"
              class="form-control"
            />
          </div>

          <div class="form-group">
            <label>Phone (if not used for signup)</label>
            <input
              v-model="profilePhone"
              type="tel"
              placeholder="+254712345678"
              class="form-control"
            />
          </div>

          <!-- Optional Fields Based on Account Type -->
          <div v-if="accountType === 'existing'" class="form-group">
            <label>Invite Code</label>
            <input
              v-model="inviteCode"
              type="text"
              placeholder="CHAMA-XXXX"
              class="form-control"
            />
          </div>

          <div class="form-group">
            <label class="checkbox-label">
              <input v-model="agreeToTerms" type="checkbox" />
              I agree to the Terms of Service and Privacy Policy
            </label>
          </div>
        </div>

        <div class="button-group">
          <button
            class="btn btn-secondary"
            @click="goToStep(3)"
            :disabled="isLoading"
          >
            Back
          </button>
          <button
            class="btn btn-primary"
            :disabled="!agreeToTerms || isLoading"
            @click="completeSignup"
            :class="{ loading: isLoading }"
          >
            <span v-if="isLoading">Creating Account...</span>
            <span v-else>Get Started</span>
          </button>
        </div>
      </div>
    </div>

    <!-- Error Message -->
    <div v-if="errorMessage" class="alert alert-error">
      ❌ {{ errorMessage }}
      <button class="alert-close" @click="errorMessage = ''">×</button>
    </div>

    <!-- Success Message -->
    <div v-if="successMessage" class="alert alert-success">
      ✅ {{ successMessage }}
    </div>

    <!-- Footer Links -->
    <div class="footer-links">
      Already have an account?
      <router-link to="/login" class="link">Sign In</router-link>
    </div>
  </div>
</template>

<script>
import { ref, computed } from "vue";
import { useRouter } from "vue-router";
import api from "../services/api";

export default {
  name: "SignupV2",
  setup() {
    const router = useRouter();

    // Step state
    const currentStep = ref(1);
    const accountType = ref("");
    const authMethod = ref("");

    // Contact info
    const email = ref("");
    const phone = ref("");
    const countryCode = ref("+254");

    // OTP state
    const otp = ref(["", "", "", "", "", ""]);
    const otpResendTimer = ref(0);
    const otpExpiry = ref("10:00");
    const signupToken = ref("");
    const password = ref("");

    // Profile info
    const firstName = ref("");
    const lastName = ref("");
    const profilePhone = ref("");
    const inviteCode = ref("");
    const agreeToTerms = ref(false);

    // UI state
    const isLoading = ref(false);
    const isResending = ref(false);
    const errorMessage = ref("");
    const successMessage = ref("");

    // Computed properties
    const canProceedStep2 = computed(() => {
      if (authMethod.value === "email")
        return email.value && email.value.includes("@");
      if (authMethod.value === "phone")
        return phone.value && phone.value.length >= 9;
      return true;
    });

    const otpComplete = computed(() => {
      return otp.value.every((digit) => digit !== "");
    });

    const contactMethodDisplay = computed(() => {
      if (authMethod.value === "email") {
        return email.value.replace(/(.{2})(.*)(@.*)/, "$1***$3");
      }
      if (authMethod.value === "phone") {
        return `${countryCode.value}${phone.value}`.replace(
          /(.{4})(.*)(.{2})$/,
          "$1****$3",
        );
      }
      return "";
    });

    // Methods
    const selectAccountType = (type) => {
      accountType.value = type;
    };

    const selectAuthMethod = (method) => {
      authMethod.value = method;
    };

    const goToStep = (step) => {
      currentStep.value = step;
      errorMessage.value = "";
    };

    const proceedToOTP = async () => {
      try {
        isLoading.value = true;
        errorMessage.value = "";

        const payload = {
          email: email.value,
          phoneNumber:
            authMethod.value === "phone"
              ? `${countryCode.value}${phone.value}`
              : authMethod.value === "email"
                ? phone.value
                : undefined,
          firstName: firstName.value,
          lastName: lastName.value || "",
          password: password.value,
        };

        const response = await api.post("/auth/register", payload);

        if (response.data.success) {
          signupToken.value = response.data.data.signupToken;
          successMessage.value = `Verification code sent to ${response.data.data.contact}`;

          // Start OTP timer
          startOTPTimer();
          goToStep(3);
        } else {
          throw new Error(response.data.message || "Failed to start signup");
        }
      } catch (error) {
        errorMessage.value =
          error.response?.data?.message ||
          error.message ||
          "Error sending verification code";
        console.error("Signup start error:", error);
      } finally {
        isLoading.value = false;
      }
    };

    const handleOTPInput = (index, event) => {
      const value = event.target.value;
      if (!/^\d*$/.test(value)) {
        otp.value[index] = "";
        return;
      }

      otp.value[index] = value;

      // Auto-focus next input
      if (value && index < 5) {
        const nextInput = event.target.nextElementSibling;
        if (nextInput) nextInput.focus();
      }
    };

    const handleOTPBackspace = (index, event) => {
      if (index > 0 && otp.value[index] === "") {
        const prevInput = event.target.previousElementSibling;
        if (prevInput) prevInput.focus();
      }
    };

    const startOTPTimer = () => {
      let timeLeft = 600; // 10 minutes in seconds
      const interval = setInterval(() => {
        timeLeft--;
        const minutes = Math.floor(timeLeft / 60);
        const seconds = timeLeft % 60;
        otpExpiry.value = `${minutes}:${seconds.toString().padStart(2, "0")}`;

        if (timeLeft <= 0) {
          clearInterval(interval);
          errorMessage.value = "OTP expired. Please request a new one.";
        }
      }, 1000);
    };

    const resendOTP = async () => {
      try {
        isResending.value = true;
        const response = await api.post("/auth/verify/email", {
          signupToken: signupToken.value,
        });

        if (response.data.success) {
          successMessage.value = "New verification code sent";
          otp.value = ["", "", "", "", "", ""];
          otpResendTimer.value = 30;
          startOTPTimer();

          const interval = setInterval(() => {
            otpResendTimer.value--;
            if (otpResendTimer.value <= 0) clearInterval(interval);
          }, 1000);
        }
      } catch (error) {
        errorMessage.value =
          error.response?.data?.message || "Failed to resend OTP";
      } finally {
        isResending.value = false;
      }
    };

    const verifyOTP = async () => {
      try {
        isLoading.value = true;
        errorMessage.value = "";

        const otpCode = otp.value.join("");
        const payload = {
          signupToken: signupToken.value,
          otp: otpCode,
          password: password.value || undefined,
        };

        const response = await api.post("/auth/verify/email", payload);

        if (response.data.success) {
          // Store tokens
          localStorage.setItem(
            "accessToken",
            response.data.data.tokens.accessToken,
          );
          localStorage.setItem(
            "refreshToken",
            response.data.data.tokens.refreshToken,
          );

          // Go to profile step
          goToStep(4);
          successMessage.value = "OTP verified! Complete your profile.";
        } else {
          throw new Error(response.data.message || "OTP verification failed");
        }
      } catch (error) {
        errorMessage.value =
          error.response?.data?.message || error.message || "Invalid OTP";
        console.error("OTP verification error:", error);
      } finally {
        isLoading.value = false;
      }
    };

    const handleGoogleAuth = async () => {
      try {
        // TODO: Implement Google OAuth flow
        // 1. Initialize Google Sign-In
        // 2. Get token from Google
        // 3. Send token to backend
        // 4. Receive user + tokens
        // 5. Redirect to dashboard

        errorMessage.value = "Google OAuth coming soon!";
      } catch (error) {
        errorMessage.value = "Google authentication failed";
      }
    };

    const completeSignup = async () => {
      try {
        isLoading.value = true;

        // In a real app, you might update user profile here
        // For now, redirect to dashboard
        successMessage.value = "Account created successfully! Redirecting...";

        setTimeout(() => {
          router.push("/dashboard");
        }, 1500);
      } catch (error) {
        errorMessage.value = "Failed to complete signup";
      } finally {
        isLoading.value = false;
      }
    };

    return {
      currentStep,
      accountType,
      authMethod,
      email,
      phone,
      countryCode,
      otp,
      otpResendTimer,
      otpExpiry,
      password,
      firstName,
      lastName,
      profilePhone,
      inviteCode,
      agreeToTerms,
      isLoading,
      isResending,
      errorMessage,
      successMessage,
      canProceedStep2,
      otpComplete,
      contactMethodDisplay,
      selectAccountType,
      selectAuthMethod,
      goToStep,
      proceedToOTP,
      handleOTPInput,
      handleOTPBackspace,
      resendOTP,
      verifyOTP,
      handleGoogleAuth,
      completeSignup,
    };
  },
};
</script>

<style scoped>
/* Container */
.signup-v2-container {
  min-height: 100vh;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  padding: 20px;
  font-family:
    -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen, Ubuntu,
    Cantarell, sans-serif;
}

/* Header */
.signup-header {
  text-align: center;
  color: white;
  margin-bottom: 40px;
}

.logo {
  font-size: 32px;
  font-weight: bold;
  margin-bottom: 10px;
}

.signup-header h1 {
  font-size: 28px;
  margin: 0 0 10px 0;
}

.subtitle {
  font-size: 16px;
  opacity: 0.9;
  margin: 0;
}

/* Progress Bar */
.progress-bar {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 20px;
  margin-bottom: 40px;
  max-width: 600px;
}

.progress-step {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  opacity: 0.5;
  transition: opacity 0.3s;
}

.progress-step.active,
.progress-step.completed {
  opacity: 1;
}

.step-number {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: white;
  color: #667eea;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: bold;
  font-size: 16px;
}

.progress-step.completed .step-number {
  background: #4caf50;
  color: white;
}

.step-label {
  font-size: 12px;
  color: white;
  text-align: center;
  max-width: 70px;
}

.progress-line {
  width: 40px;
  height: 2px;
  background: rgba(255, 255, 255, 0.3);
  transition: background 0.3s;
}

.progress-line.active {
  background: white;
}

/* Forms Container */
.forms-container {
  background: white;
  border-radius: 12px;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.15);
  padding: 40px;
  max-width: 500px;
  width: 100%;
}

.form-step {
  animation: slideIn 0.3s ease-out;
}

@keyframes slideIn {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.form-step h2 {
  font-size: 24px;
  margin: 0 0 10px 0;
  color: #333;
}

.step-description {
  font-size: 14px;
  color: #666;
  margin: 0 0 20px 0;
}

/* Option Grid (Step 1) */
.option-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 15px;
  margin: 30px 0;
}

.option-card {
  padding: 20px;
  border: 2px solid #e0e0e0;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.3s;
  text-align: center;
}

.option-card:hover {
  border-color: #667eea;
  background: #f5f7ff;
}

.option-card.selected {
  border-color: #667eea;
  background: #f5f7ff;
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.2);
}

.option-icon {
  font-size: 32px;
  margin-bottom: 10px;
}

.option-title {
  font-weight: 600;
  color: #333;
  margin-bottom: 5px;
}

.option-description {
  font-size: 13px;
  color: #999;
}

/* Auth Options (Step 2) */
.auth-options {
  display: grid;
  grid-template-columns: 1fr;
  gap: 12px;
  margin: 30px 0;
}

.auth-btn {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 16px;
  border: 2px solid #e0e0e0;
  border-radius: 8px;
  background: white;
  cursor: pointer;
  transition: all 0.3s;
  font-size: 14px;
  font-weight: 500;
}

.auth-btn:hover {
  border-color: #667eea;
  background: #f5f7ff;
}

.auth-btn.active {
  border-color: #667eea;
  background: #f5f7ff;
}

.auth-icon {
  font-size: 18px;
  margin-right: 12px;
}

.auth-badge {
  font-size: 11px;
  background: #667eea;
  color: white;
  padding: 2px 8px;
  border-radius: 12px;
  margin-left: auto;
}

.contact-input {
  margin: 20px 0;
}

.phone-input-group {
  display: grid;
  grid-template-columns: 80px 1fr;
  gap: 10px;
}

.country-select,
.form-control {
  padding: 12px;
  border: 1px solid #ddd;
  border-radius: 6px;
  font-size: 14px;
}

.form-control:focus {
  outline: none;
  border-color: #667eea;
  box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
}

/* OTP Input (Step 3) */
.otp-input-group {
  display: grid;
  grid-template-columns: repeat(6, 1fr);
  gap: 10px;
  margin: 30px 0;
}

.otp-input {
  width: 100%;
  padding: 14px;
  font-size: 24px;
  font-weight: bold;
  text-align: center;
  border: 2px solid #ddd;
  border-radius: 8px;
  transition: all 0.3s;
}

.otp-input:focus {
  outline: none;
  border-color: #667eea;
  box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
}

.otp-input::placeholder {
  color: #ddd;
}

.resend-section {
  text-align: center;
  margin: 15px 0;
}

.btn-link {
  background: none;
  border: none;
  color: #667eea;
  cursor: pointer;
  font-size: 14px;
  text-decoration: underline;
}

.btn-link:hover {
  color: #764ba2;
}

.otp-expiry {
  text-align: center;
  font-size: 13px;
  color: #999;
  margin: 10px 0;
}

.password-input-group {
  margin: 20px 0;
}

.password-input-group label {
  display: block;
  margin-bottom: 8px;
  font-weight: 500;
  color: #333;
}

.password-input-group small {
  display: block;
  color: #999;
  margin-top: 5px;
}

/* Profile Form (Step 4) */
.profile-form {
  margin: 30px 0;
}

.form-group {
  margin-bottom: 15px;
}

.form-group label {
  display: block;
  margin-bottom: 6px;
  font-weight: 500;
  color: #333;
  font-size: 14px;
}

.checkbox-label {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  font-weight: normal;
}

.checkbox-label input {
  width: 16px;
  height: 16px;
  cursor: pointer;
}

/* Buttons */
.btn {
  padding: 12px 24px;
  border: none;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s;
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-primary {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  width: 100%;
}

.btn-primary:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(102, 126, 234, 0.4);
}

.btn-secondary {
  background: #f0f0f0;
  color: #333;
  width: 100%;
}

.btn-secondary:hover:not(:disabled) {
  background: #e0e0e0;
}

.btn-block {
  width: 100%;
}

.btn.loading {
  opacity: 0.7;
  cursor: wait;
}

.button-group {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  margin-top: 20px;
}

/* Alerts */
.alert {
  padding: 12px 16px;
  border-radius: 6px;
  margin: 20px 0;
  font-size: 14px;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.alert-error {
  background: #ffebee;
  color: #c62828;
  border: 1px solid #ef5350;
}

.alert-success {
  background: #e8f5e9;
  color: #2e7d32;
  border: 1px solid #66bb6a;
}

.alert-close {
  background: none;
  border: none;
  font-size: 20px;
  cursor: pointer;
  color: inherit;
}

/* Footer Links */
.footer-links {
  text-align: center;
  color: rgba(255, 255, 255, 0.8);
  margin-top: 20px;
}

.link {
  color: white;
  text-decoration: none;
  font-weight: 600;
}

.link:hover {
  text-decoration: underline;
}

/* Responsive */
@media (max-width: 640px) {
  .forms-container {
    padding: 30px 20px;
  }

  .signup-header {
    margin-bottom: 30px;
  }

  .signup-header h1 {
    font-size: 24px;
  }

  .progress-bar {
    gap: 10px;
    margin-bottom: 30px;
  }

  .step-number {
    width: 32px;
    height: 32px;
    font-size: 14px;
  }

  .progress-line {
    width: 20px;
  }

  .step-label {
    font-size: 10px;
    max-width: 60px;
  }

  .button-group {
    grid-template-columns: 1fr;
  }

  .otp-input {
    font-size: 20px;
    padding: 12px 8px;
  }
}
</style>
