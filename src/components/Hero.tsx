import { useNavigate } from "react-router-dom";
import { Shield, Lock, Timer, Users, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export const Hero = () => {
  const navigate = useNavigate();

  return (
    <section className="relative py-20 bg-gradient-to-br from-primary/5 via-background to-primary/10 overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center space-y-12">
          <Badge variant="outline" className="text-sm">
            <Shield className="h-3 w-3 mr-1" />
            End-to-End Encrypted File Sharing
          </Badge>

          <div className="space-y-6">
            <h1 className="text-4xl sm:text-6xl font-bold bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
              Share Files Securely
            </h1>
            <p className="text-xl text-muted-foreground max-w-3xl mx-auto leading-relaxed">
              Upload, encrypt, and share your files with confidence. Every file is encrypted 
              in your browser before upload, ensuring maximum security and privacy.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 max-w-4xl mx-auto">
            <div className="flex flex-col items-center gap-4 p-6 rounded-xl bg-card border">
              <div className="p-3 bg-primary/10 rounded-full">
                <Lock className="h-6 w-6 text-primary" />
              </div>
              <div className="text-center">
                <h3 className="font-semibold mb-2">Client-Side Encryption</h3>
                <p className="text-sm text-muted-foreground">
                  Files are encrypted with AES-256 in your browser before upload
                </p>
              </div>
            </div>
            
            <div className="flex flex-col items-center gap-4 p-6 rounded-xl bg-card border">
              <div className="p-3 bg-primary/10 rounded-full">
                <Timer className="h-6 w-6 text-primary" />
              </div>
              <div className="text-center">
                <h3 className="font-semibold mb-2">Smart Expiration</h3>
                <p className="text-sm text-muted-foreground">
                  Set time limits and download counts for automatic cleanup
                </p>
              </div>
            </div>
            
            <div className="flex flex-col items-center gap-4 p-6 rounded-xl bg-card border">
              <div className="p-3 bg-primary/10 rounded-full">
                <Users className="h-6 w-6 text-primary" />
              </div>
              <div className="text-center">
                <h3 className="font-semibold mb-2">Easy Sharing</h3>
                <p className="text-sm text-muted-foreground">
                  Generate secure links that work on any device
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button 
              size="lg" 
              className="text-lg px-8"
              onClick={() => navigate("/auth")}
            >
              Start Sharing Now
              <ChevronRight className="ml-2 h-5 w-5" />
            </Button>
            <Button 
              variant="outline" 
              size="lg" 
              className="text-lg px-8"
              onClick={() => navigate("/auth")}
            >
              Learn More
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
};