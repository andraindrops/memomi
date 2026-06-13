import { Trash2 } from "lucide-react";
import { useCallback, useState } from "react";
import { toast } from "sonner";
import { useLocation } from "wouter";
import { TodoForm } from "@/renderer/components/domain/todo/form";
import { ErrorMessage } from "@/renderer/components/shared/error-message";
import { LoadingMessage } from "@/renderer/components/shared/loading-message";
import { Button } from "@/renderer/components/ui/button";
import { useFetchState } from "@/renderer/hooks/use-fetch-state";
import { api } from "@/renderer/lib/api";
import { uploadImage } from "@/renderer/lib/images";
import type { Todo, TodoFormValues } from "@/shared/schemas/todo";

interface TodoEditPageProps {
  params: { id: string };
}

export function TodoEditPage({ params }: TodoEditPageProps) {
  const [, navigate] = useLocation();
  const [deleting, setDeleting] = useState(false);
  const loader = useCallback(() => api.todos.get(params.id), [params.id]);
  const { state } = useFetchState<Todo>({
    loader,
    errorMessage: "Failed to load todo",
  });

  async function handleSubmit({
    values,
    imageFile,
    imageUrl,
  }: {
    values: TodoFormValues;
    imageFile: File | null;
    imageUrl: string | null;
  }) {
    try {
      const uploadedUrl = await uploadImage({ imageFile });
      const nextImageUrl = uploadedUrl ?? imageUrl;

      await api.todos.update(params.id, {
        title: values.title,
        description: values.description || null,
        imageUrl: nextImageUrl,
      });
      toast.success("Todo updated");
      navigate("/");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to update todo",
      );
    }
  }

  async function handleDelete() {
    setDeleting(true);
    try {
      await api.todos.delete(params.id);
      toast.success("Todo deleted");
      navigate("/");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to delete todo",
      );
      setDeleting(false);
    }
  }

  if (state.status === "error") return <ErrorMessage message={state.message} />;
  if (state.status === "loading") return <LoadingMessage />;

  const todo = state.value;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Edit todo</h1>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Delete"
          onClick={handleDelete}
          disabled={deleting}
        >
          <Trash2 />
        </Button>
      </div>
      <TodoForm
        defaultValues={{
          title: todo.title,
          description: todo.description ?? "",
        }}
        defaultImageUrl={todo.imageUrl}
        submitLabel="Save"
        onSubmit={handleSubmit}
      />
    </div>
  );
}
