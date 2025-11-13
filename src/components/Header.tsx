import { useNavigate } from "react-router-dom";
import { Shield } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Header = () => {
  const navigate = useNavigate();
  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Shield className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-xl font-bold">SecureShare</h1>
            <p className="text-xs text-muted-foreground">Secure file sharing</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => navigate("/auth")}
          >
            Sign In
          </Button>
          <Button 
            size="sm"
            onClick={() => navigate("/auth")}
          >
            Get Started
          </Button>
        </div>
      </div>
    </header>
  );
};