import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Home from './pages/Home';
import DataViewer from './pages/DataViewer';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/data-viewer" element={<DataViewer />} />
      </Routes>
    </BrowserRouter>
  );
}
