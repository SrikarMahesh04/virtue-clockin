import { RouteLink as Link } from "@/components/app-navigation";
export default function NotFound() {
  return (
    <main className="auth-bg">
      <section className="card auth-card">
        <h1>Page Not Found</h1>
        <p>This page is unavailable.</p>
        <Link href="/login">Return To Sign In</Link>
      </section>
    </main>
  );
}
