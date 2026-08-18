import { Routes, Route } from "react-router-dom";
import Landing from "./pages/Landing.jsx";
import Room from "./pages/Room.jsx";
import Filmstrip from "./components/Filmstrip.jsx";

export default function App() {
  return (
    <>
      <Filmstrip side="left" />
      <Filmstrip side="right" />
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/room/:code" element={<Room />} />
      </Routes>
    </>
  );
}
