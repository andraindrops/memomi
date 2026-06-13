import { Plus } from "lucide-react";
import { useCallback, useState } from "react";
import { toast } from "sonner";
import { useLocation } from "wouter";
import { TodoItem } from "@/renderer/components/domain/todo/item";
import { ErrorMessage } from "@/renderer/components/shared/error-message";
import { LoadingMessage } from "@/renderer/components/shared/loading-message";
import { Button } from "@/renderer/components/ui/button";
import { useFetchState } from "@/renderer/hooks/use-fetch-state";
import { api } from "@/renderer/lib/api";
import type { Todo } from "@/shared/schemas/todo";

export function TodoListPage() {
  const [, navigate] = useLocation();
  const [creating, setCreating] = useState(false);
  const loader = useCallback(() => api.todos.list(), []);
  const { state } = useFetchState<Todo[]>({
    loader,
    errorMessage: "Failed to load todos",
  });

  async function handleCreate() {
    setCreating(true);
    try {
      const todo = await api.todos.create({
        title: "Untitled todo",
        description: null,
        imageUrl: null,
      });
      toast.success("Todo created");
      navigate(`/todos/${todo.id}/edit`);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to create todo",
      );
      setCreating(false);
    }
  }

  if (state.status === "error") return <ErrorMessage message={state.message} />;
  if (state.status === "loading") return <LoadingMessage />;

  const todos = state.value;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold">Todos</h1>
        <Button onClick={handleCreate} disabled={creating}>
          <Plus />
          Create todo
        </Button>
      </div>
      {todos.length === 0 && (
        <p className="text-muted-foreground">No todos yet.</p>
      )}
      {todos.map((todo) => (
        <TodoItem key={todo.id} todo={todo} />
      ))}
    </div>
  );
}
