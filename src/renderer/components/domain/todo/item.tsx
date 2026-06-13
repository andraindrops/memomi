import { Pencil } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/renderer/components/ui/button";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/renderer/components/ui/card";
import type { Todo } from "@/shared/schemas/todo";

interface TodoItemProps {
  todo: Todo;
}

export function TodoItem({ todo }: TodoItemProps) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          <CardTitle>{todo.title}</CardTitle>
          <div className="flex gap-1">
            <Button asChild variant="ghost" size="icon" aria-label="Edit">
              <Link href={`/todos/${todo.id}/edit`}>
                <Pencil />
              </Link>
            </Button>
          </div>
        </div>
        {todo.description != null && (
          <CardDescription>{todo.description}</CardDescription>
        )}
      </CardHeader>
    </Card>
  );
}
