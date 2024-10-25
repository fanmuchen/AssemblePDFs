import React, { useState } from 'react';
import { Button, Upload, Table, Input, Select, Checkbox, Spin, Typography, Space, Row, Col } from 'antd';
import { UploadProps } from 'antd';
import { UploadOutlined, DeleteOutlined, ArrowUpOutlined, ArrowDownOutlined } from '@ant-design/icons';
import { PDFDocument, rgb } from 'pdf-lib';
import Docxtemplater from 'docxtemplater';
import PizZip from 'pizzip';
import { saveAs } from 'file-saver';

const { Option } = Select;
const { Title, Text } = Typography;

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

  const handlePdfUpload: UploadProps['onChange'] = async ({ file }) => {
    if (file.status !== 'done') return;
    const { originFileObj } = file;
    const arrayBuffer = await originFileObj!.arrayBuffer();
    const pdfDoc = await PDFDocument.load(arrayBuffer);
    setFileData((prevData) => [
      ...prevData,
      {
        id: Date.now(),
        file: originFileObj!,
        title: originFileObj!.name.replace(/\.[^/.]+$/, ""), // Remove file extension
        pageCount: pdfDoc.getPageCount(),
      },
    ]);
  };

  const handleDocxUpload: UploadProps['onChange'] = async ({ file }) => {
    if (file.status !== 'done') return;
    const { originFileObj } = file;
    const reader = new FileReader();
    reader.onload = function(e) {
      setTemplateBuffer(e.target?.result as ArrayBuffer);
    };
    reader.readAsArrayBuffer(originFileObj!);
    setDocxTemplate(originFileObj!);
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
    <div style={{ maxWidth: '800px', margin: '0 auto', padding: '2rem' }}>
      <Title level={2} style={{ textAlign: 'center', marginBottom: '2rem' }}>PDF Merger and Catalog Generator</Title>
      
      <Space direction="vertical" style={{ width: '100%' }} size="large">
        <Upload accept='.pdf' onChange={handlePdfUpload} multiple>
          <Button icon={<UploadOutlined />}>Upload PDFs</Button>
        </Upload>
        {fileData.length > 0 && <Text type="secondary">{fileData.length} file(s) selected</Text>}

        <Upload accept=".docx" onChange={handleDocxUpload} style={{ marginBottom: '1rem' }}>
          <Button icon={<UploadOutlined />}>Upload DOCX Template</Button>
        </Upload>
        {docxTemplate && <Text type="secondary">Template selected: {docxTemplate.name}</Text>}

        <Table
          dataSource={fileData}
          pagination={false}
          rowKey="id"
          columns={[
            { title: 'Title', dataIndex: 'title', render: (text: string, record: FileData) => <Input value={text} onChange={(e) => handleTitleChange(record.id, e.target.value)} /> },
            { title: 'Pages', dataIndex: 'pageCount' },
            { title: 'Actions', render: (_, record: FileData) => (
              <Space>
                <Button icon={<ArrowUpOutlined />} onClick={() => handleMoveUp(record.id)} />
                <Button icon={<ArrowDownOutlined />} onClick={() => handleMoveDown(record.id)} />
                <Button icon={<DeleteOutlined />} onClick={() => handleDelete(record.id)} />
              </Space>
            ) }
          ]}
        />

        <Row gutter={[16, 16]}>
          <Col span={12}>
            <Select value={pageNumberPosition} onChange={(value) => setPageNumberPosition(value as any)} style={{ width: '100%' }}>
              <Option value="none">No page number</Option>
              <Option value="left">Left</Option>
              <Option value="right">Right</Option>
              <Option value="outside">Outside</Option>
              <Option value="inside">Inside</Option>
            </Select>
          </Col>
          <Col span={12}>
            <Checkbox checked={insertEmptyPages} onChange={(e) => setInsertEmptyPages(e.target.checked)}>Insert empty page after odd page count PDFs</Checkbox>
          </Col>
        </Row>

        <Checkbox checked={needContentPage} onChange={(e) => setNeedContentPage(e.target.checked)}>Generate content page</Checkbox>

        {needContentPage && (
          <Space direction="vertical" style={{ width: '100%' }}>
            <Button onClick={handleGenerateContentPage}>Generate Content Page DOCX</Button>
            <Input value={tocTitle} onChange={handleTocTitleChange} placeholder="Custom Table of Contents Title" />
            <Upload accept=".pdf" onChange={handlePdfUpload}>
              <Button icon={<UploadOutlined />}>Choose Converted Content Page PDF</Button>
            </Upload>
          </Space>
        )}

        <Button onClick={handleSubmit} disabled={isLoading} type="primary" block>
          {isLoading ? <Spin size="small" /> : 'Generate and Download Final PDF'}
        </Button>
      </Space>
    </div>
  );
};

export default App;
