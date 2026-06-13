import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { ImageField } from "@/renderer/components/shared/image-field";
import { Button } from "@/renderer/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/renderer/components/ui/form";
import { Input } from "@/renderer/components/ui/input";
import { Textarea } from "@/renderer/components/ui/textarea";
import { todoFormSchema, type TodoFormValues } from "@/shared/schemas/todo";

interface TodoFormProps {
  defaultValues?: Partial<TodoFormValues>;
  defaultImageUrl?: string | null;
  submitLabel: string;
  onSubmit: (args: {
    values: TodoFormValues;
    imageFile: File | null;
    imageUrl: string | null;
  }) => Promise<void>;
}

export function TodoForm({
  defaultValues,
  defaultImageUrl,
  submitLabel,
  onSubmit,
}: TodoFormProps) {
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(
    defaultImageUrl ?? null,
  );
  const form = useForm<TodoFormValues>({
    resolver: zodResolver(todoFormSchema),
    defaultValues: { title: "", description: "", ...defaultValues },
  });

  return (
    <Form {...form}>
      <form
        className="flex flex-col gap-6"
        onSubmit={form.handleSubmit((values) =>
          onSubmit({ values, imageFile, imageUrl }),
        )}
      >
        <FormField
          control={form.control}
          name="title"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Title</FormLabel>
              <FormControl>
                <Input {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Description</FormLabel>
              <FormControl>
                <Textarea rows={4} {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <ImageField
          imageUrl={imageUrl}
          onImageUrlChange={setImageUrl}
          file={imageFile}
          onFileChange={setImageFile}
        />

        <Button type="submit" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting && <Loader2 className="animate-spin" />}
          {submitLabel}
        </Button>
      </form>
    </Form>
  );
}
