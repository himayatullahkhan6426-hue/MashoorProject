import { BrowserRouter, Routes, Route } from "react-router-dom";

import Sidebar from "./components/Sidebar";
import Header from "./components/Header";
import Dashboard from "./pages/Dashboard";

import "./index.css";

function App() {
  return (
    <BrowserRouter>
      <div className="app-layout">

        <Sidebar />

        <main className="main-content">
          <Header />

          <div className="page-content">
            <Routes>
              <Route path="/" element={<Dashboard />} />
            </Routes>
          </div>

        </main>

      </div>
    </BrowserRouter>
  );
}

export default App;