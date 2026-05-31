import React, { useState } from "react";
import { createRoot } from "react-dom/client";

import "./index.css";

function App() {
  const [count, setCount] = useState(0);

  return (
    <main className="p-4 font-mono">
      <div>
        Count: <span>{count}</span>
      </div>
      <div>
        <button type="button" onClick={() => setCount((value) => value + 1)}>
          Increment
        </button>
      </div>
    </main>
  );
}

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
