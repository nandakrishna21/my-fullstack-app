import { io } from "socket.io-client";
const token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MTYsInVzZXJuYW1lIjoidGVzdHVzZXI5OSIsImlzX2FkbWluIjp0cnVlLCJpYXQiOjE3ODA5MDExNjEsImV4cCI6MTc4MDk4NzU2MX0.yEBH7Oq6GMDCWx2EhTurt7YmWwFmgID28ryH_aiQknA";
const socket = io("https://chat-app-backend-fdhs.onrender.com");
socket.on("connect", () => {
  console.log("Connected:", socket.id);
  socket.emit("join", { id: 16, username: "testuser99", status: "online" });
  socket.emit("send_message", { roomId: 1, userId: 16, username: "testuser99", content: "Hello from test script" });
  setTimeout(async () => {
    const r = await fetch("https://chat-app-backend-fdhs.onrender.com/api/messages?room_id=1", { headers: { Authorization: `Bearer ${token}` } });
    const msgs = await r.json();
    if (msgs.length > 0) {
      const msgId = msgs[msgs.length - 1].id;
      console.log("Reacting to message id:", msgId);
      const reactRes = await fetch(`https://chat-app-backend-fdhs.onrender.com/api/messages/${msgId}/react`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ emoji: "👍" }) });
      const reactData = await reactRes.json();
      console.log("React response:", JSON.stringify(reactData, null, 2));
      console.log("Reactions type:", typeof reactData.reactions);
      console.log("Reactions value:", reactData.reactions);
    }
    process.exit(0);
  }, 2000);
});
socket.on("connect_error", (err) => { console.error("Socket error:", err.message); process.exit(1); });
setTimeout(() => { console.log("Timeout"); process.exit(1); }, 10000);
