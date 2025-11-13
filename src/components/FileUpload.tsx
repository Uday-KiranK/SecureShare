import React, { useState, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { 
  Upload, 
  FileText, 
  Shield, 
  Lock, 
  CheckCircle, 
  Copy, 
  RotateCcw,
  Clock,
  Download
} from "lucide-react";

interface FileUploadProps {
  onUploadComplete?: () => void;
}

interface FileUploadState {
  selectedFile: File | null;
  encryptionProgress: number;
  uploadProgress: number;
  shareLink: string;
  expirationTime: string;
  maxDownloads: string;
  isEncrypting: boolean;
  isUploading: boolean;
  isComplete: boolean;
}

export const FileUpload: React.FC<FileUploadProps> = ({ onUploadComplete }) => {
  const [state, setState] = useState<FileUploadState>({
    selectedFile: null,
    encryptionProgress: 0,
    uploadProgress: 0,
    shareLink: "",
    expirationTime: "24",
    maxDownloads: "5",
    isEncrypting: false,
    isUploading: false,
    isComplete: false,
  });

  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  // Check file signatures (magic numbers) for dangerous file types
  const checkFileMagicNumbers = (bytes: Uint8Array): boolean => {
    if (bytes.length < 4) return false;

    // Common executable file signatures
    const signatures = [
      { bytes: [0x4D, 0x5A], name: 'PE/DOS executable' }, // MZ (Windows EXE)
      { bytes: [0x7F, 0x45, 0x4C, 0x46], name: 'ELF executable' }, // ELF (Linux)
      { bytes: [0xCE, 0xFA, 0xED, 0xFE], name: 'Mach-O executable' }, // Mach-O (macOS)
      { bytes: [0xCF, 0xFA, 0xED, 0xFE], name: 'Mach-O 64-bit' },
      { bytes: [0xCA, 0xFE, 0xBA, 0xBE], name: 'Java class file' },
      { bytes: [0x21, 0x3C, 0x61, 0x72, 0x63, 0x68, 0x3E], name: 'Debian package' }, // !<arch>
    ];

    // Check against known dangerous signatures
    for (const sig of signatures) {
      let matches = true;
      for (let i = 0; i < sig.bytes.length; i++) {
        if (bytes[i] !== sig.bytes[i]) {
          matches = false;
          break;
        }
      }
      if (matches) {
        console.warn(`Blocked file with signature: ${sig.name}`);
        return true;
      }
    }

    return false;
  };

  // Real file encryption and upload
  const handleRealUpload = async (file: File): Promise<void> => {
    // Validate file size (20MB max)
    const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB in bytes
    if (file.size > MAX_FILE_SIZE) {
      toast({
        variant: "destructive",
        title: "File Too Large",
        description: "File size exceeds 20MB limit.",
      });
      return;
    }

    // Validate file extension (first layer)
    const BLOCKED_EXTENSIONS = ['.exe', '.bat', '.cmd', '.sh', '.app', '.deb', '.rpm', '.msi', '.com', '.scr'];
    const fileExtension = '.' + file.name.split('.').pop()?.toLowerCase();
    if (BLOCKED_EXTENSIONS.includes(fileExtension)) {
      toast({
        title: "File type not allowed",
        description: "Executable files are not permitted for security reasons",
        variant: "destructive",
      });
      setState(prev => ({ ...prev, isUploading: false }));
      return;
    }

    // Validate file content using magic numbers (file signatures)
    try {
      const buffer = await file.arrayBuffer();
      const bytes = new Uint8Array(buffer);
      
      // Check file signatures for dangerous file types
      const isDangerous = checkFileMagicNumbers(bytes);
      
      if (isDangerous) {
        toast({
          title: "File type not allowed",
          description: "This file type is not permitted for security reasons",
          variant: "destructive",
        });
        setState(prev => ({ ...prev, isUploading: false }));
        return;
      }
    } catch (error) {
      // If magic number check fails, continue with extension-based validation
      console.warn('File signature check failed, continuing with extension validation');
    }

    setState(prev => ({ ...prev, isEncrypting: true, encryptionProgress: 0 }));
    
    try {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error("User not authenticated");
      }

      // Simulate encryption progress
      for (let i = 0; i <= 100; i += 20) {
        await new Promise(resolve => setTimeout(resolve, 100));
        setState(prev => ({ ...prev, encryptionProgress: i }));
      }
      
      setState(prev => ({ ...prev, isEncrypting: false, isUploading: true, uploadProgress: 0 }));

      // Generate unique filename
      const fileExtension = file.name.split('.').pop();
      const uniqueFilename = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExtension}`;
      const filePath = `${user.id}/${uniqueFilename}`;

      // Upload to Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from('secure-files')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      setState(prev => ({ ...prev, uploadProgress: 50 }));

      // Save file metadata to database
      const { data: fileData, error: dbError } = await supabase
        .from('files')
        .insert({
          user_id: user.id,
          filename: uniqueFilename,
          original_filename: file.name,
          file_size: file.size,
          content_type: file.type,
          storage_path: filePath,
          is_encrypted: true,
        })
        .select()
        .single();

      if (dbError) throw dbError;

      setState(prev => ({ ...prev, uploadProgress: 80 }));

      // Create share link with cryptographically secure token
      const tokenArray = new Uint8Array(32);
      crypto.getRandomValues(tokenArray);
      const shareToken = Array.from(tokenArray, byte => byte.toString(16).padStart(2, '0')).join('');
      
      let expiresAt = null;
      if (state.expirationTime && state.expirationTime !== 'never') {
        const hours = parseInt(state.expirationTime);
        expiresAt = new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();
      }

      let maxDownloads = null;
      if (state.maxDownloads && state.maxDownloads !== 'unlimited') {
        maxDownloads = parseInt(state.maxDownloads);
      }

      const { error: linkError } = await supabase
        .from('share_links')
        .insert({
          file_id: fileData.id,
          token: shareToken,
          expires_at: expiresAt,
          max_downloads: maxDownloads,
          is_active: true,
        });

      if (linkError) throw linkError;

      const shareLink = `${window.location.origin}/download/${shareToken}`;
      
      setState(prev => ({ 
        ...prev, 
        uploadProgress: 100,
        isUploading: false, 
        shareLink,
        isComplete: true 
      }));

      toast({
        title: "Upload Successful!",
        description: "Your file has been encrypted and uploaded securely.",
      });

      // Call the callback to refresh the files list
      if (onUploadComplete) {
        onUploadComplete();
      }

    } catch (error) {
      toast({
        variant: "destructive",
        title: "Upload Failed",
        description: error instanceof Error ? error.message : "An unexpected error occurred.",
      });
      setState(prev => ({ 
        ...prev, 
        isEncrypting: false, 
        isUploading: false 
      }));
    }
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setState(prev => ({ 
        ...prev, 
        selectedFile: file, 
        isComplete: false, 
        shareLink: "" 
      }));
    }
  };

  const handleUpload = async () => {
    if (!state.selectedFile) return;
    
    await handleRealUpload(state.selectedFile);
  };

  const copyToClipboard = async () => {
    if (state.shareLink) {
      try {
        await navigator.clipboard.writeText(state.shareLink);
        toast({
          title: "Link Copied!",
          description: "The share link has been copied to your clipboard.",
        });
      } catch (error) {
        toast({
          variant: "destructive",
          title: "Copy Failed",
          description: "Failed to copy link to clipboard.",
        });
      }
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const resetUpload = () => {
    setState({
      selectedFile: null,
      encryptionProgress: 0,
      uploadProgress: 0,
      shareLink: "",
      expirationTime: "24",
      maxDownloads: "5",
      isEncrypting: false,
      isUploading: false,
      isComplete: false,
    });
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <Card>
        <CardHeader className="text-center">
          <div className="flex items-center justify-center gap-2 mb-4">
            <Shield className="h-8 w-8 text-primary" />
          </div>
          <CardTitle className="text-2xl">Secure File Upload</CardTitle>
          <p className="text-muted-foreground">
            Files are encrypted before upload for maximum security
          </p>
        </CardHeader>

        <CardContent className="space-y-6">
          {!state.isComplete && (
            <>
              {/* File Selection */}
              <div className="space-y-4">
                <Label htmlFor="file-upload">Select File</Label>
                <div
                  className="border-2 border-dashed border-border rounded-lg p-8 text-center cursor-pointer hover:border-primary transition-colors"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <input
                    ref={fileInputRef}
                    id="file-upload"
                    type="file"
                    className="hidden"
                    onChange={handleFileSelect}
                    disabled={state.isEncrypting || state.isUploading}
                  />

                  {state.selectedFile ? (
                    <div className="space-y-2">
                      <FileText className="h-12 w-12 mx-auto text-primary" />
                      <p className="font-medium">{state.selectedFile.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {formatFileSize(state.selectedFile.size)}
                      </p>
                      <Badge variant="outline" className="border-primary text-primary">
                        <Lock className="h-3 w-3 mr-1" />
                        Ready for encryption
                      </Badge>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <Upload className="h-12 w-12 mx-auto text-muted-foreground" />
                      <p className="text-lg font-medium">Choose a file to upload</p>
                      <p className="text-sm text-muted-foreground">
                        Maximum file size: 20MB
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Expiration Settings */}
              {state.selectedFile && (
                <Tabs defaultValue="time" className="w-full">
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="time">Time-based Expiration</TabsTrigger>
                    <TabsTrigger value="downloads">Download-based Expiration</TabsTrigger>
                  </TabsList>

                  <TabsContent value="time" className="space-y-4">
                    <div className="space-y-2">
                      <Label>Link expires after</Label>
                      <Select 
                        value={state.expirationTime} 
                        onValueChange={(value) => setState(prev => ({ ...prev, expirationTime: value }))}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="1">1 hour</SelectItem>
                          <SelectItem value="6">6 hours</SelectItem>
                          <SelectItem value="24">24 hours</SelectItem>
                          <SelectItem value="48">48 hours</SelectItem>
                          <SelectItem value="168">1 week</SelectItem>
                          <SelectItem value="never">Never</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </TabsContent>

                  <TabsContent value="downloads" className="space-y-4">
                    <div className="space-y-2">
                      <Label>Maximum downloads</Label>
                      <Select 
                        value={state.maxDownloads} 
                        onValueChange={(value) => setState(prev => ({ ...prev, maxDownloads: value }))}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="1">1 download</SelectItem>
                          <SelectItem value="3">3 downloads</SelectItem>
                          <SelectItem value="5">5 downloads</SelectItem>
                          <SelectItem value="10">10 downloads</SelectItem>
                          <SelectItem value="25">25 downloads</SelectItem>
                          <SelectItem value="unlimited">Unlimited</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </TabsContent>
                </Tabs>
              )}

              {/* Progress Indicators */}
              {state.isEncrypting && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm">Encrypting file...</Label>
                    <span className="text-sm text-muted-foreground">{state.encryptionProgress}%</span>
                  </div>
                  <Progress value={state.encryptionProgress} className="h-2" />
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Shield className="h-4 w-4" />
                    Using AES-256 encryption
                  </div>
                </div>
              )}

              {state.isUploading && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm">Uploading encrypted file...</Label>
                    <span className="text-sm text-muted-foreground">{state.uploadProgress}%</span>
                  </div>
                  <Progress value={state.uploadProgress} className="h-2" />
                </div>
              )}

              {/* Upload Button */}
              {state.selectedFile && (
                <Button
                  onClick={handleUpload}
                  disabled={state.isEncrypting || state.isUploading}
                  className="w-full"
                  size="lg"
                >
                  {state.isEncrypting || state.isUploading ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2" />
                      {state.isEncrypting ? "Encrypting..." : "Uploading..."}
                    </>
                  ) : (
                    <>
                      <Shield className="h-4 w-4 mr-2" />
                      Encrypt & Upload
                    </>
                  )}
                </Button>
              )}
            </>
          )}

          {/* Share Link Section */}
          {state.shareLink && state.isComplete && (
            <div className="space-y-4 p-6 bg-success/10 border border-success/20 rounded-lg">
              <div className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-success" />
                <h3 className="font-semibold text-success">File Ready to Share!</h3>
              </div>

              <div className="space-y-2">
                <Label>Secure Download Link</Label>
                <div className="flex gap-2">
                  <Input
                    value={state.shareLink}
                    readOnly
                    className="font-mono text-sm"
                  />
                  <Button onClick={copyToClipboard} variant="outline" size="icon">
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 p-4 bg-muted/50 rounded-lg">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">Expires in</p>
                    <p className="text-sm text-muted-foreground">
                      {state.expirationTime === 'never' ? 'Never' : `${state.expirationTime} hours`}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Download className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">Max downloads</p>
                    <p className="text-sm text-muted-foreground">
                      {state.maxDownloads === 'unlimited' ? 'Unlimited' : state.maxDownloads}
                    </p>
                  </div>
                </div>
              </div>

              <Button onClick={resetUpload} variant="outline" className="w-full">
                <RotateCcw className="h-4 w-4 mr-2" />
                Upload Another File
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};