export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="auth">
      <section className="auth-art" aria-hidden="true">
        <div className="brand"><span className="brand-mark">ln</span><span>LN People</span></div>
        <p className="auth-quote">Everything about work here, in one calm place.</p>
        <p className="auth-foot">LN Webworks · Mohali</p>
      </section>
      <main className="auth-main">{children}</main>
    </div>
  );
}
