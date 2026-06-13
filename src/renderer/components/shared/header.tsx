import { ListTodo } from "lucide-react";
import { Link } from "wouter";

export function Header() {
  return (
    <header className="flex items-center justify-between">
      <Link href="/" className="flex items-center gap-2 text-xl font-bold">
        <ListTodo className="size-6" />
        Todo
      </Link>
    </header>
  );
}
