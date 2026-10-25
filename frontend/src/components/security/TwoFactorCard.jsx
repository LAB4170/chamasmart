import { useEffect, useState, useCallback } from "react";
import { toast } from "react-toastify";
import QRCode from "qrcode";
import { ShieldCheck } from "lucide-react";
import { authAPI } from "../../services/api";
import { Button } from "../ui";

const message = (err, fallback) => err?.response?.data?.message || fallback;

/** Turn authenticator-app sign-in on or off, and see recovery codes once. */
export default function TwoFactorCard() {
  const [status, setStatus] = useState(null);
  const [setup, setSetup] = useState(null); // { secret, qr }
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [recovery, setRecovery] = useState(null);
  const [confirmOff, setConfirmOff] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await authAPI.mfaStatus();
      setStatus(res.data.data);
    } catch {
      setStatus({ enabled: false, recovery_codes_left: 0, unknown: true });
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  const begin = async () => {
    setBusy(true);
    try {
      const res = await authAPI.mfaSetup();
      const { secret, otpauth_uri: uri } = res.data.data;
      const qr = await QRCode.toDataURL(uri, { margin: 1, width: 192 });
      setSetup({ secret, qr });
      setCode("");
    } catch (err) {
      toast.error(message(err, "Couldn't start setup. Please try again."));
    } finally { setBusy(false); }
  };

  const enable = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await authAPI.mfaEnable(code.trim());
      setRecovery(res.data.data.recovery_codes);
      setSetup(null);
      setCode("");
      load();
      toast.success("Two-factor sign-in is on");
    } catch (err) {
      toast.error(message(err, "That code isn't right."));
    } finally { setBusy(false); }
  };

  const disable = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await authAPI.mfaDisable(code.trim());
      setConfirmOff(false);
      setCode("");
      setRecovery(null);
      load();
      toast.success("Two-factor sign-in is off");
    } catch (err) {
      toast.error(message(err, "That code isn't right."));
    } finally { setBusy(false); }
  };

  const copyCodes = async () => {
    try { await navigator.clipboard.writeText(recovery.join("\n")); toast.success("Copied"); } catch { toast.info("Select and copy the codes by hand"); }
  };

  return (
    <section className="cs-card" aria-label="Two-factor sign-in" style={{ marginBottom: 16, maxWidth: 720 }}>
      <h2 className="cs-card-title" style={{ display: "flex", alignItems: "center", gap: 8 }}><ShieldCheck size={18} aria-hidden="true" /> Two-factor sign-in</h2>
      {!status ? <p className="cs-help">Checking…</p> : (
        <>
          <p className="cs-help">
            {status.enabled
              ? `On. You'll be asked for a code from your authenticator app each time you sign in. ${status.recovery_codes_left} recovery codes left.`
              : "Adds a code from an authenticator app (Google Authenticator, Microsoft Authenticator, Authy) to your password. Chama officials should turn this on."}
          </p>

          {recovery && (
            <div className="cs-notice" role="status" style={{ margin: "12px 0" }}>
              <div>
                <strong>Save these recovery codes now.</strong> Each works once if you lose your phone. They won't be shown again.
                <ul className="cs-code-list">{recovery.map((c) => <li key={c}><code>{c}</code></li>)}</ul>
                <Button variant="secondary" onClick={copyCodes}>Copy codes</Button>{" "}
                <Button variant="secondary" onClick={() => setRecovery(null)}>I've saved them</Button>
              </div>
            </div>
          )}

          {!status.enabled && !setup && <Button variant="primary" onClick={begin} loading={busy}>Turn on</Button>}

          {setup && (
            <form onSubmit={enable} noValidate style={{ marginTop: 8 }}>
              <div style={{ display: "flex", gap: 16, flexWrap: "wrap", alignItems: "center" }}>
                <img src={setup.qr} alt="QR code to add ChamaSmart to your authenticator app" width="192" height="192" style={{ borderRadius: 12, background: "#fff", padding: 6 }} />
                <div style={{ flex: "1 1 220px" }}>
                  <p className="cs-help">1. Scan the code with your authenticator app, or type this key in: <code style={{ wordBreak: "break-all" }}>{setup.secret}</code></p>
                  <div className="cs-field">
                    <label className="cs-label" htmlFor="mfa-code">2. Enter the 6-digit code it shows</label>
                    <input id="mfa-code" className="cs-input" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} />
                  </div>
                  <Button type="submit" variant="primary" loading={busy} disabled={code.length !== 6}>Confirm and turn on</Button>{" "}
                  <Button type="button" variant="secondary" onClick={() => setSetup(null)}>Cancel</Button>
                </div>
              </div>
            </form>
          )}

          {status.enabled && !confirmOff && <Button variant="secondary" onClick={() => { setConfirmOff(true); setCode(""); }}>Turn off</Button>}
          {status.enabled && confirmOff && (
            <form onSubmit={disable} noValidate style={{ marginTop: 8 }}>
              <div className="cs-field">
                <label className="cs-label" htmlFor="mfa-off">Enter a code from your app (or a recovery code) to turn it off</label>
                <input id="mfa-off" className="cs-input" autoComplete="one-time-code" value={code} onChange={(e) => setCode(e.target.value)} />
              </div>
              <Button type="submit" variant="danger" loading={busy} disabled={!code.trim()}>Turn off</Button>{" "}
              <Button type="button" variant="secondary" onClick={() => setConfirmOff(false)}>Keep it on</Button>
            </form>
          )}
        </>
      )}
    </section>
  );
}
