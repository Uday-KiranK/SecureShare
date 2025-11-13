// src/components/ProtectedRoute.tsx
export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
  // LOCAL DEV: SKIP AUTH ENTIRELY
  if (import.meta.env.DEV) {
    return <>{children}</>;
  }

  // PRODUCTION: REAL AUTH (you can add back later)
  return <>{children}</>;
}
