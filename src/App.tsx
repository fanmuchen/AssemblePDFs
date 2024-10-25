import React, { useState } from 'react';
import { PDFDocument, rgb } from 'pdf-lib';
import Docxtemplater from 'docxtemplater';
import PizZip from 'pizzip';
import { saveAs } from 'file-saver';
import styled from 'styled-components';
import {
  Box,
  Heading,
  Text,
  FormControl,
  Select,
  TextInput,
  Button,
  Spinner,
  IconButton,
} from '@primer/react';
import { DataTable } from '@primer/react/experimental';
import { TrashIcon, ChevronUpIcon, ChevronDownIcon } from '@primer/octicons-react';

const StyledBox = styled(Box)`
  max-width: 1000px;
  margin: 0 auto;
  padding: 2rem;
`;

const FileInput = styled.input`
  display: none;
`;

const FileLabel = styled.label`
  display: inline-block;
  padding: 8px 12px;
  cursor: pointer;
  background-color: #0366d6;
  color: white;
  border-radius: 6px;
  font-size: 14px;
  &:hover {
    background-color: #0255b3;
  }
`;

interface FileData {
  id: number;
  file: File;
  title: string;
  pageCount: number;
}

const App: React.FC = () => {
  const [fileData, setFileData] = useState<FileData[]>([]);
  const [docxTemplate, setDocxTemplate] = useState<File | null>(null);
  const [pageNumberPosition, setPageNumberPosition] = useState<'left' | 'right' | 'outside' | 'inside'>('right');
  const [isLoading, setIsLoading] = useState(false);

  const handlePdfUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) {
      const files = Array.from(event.target.files);
      const newFileData = await Promise.all(files.map(async (file, index) => {
        const pdfDoc = await PDFDocument.load(await file.arrayBuffer());
        return {
          id: Date.now() + index,
          file,
          title: file.name.replace(/\.[^/.]+$/, ""), // Remove file extension
          pageCount: pdfDoc.getPageCount(),
        };
      }));
      setFileData(prevData => [...prevData, ...newFileData]);
    }
  };

  const handleDocxUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) {
      setDocxTemplate(event.target.files[0]);
    }
  };

  const handleTitleChange = (id: number, value: string) => {
    setFileData(prevData =>
      prevData.map(item =>
        item.id === id ? { ...item, title: value } : item
      )
    );
  };

  const handleDelete = (id: number) => {
    setFileData(prevData => prevData.filter(item => item.id !== id));
  };

  const handleMoveUp = (id: number) => {
    setFileData(prevData => {
      const index = prevData.findIndex(item => item.id === id);
      if (index > 0) {
        const newData = [...prevData];
        [newData[index - 1], newData[index]] = [newData[index], newData[index - 1]];
        return newData;
      }
      return prevData;
    });
  };

  const handleMoveDown = (id: number) => {
    setFileData(prevData => {
      const index = prevData.findIndex(item => item.id === id);
      if (index < prevData.length - 1) {
        const newData = [...prevData];
        [newData[index], newData[index + 1]] = [newData[index + 1], newData[index]];
        return newData;
      }
      return prevData;
    });
  };

  const mergePDFs = async () => {
    const mergedPdf = await PDFDocument.create();

    for (const data of fileData) {
      const pdfBytes = await data.file.arrayBuffer();
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
        color: rgb(0, 0, 0),
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
    setIsLoading(true);
    try {
      const mergedPdf = await mergePDFs();
      const pdfBytes = await mergedPdf.save();
      const blob = new Blob([pdfBytes], { type: 'application/pdf' });
      saveAs(blob, 'merged_document_with_catalog.pdf');
      setIsLoading(false);
    } catch (error) {
      console.error('Error generating document:', error);
      alert('An error occurred while generating the document. Please try again.');
      setIsLoading(false);
    }
  };

  return (
    <StyledBox>
      <Heading mb={4}>PDF Merger and Catalog Generator</Heading>

      <Box mb={4} display="flex" flexDirection="row" justifyContent="space-between">
        <Box width="48%">
          <Text fontWeight="bold" mb={2}>Upload PDFs</Text>
          <FileLabel>
            Choose PDF Files
            <FileInput type="file" multiple accept=".pdf" onChange={handlePdfUpload} />
          </FileLabel>
          {fileData.length > 0 && (
            <Text mt={2}>{fileData.length} file(s) selected</Text>
          )}
        </Box>

        <Box width="48%">
          <Text fontWeight="bold" mb={2}>Upload DOCX Template</Text>
          <FileLabel>
            Choose DOCX Template
            <FileInput type="file" accept=".docx" onChange={handleDocxUpload} />
          </FileLabel>
          {docxTemplate && (
            <Text mt={2}>{docxTemplate.name} selected</Text>
          )}
        </Box>
      </Box>

      {fileData.length > 0 && (
        <Box mb={4}>
          <DataTable
            aria-labelledby="uploaded-files"
            data={fileData}
            columns={[
              {
                header: 'Title',
                field: 'title',
                width: 'grow',
                renderCell: (row) => (
                  <TextInput
                    value={row.title}
                    onChange={(e) => handleTitleChange(row.id, e.target.value)}
                  />
                ),
              },
              {
                header: 'Pages',
                field: 'pageCount',
                width: 100,
              },
              {
                header: 'Actions',
                field: 'id',
                width: 150,
                renderCell: (row) => (
                  <Box display="flex" justifyContent="space-between">
                    <IconButton icon={ChevronUpIcon} aria-label="Move Up" onClick={() => handleMoveUp(row.id)} />
                    <IconButton icon={ChevronDownIcon} aria-label="Move Down" onClick={() => handleMoveDown(row.id)} />
                    <IconButton icon={TrashIcon} aria-label="Delete" onClick={() => handleDelete(row.id)} />
                  </Box>
                ),
              },
            ]}
          />
        </Box>
      )}

      <FormControl mb={4}>
        <FormControl.Label>Page Number Position</FormControl.Label>
        <Select value={pageNumberPosition} onChange={(e) => setPageNumberPosition(e.target.value as any)}>
          <Select.Option value="left">Left</Select.Option>
          <Select.Option value="right">Right</Select.Option>
          <Select.Option value="outside">Outside</Select.Option>
          <Select.Option value="inside">Inside</Select.Option>
        </Select>
      </FormControl>

      <Button onClick={handleSubmit} disabled={isLoading}>
        {isLoading ? <Spinner size="small" /> : 'Generate and Download'}
      </Button>
    </StyledBox>
  );
};

export default App;
