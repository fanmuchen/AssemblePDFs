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
  const [needContentPage, setNeedContentPage] = useState(true);
  const [pageNumberPosition, setPageNumberPosition] = useState<'left' | 'right' | 'outside' | 'inside' | 'none'>('outside');
  const [isLoading, setIsLoading] = useState(false);
  const [insertEmptyPages, setInsertEmptyPages] = useState(true);
  const [templateBuffer, setTemplateBuffer] = useState<ArrayBuffer | null>(null);
  const [tocTitle, setTocTitle] = useState('Table of Contents');

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
    const file = event.target.files ? event.target.files[0] : null;
    if (file?.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
      setDocxTemplate(file);

      // Added code to set templateBuffer
      const reader = new FileReader();
      reader.onload = function(e) {
        setTemplateBuffer(e.target?.result as ArrayBuffer);
      };
      reader.readAsArrayBuffer(file);

    } else {
      alert("Please upload a valid DOCX file.");
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

      // Insert an empty page if the PDF has an odd number of pages and insertEmptyPages is true
      if (insertEmptyPages && copiedPages.length % 2 !== 0) {
        const emptyPage = mergedPdf.addPage([pdf.getPage(0).getSize().width, pdf.getPage(0).getSize().height]);
      }
    }

    const font = await mergedPdf.embedFont('Helvetica');

    mergedPdf.getPages().forEach((page, index) => {
      if (pageNumberPosition === 'none') return;

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

    // Prepare catalog entries from fileData
    const catalogEntries = fileData.map((file, index) => ({
      title: file.title,
      page: index + 1 // Assuming sequential numbering
    }));

    const templateContent = await docxTemplate.arrayBuffer();
    const zip = new PizZip(templateContent);
    const doc = new Docxtemplater(zip, {
      paragraphLoop: true,
      linebreaks: true,
    });

    doc.render({ entries: catalogEntries }); // Use catalogEntries here

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

  const handleTemplateUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = function(e) {
        setTemplateBuffer(e.target?.result as ArrayBuffer);
      };
      reader.readAsArrayBuffer(file);
    }
  };

  const handleGenerateContentPage = async () => {
    if(!templateBuffer) {
      alert('Template buffer not loaded. Please upload a valid DOCX file.');
      return;
    }

    try {
      const zip = new PizZip(templateBuffer);
      const doc = new Docxtemplater(zip, { paragraphLoop: true });

      // Calculate page numbers taking into account empty pages
      let currentPageNumber = 1;
      const catalogEntries = fileData.map((file, index) => {
        const entry = { title: file.title, page: currentPageNumber };
        currentPageNumber += file.pageCount;
        if (insertEmptyPages && file.pageCount % 2 !== 0) {
          currentPageNumber++; // Adding an empty page if odd number of pages
        }
        return entry;
      });

      const data = {
        title: tocTitle,
        entries: catalogEntries
      };

      doc.render(data);

      const blob = doc.getZip().generate({
        type: 'blob',
        mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      });

      saveAs(blob, 'generated_document.docx');
    } catch (error) {
      console.error("Error generating content page:", error);
    }
  };

  const handleTocTitleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setTocTitle(event.target.value);
  };

  return (
    <StyledBox>
      <Heading mb={4}>PDF 合并与目录生成器</Heading> {/* PDF Merger and Catalog Generator */}

      <Box mb={4}>
        <Text fontWeight="bold" mb={2}>
          上传 PDFs <span style={{ color: 'red' }}>*</span> {/* Upload PDFs */}
        </Text>
        <FileLabel>
          选择 PDF 文件 {/* Choose PDF Files */}
          <FileInput type="file" multiple accept=".pdf" onChange={handlePdfUpload} />
        </FileLabel>
        {fileData.length > 0 && (
          <Text mt={2}>{fileData.length} 个文件已选择</Text> // 确保注释没有多余的符号 {file(s) selected}
        )}
      </Box>

      <Box mb={4}>
        <Text fontWeight="bold" mb={2}>
          上传 DOCX 模板 {/* Upload DOCX Template */}
        </Text>
        <FileLabel>
          选择 DOCX 文件 {/* Choose DOCX File */}
          <FileInput type="file" accept=".docx" onChange={handleDocxUpload} />
        </FileLabel>
        {docxTemplate && (
          <Text mt={2}>模板已选择: {docxTemplate.name}</Text> // Display message when template is chosen
        )}
      </Box>

      {fileData.length > 0 && (
        <Box mb={4}>
          <DataTable
            aria-labelledby="uploaded-files"
            data={fileData}
            columns={[
              {
                header: '标题', // 标题 represents "Title"
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
                header: '页数', // Pages
                field: 'pageCount',
                width: 100,
              },
              {
                header: '动作', // Actions
                field: 'id',
                width: 150,
                renderCell: (row) => (
                  <Box display="flex" justifyContent="space-between">
                    <IconButton icon={ChevronUpIcon} aria-label="上移" onClick={() => handleMoveUp(row.id)} /> {/* Move Up */}
                    <IconButton icon={ChevronDownIcon} aria-label="下移" onClick={() => handleMoveDown(row.id)} /> {/* Move Down */}
                    <IconButton icon={TrashIcon} aria-label="删除" onClick={() => handleDelete(row.id)} /> {/* Delete */}
                  </Box>
                ),
              },
            ]}
          />
        </Box>
      )}

      <FormControl mb={4}>
        <FormControl.Label>页码位置</FormControl.Label> {/* Page Number Position */}
        <Select value={pageNumberPosition} onChange={(e) => setPageNumberPosition(e.target.value as any)}>
          <Select.Option value="none">无页码</Select.Option> {/* No page number - 6. Move to first option */}
          <Select.Option value="left">左侧</Select.Option> {/* Left */}
          <Select.Option value="right">右侧</Select.Option> {/* Right */}
          <Select.Option value="outside">外侧</Select.Option> {/* Outside */}
          <Select.Option value="inside">内侧</Select.Option> {/* Inside */}
        </Select>
      </FormControl>

      <FormControl mb={4}>
        <FormControl.Label>
          <input
            type="checkbox"
            checked={needContentPage}
            onChange={(e) => setNeedContentPage(e.target.checked)}
          />
          {' '}生成目录页 {/* Generate content page */}
        </FormControl.Label>
      </FormControl>

      {needContentPage && (
        <>
          <Button onClick={handleGenerateContentPage}>
            生成目录页 DOCX {/* Generate Content Page DOCX */}
          </Button>

          <Box mt={4} mb={4}>
            <Text fontWeight="bold" mb={2}>
              将下载的目录页 DOCX 转换为 PDF 后，在此处上传 PDF：{/* Instructions: How to handle content page */}
            </Text>
            <FileLabel>
              选择转换后的目录页 PDF {/* Choose Converted Content Page PDF */}
              <FileInput type="file" accept=".pdf" onChange={handlePdfUpload} />
            </FileLabel>
          </Box>
        </>
      )}

      <FormControl mb={4}>
        <FormControl.Label>
          <input
            type="checkbox"
            checked={insertEmptyPages}
            onChange={(e) => setInsertEmptyPages(e.target.checked)}
          />
          {' '}在页数为奇数的 PDF 后插入空白页 {/* Insert empty page after PDFs with odd page numbers */}
        </FormControl.Label>
      </FormControl>

      {fileData.length > 0 && (
        <FormControl mb={4}>
          <FormControl.Label>
            自定义目录标题 {/* Custom Table of Contents Title */}
          </FormControl.Label>
          <TextInput value={tocTitle} onChange={handleTocTitleChange} />
        </FormControl>
      )}

      <Button onClick={handleSubmit} disabled={isLoading}>
        {isLoading ? <Spinner size="small" /> : '生成并下载最终 PDF'} {/* Generate and Download Final PDF */}
      </Button>
    </StyledBox>
  );
};

export default App;
