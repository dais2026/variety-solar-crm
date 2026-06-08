import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Send, Loader2, Mail, FileText } from "lucide-react";

interface ComposeEmailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Pre-fill recipient info (e.g., from a lead row) */
  defaultRecipientName?: string;
  defaultRecipientEmail?: string;
}

export function ComposeEmailDialog({
  open,
  onOpenChange,
  defaultRecipientName = "",
  defaultRecipientEmail = "",
}: ComposeEmailDialogProps) {
  const [recipientName, setRecipientName] = useState(defaultRecipientName);
  const [recipientEmail, setRecipientEmail] = useState(defaultRecipientEmail);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [selectedTemplate, setSelectedTemplate] = useState<string>("");

  const { data: templatesData } = trpc.sendEmail.getTemplates.useQuery();
  const utils = trpc.useUtils();

  const sendMutation = trpc.sendEmail.send.useMutation({
    onSuccess: (data) => {
      toast.success(data.message);
      onOpenChange(false);
      resetForm();
      // Invalidate email tracking list so the new email shows up
      utils.emailTracking.list.invalidate();
      utils.emailTracking.recentOpens.invalidate();
    },
    onError: (error) => {
      toast.error(`Failed to send: ${error.message}`);
    },
  });

  // Update fields when defaults change (e.g., opening for a different lead)
  useEffect(() => {
    if (open) {
      setRecipientName(defaultRecipientName);
      setRecipientEmail(defaultRecipientEmail);
    }
  }, [open, defaultRecipientName, defaultRecipientEmail]);

  function resetForm() {
    setRecipientName("");
    setRecipientEmail("");
    setSubject("");
    setBody("");
    setSelectedTemplate("");
  }

  function handleTemplateChange(templateId: string) {
    setSelectedTemplate(templateId);
    if (templateId === "custom") {
      // Don't change subject/body for custom
      return;
    }
    const template = templatesData?.templates.find((t) => t.id === templateId);
    if (template) {
      // Replace {{name}} placeholder with recipient name
      const name = recipientName || "there";
      setSubject(template.subject);
      setBody(template.body.replace(/\{\{name\}\}/g, name));
    }
  }

  function handleSend() {
    if (!recipientName.trim()) {
      toast.error("Please enter a recipient name");
      return;
    }
    if (!recipientEmail.trim()) {
      toast.error("Please enter a recipient email");
      return;
    }
    if (!subject.trim()) {
      toast.error("Please enter a subject");
      return;
    }
    if (!body.trim()) {
      toast.error("Please enter an email body");
      return;
    }

    sendMutation.mutate({
      recipientName: recipientName.trim(),
      recipientEmail: recipientEmail.trim(),
      subject: subject.trim(),
      body: body.trim(),
      templateId: selectedTemplate || undefined,
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] bg-[#1a1a2e] border-[#2a2a4a] text-white max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-white">
            <Mail className="w-5 h-5 text-[#00e676]" />
            Send Tracked Email
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          {/* Template Selector */}
          <div className="space-y-1.5">
            <Label className="text-gray-300 text-sm flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5" />
              Template
            </Label>
            <Select value={selectedTemplate} onValueChange={handleTemplateChange}>
              <SelectTrigger className="bg-[#0d0d1a] border-[#2a2a4a] text-white">
                <SelectValue placeholder="Choose a template or write custom..." />
              </SelectTrigger>
              <SelectContent className="bg-[#1a1a2e] border-[#2a2a4a]">
                <SelectItem value="custom" className="text-white hover:bg-[#2a2a4a]">
                  Custom Email
                </SelectItem>
                {templatesData?.templates.map((t) => (
                  <SelectItem key={t.id} value={t.id} className="text-white hover:bg-[#2a2a4a]">
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Recipient Name */}
          <div className="space-y-1.5">
            <Label className="text-gray-300 text-sm">Recipient Name</Label>
            <Input
              value={recipientName}
              onChange={(e) => setRecipientName(e.target.value)}
              placeholder="e.g., Kian Flanagan"
              className="bg-[#0d0d1a] border-[#2a2a4a] text-white placeholder:text-gray-500"
            />
          </div>

          {/* Recipient Email */}
          <div className="space-y-1.5">
            <Label className="text-gray-300 text-sm">Recipient Email</Label>
            <Input
              value={recipientEmail}
              onChange={(e) => setRecipientEmail(e.target.value)}
              placeholder="e.g., kian@example.com"
              type="email"
              className="bg-[#0d0d1a] border-[#2a2a4a] text-white placeholder:text-gray-500"
            />
          </div>

          {/* Subject */}
          <div className="space-y-1.5">
            <Label className="text-gray-300 text-sm">Subject</Label>
            <Input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Email subject line"
              className="bg-[#0d0d1a] border-[#2a2a4a] text-white placeholder:text-gray-500"
            />
          </div>

          {/* Body */}
          <div className="space-y-1.5">
            <Label className="text-gray-300 text-sm">Message</Label>
            <Textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Write your email message..."
              rows={10}
              className="bg-[#0d0d1a] border-[#2a2a4a] text-white placeholder:text-gray-500 resize-none"
            />
          </div>

          {/* Tracking notice */}
          <div className="flex items-center gap-2 text-xs text-gray-400 bg-[#0d0d1a] rounded-md px-3 py-2 border border-[#2a2a4a]">
            <div className="w-2 h-2 rounded-full bg-[#00e676] animate-pulse" />
            A tracking pixel will be automatically embedded. You'll be notified when the recipient opens this email.
          </div>

          {/* Send Button */}
          <div className="flex justify-end gap-2 pt-2">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="border-[#2a2a4a] text-gray-300 hover:bg-[#2a2a4a]"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSend}
              disabled={sendMutation.isPending}
              className="bg-[#00e676] text-black hover:bg-[#00c853] font-medium"
            >
              {sendMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4 mr-2" />
                  Send Email
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
