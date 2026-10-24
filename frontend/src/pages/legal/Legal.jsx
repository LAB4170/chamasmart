import { Link, useLocation } from "react-router-dom";

const DOCS = {
  "/terms": {
    title: "Terms of use",
    sections: [
      ["What ChamaSmart is", "ChamaSmart is a record-keeping and approval tool for savings groups (chamas). It does not hold your money. Contributions, loans and payouts are paid between members outside the app, and the app records and checks them."],
      ["Your account", "You are responsible for your password and for what is done with your account. Tell the chairperson of your chama if you think someone else has used it. You can sign out of every device from your profile."],
      ["Your chama's rules", "Each chama sets its own contribution amounts, loan terms and welfare cover. Officials approve money movements and the app requires a second official for large amounts and for anything involving their own money. Decisions are recorded in an audit trail that officials and members can read."],
      ["Records", "Financial records are kept for the life of the chama so members can check them. If you close your account your name and contact details are erased, but the money records stay, shown against a former member."],
      ["Fair use", "Do not enter false payments, share another person's details, or try to get around the approval rules. We may suspend accounts that do."],
      ["Changes", "We will tell you in the app when these terms change in a way that matters to you."],
    ],
  },
  "/privacy": {
    title: "Privacy notice",
    sections: [
      ["What we collect", "Your name, email, phone number, and, if you choose to add it, your national ID number and a profile photo. We also keep your chama activity: contributions, loans, guarantees, welfare claims and the approvals made on them."],
      ["Why", "To run your chama's records, to let officials check and approve money movements, and to keep your account secure. We do not sell your data or use it for advertising."],
      ["Who sees it", "Officials of the chamas you belong to see your activity in those chamas. Other members see your name and the group's totals. Your national ID is stored encrypted and is only shown to you."],
      ["Security", "Passwords are stored as one-way hashes. Sessions are short and can be ended from every device. Every sign-in and money action is written to an audit trail that is checked for tampering."],
      ["Your rights", "From your profile you can download a copy of your data and close your account, which erases your personal details. Money records are kept for the chamas that need them, without your identity attached. To correct something you cannot edit yourself, contact your chama's officials or us."],
      ["Contact", "Questions about your data can be sent to the address shown on the sign-in page of the app."],
    ],
  },
};

export default function Legal() {
  const { pathname } = useLocation();
  const doc = DOCS[pathname] || DOCS["/terms"];
  return (
    <div className="cs-auth">
      <main className="cs-auth-card" style={{ maxWidth: 720 }}>
        <h1>{doc.title}</h1>
        {doc.sections.map(([h, t]) => (
          <section key={h}>
            <h2 className="cs-card-title">{h}</h2>
            <p>{t}</p>
          </section>
        ))}
        <p><Link to="/register">Back to sign up</Link></p>
      </main>
    </div>
  );
}
