import React, { useState } from 'react';
import { PDFDocument } from 'pdf-lib';
import Docxtemplater from 'docxtemplater';
import PizZip from 'pizzip';
import { saveAs } from 'file-saver';

const App: React.FC = () => {
  const [pdfFiles, setPdfFiles] = useState<File[]>([]);
  const [docxTemplate, setDocxTemplate] = useState<File | null>(null);
  const [pageNumberPosition, setPageNumberPosition] = useState<'left' | 'right' | 'outside' | 'inside'>('right');
  const [catalogEntries, setCatalogEntries] = useState<string[]>([]);

  const handlePdfUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) {
      setPdfFiles(Array.from(event.target.files));
      setCatalogEntries(Array.from(event.target.files).map(file => file.name));
    }
  };

  const handleDocxUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) {
      setDocxTemplate(event.target.files[0]);
    }
  };

  const handleCatalogEntryChange = (index: number, value: string) => {
    const newEntries = [...catalogEntries];
    newEntries[index] = value;
    setCatalogEntries(newEntries);
  };

  const mergePDFs = async () => {
    const mergedPdf = await PDFDocument.create();

    for (const pdfFile of pdfFiles) {
      const pdfBytes = await pdfFile.arrayBuffer();
      const pdf = await PDFDocument.load(pdfBytes);
      const copiedPages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
      copiedPages.forEach((page) => mergedPdf.addPage(page));
    }

    const font = await mergedPdf.embedFont('Helvetica');

    mergedPdf.getPages().forEach((page, index) => {
      const { width, height } = page.getSize();
      const fontSize = 12;
      const pageNumber = `${index + 1}`;

      let x, y;
      switch (pageNumberPosition) {
        case 'left':
          x = 50;
          y = 30;
          break;
        case 'right':
          x = width - 50;
          y = 30;
          break;
        case 'outside':
          x = index % 2 === 0 ? width - 50 : 50;
          y = 30;
          break;
        case 'inside':
          x = index % 2 === 0 ? 50 : width - 50;
          y = 30;
          break;
      }

      page.drawText(pageNumber, {
        x,
        y,
        size: fontSize,
        font,
        color: PDFDocument.rgb(0, 0, 0),
      });
    });

    return mergedPdf;
  };

  const generateCatalog = async () => {
    if (!docxTemplate) {
      throw new Error('No DOCX template uploaded');
    }

    const templateContent = await docxTemplate.arrayBuffer();
    const zip = new PizZip(templateContent);
    const doc = new Docxtemplater(zip, {
      paragraphLoop: true,
      linebreaks: true,
    });

    doc.render({ entries: catalogEntries });

    const generatedDoc = doc.getZip().generate({
      type: 'blob',
      mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    });

    return generatedDoc;
  };

  const handleSubmit = async () => {
    try {
      const mergedPdf = await mergePDFs();
      const catalog = await generateCatalog();

      // Convert catalog to PDF
      const catalogPdf = await PDFDocument.create();
      const catalogPdfBytes = await catalogPdf.save();

      // Merge catalog with the main PDF
      const finalPdf = await PDFDocument.create();
      const [catalogDoc, mainDoc] = await Promise.all([
        PDFDocument.load(catalogPdfBytes),
        PDFDocument.load(await mergedPdf.save()),
      ]);

      const copiedCatalogPages = await finalPdf.copyPages(catalogDoc, catalogDoc.getPageIndices());
      const copiedMainPages = await finalPdf.copyPages(mainDoc, mainDoc.getPageIndices());

      copiedCatalogPages.forEach((page) => finalPdf.addPage(page));
      copiedMainPages.forEach((page) => finalPdf.addPage(page));

      const pdfBytes = await finalPdf.save();
      const blob = new Blob([pdfBytes], { type: 'application/pdf' });
      saveAs(blob, 'merged_document_with_catalog.pdf');
    } catch (error) {
      console.error('Error generating document:', error);
      alert('An error occurred while generating the document. Please try again.');
    }
  };

  return (
    <div>
      <h1>PDF Merger and Catalog Generator</h1>
      <div>
        <h2>Upload PDFs</h2>
        <input type="file" multiple accept=".pdf" onChange={handlePdfUpload} />
      </div>
      <div>
        <h2>Upload DOCX Template</h2>
        <input type="file" accept=".docx" onChange={handleDocxUpload} />
      </div>
      <div>
        <h2>Page Number Position</h2>
        <select value={pageNumberPosition} onChange={(e) => setPageNumberPosition(e.target.value as any)}>
          <option value="left">Left</option>
          <option value="right">Right</option>
          <option value="outside">Outside</option>
          <option value="inside">Inside</option>
        </select>
      </div>
      <div>
        <h2>Catalog Entries</h2>
        {catalogEntries.map((entry, index) => (
          <input
            key={index}
            type="text"
            value={entry}
            onChange={(e) => handleCatalogEntryChange(index, e.target.value)}
          />
        ))}
      </div>
      <button onClick={handleSubmit}>Generate and Download</button>
    </div>
  );
};

export default App;
