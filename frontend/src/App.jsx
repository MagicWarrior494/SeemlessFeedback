import { useEffect, useState } from "react";

export default function App() {
  const [apiMessage, setApiMessage] = useState("Loading...");

  useEffect(() => {
    fetch("http://127.0.0.1:8000/")
      .then((res) => res.json())
      .then((data) => setApiMessage(data.message))
      .catch(() => setApiMessage("Could not reach FastAPI backend"));
  }, []);

  return (
    <main className="container">
      <h1>Hello from React</h1>
      <p>Backend says: {apiMessage}</p>
    </main>
  );
}
