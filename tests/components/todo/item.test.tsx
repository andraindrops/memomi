import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { TodoItem } from "@/renderer/components/domain/todo/item";
import type { Todo } from "@/shared/schemas/todo";

const todo: Todo = {
  id: "todo-1-id",
  title: "Test Todo 1",
  description: "Test Description 1",
  imageUrl: null,
  createdUserId: "user-1-id",
  updatedUserId: "user-1-id",
  createdAt: new Date("2026-06-13T00:00:00Z"),
  updatedAt: new Date("2026-06-13T00:00:00Z"),
};

describe("TodoItem", () => {
  it("renders the title and description", () => {
    const { getByText } = render(<TodoItem todo={todo} />);
    expect(getByText("Test Todo 1")).toBeTruthy();
    expect(getByText("Test Description 1")).toBeTruthy();
  });

  it("renders a link to the edit page", () => {
    const { getByLabelText } = render(<TodoItem todo={todo} />);
    expect(getByLabelText("Edit").getAttribute("href")).toBe(
      `/todos/${todo.id}/edit`,
    );
  });
});
