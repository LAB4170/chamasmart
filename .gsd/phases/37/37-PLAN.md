# Implementation Plan: Multi-Tenant M-Pesa Payment Routing

This plan addresses the conflict where M-Pesa payments were being hard-coded to a single global Shortcode, ignoring the specific Paybill/Till details provided during Chama creation.

## User Review Required

> [!IMPORTANT]
> **MPESA PASSKEY REQUIREMENT**: For an STK Push to work on a custom Paybill, the system requires the corresponding **M-Pesa Passkey**. 
> - If a Chama provides their own Shortcode but **no Passkey**, the STK push will fail at the Safaricom gateway.
> - **Proposed Fallback**: If a Chama's custom payment details are incomplete (missing Passkey), the system will default to the **ChamaSmart Platform Account** to ensure the member can still pay, but funds will require manual reconciliation by the Platform Admin.

## Proposed Changes

### Backend Infrastructure

#### [MODIFY] [mpesaService.js](file:///c:/Users/Eobord/Desktop/chamasmart/backend/utils/mpesaService.js)
- Update `initiateStkPush` to accept an optional `configOverride` object.
- Dynamically resolve `BusinessShortCode` and `Passkey` from the override if provided.

#### [MODIFY] [mpesaController.js](file:///c:/Users/Eobord/Desktop/chamasmart/backend/controllers/mpesaController.js)
- In `initiatePayment`, fetch the `payment_methods` JSON from the `chamas` table for the target `chamaId`.
- Parse the JSON to extract `businessNumber` and `passKey`.
- Pass these details to the `mpesaService` to route the payment correctly.

#### [MODIFY] [chamaController.js](file:///c:/Users/Eobord/Desktop/chamasmart/backend/controllers/chamaController.js)
- Verify that the `createChama` logic correctly saves the `payment_methods` object including the optional `passKey` field (if provided by the user).

## Verification Plan

### Automated Tests
- **Mock Payout Route Test**: Verify that providing a custom shortcode in a dummy request results in the `MpesaService` using that shortcode in the logged payload.
- **Fallback Test**: Verify that if a Chama has no `payment_methods`, the system still falls back to the `.env` default without crashing.

### Manual Verification
- Initiate an STK push for a Chama with a "Dummy" Paybill in its settings and verify the logs show the request going to that Dummy Paybill.
