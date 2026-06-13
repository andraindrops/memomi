import { Trash2 } from "lucide-react";
import { useEffect, useId, useMemo } from "react";
import { Button } from "@/renderer/components/ui/button";
import { Input } from "@/renderer/components/ui/input";
import { Label } from "@/renderer/components/ui/label";

interface ImageFieldProps {
  imageUrl: string | null;
  onImageUrlChange: (url: string | null) => void;
  file: File | null;
  onFileChange: (file: File | null) => void;
  label?: string;
}

export function ImageField({
  imageUrl,
  onImageUrlChange,
  file,
  onFileChange,
  label = "Image",
}: ImageFieldProps) {
  const inputId = useId();
  const filePreview = useMemo(
    () => (file != null ? URL.createObjectURL(file) : null),
    [file],
  );

  useEffect(() => {
    if (filePreview == null) return;
    return () => URL.revokeObjectURL(filePreview);
  }, [filePreview]);

  const preview = filePreview ?? imageUrl;

  function clear() {
    if (file != null) {
      onFileChange(null);
    } else {
      onImageUrlChange(null);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={inputId}>{label}</Label>
      {preview != null && (
        <div className="relative w-fit">
          <img
            src={preview}
            alt=""
            className="max-h-48 rounded-md object-cover"
          />
          <Button
            type="button"
            variant="secondary"
            size="icon"
            aria-label="Remove image"
            className="absolute right-2 top-2"
            onClick={clear}
          >
            <Trash2 />
          </Button>
        </div>
      )}
      <Input
        id={inputId}
        type="file"
        accept="image/*"
        onChange={(e) => onFileChange(e.target.files?.[0] ?? null)}
      />
    </div>
  );
}
