import { useEffect, useRef, useState } from "react";

export default function Chat({ messages, onSend }) {
  const [text, setText] = useState("");
  const logRef = useRef(null);

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [messages]);

  function handleSubmit(e) {
    e.preventDefault();
    const trimmed = text.trim();
    if (!trimmed) return;
    onSend(trimmed);
    setText("");
  }

  return (
    <div className="panel-block chat-block">
      <h2 className="panel-title">Chat</h2>
      <ul className="chat-log" ref={logRef}>
        {messages.map((m, i) =>
          m.system ? (
            <li key={i} className="chat-system">
              {m.text}
            </li>
          ) : (
            <li key={i}>
              <span className="chat-name" style={{ color: m.color }}>
                {m.name}:
              </span>
              {m.text}
            </li>
          )
        )}
      </ul>
      <form className="chat-form" onSubmit={handleSubmit}>
        <input
          type="text"
          placeholder="Say something..."
          maxLength={500}
          autoComplete="off"
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <button className="btn btn-primary btn-small" type="submit">
          Send
        </button>
      </form>
    </div>
  );
}
