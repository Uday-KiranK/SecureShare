// src/pages/auth/Callback.tsx
import { useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

export default function Callback() {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const hash = location.hash.substring(1);
    const params = new URLSearchParams(hash);
    const access_token = params.get("access_token");
    const refresh_token = params.get("refresh_token");

    if (access_token && refresh_token) {
      supabase.auth.setSession({ access_token, refresh_token }).then(() => {
        navigate("/dashboard");
      });
    }
  }, [location, navigate]);

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="text-center space-y-4">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        <p className="text-lg">Confirming your email...</p>
      </div>
    </div>
  );
}
