import { createRoot } from 'react-dom/client';
import { PdfViewer } from './PdfViewer';
import 'pdfjs-dist/web/pdf_viewer.css';
import './pdfviewer.css';

const root = document.getElementById('root');
if (root) {
  createRoot(root).render(<PdfViewer />);
}
