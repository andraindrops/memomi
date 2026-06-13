import { Route, Router, Switch } from "wouter";
// eslint-disable-next-line import/no-unresolved
import { useHashLocation } from "wouter/use-hash-location";
import { TodoEditPage } from "@/renderer/pages/todo/edit";
import { TodoListPage } from "@/renderer/pages/todo/list";
import { Header } from "@/renderer/components/shared/header";
import { Toaster } from "@/renderer/components/ui/sonner";

export function App() {
  return (
    <Router hook={useHashLocation}>
      <div className="flex w-full flex-col items-center font-mono">
        <div className="container flex w-full max-w-2xl flex-col gap-8 p-8">
          <Header />
          <main>
            <Switch>
              <Route path="/" component={TodoListPage} />
              <Route path="/todos/:id/edit" component={TodoEditPage} />
              <Route>
                <p className="text-center text-muted-foreground">
                  Page not found.
                </p>
              </Route>
            </Switch>
          </main>
        </div>
        <Toaster />
      </div>
    </Router>
  );
}

export default App;
