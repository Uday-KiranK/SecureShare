import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { FileUpload } from "@/components/FileUpload";
import { 
  LogOut, 
  Files, 
  Upload, 
  Download, 
  ExternalLink, 
  Trash2, 
  Calendar,
  Eye,
  Clock,
  Share
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface UserFile {
  id: string;
  filename: string;
  original_filename: string;
  file_size: number;
  storage_path: string;
  created_at: string;
  share_links: {
    id: string;
    token: string;
    expires_at: string | null;
    max_downloads: number | null;
    current_downloads: number;
    is_active: boolean;
  }[];
}

const Dashboard = () => {
  const [user, setUser] = useState<any>(null);
  const [displayName, setDisplayName] = useState<string>("");
  const [files, setFiles] = useState<UserFile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    // Check authentication and get user data
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate("/auth");
        return;
      }
      setUser(session.user);
      
      // Fetch user profile to get display name
      const { data: profile } = await supabase
        .from('profiles')
        .select('display_name')
        .eq('user_id', session.user.id)
        .single();
      
      setDisplayName(profile?.display_name || session.user.email?.split('@')[0] || 'User');
      
      await fetchFiles();
      setIsLoading(false);
    };

    checkAuth();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (event === 'SIGNED_OUT' || !session) {
          navigate("/auth");
        } else {
          setUser(session.user);
        }
      }
    );

    return () => subscription.unsubscribe();
  }, [navigate]);

  const fetchFiles = async () => {
    try {
      const { data, error } = await supabase
        .from('files')
        .select(`
  id,
  filename,
  original_filename,
  file_size,
  storage_path,
  created_at,
  share_links (
            id,
            token,
            expires_at,
            max_downloads,
            current_downloads,
            is_active
          )
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setFiles(data || []);
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to fetch files. Please try again.",
      });
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    toast({
      title: "Signed Out",
      description: "You have been successfully signed out.",
    });
  };

  const handleDeleteFile = async (fileId: string, storagePath: string) => {
    try {
      // First, delete the file from storage
      const { error: storageError } = await supabase.storage
        .from("secure-files")
        .remove([storagePath]);

      if (storageError) {
        throw new Error(`Failed to delete file from storage: ${storageError.message}`);
      }

      // Then delete the database record
      const { error: dbError } = await supabase
        .from("files")
        .delete()
        .eq("id", fileId);

      if (dbError) throw dbError;

      toast({
        title: "File deleted",
        description: "Your file has been completely removed from storage and database",
      });

      fetchFiles();
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to delete file",
        variant: "destructive",
      });
    }
  };

  const copyShareLink = async (token: string) => {
    const shareUrl = `${window.location.origin}/download/${token}`;
    try {
      await navigator.clipboard.writeText(shareUrl);
      toast({
        title: "Link Copied",
        description: "Share link has been copied to clipboard.",
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to copy link to clipboard.",
      });
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background/80 to-primary/5 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background/80 to-primary/5">
      {/* Header */}
      <header className="border-b border-border/50 bg-card/95 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Files className="h-8 w-8 text-primary" />
              <div>
                <h1 className="text-xl font-semibold">SecureShare Dashboard</h1>
                <p className="text-sm text-muted-foreground">Welcome back, {displayName}</p>
              </div>
            </div>
            <Button variant="outline" onClick={handleSignOut}>
              <LogOut className="h-4 w-4 mr-2" />
              Sign Out
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Tabs defaultValue="upload" className="space-y-6">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="upload" className="flex items-center gap-2">
              <Upload className="h-4 w-4" />
              Upload Files
            </TabsTrigger>
            <TabsTrigger value="files" className="flex items-center gap-2">
              <Files className="h-4 w-4" />
              My Files
            </TabsTrigger>
          </TabsList>

          <TabsContent value="upload">
            <Card>
              <CardHeader>
                <CardTitle>Upload New File</CardTitle>
                <CardDescription>
                  Securely upload and share your files with encryption
                </CardDescription>
              </CardHeader>
              <CardContent>
                <FileUpload onUploadComplete={fetchFiles} />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="files" className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-semibold">Your Files</h2>
                <p className="text-muted-foreground">
                  Manage your uploaded files and share links
                </p>
              </div>
              <Badge variant="secondary" className="text-sm">
                {files.length} file{files.length !== 1 ? 's' : ''}
              </Badge>
            </div>

            {files.length === 0 ? (
              <Card className="text-center py-12">
                <CardContent>
                  <Files className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-medium mb-2">No files uploaded yet</h3>
                  <p className="text-muted-foreground mb-4">
                    Upload your first file to get started with secure sharing
                  </p>
              <Button onClick={() => {
                const uploadTab = document.querySelector('[value="upload"]') as HTMLElement;
                uploadTab?.click();
              }}>
                <Upload className="h-4 w-4 mr-2" />
                Upload File
              </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4">
                {files.map((file) => (
                  <Card key={file.id} className="hover:shadow-md transition-shadow">
                    <CardContent className="p-6">
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex-1 min-w-0">
                          <h3 className="font-medium text-lg truncate">
                            {file.original_filename}
                          </h3>
                          <div className="flex items-center gap-4 text-sm text-muted-foreground mt-1">
                            <span>{formatFileSize(file.file_size)}</span>
                            <span className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              {formatDistanceToNow(new Date(file.created_at), { addSuffix: true })}
                            </span>
                          </div>
                        </div>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => handleDeleteFile(file.id, file.storage_path)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>

                      {file.share_links.length > 0 && (
                        <div className="space-y-2">
                          <h4 className="font-medium flex items-center gap-2">
                            <Share className="h-4 w-4" />
                            Share Links
                          </h4>
                          {file.share_links.map((link) => (
                            <div
                              key={link.id}
                              className="flex items-center justify-between p-3 bg-muted/30 rounded-lg"
                            >
                              <div className="flex items-center gap-3">
                                <Badge
                                  variant={link.is_active ? "default" : "secondary"}
                                >
                                  {link.is_active ? "Active" : "Inactive"}
                                </Badge>
                                <div className="text-sm text-muted-foreground">
                                  <div className="flex items-center gap-1">
                                    <Download className="h-3 w-3" />
                                    {link.current_downloads}
                                    {link.max_downloads && ` / ${link.max_downloads}`}
                                  </div>
                                  {link.expires_at && (
                                    <div className="flex items-center gap-1 mt-1">
                                      <Clock className="h-3 w-3" />
                                      Expires {formatDistanceToNow(new Date(link.expires_at), { addSuffix: true })}
                                    </div>
                                  )}
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => copyShareLink(link.token)}
                                >
                                  <ExternalLink className="h-4 w-4 mr-1" />
                                  Copy Link
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default Dashboard;